// The current band of the ferry scene is soft, in whichever engine this run is for:
//
//   node packages/scenes/ferry/ferry.band.check.mjs
//   SG_ENGINE=webkit node packages/scenes/ferry/ferry.band.check.mjs
//
// Across its upper edge no single pixel row carries 40% of the lift from the water to the band's crest.
// A blur through the canvas filter is kept by WebKit and drawn unblurred, so the old band read about
// 0.55 there (a hard ribbon) and the stacked fills read 0.12 to 0.21. Light and dark theme. This check
// opens the page itself through harness(), with the shared scene probe left out (it reads a Chromium-only session).
//
// Watched failing first: with the blur(6px) fill put back (the control below does exactly that) the
// light clause read 0.56 and the dark 0.48 in WebKit.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness({ axe: 'a pixel-profile check of the canvas; tools/smoke.mjs axes the scene page' });
const { server, browser: b4, engine: eng, check } = h;

// a real band lifts the water 10 to 13 levels; the river alone brightens by about 4.5 toward it (dark) and 3 (light, measured with the band removed)
const MIN_LIFT = { light: 6, dark: 7 };
const soft = (r, theme) => r.rise > MIN_LIFT[theme] && r.share < 0.4;

async function open(theme, ctx = null) {
  const page = await (ctx ?? b4).newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${server.url}/tools/harness/scene.html?name=ferry&register=warm&theme=${theme}`);
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page;
}

// The band follows currentY(x) = 440 + 0.1x - 26 sin(x / 260), its upper edge 9 above that line. Every column is read
// along that line (so the edge lines up in all of them), and the columns are averaged: the ripple dashes that cross
// the water average out, the band's edge does not.
const PROFILE = () => {
  const el = window.__piece, cv = el.shadowRoot.querySelector('canvas'), { W } = el.meta, k = cv.width / W;
  const g = cv.getContext('2d', { willReadFrequently: true }), img = g.getImageData(0, 0, cv.width, cv.height);
  const cy = x => 440 + x * 0.1 - Math.sin(x / 260) * 26, LO = -34, HI = 34, sum = new Float64Array(HI - LO + 1), n = new Float64Array(HI - LO + 1);
  for (let x = 300; x < 1000; x += 2) for (let d = LO; d <= HI; d++) {
    const px = Math.round(x * k), py = Math.round((cy(x) + d) * k), i = (py * cv.width + px) * 4;
    sum[d - LO] += 0.3 * img.data[i] + 0.59 * img.data[i + 1] + 0.11 * img.data[i + 2]; n[d - LO]++;
  }
  const p = Array.from(sum, (v, i) => v / n[i]);
  // the water just above the band's edge (12 to 16 rows above it): the river itself brightens toward the band, so the lift is measured from here
  const base = p.slice(12, 17).reduce((a, b) => a + b) / 5;
  const crest = Math.max(...p), rise = crest - base;
  let step = 0; for (let i = 1; i < p.length; i++) step = Math.max(step, Math.abs(p[i] - p[i - 1]));
  return { rise, step, share: rise > 0 ? step / rise : null, lead: p.slice(18, 30).map(v => Math.round(v)), all: p.map(v => Math.round(v)).map(v => +v.toFixed(1)) };
};
{
  for (const theme of ['light', 'dark']) {
    const page = await open(theme);
    const r = await page.evaluate(PROFILE);
    check(`the current band is soft in ${eng}, ${theme} theme (no pixel row carries 40% of its lift)`, soft(r, theme), `lift ${r.rise.toFixed(1)} levels, steepest row ${r.step.toFixed(2)} = ${r.share?.toFixed(2)} of it; the water, then the edge: ${r.lead.join(' ')}`);
    await page.close();
  }
  // the control that the clause can fail: the band removed (the fill line cut out), in each theme, must NOT read as a soft band
  for (const theme of ['light', 'dark']) {
    const gone = await b4.newContext();
    await gone.route('**/ferry/render.js*', async route => {
      const res = await route.fetch(), body = (await res.text()).replace('g.fillStyle = `${tint}${a.toFixed(4)})`; g.fill(currentLayer(k));', '');
      await route.fulfill({ response: res, body });
    });
    const q = await open(theme, gone), none = await q.evaluate(PROFILE);
    check(`control: with the band removed, the ${theme} clause reads no band in ${eng}`, !soft(none, theme), `lift ${none.rise.toFixed(1)} (needs more than ${MIN_LIFT[theme]}), steepest row ${none.step.toFixed(2)} = ${none.share?.toFixed(2)}`);
    await gone.close();
  }
  // the control: the old band, restored (a blur through ctx.filter). It must read as a hard ribbon where the engine ignores the filter.
  const hard = await b4.newContext();
  await hard.route('**/ferry/render.js*', async route => {
    const res = await route.fetch(), body = (await res.text()).replace('g.fillStyle = `${tint}${a.toFixed(4)})`; g.fill(currentLayer(k));', "if (CURRENT_GROW[k] === 0) { g.save(); g.filter = 'blur(6px)'; g.fillStyle = dark ? 'rgba(200,210,230,0.08)' : 'rgba(255,252,240,0.45)'; g.fill(currentLayer(k)); g.restore(); }");
    await route.fulfill({ response: res, body });
  });
  const q = await open('light', hard);
  const old = await q.evaluate(PROFILE), blurWorks = await q.evaluate(() => { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(6px)'; c.fillStyle = '#000'; c.fillRect(20, 20, 20, 20); return c.getImageData(19, 30, 1, 1).data[3] > 0; });
  check(`control: the old blur(6px) band, put back, is a hard ribbon in ${eng} (${blurWorks ? 'this engine blurs it, so it stays soft' : 'this engine draws it unblurred'})`, blurWorks ? soft(old, 'light') : old.rise > MIN_LIFT.light && old.share >= 0.4, `steepest row ${old.share?.toFixed(2)} of a ${old.rise.toFixed(1)} lift across the edge ${old.all.slice(18, 40).join(' ')}`);
  await hard.close();
}
await h.done();

