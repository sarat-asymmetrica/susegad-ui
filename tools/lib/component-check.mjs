// Shared glue for component browser checks (*.check.mjs): a server, a browser,
// a pass/fail printer, axe with the WCAG 2.2 AA tags (with and without
// JavaScript), and pages built from a string. Added for the studio-site batch
// (docs/requests/2026-09-27-studio-site-components.md); older checks inline
// the same few lines.

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { startServer } from '../serve.mjs';
import path from 'node:path';
import { contextOptions, engineName, launchArgs, pickEngine, unsupportedIn } from './engine.mjs';
import { gpuGate } from './gpu.core.js';
import { gpuOf } from './gpu.mjs';
import { openScene } from './scene-probe.mjs';
import { acquireSlot } from './slots.mjs';

export { tab, tabTo, tabWalk, tabsToLinks } from './tab.mjs'; // Tab as far as the engine can press it (WebKit leaves links out of the tab order)

export const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const AXE = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

/**
 * The one entry for a browser check (*.check.mjs). It owns the dev server, the machine-wide browser slot
 * (slots.mjs; skipped when runCheck already holds one), the engine (`--engine=` / SG_ENGINE through
 * pickEngine), the pass/fail printer, axe, and a `done()` whose closes cannot hang. A check never calls
 * `chromium.launch()` itself: it would run Chromium whatever engine the run asked for
 * (tools/lib/chromium-only.core.test.mjs fails the build if one does).
 *
 *   const h = await harness();                                   // a plain DOM page
 *   const h = await harness({ args: GPU_FLAGS, axe: 'why axe is not run here' });
 *   const ctx = await h.context({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' });
 *   const probe = await h.scene('vahi', { register: 'warm' });   // a scene in tools/harness/scene.html (scene-probe.mjs)
 *   if (h.skip('WebGL readback', 'Chromium only')) {} else { ... }  // a printed, counted skip, never a silent pass
 *   await h.done();                                              // verdict, guarded closes, the slot back, process.exit
 *
 * options
 *   args  Chromium launch flags (GPU switches and the like); other engines get none (launchArgs)
 *   axe   true (default): the check is expected to call h.axe(page). A string opts out and says why. A check that
 *         neither ran axe nor opted out gets a `note` line at the end
 */
