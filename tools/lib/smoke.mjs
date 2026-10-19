// The smoke tier's browser half: one browser (through a machine slot), one server, a fresh context
// for every pass of every page. The decisions are pure and live in smoke.core.js.
//
//   const { results, seconds } = await runSmoke({ pages, jobs: 3 });
//
// Per page, in order:
//   desktop (1280 px)  loads with no console error, page error, failed request or third-party request;
//                      a page with a scene waits for its first painted frame; axe, WCAG 2.2 AA, once, in the page's
//                      default theme and register (the matrix does the other cells)
//                      a page with a scene is watched for scenes added late until 4 s after load and 1.5 s since the last one; a scene
//                      inside a closed <details> is opened after axe, held to sg-ready, and not axe'd in its open state
//   phone (390 px)     the same error watch, and no sideways scroll (tools/lib/overflow.mjs)
//   reduced (optional) desktop again with prefers-reduced-motion: reduce, errors only
//   forced (optional)  desktop again with forced colours (Chromium): errors, axe, and what the page keeps visible
//   Behind flags, on the desktop pass (a11y.core.js says what each judges): the accessibility tree against its baseline,
//   contrast of text over a canvas, axe in every register and theme, axe on the open states.

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from '../serve.mjs';
import { acquireSlot } from './slots.mjs';
import { contextOptions, engineName, launchArgs, pickEngine } from './engine.mjs';
import { waitReady, PHONE, DESKTOP } from './browser.mjs';
import { sidewaysScroll } from './overflow.mjs';
import { axeLine, failuresOf, requestFailureCounts } from './smoke.core.js';
import { axeCells, contrastPass, forcedPass, openActionsFor, openPass, treePass } from './a11y.mjs';

const require = createRequire(import.meta.url);
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// SG_SMOKE_PAGE_MS and SG_SMOKE_SCENE_MS shorten the two waits so smoke.check.mjs can plant a hang and a scene that never paints.
const PAGE_LIMIT_MS = Number(process.env.SG_SMOKE_PAGE_MS) || 60000;
const SCENE_READY_MS = Number(process.env.SG_SMOKE_SCENE_MS) || 15000; // a healthy scene paints in under a second; Toran missed 8 s at 82% CPU busy

let axeSource;
const loadAxe = async () => (axeSource ??= await readFile(require.resolve('axe-core/axe.min.js'), 'utf8'));

/**
 * axe on the page as it stands, as "rule (n: selectors)" lines. `skip` names rules to leave out; the forced-colours pass skips
 * color-contrast, because there the browser paints its own colours and axe reads the author's.
 */
async function runAxe(page, { skip = [] } = {}) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: await loadAxe() });
  const violations = await page.evaluate(async ({ tags, skip }) => (await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, rules: Object.fromEntries(skip.map(id => [id, { enabled: false }])), resultTypes: ['violations'] })).violations
    .map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target })) })), { tags: WCAG_TAGS, skip });
  return violations.map(axeLine);
}

const SETTLE_MS = 300;
// A page that has a scene is watched until this long after navigation, and until no scene has been added for SCENE_QUIET_MS:
// a scene behind a fetch or a lazy loader arrives late, and a blank hole there is what the tier exists to catch. Not shortened
// by SG_SMOKE_SCENE_MS (that is how long an unpainted scene is waited for, on top). A page that never had a scene is not held.
const SCENE_WATCH_MS = 4000;
const SCENE_QUIET_MS = 1500;

/** Runs in the page: the visible sg-scenes that have not fired sg-ready, the hidden ones, and whether the page has stopped adding scenes. */
const sceneState = (watchMs, quietMs) => {
  const label = el => el.getAttribute('name') || el.id || 'sg-scene';
  const all = [...document.querySelectorAll('sg-scene')];
  const visible = all.filter(el => el.checkVisibility());
  const now = performance.now();
  const quiet = !window.__smokeScenes || (now >= watchMs && now - window.__smokeLastAdd >= quietMs);
  return { unpainted: visible.filter(el => !window.__smokeSeen.has(el)).map(label), hidden: all.filter(el => !el.checkVisibility()).map(label), quiet };
};

/**
 * Wait for every visible scene to paint (asked afresh each poll, so a scene added meanwhile joins) and for the page to stop
 * adding scenes (the in-page observer in pass() notes each insertion), then record who did not paint.
 */
