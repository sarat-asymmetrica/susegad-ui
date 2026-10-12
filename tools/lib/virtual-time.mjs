// Virtual time for browser checks: scene time is stepped, not waited for.
//
// A scene's clock is requestAnimationFrame. A check that waits for "three seconds" with waitForTimeout, or
// loads `?freeze=40.2` and lets the harness count 2,412 real frames, pays the page's real frame time (about
// 15 ms here) for every frame. This module holds the page's rAF loops and runs them by hand: each step is one
// sixtieth of a second of the scene's time, drawn as fast as the page can draw it (about 6.5 ms), with a
// message-channel settle between steps so promises, network and module loads still land. On shet it took a
// 342 s check to 107 s with the same pixels (docs/reports/2026-10-12-scene-check-time.md).
//
//   HOLD_SCRIPT       the init script: window.__tools { held, frames, hold(), step(n), release() }. tools/lib/browser.mjs
//                     installs it for the strip, onion and capture tools (hold / holdAtReady).
//   VIRTUAL_FRAMES    HOLD_SCRIPT, held from the first script, plus window.__fast { frames, step(n), toTime(t) }.
//   openStepped       a page on virtual frames in its own context, stepped to window.__ready.
//   openReal          the same page on the real clock, with routes, for the clauses that keep real time.
//   frames, until     step n frames; step until a page predicate holds.
//   untilFrozen       step to the frame that freezes the harness clock, and no further.
//   frozenAt          one `?freeze=` page, a grab at each moment on the way: 40.2 s on the way to a 40.7 s
//                     freeze is the picture `?freeze=40.2` alone freezes (0 of 603,900 values differ).
//   plantFault        a scene file served with one string replaced: the check's --break and its controls.
//   forceQuality      routes that let a check set the governor's level (see the note below).
//   grabPixels        the canvas pixels as base64 bytes, not a plain array (2.3 to 3.5 s a grab for 2.6 M numbers).
//
// What stays on the real clock: anything that watches the network or a timer (no request leaves the page,
// lazy loads), perf and frame budgets, axe, the stills (nothing moves), Web Animations and CSS (the document
// timeline is not requestAnimationFrame; ?freeze pauses and seeks them itself).
//
// Stepped frames are always 16.7 ms, so the quality governor (packages/engine/src/governor.js) stays at 1 and the
// low-quality branches of a scene never run. A check that guards one must force the level itself, with
// forceQuality below, the way abri's calm clause does for the veins.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contextOptions } from './engine.mjs';

export const HOLD_SCRIPT = `(() => {
  const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window);
  const queued = new Map();
  let holding = false, nextId = 1e9, fakeTs = 1e6, frames = 0;
  const port = new MessageChannel();
  const settle = () => new Promise(r => { port.port1.onmessage = () => r(); port.port2.postMessage(0); });
  window.requestAnimationFrame = cb => {
    if (!holding) return raf(cb);
    const id = nextId++;
    queued.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = id => { if (!queued.delete(id)) caf(id); };
  Object.defineProperty(window, '__tools', { value: Object.freeze({
    get held() { return holding; },
    get frames() { return frames; },
    hold() { holding = true; },
    async step(n = 1) {
      if (!holding) throw new Error('__tools.step needs __tools.hold() first');
      for (let i = 0; i < n; i++) {
        const cbs = [...queued.values()];
        queued.clear();
        fakeTs += 1000 / 60;
        frames++;
        for (const cb of cbs) { try { cb(fakeTs); } catch (e) { setTimeout(() => { throw e; }); } }
        await settle();
      }
    },
    release() {
      holding = false;
      const cbs = [...queued.values()];
      queued.clear();
      for (const cb of cbs) raf(cb);
    },
  }) });
})();`;

/** The same, held from the first script. toTime(t) steps until the harness clock (?freeze) reads t seconds. */
export const VIRTUAL_FRAMES = `${HOLD_SCRIPT}
(() => {
  window.__tools.hold();
  window.__fast = Object.freeze({
    get frames() { return window.__tools.frames; },
    step: n => window.__tools.step(n),
    /** Step until the harness clock reads t seconds; throws, rather than looping for ever, when the page has no ?freeze clock. */
    async toTime(t) {
      if (!window.__clock) throw new Error('__fast.toTime needs the harness clock: load the scene with ?freeze=');
      while (!(window.__clock.time >= t - 1e-6)) await window.__tools.step(1);
    },
    /** Step, at most n frames, until the harness says window.__frozen; stops on that frame, as a real page would. */
    async toFrozen(n) { for (let i = 0; i < n && window.__frozen !== true; i++) await window.__tools.step(1); return window.__frozen === true; },
  });
})();`;

