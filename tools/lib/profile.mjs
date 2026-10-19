// Where a browser check's time goes. Off unless SG_PROFILE=1, and then it costs a stack capture per Playwright call.
//
//   SG_PROFILE=1 node packages/scenes/chiro/chiro.check.mjs        prints a table at the end, writes .shots/profile/<check>.<engine>.json
//   node tools/profile.mjs .shots/profile                           folds a folder of those into one table
//
// How it works: component-check.mjs's harness() calls instrument(browser), which wraps the methods of Playwright's Browser,
// BrowserContext, Page, Locator, Keyboard and Mouse classes (by prototype, so a check that calls browser.newContext itself is
// seen too), and virtual-time.mjs wraps its stepping and pixel grabs in span(). Time is kept as EXCLUSIVE time on a stack: while
// a context is being created, the clock runs for 'ctx-new' and for nothing else. With the stack empty the clock runs for 'node':
// the check's own JavaScript (pixel diffs, loops), and any Playwright call this file does not wrap.
//
// A 'weak' span (page.evaluate, the stepping helpers) does nothing when a span is already open, so an evaluate inside
// a screenshot or a step counts for the outer one. Spans assume a check awaits one call at a time (a Promise.all of
// two calls would share the clock), which holds for the checks measured; abri's one Promise.all is noted in the report.
//
// Categories
//   launch      the dev server and the browser process
//   ctx-new     newContext / newPage          ctx-close   closing a context or page          close  closing the browser
//   nav         goto / reload / setContent (to the load event)
//   step-ready  virtual frames stepped until window.__ready (openStepped)       step  virtual frames stepped by a clause
//   wait-ready  real time waiting for window.__ready / __frozen                 wait-fn  other waitFor*()
//   wait-real   page.waitForTimeout (a fixed sleep)
//   grab        grabPixels (canvas to Node)   shot  page.screenshot                axe  axe-core, script injection included
//   eval        page.evaluate and friends: DOM reads, in-page loops, in-page real-time rAF waits
//   pw-input    keyboard, mouse, locator actions
//   node        everything else: the check's own JavaScript

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

export const PROFILING = process.env.SG_PROFILE === '1';

const T0 = performance.now();
const cats = new Map();        // cat -> { n, s }
const sites = new Map();       // `${cat} ${file}:${line}` -> { n, s }
const stack = [];              // open spans
const pages = new Map();       // page -> { stepped, ready, lastRead, reads, close }
const contexts = [];           // { opts, urls }
const ctxOf = new WeakMap();
const clauses = [];
const waits = [];              // { ms, site } for each waitForTimeout
let mark = performance.now(), inProbe = false, cpuStart = null, lastClauseSnap = null, lastClauseAt = performance.now();
let ORIG = null;               // Page.prototype.evaluate before it was wrapped

const bump = (map, key, s) => { const r = map.get(key) ?? { n: 0, s: 0 }; r.s += s; map.set(key, r); return r; };
const siteOf = () => {
  for (const l of new Error().stack.split('\n').slice(2)) {
    const m = /([\w.-]+\.(?:check|mjs|js)):(\d+):\d+\)?$/.exec(l);
    if (m && !/profile\.mjs|component-check|virtual-time|node:internal/.test(l)) return `${m[1]}:${m[2]}`;
  }
  return '?';
};
function flush(now = performance.now()) {
  const top = stack[stack.length - 1];
  const d = (now - mark) / 1000;
  bump(cats, top ? top.cat : 'node', d);
  bump(sites, top ? `${top.cat} ${top.site}` : 'node', d);
  mark = now;
}

/** Run fn as a span of `cat`. A weak span does nothing when another is open. Returns fn's result. */
export function span(cat, fn, { weak = false, site = null } = {}) {
  if (!PROFILING || (weak && stack.length)) return fn();
  flush();
  const s = { cat, site: site ?? siteOf() };
  stack.push(s);
  bump(cats, cat, 0).n++;
  bump(sites, `${cat} ${s.site}`, 0).n++;
  const pop = () => { flush(); const i = stack.lastIndexOf(s); if (i >= 0) stack.splice(i, 1); };
  let r;
  try { r = fn(); } catch (e) { pop(); throw e; }
  if (r && typeof r.then === 'function') return r.then(v => { pop(); return v; }, e => { pop(); throw e; });
  pop();
  return r;
}

const pageInfo = p => { let r = pages.get(p); if (!r) pages.set(p, r = { stepped: null, ready: null, lastRead: null, close: null, reads: 0 }); return r; };
async function framesOf(page) {
  const rec = pageInfo(page);
  if (rec.stepped === false) return null;
  inProbe = true;
  try { const n = await ORIG.call(page, () => window.__tools?.frames ?? null); rec.stepped = n !== null; return n; }
  catch { return null; }
  finally { inProbe = false; }
}
/** A clause just looked at this page: note how many virtual frames had run. */
export async function markRead(page) {
  if (!PROFILING) return;
  const n = await framesOf(page);
  if (n !== null) { const r = pageInfo(page); r.first ??= n; r.lastRead = n; r.reads++; }
}
/** The page reached window.__ready on virtual frames. */
export async function markReady(page) {
  if (!PROFILING) return;
  const n = await framesOf(page);
  if (n !== null) pageInfo(page).ready = n;
}

