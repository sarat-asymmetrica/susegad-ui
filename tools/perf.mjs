// The perf probe: frame times, long tasks and JS bytes, with Paus as the baseline.
//
//   node tools/perf.mjs --scene kolam [--seconds 6] [--register warm] [--seed 3] [--param k=v]
//   node tools/perf.mjs --url /apps/docs/index.html
//
//   --seconds N       measuring time per target (default 6), split across --rounds
//   --rounds N        the target and the baseline alternate this many times (default 2),
//                     so a burst of machine load lands on both rather than one
//   --baseline NAME   baseline scene (default paus once packages/scenes/paus exists); "none" to skip
//   --phone           390 px, 3x, touch (default 1280 px desktop at 1x)
//   --uncapped        launch Chromium without the vsync frame cap, so frame time is the cost of
//                     a frame rather than 16.7 ms for anything that fits in one
//   --json            print the result as JSON
//
// Frame time is from requestAnimationFrame deltas after the target is ready. Dropped frames
// count whole missed vsync intervals. Long tasks come from PerformanceObserver. JS bytes are the
// body sizes of every .js / .mjs the page loaded, grouped by folder so each piece's own weight shows.
// Headless Chromium renders WebGL on the CPU (SwiftShader), so absolute numbers say little about a
// real device; the ratio to the baseline, measured in the same run, is the number to read.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { TARGET_SPEC, FIXTURES, targetFrom } from './lib/target.mjs';
import { session, openTarget, waitReady, errorCount, PHONE, DESKTOP } from './lib/browser.mjs';
import { frameStats, bytesByFolder, baselineRatio, fmtMs, fmtKB } from './lib/stats.mjs';
import { REPO_ROOT } from './serve.mjs';

const SPEC = { ...TARGET_SPEC, seconds: 'number', rounds: 'number', baseline: 'string', phone: 'bool', uncapped: 'bool', json: 'bool' };
let parsed;
try { parsed = parseArgs(process.argv.slice(2), SPEC, { seconds: 6, rounds: 2 }); }
catch (e) { console.error(e.message); process.exit(2); }
const { opts, positional } = parsed;
let target;
try { target = targetFrom(opts, positional); } catch (e) { console.error(e.message); process.exit(2); }
if (target.noJs) { console.error('--no-js: perf measures animation frames, and nothing animates without JavaScript'); process.exit(2); }
if (!target.scene && !target.url) { console.error('usage: node tools/perf.mjs --scene <name> | --url <path>'); process.exit(2); }

const pausExists = fs.existsSync(path.join(REPO_ROOT, 'packages/scenes/paus/index.js'));
let baselineName = opts.baseline ?? (pausExists ? 'paus' : null);
let baselineStatus;
if (opts.baseline === 'none') { baselineName = null; baselineStatus = 'skipped (--baseline none)'; }
else if (!baselineName) baselineStatus = 'baseline not available: packages/scenes/paus/index.js does not exist yet';
else if (!FIXTURES[baselineName] && !fs.existsSync(path.join(REPO_ROOT, `packages/scenes/${baselineName}/index.js`))) {
  baselineStatus = `baseline not available: packages/scenes/${baselineName}/index.js does not exist`;
  baselineName = null;
}
const baseline = baselineName ? { scene: baselineName, register: target.register, theme: target.theme, params: {} } : null;

const view = opts.phone ? PHONE : DESKTOP;
const rounds = Math.max(1, Math.round(opts.rounds));
const perRound = opts.seconds / rounds;
const launchArgs = opts.uncapped ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [];

function cpuTimes() {
  return os.cpus().reduce((a, c) => {
    const t = c.times;
    a.busy += t.user + t.nice + t.sys + t.irq; a.total += t.user + t.nice + t.sys + t.irq + t.idle;
    return a;
  }, { busy: 0, total: 0 });
}