/**
 * The same page on the real clock, in the same kind of context, for what virtual frames cannot show: a clause that
 * keeps real time (see the note at the top) but needs routes (a planted fault, a blocked request) in place before it loads.
 * Waits for window.__ready; a page that never gets there fails the check and ends the run.
 */
export async function openReal(h, path, { reduced = false, routes = [], ms = 40000, view = {} } = {}) {
  const ctx = await h.browser.newContext(contextOptions(h.engine, {
    viewport: { width: 1280, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference', ...view,
  }));
  for (const [url, handler] of routes) await ctx.route(url, handler);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${h.server.url}${path}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: ms })
    .catch(async () => { h.check(`ready: ${path}`, false, `no sg-ready in ${ms / 1000} s`); await h.done(); });
  return { ctx, page, errors };
}

/** Step `n` virtual frames (n / 60 s of the scene's time). */
export const frames = (page, n) => page.evaluate(n => window.__fast.step(n), n);

/**
 * Step frames, `batch` at a time, until `cond` (a page function, given `arg`) holds, or `ms` of real time pass.
 * Returns whether it held.
 */
export async function until(page, cond, { arg, ms = 30000, batch = 6 } = {}) {
  const t0 = Date.now();
  while (!(await page.evaluate(cond, arg))) {
    if (Date.now() - t0 > ms) return false;
    await frames(page, batch);
  }
  return true;
}

/**
 * A page on virtual frames in its own 1280 x 900 context, stepped to window.__ready.
 * @param h the check's harness (component-check.mjs): browser, engine, server, check, done
 * @param {string} path  a URL path with its query
 * @param {{ reduced?: boolean, routes?: Array<[any, Function]>, setup?: (ctx) => any, ms?: number, view?: object }} [o]
 *   routes: [url, handler] pairs for ctx.route (a patched file, a blocked request); setup(ctx) runs before the page loads;
 *   ms: real time to wait for ready (a page that never gets there fails the check and ends the run).
 */
