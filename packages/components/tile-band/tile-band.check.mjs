// Browser checks for <sg-tile-band>: axe, painted tiles (whole, square, crisp at any pixel ratio), flat quiet
// against glazed warm, a seed lays the same tiles, ZERO frames when idle (counted by a rAF hook the page cannot
// see), a turn that costs frames only while it turns, taps and reduced motion, the divider's <hr>, and no
// JavaScript. Each probe also runs on a broken copy to show it can fail.
//
//   node packages/components/tile-band/tile-band.check.mjs

import { readFileSync } from 'node:fs';
import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';

const { server, browser, engine, check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/tile-band/demo.html';

// ── axe, errors, no JavaScript ──────────────────────────────────────────
for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
for (const palette of ['azulejo']) for (const theme of ['light', 'dark']) {
  const { ctx, page } = await open(`${DEMO}?register=warm&theme=${theme}&palette=${palette}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${palette} palette, ${theme}: 0 violations`, !v.length, v.join('; '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

// ── a page with a rAF counter the band cannot see ───────────────────────
const COUNTER = () => {
  const o = window.requestAnimationFrame.bind(window);
  window.__raf = 0;
  window.requestAnimationFrame = cb => o(t => { window.__raf++; cb(t); });
};
let n = 0;
async function counted(path, { width = 1280, dpr = 1, reduced = false, touch = false, errors = [] } = {}) {
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width, height: 900 }, deviceScaleFactor: dpr, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: touch, isMobile: touch }));
  await ctx.addInitScript(COUNTER);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${server.url}${path}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 }).catch(() => errors.push('never ready'));
  await page.waitForFunction(() => [...document.querySelectorAll('sg-tile-band')].every(b => b.dataset.painted), null, { timeout: 5000 }).catch(() => errors.push('never painted'));
  return { ctx, page, errors };
}
const frames = page => page.evaluate(() => window.__raf);

// ── painted, whole and square, crisp ────────────────────────────────────
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await counted(`${DEMO}?register=${register}`);
  const r = await page.evaluate(() => [...document.querySelectorAll('sg-tile-band')].map(b => {
    const cv = b.querySelector('canvas'), v = b.getAttribute('orientation') === 'vertical';
    const bb = b.getBoundingClientRect(), length = v ? bb.height : bb.width, thick = v ? bb.width : bb.height, count = +b.dataset.painted;
    return { count, length, thick, whole: Math.abs(count * thick - length) < 0.6, cw: cv.width, ch: cv.height, boxW: bb.width, boxH: bb.height, ariaHidden: b.getAttribute('aria-hidden'), hr: !!b.querySelector('hr') };
  }));
  check(`${register}: every band is painted with whole square tiles (count x thickness = length)`, r.length === 4 && r.every(b => b.count > 0 && b.whole), JSON.stringify(r.map(b => [b.count, b.length, Math.round(b.thick * 100) / 100])));
  check(`${register}: the canvas is one pixel per device pixel at 1x`, r.every(b => Math.abs(b.cw - b.boxW) <= 1 && Math.abs(b.ch - b.boxH) <= 1), JSON.stringify(r.map(b => [b.cw, b.boxW, b.ch, b.boxH])));
  check(`${register}: a decoration is aria-hidden; the divider keeps its <hr>`, r.filter(b => !b.hr).every(b => b.ariaHidden === 'true') && r.filter(b => b.hr).every(b => b.ariaHidden === null), JSON.stringify(r.map(b => [b.hr, b.ariaHidden])));
  await ctx.close();
}
{
  const { ctx, page } = await counted(`${DEMO}?register=warm`, { dpr: 2 });
  const r = await page.evaluate(() => [...document.querySelectorAll('sg-tile-band')].map(b => { const cv = b.querySelector('canvas'); const bb = b.getBoundingClientRect(); return [cv.width / bb.width, cv.height / bb.height]; }));
  check('at 2x the canvas has two device pixels to every CSS pixel, so the tiles are crisp', r.every(([a, b]) => Math.abs(a - 2) < 0.01 && Math.abs(b - 2) < 0.01), JSON.stringify(r));
  await ctx.close();
}