const NAMED = {
  goto: 'nav', reload: 'nav', setContent: 'nav',
  waitForTimeout: 'wait-real', waitForLoadState: 'wait-fn', waitForSelector: 'wait-fn', waitFor: 'wait-fn',
  screenshot: 'shot',
};
const EVALS = ['evaluate', 'evaluateHandle', 'evaluateAll', 'addScriptTag', 'ariaSnapshot', 'boundingBox', 'textContent', 'innerText', 'innerHTML', 'getAttribute', 'isVisible', 'isHidden', 'count', 'inputValue', 'content', 'title'];
const INPUTS = ['click', 'dblclick', 'press', 'down', 'up', 'type', 'insertText', 'hover', 'focus', 'blur', 'fill', 'tap', 'move', 'wheel', 'check', 'uncheck', 'selectOption', 'dispatchEvent', 'dragTo', 'setViewportSize', 'emulateMedia'];

function wrap(proto, name, cat, { weak = false, after = null } = {}) {
  const orig = proto[name];
  if (typeof orig !== 'function' || orig.__prof) return;
  const fn = function (...a) {
    if (inProbe) return orig.apply(this, a);
    const c = typeof cat === 'function' ? cat(this, a) : cat;
    const top = !stack.length;
    const out = span(c, () => orig.apply(this, a), { weak });
    // a read of the page by the check itself, not inside a step or a grab: note where the frame counter stood
    if (after && top && out && typeof out.then === 'function') return out.then(async v => { await after(this, a, v); return v; });
    return out;
  };
  fn.__prof = true;
  proto[name] = fn;
}

function patchPage(page) {
  const P = Object.getPrototypeOf(page);
  if (P.__prof) return;
  P.__prof = true;
  ORIG ??= P.evaluate;
  const read = p => markRead(p);
  for (const [n, c] of Object.entries(NAMED)) wrap(P, n, c, { after: c === 'shot' ? read : null });
  wrap(P, 'waitForFunction', (_, a) => /__ready|__frozen/.test(String(a[0])) ? 'wait-ready' : 'wait-fn');
  for (const n of EVALS) wrap(P, n, 'eval', { weak: true, after: n === 'evaluate' ? read : null });
  for (const n of INPUTS) wrap(P, n, 'pw-input', { weak: true });
  const origWait = P.waitForTimeout;
  P.waitForTimeout = function (ms, ...r) { waits.push({ ms, site: siteOf() }); return origWait.call(this, ms, ...r); };
  P.waitForTimeout.__prof = true;
  for (const part of [page.keyboard, page.mouse, page.locator('html')]) {
    const Q = Object.getPrototypeOf(part);
    if (Q.__prof) continue;
    Q.__prof = true;
    for (const n of [...INPUTS, ...EVALS, 'waitFor']) wrap(Q, n, n === 'waitFor' ? 'wait-fn' : INPUTS.includes(n) ? 'pw-input' : 'eval', { weak: true });
    wrap(Q, 'screenshot', 'shot');
  }
  // closing the page notes its last frame count
  const origClose = P.close;
  P.close = function (...a) {
    return span('ctx-close', async () => { await closeNote(this); return origClose.apply(this, a); });
  };
  P.close.__prof = true;
}
async function closeNote(page) {
  const n = await framesOf(page).catch(() => null);
  if (n !== null) pageInfo(page).close = n;
}

function patchContext(ctx) {
  const C = Object.getPrototypeOf(ctx);
  if (C.__prof) return;
  C.__prof = true;
  wrap(C, 'newPage', 'ctx-new');
  const origClose = C.close;
  C.close = function (...a) {
    return span('ctx-close', async () => { for (const p of this.pages()) await closeNote(p); return origClose.apply(this, a); });
  };
  C.close.__prof = true;
}

/** Wrap a Browser (and, as they appear, its contexts and pages). Called once by harness(). */
export function instrument(browser) {
  if (!PROFILING) return browser;
  cpuStart ??= cpuSnap();
  const B = Object.getPrototypeOf(browser);
  if (B.__prof) return browser;
  B.__prof = true;
  const track = (ctx, opts) => {
    patchContext(ctx);
    const rec = { opts: opts ?? {}, urls: [] };
    contexts.push(rec);
    ctxOf.set(ctx, rec);
    ctx.on('page', p => { patchPage(p); p.on('framenavigated', f => { if (f === p.mainFrame()) rec.urls.push(f.url()); }); });
  };
  const newContext = B.newContext;
  B.newContext = function (opts, ...r) {
    if (inProbe) return newContext.call(this, opts, ...r);
    return span('ctx-new', async () => { const ctx = await newContext.call(this, opts, ...r); track(ctx, opts); return ctx; });
  };
  const newPage = B.newPage;
  B.newPage = function (opts, ...r) {
    return span('ctx-new', async () => { const p = await newPage.call(this, opts, ...r); track(p.context(), opts); patchPage(p); return p; });
  };
  const close = B.close;
  B.close = function (...a) { return span('close', () => close.apply(this, a)); };
  return browser;
}