async function expectScenes(page, record, { watch = SCENE_WATCH_MS, quiet = SCENE_QUIET_MS } = {}) {
  const state = `(${sceneState})(${watch}, ${quiet})`;
  await page.waitForFunction(`(s => s.unpainted.length === 0 && s.quiet)(${state})`, null, { timeout: SCENE_READY_MS + watch }).catch(() => {});
  const { unpainted, hidden } = await page.evaluate(state);
  if (unpainted.length && !record.notReady) record.notReady = `no sg-ready within ${(SCENE_READY_MS + SCENE_WATCH_MS) / 1000} s of load from ${unpainted.length} visible scene(s): ${unpainted.join(', ')}`;
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
async function pass(browser, engine, base, path, view, { reduced = false, forced = false, work } = {}) {
  const context = await browser.newContext(contextOptions(engine, {
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: view.dpr,
    hasTouch: view.touch,
    isMobile: view.touch,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    ...(forced ? { forcedColors: 'active' } : {}),
  }));
  try {
    // sg-ready bubbles from every scene: count them so a page's scenes can be waited for.
    // and note when a sg-scene is added (the parser's, a script's or a loader's), so expectScenes can tell a page still adding scenes from a finished one.
    await context.addInitScript(`window.__smokeSeen = new WeakSet(); window.__smokeScenes = false; window.__smokeLastAdd = 0;
      document.addEventListener('sg-ready', e => { window.__smokeSeen.add(e.composedPath()[0]); }, { capture: true });
      const note = n => { if (n.nodeType === 1 && (n.localName === 'sg-scene' || n.querySelector('sg-scene'))) { window.__smokeScenes = true; window.__smokeLastAdd = performance.now(); } };
      new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) note(n); }).observe(document, { childList: true, subtree: true });`);
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

/** Run one accessibility pass; a pass that throws is recorded as its own failure, never as a pass. */
async function guarded(record, errorKey, label, fn) {
  try { return await fn(); } catch (e) { record[errorKey] = `${label} could not run: ${String(e.message || e).split('\n')[0]}`; return undefined; }
}

async function onePage(browser, engine, base, p, { reduced, axeOn, a11y = {} }) {
  const seen = {};
  seen.desktop = await pass(browser, engine, base, p.path, DESKTOP, {
    work: async (page, record) => {
      // Every sg-scene the page has once it has settled, and any added later, must have fired sg-ready, one by one
      // (a scene that never paints is a blank hole; one painted scene does not vouch for its neighbour). A scene hidden
      // by design (the event template's pahat waits behind `hidden`) is not waited for and is listed, never passed in silence.
      await page.waitForTimeout(SETTLE_MS);
      await expectScenes(page, record);
      if (axeOn) {
        try { record.axe = await runAxe(page); } catch (e) { record.axeError = `axe could not run: ${String(e.message || e).split('\n')[0]}`; }
        // after axe (late scenes have had time to arrive)
        await expectScenes(page, record);
      }
      // the accessibility passes see the page as it loads, before <details> are opened or a state is entered
      if (a11y.tree) record.tree = await guarded(record, 'treeError', 'the accessibility tree', () => treePass(page, p.path, { record: a11y.record, baseline: engine === 'chromium' }));
      if (a11y.contrast) record.contrast = await guarded(record, 'contrastError', 'the contrast pass', () => contrastPass(page));
      if (a11y.registers) {
        const cells = await guarded(record, 'cellsError', 'the register pass', () => axeCells(page, runAxe));
        if (cells) record.cells = cells;
      }
      if (a11y.open) {
        const actions = await openActionsFor(page, p.path);
        if (actions.length) {
          const o = await guarded(record, 'openError', 'the open-state pass', () => openPass(page, actions, runAxe));
          if (o) { record.opens = o.opens; record.opensReached = o.reached; if (o.errors.length) record.openErrors = o.errors; }
        }
      }
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
  // forced colours is Chromium's emulation (Playwright's forcedColors does nothing in WebKit and Firefox), so the pass is Chromium's
  if (a11y.forced && engine === 'chromium') {
    seen.forced = await pass(browser, engine, base, p.path, DESKTOP, {
      forced: true,
      work: async (page, record) => {
        await page.waitForTimeout(SETTLE_MS);
        await expectScenes(page, {}, { watch: 0, quiet: 0 }); // a scene labels its stage when it paints, so judge it after; the desktop pass already watched for late scenes
        if (axeOn) { try { record.axe = await runAxe(page,{ skip: ['color-contrast'] }); } catch (e) { record.axeError = String(e.message || e).split('\n')[0]; } }
        const j = await guarded(record, 'factsError', 'the forced-colours pass', () => forcedPass(page, p.path));
        if (j) { record.problems = j.problems; record.exempted = j.exempted; record.counts = { controls: j.controls, texts: j.texts }; }
      },
    });
  }
  return { ...p, failures: failuresOf(seen), notChecked: seen.desktop.hidden ?? [], a11y: summaryOf(seen, a11y) };
}

/** What the accessibility passes saw, for the JSON result and the run's summary lines (not only what failed). */
export function summaryOf(seen, a11y) {
  const d = seen.desktop, out = {};
  if (d.tree) out.tree = { counts: d.tree.counts, exempted: d.tree.exempted, masked: d.tree.masked, recorded: d.tree.recorded, compared: d.tree.compared };
  if (d.contrast) out.contrast = { canvases: d.contrast.canvases, boxes: d.contrast.boxes, found: d.contrast.found, worst: d.contrast.worst };
  if (a11y.registers) out.registers = { cells: 6, failing: Object.entries(d.cells ?? {}).filter(([, lines]) => lines.some(l => !(d.axe ?? []).includes(l))).map(([cell]) => cell) };
  if (d.opensReached) out.open = { reached: d.opensReached };
  if (seen.forced?.counts) out.forced = { ...seen.forced.counts, exempted: seen.forced.exempted };
  return Object.keys(out).length ? out : undefined;
}

/**
 * @param {{ pages: { path: string, item: string, type: string }[], jobs?: number, reduced?: boolean, axe?: boolean,
 *   a11y?: { tree?: boolean, record?: boolean, contrast?: boolean, forced?: boolean, registers?: boolean, open?: boolean },
 *   engine?: string, root?: string, onResult?: (r: object, done: number, total: number) => void }} opts
 * @returns {Promise<{ results: object[], seconds: number, engine: string, browser: string }>}
 */
export async function runSmoke({ pages, jobs = 3, reduced = false, axe = true, a11y = {}, engine: wanted, root, onResult }) {
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
          results[i] = await Promise.race([onePage(browser, engine, server.url, p, { reduced, axeOn: axe, a11y }), limit]);
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
