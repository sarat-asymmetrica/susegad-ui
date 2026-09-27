// Shared browser plumbing: launch, open a target with its errors captured, wait for it.

import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
import { targetPath } from './target.mjs';

export const PHONE = { width: 390, height: 844, dpr: 3, touch: true };
export const DESKTOP = { width: 1280, height: 900, dpr: 1, touch: false };

/**
 * Installed before any page script: lets a capture hold every requestAnimationFrame loop
 * without touching the piece's own state or UI (a paused scene would show its play toggle).
 * While held, new rAF callbacks queue instead of running; release() schedules them again.
 */
const HOLD_SCRIPT = `(() => {
  const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window);
  const queued = new Map();
  let holding = false, nextId = 1e9;
  window.requestAnimationFrame = cb => {
    if (!holding) return raf(cb);
    const id = nextId++;
    queued.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = id => { if (!queued.delete(id)) caf(id); };
  Object.defineProperty(window, '__tools', { value: Object.freeze({
    hold() { holding = true; },
    release() {
      holding = false;
      const cbs = [...queued.values()];
      queued.clear();
      for (const cb of cbs) raf(cb);
    },
  }) });
})();`;

/** Start the server and the browser together; `done()` closes both. */
export async function session({ headed = false, args = [] } = {}) {
  const server = await startServer({ quiet: true });
  const browser = await chromium.launch({ headless: !headed, args });
  return {
    server, browser, base: server.url,
    version: browser.version(),
    async done() { await browser.close(); await server.close(); },
  };
}

/**
 * Open a target in a fresh context. Returns the page and a log that collects
 * console errors, console warnings, page errors and failed requests.
 * @param {Awaited<ReturnType<typeof session>>} s
 * @param {object} t target (see target.mjs) plus freeze
 * @param {{ width?: number, height?: number, dpr?: number, touch?: boolean, reduced?: boolean }} view
 */
export async function openTarget(s, t, view = {}) {
  const { width = DESKTOP.width, height = DESKTOP.height, dpr = 1, touch = false, reduced = false } = view;
  const context = await s.browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    hasTouch: touch,
    isMobile: touch,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    colorScheme: t.theme === 'dark' ? 'dark' : 'light',
    // --no-js: the page as a browser without JavaScript builds it. <noscript> renders, no page
    // script runs. The tools' own page.evaluate calls still work, but timers and rAF do not.
    javaScriptEnabled: !t.noJs,
  });
  await context.addInitScript(HOLD_SCRIPT);
  const page = await context.newPage();
  const log = { consoleErrors: [], warnings: [], pageErrors: [], failedRequests: [] };
  page.on('console', m => {
    if (m.type() === 'error') log.consoleErrors.push(m.text());
    else if (m.type() === 'warning') log.warnings.push(m.text());
  });
  page.on('pageerror', e => log.pageErrors.push(e.message));
  // A 404 module import also fires requestfailed (ERR_ABORTED); count each path once.
  const failedPaths = new Set();
  const fail = (what, url) => {
    const p = new URL(url).pathname;
    if (failedPaths.has(p)) return;
    failedPaths.add(p);
    log.failedRequests.push(`${what} ${p}`);
  };
  page.on('response', r => { if (r.status() >= 400) fail(r.status(), r.url()); });
  page.on('requestfailed', r => fail(r.failure()?.errorText || 'failed', r.url()));
  const path = targetPath(t);
  const url = s.base + path;
  await page.goto(url, { waitUntil: 'load' });
  return { context, page, log, url, path };
}

/**
 * Wait until the target is ready. Scenes: window.__ready (or __error) from the harness,
 * and window.__frozen as well when a freeze was asked for. Pages: load, fonts, and a
 * short settle; a page that sets window.__ready is waited for too.
 * Pages get data-register / data-theme set on :root so they can be matrixed like scenes.
 * With t.noJs the page is ready at load plus fonts: no script can set __ready, and the
 * attributes stand in for what a server would render on <html>.
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function waitReady(page, t, { timeout = 15000 } = {}) {
  if (t.scene && t.noJs) return { ok: false, reason: 'a scene cannot run without JavaScript; use --url with --no-js' };
  if (t.scene) {
    const flag = t.freeze !== undefined ? '__frozen' : '__ready';
    try {
      await page.waitForFunction(f => window[f] === true || !!window.__error, flag, { timeout });
    } catch {
      return { ok: false, reason: `scene never set window.${flag} within ${timeout / 1000} s` };
    }
    const err = await page.evaluate(() => window.__error);
    if (err) return { ok: false, reason: err };
    await page.evaluate(() => document.fonts.ready);
    return { ok: true };
  }
  await page.evaluate(({ register, theme, palette }) => {
    const d = document.documentElement.dataset;
    if (register) d.register = register;
    if (theme) d.theme = theme;
    if (palette) d.palette = palette;
  }, { register: t.register, theme: t.theme, palette: t.palette });
  await page.evaluate(() => document.fonts.ready);
  // A page that declares window.__ready (false until done) is waited for.
  if (!t.noJs && await page.evaluate(() => '__ready' in window)) {
    try { await page.waitForFunction(() => window.__ready === true, null, { timeout }); }
    catch { return { ok: false, reason: `the page declared window.__ready but never set it within ${timeout / 1000} s` }; }
  }
  await page.waitForTimeout(300);
  return { ok: true };
}

/** Count of problems that make a run fail. */
export function errorCount(log) {
  return log.consoleErrors.length + log.pageErrors.length + log.failedRequests.length;
}