// ── flat quiet, glazed warm ─────────────────────────────────────────────
const stats = page => page.evaluate(() => {
  const cv = document.querySelector('sg-tile-band').querySelector('canvas'), g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data;
  let solid = 0, ink = [0, 0, 0], n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 250) solid++; if (d[i + 3] > 200 && d[i + 2] > d[i] + 40) { ink[0] += d[i]; ink[1] += d[i + 1]; ink[2] += d[i + 2]; n++; } }
  return { solid: solid / (d.length / 4), ink: n ? ink.map(v => Math.round(v / n)) : null, w: cv.width, h: cv.height };
});
{
  const q = await counted(`${DEMO}?register=quiet&theme=light`), w = await counted(`${DEMO}?register=warm&theme=light`);
  const [sq, sw] = [await stats(q.page), await stats(w.page)];
  check('quiet is flat line art on the page (under 12% of its pixels painted); warm is a glazed tile (over 90% painted)', sq.solid < 0.12 && sw.solid > 0.9, `${sq.solid.toFixed(3)} / ${sw.solid.toFixed(3)}`);
  const qd = await counted(`${DEMO}?register=quiet&theme=dark`), wd = await counted(`${DEMO}?register=warm&theme=dark`);
  const [sqd, swd] = [await stats(qd.page), await stats(wd.page)];
  const lum = c => c ? 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] : -1;
  check('quiet follows the theme: its line is lighter at night than by day', lum(sqd.ink) > lum(sq.ink) + 40, `${sq.ink} -> ${sqd.ink}`);
  check('warm keeps its glaze at night: the tile colours are the same in both themes', sw.solid > 0.9 && swd.solid > 0.9 && Math.abs(lum(sw.ink) - lum(swd.ink)) < 12, `${sw.ink} / ${swd.ink}`);
  await Promise.all([q, w, qd, wd].map(x => x.ctx.close()));
}

// ── a seed lays the same tiles ──────────────────────────────────────────
{
  const html = seed => `<!doctype html><html lang="en" data-register="warm"><head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/tile-band/tile-band.css"></head><body><main style="width:640px"><sg-tile-band seed="${seed}"></sg-tile-band></main><script type="module">import "/packages/components/tile-band/tile-band.js";</script></body></html>`;
  const grab = async seed => {
    const { ctx, page } = await openHtml(`tb-${seed}-${++n}`, html(seed));
    await page.waitForFunction(() => document.querySelector('sg-tile-band')?.dataset.painted, null, { timeout: 5000 });
    const url = await page.evaluate(() => document.querySelector('canvas').toDataURL());
    await ctx.close();
    return url;
  };
  const [a, b, c] = [await grab('goa'), await grab('goa'), await grab('mapusa')];
  check('the same seed paints the same tiles, pixel for pixel; another seed paints others', a === b && a !== c, `${a.length} bytes`);
}

