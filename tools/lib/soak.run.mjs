// The soak's browser side: open the target the way a kiosk would, then sample it on a timer for as long as the mode says.
// Everything that decides anything is in soak.core.js; this file only measures.
//
// Per sample (every `interval` seconds):
//   frames       requestAnimationFrame deltas since the last sample, summarised with stats.mjs (count, mean, p95)
//   long tasks   PerformanceObserver 'longtask' entries since the last sample
//   canvases     every <canvas> in the page, its shadow roots and its same-origin iframes, and their megapixels
//   DOM counters CDP Memory.getDOMCounters: nodes (detached ones too), documents, JS event listeners
//   heap         CDP Performance.getMetrics JSHeapUsedSize after two forced collections (HeapProfiler.collectGarbage)
//   CPU busy     the whole machine, over the interval just ended (os.cpus, as smoke.mjs does)
// The frame window is drained before the collection, so the pause of the collection itself is not in the next window's frames.
// Chromium only: the counters and the forced collection are CDP.

import os from 'node:os';
import { session, openTarget, waitReady } from './browser.mjs';
import { engineName } from './engine.mjs';
import { frameStats } from './stats.mjs';
import { evaluate } from './soak.core.js';

const INSTALL = `(() => {
  if (window.__soak) return;
  const s = window.__soak = { deltas: [], long: 0 };
  let last = performance.now();
  const tick = now => { s.deltas.push(now - last); if (s.deltas.length > 20000) s.deltas.shift(); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver(l => { s.long += l.getEntries().length; }).observe({ entryTypes: ['longtask'] }); } catch {}
})()`;

/** Page side: drain the frame window and count live canvases through shadow roots and same-origin frames. */
const DRAIN = `(() => {
  const s = window.__soak, deltas = s.deltas.splice(0), long = s.long; s.long = 0;
  let canvases = 0, px = 0;
  const walk = root => {
    for (const c of root.querySelectorAll('canvas')) { canvases++; px += c.width * c.height; }
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
    for (const fr of root.querySelectorAll('iframe')) { try { if (fr.contentDocument) walk(fr.contentDocument); } catch {} }
  };
  walk(document);
  const pl = window.__playlist;
  return { deltas, long, canvases, mpx: px / 1e6, mounts: pl ? pl.mounts : 0, unmounts: pl ? pl.unmounts : 0, current: pl ? pl.current : null };
})()`;

const cpuTimes = () => os.cpus().reduce((a, c) => { const t = c.times; a.busy += t.user + t.nice + t.sys + t.irq; a.total += t.user + t.nice + t.sys + t.irq + t.idle; return a; }, { busy: 0, total: 0 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * @param {object} o
 * @param {object} o.target a target (target.mjs): a scene or a --url page (the playlist host is one)
 * @param {{ width: number, height: number, dpr: number }} o.view
 * @param {number} o.seconds @param {number} o.interval @param {number} o.warmup
 * @param {(line: string, sample: object) => void} [o.onSample]
 */
export async function runSoak({ target, view, seconds, interval, warmup, onSample = () => {} }) {
  if (engineName() !== 'chromium') throw new Error('the soak reads CDP counters and forces collections; it runs in Chromium only (unset SG_ENGINE)');
  const s = await session({ args: ['--enable-precise-memory-info'] });
  const samples = [], problems = [];
  let log, context, crashes = 0;
  try {
    const opened = await openTarget(s, target, view);
    const { page } = opened;
    ({ context, log } = opened);
    page.on('crash', () => { crashes++; problems.push('PAGE CRASHED'); });
    const ready = await waitReady(page, target, { timeout: 30000 });
    if (!ready.ok) throw new Error(`target not ready: ${ready.reason}`);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.evaluate(INSTALL);
    const t0 = Date.now();
    let c0 = cpuTimes();
    const n = Math.floor(seconds / interval);
    for (let i = 1; i <= n; i++) {
      const wait = t0 + i * interval * 1000 - Date.now();
      if (wait > 0) await sleep(wait);
      const c1 = cpuTimes();
      const cpuBusy = (100 * (c1.busy - c0.busy)) / Math.max(1, c1.total - c0.total); c0 = c1;
      try {
        const pg = await page.evaluate(DRAIN);
        const dom = await cdp.send('Memory.getDOMCounters');
        await cdp.send('HeapProfiler.collectGarbage');
        await cdp.send('HeapProfiler.collectGarbage');
        const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
        const fs = frameStats(pg.deltas);
        const sample = {
          t: Math.round((Date.now() - t0) / 100) / 10, heapMB: metrics.JSHeapUsedSize / 1048576, nodes: dom.nodes, docs: dom.documents,
          listeners: dom.jsEventListeners, canvases: pg.canvases, canvasMpx: pg.mpx, longTasks: pg.long,
          frames: { count: fs.count, mean: fs.mean, p95: fs.p95 }, cpuBusy, mounts: pg.mounts, unmounts: pg.unmounts,
        };
        samples.push(sample);
        onSample(`${String(sample.t).padStart(7)} s  heap ${sample.heapMB.toFixed(2)} MB  nodes ${sample.nodes}  docs ${sample.docs}  listeners ${sample.listeners}  canvas ${sample.canvases} (${sample.canvasMpx.toFixed(2)} Mpx)  p95 ${fs.p95.toFixed(1)} ms (mean ${fs.mean.toFixed(1)}, ${fs.count} frames)  long ${pg.long}  cpu ${cpuBusy.toFixed(0)}%${pg.current ? `  mounts ${pg.mounts}` : ''}`, sample);
      } catch (e) {
        problems.push(`sample ${i}: ${e.message}`);
        if (crashes) break;
      }
    }
    const errors = [
      ...log.consoleErrors.map(m => 'console: ' + m), ...log.pageErrors.map(m => 'pageerror: ' + m),
      ...log.failedRequests.map(m => 'request: ' + m), ...problems,
    ];
    const verdict = evaluate(samples, { warmup, errors });
    return { samples, errors, verdict, crashes, browser: s.version, mounts: samples.at(-1)?.mounts ?? 0, unmounts: samples.at(-1)?.unmounts ?? 0 };
  } finally {
    await s.done();
  }
}
