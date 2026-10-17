// The smoke tier's browser half: one browser (through a machine slot), one server, a fresh context
// for every pass of every page. The decisions are pure and live in smoke.core.js.
//
//   const { results, seconds } = await runSmoke({ pages, jobs: 3 });
//
// Per page, in order:
//   desktop (1280 px)  loads with no console error, page error, failed request or third-party request;
//                      a page with a scene waits for its first painted frame; axe, WCAG 2.2 AA, once, in the page's
//                      default theme and register (the matrix does the other cells)
//   phone (390 px)     the same error watch, and no sideways scroll (tools/lib/overflow.mjs)
//   reduced (optional) desktop again with prefers-reduced-motion: reduce, errors only

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from '../serve.mjs';
import { acquireSlot } from './slots.mjs';
import { contextOptions, engineName, launchArgs, pickEngine } from './engine.mjs';
import { waitReady, PHONE, DESKTOP } from './browser.mjs';
import { sidewaysScroll } from './overflow.mjs';
import { axeLine, failuresOf, requestFailureCounts } from './smoke.core.js';

const require = createRequire(import.meta.url);
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// SG_SMOKE_PAGE_MS and SG_SMOKE_SCENE_MS shorten the two waits so smoke.check.mjs can plant a hang and a scene that never paints.
const PAGE_LIMIT_MS = Number(process.env.SG_SMOKE_PAGE_MS) || 60000;
const SCENE_READY_MS = Number(process.env.SG_SMOKE_SCENE_MS) || 15000; // a healthy scene paints in under a second; Toran missed 8 s at 82% CPU busy

let axeSource;
const loadAxe = async () => (axeSource ??= await readFile(require.resolve('axe-core/axe.min.js'), 'utf8'));

const SETTLE_MS = 300; // a scene a script adds just after load is in the page by now; the check after axe catches slower ones

/** Runs in the page: the visible sg-scenes that have not fired sg-ready, and the hidden ones. */
const sceneState = () => {
  const label = el => el.getAttribute('name') || el.id || 'sg-scene';
  const all = [...document.querySelectorAll('sg-scene')];
  const visible = all.filter(el => el.checkVisibility());
  return { unpainted: visible.filter(el => !window.__smokeSeen.has(el)).map(label), hidden: all.filter(el => !el.checkVisibility()).map(label) };
};

/** Wait for every visible scene to paint (asked afresh each poll, so a scene added meanwhile joins), then record who did not. */
async function expectScenes(page, record) {
  await page.waitForFunction(`(${sceneState})().unpainted.length === 0`, null, { timeout: SCENE_READY_MS }).catch(() => {});
  const { unpainted, hidden } = await page.evaluate(`(${sceneState})()`);
  if (unpainted.length && !record.notReady) record.notReady = `no sg-ready within ${SCENE_READY_MS / 1000} s from ${unpainted.length} visible scene(s): ${unpainted.join(', ')}`;
  record.hidden = hidden;
}

/** A scene in a closed <details> is hidden until opened: open them (after axe saw the page as it loads) and hold those scenes to the same rule. */
async function openDetails(page, record) {
  const opened = await page.evaluate(() => {
    const closed = [...document.querySelectorAll('details:not([open])')].filter(d => d.querySelector('sg-scene'));
    for (const d of closed) d.open = true;
    return closed.length;
  });
  if (!opened) return;
  await page.waitForTimeout(SETTLE_MS);
  const before = record.notReady;
  await expectScenes(page, record);
  if (record.notReady && record.notReady !== before) record.notReady += ' (after opening <details>)';
}

/** Open one pass of one page in a context of its own; returns what it saw. `work(page, errors)` adds to the record. */
async function pass(browser, engine, base, path, view, { reduced = false, work } = {}) {
  const context = await browser.newContext(contextOptions(engine, {
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: view.dpr,
    hasTouch: view.touch,
    isMobile: view.touch,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  }));
  try {
    // sg-ready bubbles from every scene: count them so a page's scenes can be waited for.
    await context.addInitScript("window.__smokeSeen = new WeakSet(); document.addEventListener('sg-ready', e => { window.__smokeSeen.add(e.composedPath()[0]); }, { capture: true });");
    const page = await context.newPage();
    const errors = [];
    const failedPaths = new Set();
    // a failed load logs "Failed to load resource" without its path; the response listener below names the path
    page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource: the server responded with a status of \d+/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push(`page error: ${e.message}`));
    page.on('requestfailed', r => {
      const why = r.failure()?.errorText ?? 'no reason given';
      if (requestFailureCounts(why, r.resourceType()) && !failedPaths.has(r.url())) errors.push(`request failed ${new URL(r.url()).pathname} (${why})`);
    });
    page.on('response', r => {
      if (r.status() >= 400) { failedPaths.add(r.url()); errors.push(`${r.status()} ${new URL(r.url()).pathname}`); }
    });
    page.on('request', r => { if (!/^(data|blob):/.test(r.url()) && !r.url().startsWith(base)) errors.push(`third-party request ${r.url()}`); });
    const record = { errors };
    try {
      await page.goto(base + path, { waitUntil: 'load', timeout: 25000 });
      const ready = await waitReady(page, { url: path }, { timeout: 12000 });
      if (!ready.ok) record.notReady = ready.reason;
      await work?.(page, record);
    } catch (e) {
      errors.push(`navigation failed: ${String(e.message || e).split('\n')[0]}`);
    }
    return record;
  } finally {
    await context.close().catch(() => {});
  }
}