export async function harness({ args = [], axe: axePolicy = true } = {}) {
  // One machine-wide browser slot for the life of this check (skipped when runCheck holds one for it); freed in done() or at exit.
  const release = await acquireSlot({ label: path.basename(process.argv[1] ?? 'check') });
  const engine = engineName();
  let server, browser;
  const extra = []; // browsers from h.launch(), closed in done()
  try {
    server = await startServer({ quiet: true });
    browser = await pickEngine(engine).launch({ args: launchArgs(engine, args) });
  } catch (e) {
    try { await browser?.close(); } catch { /* never launched */ }
    try { await server?.close?.(); } catch { /* never started */ }
    release();
    throw e;
  }
  const results = [];
  const skipped = [];
  let axeRuns = 0;
  const check = (name, ok, detail = '') => {
    results.push({ name, ok: !!ok });
    console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  };
  /**
   * A clause this engine cannot answer: prints `skip  <thing> is not measurable in <engine>  (<reason>)`, counts it
   * in the closing line, and returns true so a caller can write `if (h.skip(...)) {} else { ... }`. Neither a pass nor a red.
   */
  const skip = (thing, reason) => { skipped.push(thing); return unsupportedIn(engine, thing, reason); };
  /**
   * The GPU gate (tools/lib/gpu.mjs) for a check with live-tier (WebGL) clauses. In Chromium it reads the renderer, as before.
   * In another engine the live tier is not read back at all, so each `gate.skip(clause)` prints and counts a skip with that reason.
   */
  async function gpu() {
    if (engine === 'chromium') return gpuOf(browser);
    const seen = { available: false, renderer: '', software: true, forced: false, label: `${engine}: the live WebGL tier is read back in Chromium only` };
    console.log(`GPU: ${seen.label} (the live-tier clauses will skip)`);
    return gpuGate(seen);
  }
  /** A second browser of the same engine (other flags, say an uncapped frame rate), closed with the first in done(). */
  async function launch(opts = {}) {
    const b = await pickEngine(engine).launch({ ...opts, args: launchArgs(engine, opts.args ?? []) });
    extra.push(b);
    return b;
  }
  /** browser.newContext() with the options made safe for this engine (contextOptions). */
  const context = (opts = {}, b = browser) => b.newContext(contextOptions(engine, opts));
  /** A page at `path` (query string allowed), waited on window.__ready when it declares one. */
  async function open(path, { width = 1280, height = 900, js = true, reduced = false, touch = false, errors = [] } = {}) {
    const ctx = await browser.newContext(contextOptions(engine, {
      viewport: { width, height }, javaScriptEnabled: js, reducedMotion: reduced ? 'reduce' : 'no-preference',
      hasTouch: touch, isMobile: touch, permissions: ['clipboard-read', 'clipboard-write'],
    }));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${server.url}${path}`);
    if (js) await page.waitForFunction(() => window.__ready !== false, null, { timeout: 10000 }).catch(() => errors.push('never ready'));
    return { ctx, page, errors };
  }
  /** Serve `html` at `/__check/<name>.html` for the rest of the run and open it. */
  async function openHtml(name, html, opts = {}) {
    const path = `/__check/${name}.html`;
    const errors = opts.errors ?? [];
    const ctx = await browser.newContext(contextOptions(engine, {
      viewport: { width: opts.width ?? 1280, height: opts.height ?? 900 }, javaScriptEnabled: opts.js ?? true,
      reducedMotion: opts.reduced ? 'reduce' : 'no-preference', hasTouch: !!opts.touch, isMobile: !!opts.touch,
      permissions: ['clipboard-read', 'clipboard-write'],
    }));
    await ctx.route(`**${path}`, r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${server.url}${path}`);
    return { ctx, page, errors };
  }
  /** axe violations on the page as it stands, as "rule (n)" strings. */
  async function axe(page) {
    axeRuns++;
    await page.addScriptTag({ content: AXE });
    return page.evaluate(async tags => (await window.axe.run(document, { runOnly: { type: 'tag', values: tags } })).violations.map(v => `${v.id} (${v.nodes.length}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')})`), WCAG);
  }
  /**
   * axe on the page a browser without JavaScript builds: the DOM is taken with
   * JavaScript off, then checked in a scripted copy with the scripts removed.
   */
  async function axeNoJs(path, opts = {}) {
    const { ctx, page } = await open(path, { ...opts, js: false });
    await page.waitForLoadState('load');
    const html = await page.evaluate(() => { document.querySelectorAll('script').forEach(s => s.remove()); return '<!doctype html>' + document.documentElement.outerHTML; });
    await ctx.close();
    const copy = await openHtml(`nojs-${Math.random().toString(36).slice(2)}`, html.replace('<head>', `<head><base href="${server.url}${path.replace(/[^/]*$/, '')}">`), { ...opts, js: true });
    await copy.page.waitForLoadState('load');
    const v = await axe(copy.page);
    await copy.ctx.close();
    return v;
  }
  /**
   * The verdict, the guarded closes, the slot back, and the exit. `summary` replaces the closing line (a gate's own
   * "17 of 17 pass, 5 skipped"); `expectRed` is a fail-first run (`--break`) whose reds are the point, so it exits 0.
   */
  async function done({ summary, expectRed = false } = {}) {
    if (axePolicy === true && !axeRuns) console.log("note  axe never ran in this check; run h.axe(page) on the page, or opt out with harness({ axe: '<reason>' })");
    const code = await finish(results, [...extra.map(b => () => b.close()), () => browser.close(), () => server.close?.()], { summary, skipped: skipped.length });
    release();
    process.exit(expectRed ? 0 : code);
  }
  return { server, browser, engine, results, check, skip, gpu, launch, context, open, openHtml, scene: (name, opts) => openScene({ browser, server }, name, opts), axe, axeNoJs, done };
}

/** Every animation on the page, settled. */
/**
 * Print the verdict first, then close what is open, each close raced against
 * `closeMs`: under load Playwright's close can block for good, and a check that
 * has already decided must not hang the suite waiting for it. Returns the exit code.
 */