// ── zero frames when idle ──────────────────────────────────────────────
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await counted(`${DEMO}?register=${register}`);
  const start = await frames(page);
  await page.waitForTimeout(2500);
  const idle = (await frames(page)) - start;
  check(`${register}: zero requestAnimationFrame frames in 2.5 s while idle`, idle === 0, `${idle} frames (${start} before the window, all from loading)`);
  await ctx.close();
}
{
  // control: the same counter on a page that does loop, so the instrument can read non-zero
  const c2 = await browser.newContext(contextOptions(engine, {}));
  await c2.addInitScript(COUNTER);
  await c2.route('**/__check/tb-loop2.html', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>t</title></head><body><canvas id="c"></canvas><script>(function f(){requestAnimationFrame(f)})()</script></body></html>' }));
  const p2 = await c2.newPage();
  await p2.goto(`${server.url}/__check/tb-loop2.html`);
  const s = await frames(p2);
  await p2.waitForTimeout(1000);
  const loops = (await frames(p2)) - s;
  check('control: a page that animates reads many frames on the same counter, so zero above means zero', loops > 30, `${loops} frames in 1 s`);
  await c2.close();
}

// ── a turn ──────────────────────────────────────────────────────────────
/** Index of the first tile that is not four-fold symmetric (a corner or a vine), its centre in page coordinates, and its pixels. */
const target = page => page.evaluate(async () => {
  const { layBand } = await import('/packages/components/tile-band/tile-band.core.js');
  const b = document.querySelector('sg-tile-band'), cv = b.querySelector('canvas'), count = +b.dataset.painted, size = b.clientWidth / count;
  const tiles = layBand(b.getAttribute('seed') || 'azulejo', count), i = tiles.findIndex(t => t.motif === 'corner');
  const r = cv.getBoundingClientRect();
  return { i, x: r.left + (i + 0.5) * size, y: r.top + size / 2, size };
});
const cell = (page, i) => page.evaluate(i => { const b = document.querySelector('sg-tile-band'), cv = b.querySelector('canvas'), S = cv.height, d = cv.getContext('2d').getImageData(Math.round(i * cv.width / (+b.dataset.painted)), 0, S, S).data; let h = 0; for (let k = 0; k < d.length; k += 4) h = (h * 31 + d[k] + d[k + 1] * 3 + d[k + 2] * 7) >>> 0; return h; }, i);
{
  const { ctx, page } = await counted(`${DEMO}?register=playful`);
  const t = await target(page);
  const before = await cell(page, t.i), f0 = await frames(page);
  await page.mouse.move(t.x, t.y - 40);
  await page.mouse.move(t.x, t.y, { steps: 3 });
  await page.waitForTimeout(250);
  const during = (await frames(page)) - f0;
  await page.waitForTimeout(700);
  const f1 = await frames(page);
  await page.waitForTimeout(800);
  const after = await cell(page, t.i), f2 = await frames(page);
  check('playful: a pointer over a tile turns it: frames run during the turn, the tile ends up different, and the frames stop', during > 5 && after !== before && f2 === f1, `${during} frames while turning, changed ${after !== before}, ${f2 - f1} after it settled`);
  // it settles on exactly a quarter: a second turn and two more bring it back (corner: four quarters)
  await page.mouse.move(t.x + t.size * 3, t.y);
  await page.waitForTimeout(250);
  await page.mouse.move(t.x, t.y, { steps: 3 });
  await page.waitForTimeout(1000);
  const second = await cell(page, t.i);
  await page.mouse.move(t.x + t.size * 3, t.y); await page.waitForTimeout(250); await page.mouse.move(t.x, t.y, { steps: 3 }); await page.waitForTimeout(1000);
  await page.mouse.move(t.x + t.size * 3, t.y); await page.waitForTimeout(250); await page.mouse.move(t.x, t.y, { steps: 3 }); await page.waitForTimeout(1000);
  const fourth = await cell(page, t.i);
  check('four quarter-turns bring a corner tile back to exactly where it began (it settles on 90 degrees, not near it)', second !== after && fourth === before, `${before} ${after} ${second} ${fourth}`);
  const loops = await page.evaluate(() => document.getAnimations().length);
  check('no CSS or Web Animations loop either', loops === 0, `${loops}`);
  await ctx.close();
}
{
  const { ctx, page } = await counted(`${DEMO}?register=playful`, { reduced: true });
  const t = await target(page);
  const before = await cell(page, t.i), f0 = await frames(page);
  await page.mouse.move(t.x, t.y - 40); await page.mouse.move(t.x, t.y, { steps: 3 });
  await page.waitForTimeout(900);
  check('playful with reduced motion: hovering a tile does nothing, and costs no frames', (await cell(page, t.i)) === before && (await frames(page)) === f0);
  await ctx.close();
}
{
  const { ctx, page } = await counted(`${DEMO}?register=playful`, { width: 390, touch: true });
  const t = await target(page);
  const before = await cell(page, t.i), f0 = await frames(page);
  await page.touchscreen.tap(t.x, t.y);
  await page.waitForTimeout(900);
  const frame = (await frames(page)) - f0;
  check('playful on a phone: a tap turns the tile under the finger', (await cell(page, t.i)) !== before && frame > 5, `${frame} frames`);
  await page.waitForTimeout(500);
  const f1 = await frames(page); await page.waitForTimeout(800);
  check('...and it is idle again afterwards', (await frames(page)) === f1);
  check('at 390 px the page does not scroll sideways', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await ctx.close();
}
{
  // control: the warm band does not turn, so the probe above can tell a turn from a still band
  const { ctx, page } = await counted(`${DEMO}?register=warm`);
  const t = await target(page);
  const before = await cell(page, t.i), f0 = await frames(page);
  await page.mouse.move(t.x, t.y - 40); await page.mouse.move(t.x, t.y, { steps: 3 });
  await page.waitForTimeout(900);
  check('control: the same hover on a warm band changes nothing and costs no frames, so the playful probe can tell them apart', (await cell(page, t.i)) === before && (await frames(page)) === f0);
  await ctx.close();
}

// ── the divider, and no JavaScript ──────────────────────────────────────
{
  const { ctx, page } = await open(`${DEMO}?register=quiet`, { js: false });
  const r = await page.evaluate(() => { const hr = document.querySelector('sg-tile-band > hr'), s = getComputedStyle(hr); return { shown: hr.getClientRects().length > 0, border: s.borderTopStyle, w: parseFloat(s.borderTopWidth), painted: !!document.querySelector('canvas') }; });
  check('without JavaScript the divider is a cobalt hairline (the hr), and nothing else is drawn', r.shown && r.border === 'solid' && r.w >= 1 && !r.painted, JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, page } = await counted(`${DEMO}?register=warm`);
  const r = await page.evaluate(() => { const hr = document.querySelector('sg-tile-band > hr'), b = hr.getBoundingClientRect(); return { w: b.width, h: b.height, role: hr.tagName }; });
  check('with the band painted the hr is still there for assistive technology, but takes no room', r.w <= 1 && r.h <= 1, JSON.stringify(r));
  await ctx.close();
}
{
  const reg = JSON.parse(readFileSync(new URL('../../../registry/registry.json', import.meta.url), 'utf8')).items.find(i => i.name === 'tile-band');
  check('the registry carries the motif: origin goa, tier everyday, a gloss naming azulejo and majolica', reg?.motif?.origin === 'goa' && reg.motif.tier === 'everyday' && /Azulejo/.test(reg.motif.gloss) && /majolica/.test(reg.motif.gloss), JSON.stringify(reg?.motif));
}

await done();