async function onePage(browser, engine, base, p, { reduced, axeOn }) {
  const seen = {};
  seen.desktop = await pass(browser, engine, base, p.path, DESKTOP, {
    work: async (page, record) => {
      // Every sg-scene the page has once it has settled, and any added later, must have fired sg-ready, one by one
      // (a scene that never paints is a blank hole; one painted scene does not vouch for its neighbour). A scene hidden
      // by design (the event template's pahat waits behind `hidden`) is not waited for and is listed, never passed in silence.
      await page.waitForTimeout(SETTLE_MS);
      await expectScenes(page, record);
      if (!axeOn) { await openDetails(page, record); return; }
      try {
        await page.addScriptTag({ content: await loadAxe() });
        const violations = await page.evaluate(async tags => (await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] })).violations
          .map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target })) })), WCAG_TAGS);
        record.axe = violations.map(axeLine);
      } catch (e) {
        record.axeError = `axe could not run: ${String(e.message || e).split('\n')[0]}`;
      }
      // after axe (late scenes have had time to arrive), and with the closed <details> opened
      await expectScenes(page, record);
      await openDetails(page, record);
    },
  });
  seen.phone = await pass(browser, engine, base, p.path, PHONE, {
    work: async (page, record) => {
      const o = await sidewaysScroll(page, PHONE.width);
      record.overflow = o.overflow;
      record.clipped = o.clipped;
      record.metaViewport = o.metaViewport;
    },
  });
  if (reduced) seen.reduced = await pass(browser, engine, base, p.path, DESKTOP, { reduced: true });
  return { ...p, failures: failuresOf(seen), notChecked: seen.desktop.hidden ?? [] };
}

/**
 * @param {{ pages: { path: string, item: string, type: string }[], jobs?: number, reduced?: boolean, axe?: boolean,
 *   engine?: string, root?: string, onResult?: (r: object, done: number, total: number) => void }} opts
 * @returns {Promise<{ results: object[], seconds: number, engine: string, browser: string }>}
 */
export async function runSmoke({ pages, jobs = 3, reduced = false, axe = true, engine: wanted, root, onResult }) {
  const t0 = Date.now();
  const engine = engineName(wanted);
  const release = await acquireSlot({ label: 'smoke' });
  let server, browser;
  try {
    server = await startServer({ quiet: true, ...(root ? { root } : {}) });
    browser = await pickEngine(engine).launch({ headless: true, args: launchArgs(engine, []) });
    const results = new Array(pages.length);
    let next = 0, done = 0;
    const worker = async () => {
      while (next < pages.length) {
        const i = next++;
        const p = pages[i];
        let timer;
        const limit = new Promise(r => { timer = setTimeout(() => r({ ...p, failures: [{ kind: 'timeout', message: `the page's passes did not finish in ${PAGE_LIMIT_MS / 1000} s` }] }), PAGE_LIMIT_MS); });
        try {
          results[i] = await Promise.race([onePage(browser, engine, server.url, p, { reduced, axeOn: axe }), limit]);
        } catch (e) {
          results[i] = { ...p, failures: [{ kind: 'crash', message: String(e.message || e).split('\n')[0] }] };
        } finally { clearTimeout(timer); }
        onResult?.(results[i], ++done, pages.length);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, pages.length)) }, worker));
    return { results, seconds: (Date.now() - t0) / 1000, engine, browser: `${engine} ${browser.version()}` };
  } finally {
    // Playwright's close can block for good under load; give it a few seconds, then leave it to process exit.
    await Promise.race([Promise.allSettled([browser?.close(), server?.close?.()]), new Promise(r => setTimeout(r, 8000).unref())]);
    release();
  }
}