const cpuSnap = () => os.cpus().reduce((a, c) => { const t = Object.values(c.times).reduce((x, y) => x + y, 0); a.busy += t - c.times.idle; a.total += t; return a; }, { busy: 0, total: 0 });

/** A clause finished (called from the harness's check()): the time since the last one, by category. */
export function markClause(name, ok) {
  if (!PROFILING) return;
  flush();
  const snap = Object.fromEntries([...cats].map(([k, v]) => [k, v.s]));
  const prev = lastClauseSnap ?? {};
  const by = {};
  for (const k of Object.keys(snap)) { const d = snap[k] - (prev[k] ?? 0); if (d > 0.0005) by[k] = +d.toFixed(3); }
  const now = performance.now();
  clauses.push({ name, ok, s: +((now - lastClauseAt) / 1000).toFixed(3), by });
  lastClauseSnap = snap;
  lastClauseAt = now;
}

const r2 = x => +x.toFixed(2);
/** The profile so far, as plain data. */
export function profile(name, engine) {
  flush();
  const total = (performance.now() - T0) / 1000;
  const cpu = cpuSnap(), c0 = cpuStart ?? cpu;
  const catRows = Object.fromEntries([...cats].map(([k, v]) => [k, { n: v.n, s: r2(v.s) }]));
  // virtual frames: setup (to ready), to the last read, and the tail after it
  let stepped = 0, toReady = 0, toRead = 0, tail = 0, unread = 0, approach = 0, between = 0;
  for (const p of pages.values()) {
    if (!p.stepped) continue;
    stepped++;
    const end = p.close ?? p.lastRead ?? p.ready ?? 0, ready = p.ready ?? 0, read = Math.min(end, Math.max(p.lastRead ?? ready, ready));
    const first = Math.min(read, Math.max(p.first ?? ready, ready));
    toReady += ready; toRead += read - ready; tail += end - read;
    approach += first - ready; between += read - first;
    if (!p.reads) unread += end - ready;
  }
  const stepS = (cats.get('step')?.s ?? 0) + (cats.get('step-ready')?.s ?? 0);
  const framesAll = toReady + toRead + tail;
  const matrix = new Set(contexts.flatMap(c => {
    const v = c.opts.viewport ?? { width: 1280, height: 720 };
    return (c.urls.length ? c.urls : ['']).map(u => {
      let q = ''; try { const x = new URL(u); q = `${x.pathname}|${x.searchParams.get('register') ?? ''}|${x.searchParams.get('theme') ?? ''}`; } catch { q = u; }
      return `${q}|${v.width}x${v.height}|${c.opts.reducedMotion === 'reduce' ? 'reduced' : 'motion'}`;
    });
  }));
  return {
    check: name, engine, total_s: r2(total),
    cpu_busy: r2(100 * (cpu.busy - c0.busy) / Math.max(1, cpu.total - c0.total)), cores: os.cpus().length,
    cats: catRows,
    contexts: contexts.length, navigations: contexts.reduce((n, c) => n + c.urls.length, 0), matrix_cells: matrix.size,
    frames: { stepped_pages: stepped, total: framesAll, to_ready: toReady, to_last_read: toRead, approach_to_first_read: approach, between_first_and_last_read: between, tail_after_last_read: tail, in_pages_never_read: unread, ms_per_frame: framesAll ? r2(1000 * stepS / framesAll) : null },
    waits: { windows: waits.length, ms_total: waits.reduce((a, w) => a + w.ms, 0), top: [...waits].sort((a, b) => b.ms - a.ms).slice(0, 8) },
    sites: [...sites].map(([k, v]) => ({ k, n: v.n, s: r2(v.s) })).sort((a, b) => b.s - a.s).slice(0, 25),
    clauses,
  };
}

/** Print the table and write the JSON; called by the harness's done(). */
export function report(name, engine) {
  if (!PROFILING) return;
  const p = profile(name, engine);
  const dir = process.env.SG_PROFILE_OUT ?? path.resolve('.shots/profile');
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${name}.${engine}.json`), JSON.stringify(p, null, 1)); } catch { /* the table still prints */ }
  console.log(`\nprofile  ${name} (${engine}): ${p.total_s} s, CPU ${p.cpu_busy}% busy of ${p.cores} cores`);
  for (const [k, v] of Object.entries(p.cats).sort((a, b) => b[1].s - a[1].s)) console.log(`  ${k.padEnd(11)} ${String(v.n).padStart(5)}  ${String(v.s).padStart(8)} s  ${(100 * v.s / p.total_s).toFixed(1).padStart(5)}%`);
  console.log(`  contexts ${p.contexts}, navigations ${p.navigations}, matrix cells ${p.matrix_cells}; frames ${p.frames.total} (${p.frames.to_ready} to ready, ${p.frames.to_last_read} to last read, ${p.frames.tail_after_last_read} after it)`);
}
