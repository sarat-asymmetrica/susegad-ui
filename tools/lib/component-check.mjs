// Shared glue for component browser checks (*.check.mjs): a server, a browser,
// a pass/fail printer, axe with the WCAG 2.2 AA tags (with and without
// JavaScript), and pages built from a string. Added for the studio-site batch
// (docs/requests/2026-09-27-studio-site-components.md); older checks inline
// the same few lines.

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { startServer } from '../serve.mjs';
import path from 'node:path';
import { contextOptions, engineName, pickEngine } from './engine.mjs';
import { acquireSlot } from './slots.mjs';

export { tab, tabTo, tabWalk, tabsToLinks } from './tab.mjs'; // Tab as far as the engine can press it (WebKit leaves links out of the tab order)

export const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const AXE = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

export async function harness() {
  // One machine-wide browser slot for the life of this check (skipped when runCheck holds one for it); freed in done() or at exit.
  const release = await acquireSlot({ label: path.basename(process.argv[1] ?? 'check') });
  const server = await startServer({ quiet: true });
  const engine = engineName();
  const browser = await pickEngine(engine).launch().catch(e => { release(); throw e; });
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok: !!ok });
    console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  };
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
  async function done() {
    const code = await finish(results, [() => browser.close(), () => server.close?.()]);
    release();
    process.exit(code);
  }
  return { server, browser, engine, check, open, openHtml, axe, axeNoJs, done };
}

/** Every animation on the page, settled. */
/**
 * Print the verdict first, then close what is open, each close raced against
 * `closeMs`: under load Playwright's close can block for good, and a check that
 * has already decided must not hang the suite waiting for it. Returns the exit code.
 */
export async function finish(results, closers, { closeMs = 20000, log = console.log } = {}) {
  const failed = results.filter(r => !r.ok).length;
  // a file that skipped everything asked nothing: "all 0 checks pass" would read as a pass
  log(failed ? `${failed} of ${results.length} checks failed` : results.length ? `all ${results.length} checks pass` : 'no check ran (everything was skipped)');
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
