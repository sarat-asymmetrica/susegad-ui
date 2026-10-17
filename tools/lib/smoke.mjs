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
    await context.addInitScript("window.__smokeReady = 0; document.addEventListener('sg-ready', () => { window.__smokeReady++; }, { capture: true });");
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
      // any page that mounts a scene (a recipe or a component demo too): its first painted frame is the page being ready
      // a hidden scene (the event template's pahat waits behind `hidden`) paints nothing until revealed, so it is not waited for
      if (await page.evaluate(() => [...document.querySelectorAll('sg-scene')].some(el => el.checkVisibility()))) {
        const painted = await page.waitForFunction(() => window.__smokeReady > 0, null, { timeout: SCENE_READY_MS }).then(() => true, () => false);
        if (!painted) record.notReady = `no scene fired sg-ready within ${SCENE_READY_MS / 1000} s`;
      }
      if (!axeOn) return;
      try {
        await page.addScriptTag({ content: await loadAxe() });
        const violations = await page.evaluate(async tags => (await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] })).violations
          .map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target })) })), WCAG_TAGS);
        record.axe = violations.map(axeLine);
      } catch (e) {
        record.axeError = `axe could not run: ${String(e.message || e).split('\n')[0]}`;
      }
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
  return { ...p, failures: failuresOf(seen) };
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