export async function finish(results, closers, { closeMs = 20000, log = console.log, summary, skipped = 0 } = {}) {
  const failed = results.filter(r => !r.ok).length;
  // a file that skipped everything asked nothing: "all 0 checks pass" would read as a pass
  const more = skipped ? `, ${skipped} skipped (not run in this engine)` : '';
  log(summary ?? (failed ? `${failed} of ${results.length} checks failed${more}` : results.length ? `all ${results.length} checks pass${more}` : 'no check ran (everything was skipped)'));
  for (const close of closers) {
    let timer;
    const late = new Promise(resolve => { timer = setTimeout(() => resolve('late'), closeMs); });
    const outcome = await Promise.race([Promise.resolve().then(close).then(() => 'closed', () => 'closed'), late]);
    clearTimeout(timer);
    if (outcome === 'late') { log(`(closing took over ${closeMs / 1000} s; leaving it to the exit)`); break; }
  }
  return failed ? 1 : 0;
}

// Waits for the animations that will end: a paused one (a bloom below the fold waits to be seen)
// or an endless one (a loader) never finishes, and waiting on it hangs the check.
export const settle = page => page.evaluate(() => Promise.all(document.getAnimations()
  .filter(a => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming?.().endTime ?? Infinity))
  .map(a => a.finished.catch(() => {}))));

/**
 * The drawn venue locator's shapes that fall back to the UA default: a shape is "styled" when its
 * fill, stroke or opacity differs from a fresh unclassed element of the same tag in the same svg.
 * Also reports the walking route's computed paint, which must be a stroked line with no fill.
 * (The event template once drew a route and a stop with classes nobody styled: a black wedge.)
 */
export function locatorShapes(page) {
  return page.evaluate(() => {
    const sel = 'path, circle, rect, ellipse, line, polyline, polygon';
    const svg = document.querySelector('.sg-venue-locator svg'), unstyled = [];
    const look = e => { const c = getComputedStyle(e); return `${c.fill}|${c.stroke}|${c.opacity}`; };
    for (const e of svg.querySelectorAll(sel)) {
      const bare = document.createElementNS('http://www.w3.org/2000/svg', e.localName);
      svg.append(bare);
      if (look(e) === look(bare)) unstyled.push(e.getAttribute('class') || e.localName);
      bare.remove();
    }
    const walk = svg.querySelector('.sg-loc-walk'), w = walk && getComputedStyle(walk);
    return { n: svg.querySelectorAll(sel).length, unstyled, walk: w ? { fill: w.fill, stroke: w.stroke, dash: w.strokeDasharray } : null };
  });
}

/**
 * The walking route's contrast (WCAG 1.4.11, 3:1) against what it touches, from computed colours. The route runs
 * along the road, so its neighbours are the road (blended over the surface by its opacity) and the surface; when a
 * visible halo is drawn under it (wider, same dashes), the halo is its only neighbour. Colours are normalised through
 * a canvas so color-mix() and the like come out as plain rgb in every engine.
 */
export function locatorRouteContrast(page) {
  return page.evaluate(() => {
    const g = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
    const rgb = v => { g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = v; g.fillRect(0, 0, 1, 1); return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const lum = c => c.reduce((a, v, i) => { v /= 255; return a + [0.2126, 0.7152, 0.0722][i] * (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); }, 0);
    const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
    const svg = document.querySelector('.sg-venue-locator svg');
    const walk = getComputedStyle(svg.querySelector('.sg-loc-walk')), haloEl = svg.querySelector('.sg-loc-walk-halo');
    const halo = haloEl && getComputedStyle(haloEl);
    const haloShown = !!halo && halo.display !== 'none' && halo.stroke !== 'none' && parseFloat(halo.strokeWidth) > parseFloat(walk.strokeWidth) && halo.strokeDasharray === walk.strokeDasharray;
    const surface = rgb(getComputedStyle(svg).backgroundColor);
    const road = getComputedStyle(svg.querySelector('.sg-loc-road')), a = parseFloat(road.opacity), rs = rgb(road.stroke);
    const roadOver = rs.map((v, i) => v * a + surface[i] * (1 - a));
    const line = rgb(walk.stroke);
    const neighbours = haloShown ? { halo: rgb(halo.stroke) } : { surface, road: roadOver };
    const ratios = Object.fromEntries(Object.entries(neighbours).map(([k, c]) => [k, Math.round(ratio(line, c) * 100) / 100]));
    return { haloShown, ratios, min: Math.min(...Object.values(ratios)) };
  });
}