/** Print a log's problems, indented; returns the error count. */
export function printLog(log, indent = '  ') {
  for (const e of log.consoleErrors) console.log(`${indent}console error: ${e}`);
  for (const e of log.pageErrors) console.log(`${indent}page error: ${e}`);
  for (const e of log.failedRequests) console.log(`${indent}failed request: ${e}`);
  for (const e of log.warnings) console.log(`${indent}console warning: ${e}`);
  return errorCount(log);
}

/**
 * Screenshot the element matching selector, or the viewport when there is no selector or the
 * element is missing or empty (a scene that failed to load leaves #box empty; the error box
 * on the page is then what the picture should show).
 * @returns {Promise<Buffer>}
 */
export async function shoot(page, selector, file) {
  // A clipped page screenshot, not locator.screenshot(): the locator waits for the element to be
  // "stable" across two frames, which a slow WebGL scene under load may never be (Rasika, wave 0, S6).
  // Coordinates are in document space so the clip may run below the fold.
  const rect = selector ? await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // Whole pixels, covering the element, so the size never flips between runs by rounding.
    const x = Math.floor(r.left + scrollX), y = Math.floor(r.top + scrollY);
    return { x, y, width: Math.ceil(r.right + scrollX) - x, height: Math.ceil(r.bottom + scrollY) - y };
  }, selector) : null;
  // animations: 'allow' because 'disabled' cancels infinite CSS animations to their first frame,
  // which would misrepresent a spinner or a loader.
  const opts = rect && rect.width > 0 && rect.height > 0
    ? { path: file, fullPage: true, clip: rect, animations: 'allow', timeout: 20000 }
    : { path: file, animations: 'allow', timeout: 20000 };
  // Hold every rAF loop for the capture, so a CPU-rendered WebGL loop cannot starve the
  // compositor. The piece is not paused, so its UI (the play/pause toggle) shows its real state.
  // One in-flight frame may still land, so wait a little after holding.
  // The wait is on the Node side: in-page timers never fire with --no-js.
  const held = await page.evaluate(() => {
    if (!window.__tools) return false;
    window.__tools.hold();
    return true;
  });
  if (held) await page.waitForTimeout(40);
  try {
    try { return await page.screenshot(opts); }
    catch (e) {
      if (e.name !== 'TimeoutError') throw e;
      return await page.screenshot(opts); // one retry: heavy load can stall a single capture
    }
  } finally {
    if (held) await page.evaluate(() => window.__tools.release());
  }
}

/**
 * For checks that need timers (axe) on a page without JavaScript: build the page with JS off,
 * serialise the DOM it produced (<noscript> content included, declarative shadow roots kept,
 * scripts and inline handlers removed), then serve that snapshot at the same URL to a
 * scripted context where the tool can run. The page's own code never runs in either.
 * @returns {Promise<{ context, page, log, url, ready: { ok: boolean, reason?: string } }>}
 */
export async function openNoJsSnapshot(s, t, view = {}) {
  const first = await openTarget(s, { ...t, noJs: true }, view);
  const ready = await waitReady(first.page, { ...t, noJs: true });
  const html = await first.page.evaluate(() => {
    const roots = [];
    const walk = node => {
      for (const el of node.querySelectorAll('*')) if (el.shadowRoot) { roots.push(el.shadowRoot); walk(el.shadowRoot); }
    };
    walk(document);
    const all = [document, ...roots];
    for (const r of all) {
      r.querySelectorAll('script').forEach(x => x.remove());
      // With scripting off, <noscript> content is live DOM; keep it in the flow.
      r.querySelectorAll('noscript').forEach(n => {
        const d = document.createElement('div');
        d.style.display = 'contents';
        d.dataset.sgNoscript = '';
        d.append(...n.childNodes);
        n.replaceWith(d);
      });
      for (const el of r.querySelectorAll('*')) for (const a of [...el.attributes]) if (/^on/i.test(a.name)) el.removeAttribute(a.name);
    }
    const de = document.documentElement;
    const attrs = [...de.attributes].map(a => ` ${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');
    return `<!doctype html><html${attrs}>${de.getHTML({ shadowRoots: roots })}</html>`;
  });
  await first.context.close();
  const { width = DESKTOP.width, height = DESKTOP.height, dpr = 1, touch = false, reduced = false } = view;
  const context = await s.browser.newContext({
    viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch,
    reducedMotion: reduced ? 'reduce' : 'no-preference', colorScheme: t.theme === 'dark' ? 'dark' : 'light',
  });
  const page = await context.newPage();
  await page.route(first.url, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(first.url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return { context, page, log: first.log, url: first.url, ready };
}