async function measureOnce(s, t) {
  const { context, page, log } = await openTarget(s, t, view);
  try {
    const ready = await waitReady(page, t);
    if (!ready.ok) return { ready, frames: [], longTasks: [], scripts: [], errors: errorCount(log), log };
    await page.evaluate(() => {
      window.__perf = { frames: [], longTasks: [] };
      try {
        new PerformanceObserver(list => {
          for (const e of list.getEntries()) window.__perf.longTasks.push(e.duration);
        }).observe({ type: 'longtask' });
      } catch { window.__perf.noLongTask = true; }
      let prev = -1;
      const tick = now => { if (prev >= 0) window.__perf.frames.push(now - prev); prev = now; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await page.waitForTimeout(perRound * 1000);
    const r = await page.evaluate(() => ({
      frames: window.__perf.frames.slice(2),
      longTasks: window.__perf.longTasks,
      scripts: performance.getEntriesByType('resource')
        .filter(e => /\.m?js$/.test(new URL(e.name).pathname))
        .map(e => ({ path: new URL(e.name).pathname, bytes: e.encodedBodySize || e.decodedBodySize || 0 })),
    }));
    return { ready, ...r, errors: errorCount(log), log };
  } finally {
    await context.close();
  }
}

function summarise(runs) {
  const frames = runs.flatMap(r => r.frames);
  const longTasks = runs.flatMap(r => r.longTasks);
  const scripts = runs.find(r => r.scripts?.length)?.scripts ?? [];
  const st = frameStats(frames);
  return {
    ready: runs.every(r => r.ready.ok),
    notReady: runs.find(r => !r.ready.ok)?.ready.reason,
    frames: st,
    longTasks: { count: longTasks.length, total: longTasks.reduce((a, b) => a + b, 0), worst: longTasks.length ? Math.max(...longTasks) : 0 },
    jsBytes: { total: scripts.reduce((a, b) => a + b.bytes, 0), files: scripts.length, byFolder: bytesByFolder(scripts) },
    errors: runs.reduce((a, r) => a + r.errors, 0),
    errorLines: [...new Set(runs.flatMap(r => [...r.log.consoleErrors, ...r.log.pageErrors, ...r.log.failedRequests]))],
  };
}

const s = await session({ args: launchArgs });
const cpu0 = cpuTimes();
const tRuns = [], bRuns = [];
try {
  for (let i = 0; i < rounds; i++) {
    // Alternate which goes first so neither always gets the warmer browser.
    const order = i % 2 ? [[baseline, bRuns], [target, tRuns]] : [[target, tRuns], [baseline, bRuns]];
    for (const [t, into] of order) if (t) into.push(await measureOnce(s, t));
  }
} finally {
  await s.done();
}
const cpu1 = cpuTimes();
const machine = {
  cpus: os.cpus().length,
  cpuModel: os.cpus()[0]?.model?.trim(),
  busyPercent: Math.round((100 * (cpu1.busy - cpu0.busy)) / Math.max(1, cpu1.total - cpu0.total)),
  freeMemGB: +(os.freemem() / 2 ** 30).toFixed(1),
  platform: `${os.platform()} ${os.release()}`,
};

const result = {
  target: target.scene ? { scene: target.scene, register: target.register ?? 'warm', seed: target.seed ?? null, params: target.params } : { url: target.url },
  environment: `headless Chromium ${s.version}, CPU-rendered WebGL (SwiftShader), ${opts.uncapped ? 'vsync cap off' : 'vsync-capped at 60 Hz'}, ${view === PHONE ? 'phone 390 px 3x' : 'desktop 1280 px 1x'}`,
  machine,
  seconds: opts.seconds, rounds,
  measured: summarise(tRuns),
  baseline: baseline ? { scene: baseline.scene, ...summarise(bRuns) } : { status: baselineStatus },
};
if (baseline) {
  const b = result.baseline, m = result.measured;
  result.ratio = { mean: baselineRatio(m.frames.mean, b.frames.mean), p95: baselineRatio(m.frames.p95, b.frames.p95) };
}

if (opts.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const line = (label, r) => {
    const f = r.frames;
    console.log(`${label.padEnd(16)} mean ${fmtMs(f.mean)}  p95 ${fmtMs(f.p95)}  worst ${fmtMs(f.worst)}  frames ${f.count}  dropped ${f.dropped}  long tasks ${r.longTasks.count} (${fmtMs(r.longTasks.total)} total)  JS ${fmtKB(r.jsBytes.total)} in ${r.jsBytes.files} files${r.ready ? '' : `  NOT READY (${r.notReady})`}${r.errors ? `  ${r.errors} error(s)` : ''}`);
  };
  console.log(result.environment);
  console.log(`machine: ${machine.cpus} x ${machine.cpuModel}, ${machine.busyPercent}% CPU busy during the run, ${machine.freeMemGB} GB free`);
  console.log(`${opts.seconds} s per target over ${rounds} alternating round(s)\n`);
  line(target.scene || target.url, result.measured);
  if (baseline) {
    line(`${baseline.scene} (base)`, result.baseline);
    const { mean, p95 } = result.ratio;
    console.log(`\nratio to baseline: mean ${mean.ratio.toFixed(2)}x, p95 ${p95.ratio.toFixed(2)}x  ${mean.within ? 'within' : 'OVER'} the 10% budget`);
    if (!opts.uncapped && result.measured.frames.mean < 17.5 && result.baseline.frames.mean < 17.5) {
      console.log('both hold 60 fps under the vsync cap, so the ratio only says neither drops frames; --uncapped compares the cost per frame');
    }
  } else {
    console.log(`\n${baselineStatus}`);
  }
  console.log('\nJS bytes by folder:');
  for (const g of result.measured.jsBytes.byFolder) console.log(`  ${fmtKB(g.bytes).padStart(9)}  ${String(g.files).padStart(3)} files  ${g.folder}`);
  for (const e of result.measured.errorLines) console.log(`  error: ${e}`);
}
const bad = !result.measured.ready || result.measured.errors || (baseline && !result.baseline.ready);
process.exit(bad ? 1 : 0);