export async function openStepped(h, path, { reduced = false, routes = [], setup = null, ms = 40000, view = {} } = {}) {
  const ctx = await h.browser.newContext(contextOptions(h.engine, {
    viewport: { width: 1280, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference', ...view,
  }));
  await ctx.addInitScript(VIRTUAL_FRAMES);
  for (const [url, handler] of routes) await ctx.route(url, handler);
  if (setup) await setup(ctx);
  const page = await ctx.newPage(), errors = [], pageErrors = [];
  page.on('pageerror', e => { errors.push(String(e)); pageErrors.push(String(e).slice(0, 90)); });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${h.server.url}${path}`);
  if (!(await until(page, () => window.__ready === true, { ms }))) {
    h.check(`ready: ${path}`, false, `no sg-ready in ${ms / 1000} s`);
    await h.done();
  }
  return { ctx, page, errors, pageErrors };
}

/**
 * The canvas inside window.__piece as a sample of its pixels, every `stride`th, as a Buffer of r, g, b
 * (base64 across the wire). `units` is the scene's coordinate box, for kx and ky and for the page's words
 * (the element's children, in those units). `data` is a copy of the .stage dataset, taken in the same
 * evaluate, so the month or the stage and the pixels are one frame even on the real clock.
 */
export async function grabPixels(page, { stride = 2, units = [1200, 800] } = {}) {
  const g = await page.evaluate(([s, ux, uy]) => {
    const el = window.__piece, cv = el.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), px = new Uint8Array(w * hh * 3);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; px[o] = d[i]; px[o + 1] = d[i + 1]; px[o + 2] = d[i + 2]; }
    const stage = el.shadowRoot.querySelector('.stage'), st = stage.getBoundingClientRect(), k = ux / st.width;
    const words = [...el.children].map(c => { const r = c.getBoundingClientRect(); return { x: (r.left - st.left) * k, y: (r.top - st.top) * k, w: r.width * k, h: r.height * k }; });
    let bin = ''; for (let i = 0; i < px.length; i += 0x8000) bin += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
    return { w, h: hh, kx: ux / w, ky: uy / hh, px: btoa(bin), words, data: { ...stage.dataset } };
  }, [stride, units[0], units[1]]);
  return { ...g, px: Buffer.from(g.px, 'base64') };
}

/** A 32-bit hash of a grab's pixels: two grabs with the same hash are the same picture. */
export function hashPixels({ px }) {
  let hash = 0;
  for (let i = 0; i < px.length; i += 3) hash = (hash * 31 + px[i] * 3 + px[i + 1] * 5 + px[i + 2] * 7) >>> 0;
  return hash;
}

/**
 * Step until the harness clock has frozen (?freeze) and its last frame has reached the screen; false after `ms` of real time.
 * It stops on the frame that sets window.__frozen, not on a round number of frames after it: a scene that keeps
 * refining while frozen (abri's sheen, a few levels a frame) would otherwise be drawn further than a real page's.
 */
export async function untilFrozen(page, { ms = 120000, batch = 120 } = {}) {
  const t0 = Date.now();
  while (!(await page.evaluate(n => window.__fast.toFrozen(n), batch))) if (Date.now() - t0 > ms) return false;
  return true;
}

/**
 * One page at `path` (a scene with `?freeze=`), a grab at each moment of `at` (seconds) on the way, and a last
 * grab once it has frozen. Returns the grabs in that order, or the last alone when `at` is empty.
 * @param {{ at?: number[], routes?: any[], grab?: object, ms?: number }} [o]  grab: options for grabPixels
 */
export async function frozenAt(h, path, { at = [], routes = [], grab = {}, ms = 120000 } = {}) {
  const { ctx, page } = await openStepped(h, path, { routes });
  const imgs = [];
  for (const t of at) { await page.evaluate(t => window.__fast.toTime(t), t); imgs.push(await grabPixels(page, grab)); }
  if (!(await untilFrozen(page, { ms }))) h.check(`frozen: ${path}`, false, `never froze in ${ms / 1000} s`);
  imgs.push(await grabPixels(page, grab));
  await ctx.close();
  return at.length ? imgs : imgs[0];
}

/**
 * Planted faults, as ctx.route pairs: each row `[file, from, to]` serves one of the scene's own files (in the folder
 * of the check whose import.meta.url is `checkUrl`) with `from` replaced by `to`. Rows for the same file apply in
 * turn to the one served copy (two routes for one file would shadow each other). Write each row with literal
 * strings in the check, as shet.check.mjs does: the mutant guard (tools/lib/mutants.core.js) reads those rows and
 * fails when a refactor of the scene moves the line, so a fault cannot quietly stop biting. If a `from` is gone
 * the check fails here, loudly, and the file is served with the rest applied.
 * @param {string} checkUrl import.meta.url of the check
 * @param {(name: string, ok: boolean, detail?: string) => void} check the harness's check
 * @param {...[string, string, string]} rows [file, from, to]
 * @returns {Array<[string, Function]>}
 */
export function plantFault(checkUrl, check, ...rows) {
  const dir = path.dirname(fileURLToPath(checkUrl));
  const folder = dir.split(path.sep).join('/').replace(/^.*\/(packages\/)/, '$1');
  const served = new Map();
  for (const [file, from, to] of rows) {
    const src = served.get(file) ?? readFileSync(path.join(dir, file), 'utf8');
    if (!src.includes(from)) check(`the planted fault applies (${from.slice(0, 48)})`, false, `${file} changed; update the fault`);
    served.set(file, src.replace(from, () => to));
  }
  return [...served].map(([file, body]) => [`**/${folder}/${file}*`, r => r.fulfill({ contentType: 'text/javascript', body })]);
}

/**
 * Route pair(s) that give the quality governor a handle: while globalThis.__q is set (in the page), the governor
 * reports that level instead of measuring frame times. Stepped frames never leave level 1, so a clause that guards
 * a low-quality branch sets `globalThis.__q = 0.25` between its two grabs. (Use globalThis in the page; window.__q
 * written inside the served module read as undefined.)
 * @returns {Array<[string, Function]>}
 */
export function forceQuality() {
  const file = new URL('../../packages/engine/src/governor.js', import.meta.url);
  const src = readFileSync(file, 'utf8');
  const anchor = 'sample(dt) {';
  if (!src.includes(anchor)) throw new Error(`forceQuality: ${anchor} is not in governor.js any more; update the helper`);
  const body = src.replace(anchor, () => `${anchor} if (globalThis.__q) { g.level = globalThis.__q; return g.level; }`);
  return [['**/packages/engine/src/governor.js*', r => r.fulfill({ contentType: 'text/javascript', body })]];
}
