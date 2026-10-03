// Browser checks for the veranda staged in 3D (stage.html): the still comes first, and the depth is exact.
//
//   node packages/scenes/veranda/stage.check.mjs            (or: npm run check)
//   node packages/scenes/veranda/stage.check.mjs --break    (against broken pages: the checks marked below must FAIL)
//
// What a person sees is what is measured: the picture element's own screenshot, decoded and read.
// A finished veranda means paper covered (over 80% of the pixels are not paper) and the near pillar
// where the geometry puts it, in laterite red.
//
//  1. control, live: warm on the GPU draws live and asks for three.js (so the request detector can see it);
//  2. WebGL disabled: the 2D tier, a finished still, no three.js requested;
//  3. three blocked: the 2D tier says why, a finished still;
//  4. reduced motion: the 2D tier, a finished still, no request for three.js;
//  5. quiet: the 2D tier, a finished still, no request for three.js;
//  6. before three loads: with three.js held back for five seconds, the still is already on screen;
//  7. the depth map: at known points of the geometry the map's byte is the encoded distance within one step;
//     a 3 px blurred copy of the same map must fail the same test (the control);
//  8. the maps are the size the drawing's aspect asks for, and the page has no console errors;
// 10. no GPU stall per frame: sixty frames of a moving camera on the live tier read no pixels back (--break puts the old line back);
//  9. no pale rim: on the live tier the colour just outside the near pillar's right edge (against the beam) and the
//     lamp's left edge (against the ceiling) is the blurred thing behind it, not sky. Cause found on 29 Sep 2026: the layers
//     map's blue (subject) made <sg-depth-photo> erode the far layer around the pillar and inpaint from the far side,
//     and the inpaint walked out to sky. Only the lamp is the subject now, and its solids are the lantern's own shape.
//     --break also marks the pillars as the subject again, and the rim check must go red.
//
// --break: the page awaits three.js before drawing anything (6 must fail), and the page's own depth map
// is written blurred (the two depth checks must fail).

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';
import { projectM, depthByte, S, gbuffer, SOLIDS, GW, GH } from './world.js';

const BREAK = process.argv.includes('--break');
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const server = await startServer({ quiet: true });
const browser = await chromium.launch({ args: GPU });
const WORLD_JS = new RegExp('veranda/world' + String.fromCharCode(92) + '.js');
const THREE = /\/node_modules\/three\/|three\.named\.js|\/three(\.module|\.core)?\.js/;
const PILLAR = projectM(1.5, 1.2, 3.22).slice(0, 2);

async function open({ register = 'warm', reduced = false, noGL = false, blockThree = false, holdThree = 0, patch = null, assetsPatch = null, worldPatch = null, dpPatch = null, spyReads = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const requests = [], errors = [], warnings = [];
  context.on('request', r => requests.push(r.url()));
  if (noGL) await context.addInitScript("const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); };");
  if (blockThree) await context.route(THREE, r => r.abort());
  if (holdThree) await context.route(THREE, async r => { await new Promise(res => setTimeout(res, holdThree)); r.continue().catch(() => {}); });
  if (patch) await context.route(/veranda\/stage\.html/, async r => { const res = await r.fetch(); r.fulfill({ response: res, body: patch(await res.text()) }); });
  if (assetsPatch) await context.route(/veranda\/assets\.js/, async r => { const res = await r.fetch(); r.fulfill({ response: res, body: assetsPatch(await res.text()) }); });
  if (spyReads) await context.addInitScript("window.__reads = 0; const rp = WebGL2RenderingContext.prototype.readPixels; WebGL2RenderingContext.prototype.readPixels = function (...a) { window.__reads++; return rp.apply(this, a); };");
  if (dpPatch) await context.route(/depth-photo[/]depth-photo[.]js$/, async r => { const res = await r.fetch(); r.fulfill({ response: res, body: dpPatch(await res.text()) }); });
  if (worldPatch) await context.route(WORLD_JS, async r => { const res = await r.fetch(); r.fulfill({ response: res, body: worldPatch(await res.text()) }); });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  await page.goto(`${server.url}/packages/scenes/veranda/stage.html?register=${register}&theme=light`);
  return { context, page, requests, errors, warnings, three: () => requests.filter(u => THREE.test(u)) };
}

/** Decode a screenshot of the picture element and measure it: how much is not paper, and the colour where the near pillar should be. */
async function seen(page, wait = true) {
  const dp = page.locator('#dp');
  if (!wait && !(await dp.count())) return { blank: 1, pillar: [0, 0, 0], laterite: false, size: [0, 0] }; // nothing on the page to look at
  await dp.waitFor({ timeout: 60000 });
  const png = (await dp.screenshot()).toString('base64');
  return page.evaluate(async ([png, [pu, pv]]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0, blank = 0;
    for (let i = 0; i < d.length; i += 4) { n++; if (d[i] > 225 && d[i + 1] > 222 && d[i + 2] > 212) blank++; }
    const px = g.getImageData(Math.round(pu * c.width) - 3, Math.round(pv * c.height) - 3, 7, 7).data;
    let r = 0, gg = 0, b = 0; for (let i = 0; i < px.length; i += 4) { r += px[i]; gg += px[i + 1]; b += px[i + 2]; }
    const k = px.length / 4; r /= k; gg /= k; b /= k;
    return { blank: blank / n, pillar: [r | 0, gg | 0, b | 0], laterite: r > 110 && r - b > 40 && r > gg + 25, size: [img.width, img.height] };
  }, [png, PILLAR]);
}
const finished = s => s.blank < 0.2 && s.laterite;
const show = s => `${(s.blank * 100).toFixed(0)}% paper, near pillar rgb(${s.pillar.join(',')})`;
async function tierAndWait(p, want) {
  await p.page.waitForFunction(w => { const dp = document.getElementById('dp'); return dp && dp.dataset.drawn !== undefined && (!w || dp.tier === w); }, want, { timeout: 60000 }).catch(() => {});
  await p.page.waitForTimeout(400);
  return p.page.evaluate(() => ({ tier: document.getElementById('dp')?.tier, drawn: document.getElementById('dp')?.dataset.drawn !== undefined }));
}

// 1. the live control
{
  const p = await open();
  const t = await tierAndWait(p, 'live');
  const s = await seen(p.page);
  check('control: warm on the GPU draws live, asks for three.js, and shows the finished veranda', t.tier === 'live' && p.three().length > 0 && finished(s), `tier ${t.tier}, ${p.three().length} three requests, ${show(s)}`);
  check('the stage page has no console errors', p.errors.length === 0, p.errors[0] ?? '');
  await p.context.close();
}
// 2. WebGL disabled
{
  const p = await open({ noGL: true });
  const t = await tierAndWait(p);
  const s = await seen(p.page);
  check('with WebGL disabled: the 2D tier, a finished still, no three.js requested', t.tier === '2d' && t.drawn && finished(s) && p.three().length === 0, `tier ${t.tier}, ${p.three().length} three requests, ${show(s)}`);
  await p.context.close();
}
// 3. three blocked
{
  const p = await open({ blockThree: true });
  const t = await tierAndWait(p, '2d');
  const s = await seen(p.page);
  const reason = await p.page.evaluate(() => document.getElementById('tier').textContent);
  check('with three.js blocked: the 2D tier says why, and shows a finished still', t.tier === '2d' && t.drawn && finished(s) && /three\.js did not load/.test(reason), `tier ${t.tier}, "${reason}", ${show(s)}`);
  await p.context.close();
}
// 4 and 5. reduced motion, quiet
for (const [label, opts] of [['reduced motion', { reduced: true }], ['quiet', { register: 'quiet' }]]) {
  const p = await open(opts);
  const t = await tierAndWait(p);
  const s = await seen(p.page);
  check(`${label}: the 2D tier, a finished still, and three.js is never requested`, t.tier === '2d' && t.drawn && finished(s) && p.three().length === 0, `tier ${t.tier}, ${p.three().length} three requests, ${show(s)}`);
  await p.context.close();
}
// 6. the still is on screen before three loads
{
  const patch = BREAK ? h => h.replace('const a = await verandaAssets({ mood });', "await import('three'); const a = await verandaAssets({ mood });") : null;
  const p = await open({ holdThree: 6000, patch });
  await p.page.waitForTimeout(4500); // long enough for the drawing to be made, short of the six seconds three.js is held
  const s = await seen(p.page, false);
  const pending = p.three().length > 0 && !(await p.page.evaluate(() => document.getElementById('dp')?.dataset.drawn !== undefined));
  check('the still is on screen while three.js is still loading', finished(s) && pending, `${show(s)}; three.js requested and not yet answered: ${pending}`);
  await p.context.close();
}
// 7. the depth map is exact at known points, and a blurred copy of it is not
{
  // --break serves the depth map already blurred: the exactness check must then go red on the page's own map
  const blurred = BREAK ? src => src.replace('toBlob(depthCanvas(g))', 'toBlob(blurCanvas(depthCanvas(g)))') + '\nfunction blurCanvas(c) { const o = Object.assign(document.createElement("canvas"), { width: c.width, height: c.height }), g = o.getContext("2d"); g.filter = "blur(3px)"; g.drawImage(c, 0, 0); return o; }\n' : null;
  const p = await open({ register: 'quiet', assetsPatch: blurred });
  await tierAndWait(p);
  const px = (projectM(1.681, 1.2, 3.22)[0] - projectM(1.68, 1.2, 3.22)[0]) * 600 * 1000; // pixels of a 600-wide map per millimetre
  const points = [['the near pillar, front face', 1.5, 1.2, 3.22], ['the near pillar, 2 px inside its right edge', 1.68 - 2 / px, 1.2, 3.22], ['the far pillar, front face', 1.5, 1.2, 10.72], ['the door leaf', -1.24, 1.9, 7], ['the balcao seat, top', 1.1, 0.46, 4.5], ['the floor, near', 0, 0, 2.6], ['the floor, middle', 0, 0, 5], ['the floor, far', 0, 0, 9], ['the wall, above the door', -1.35, 2.7, 6], ['the lamp, front', 0.25, 2.37, 4.26]]
    .map(([name, x, y, z]) => ({ name, at: projectM(x, y, z).slice(0, 2), want: depthByte(z * S) }));
  const r = await p.page.evaluate(async ({ points }) => {
    const url = document.getElementById('dp').getAttribute('depth');
    const img = new Image(); img.src = url; await img.decode();
    const read = (blur) => {
      const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }), g = c.getContext('2d', { willReadFrequently: true });
      if (blur) g.filter = 'blur(3px)';
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, c.width, c.height);
    };
    const test = d => points.filter(p => Math.abs(d.data[(Math.min(d.height - 1, Math.floor(p.at[1] * d.height)) * d.width + Math.min(d.width - 1, Math.floor(p.at[0] * d.width))) * 4] - p.want) > 1).map(p => p.name);
    const exact = read(false), blurred = read(true);
    return { size: [img.width, img.height], exact: test(exact), blurred: test(blurred) };
  }, { points });
  check('the depth map is exact at every known point (within one step of 255)', r.exact.length === 0, r.exact.length ? `off at: ${r.exact.join('; ')}` : `${points.length} points on a ${r.size.join(' x ')} map`);
  check('control: the same map with a 3 px blur fails at some of those points', r.blurred.length > 0, `off at: ${r.blurred.join('; ') || 'none'}`);
  check('the depth map has the drawing\'s aspect (3:2)', Math.abs(r.size[0] / r.size[1] - 1.5) < 1e-9, r.size.join(' x '));
  await p.context.close();
}

// 9. no pale rim at a depth edge. On the live tier the colour just outside a near thing's edge must be the blurred thing behind it.
//    Where that is dark (the roof, the beam), a lighter pixel 0 to 2 px out of the edge is sky carried across it: the near pillar's
//    right edge (row by row, from the cap down) and the lamp's left edge.
{
  const edge = (x, y, z, d, focus) => ({ at: projectM(x, y, z).slice(0, 2), d, focus });
  const cases = [
    { what: "the near pillar's right edge", side: 1, ...edge(1.68, 1.2, 3.22, 0.75, 0.76), rows: [0.22, 0.62] },
    { what: "the lamp's left edge", side: -1, ...edge(0.09, 2.37, 4.26, 0.55, 0.55), rows: [0.06, 0.1] },
  ];
  const patch = BREAK ? src => src.replace("box(`pillar${i}`, 'laterite', 1.32, 1.68, 0.3, 2.0, zc - PILLAR, zc + PILLAR),", "box(`pillar${i}`, 'laterite', 1.32, 1.68, 0.3, 2.0, zc - PILLAR, zc + PILLAR, { subject: true }),") : null;
  const p = await open({ register: 'warm', worldPatch: patch });
  const t = await tierAndWait(p, 'live');
  for (const c of cases) {
    const r = await p.page.evaluate(async ({ at, d, focus, side, rows }) => {
      // an export-size target: its look pass is at the drawing's own resolution, which shows an edge most plainly
      const tg = await window.__dp.canvasFor(1200, 800); tg.set({ focus });
      const cv = await tg.renderFrame(0), g = document.createElement('canvas'); g.width = 1200; g.height = 800;
      const x = g.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0);
      const X = Math.round(tg.place(at[0], at[1], d)[0]), lum = q => 0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2];
      let tested = 0, worst = 0, where = null;
      for (let Y = Math.round(800 * rows[0]); Y < Math.round(800 * rows[1]); Y += 2) {
        const far = lum(x.getImageData(X + side * 9, Y, 1, 1).data);
        if (far > 90) continue; // the background here is light: nothing to be paler than
        tested++;
        const near = Math.max(lum(x.getImageData(X, Y, 1, 1).data), lum(x.getImageData(X + side, Y, 1, 1).data), lum(x.getImageData(X + side * 2, Y, 1, 1).data));
        // the pillar's own ink line sits at the edge, so a row whose edge pixel is not dark is a different edge: skip it
        if (near - far > worst) { worst = near - far; where = [X, Y, Math.round(near), Math.round(far)]; }
      }
      tg.release();
      return { tested, worst: Math.round(worst), where };
    }, { at: c.at, d: c.d, focus: c.focus, side: c.side, rows: c.rows });
    check(`no pale rim: ${c.what} (live tier, focus ${c.focus})`, t.tier === 'live' && r.tested >= 5 && r.worst < 40, `${r.tested} dark-background rows tested, brightest excess out of the edge ${r.worst}${r.worst >= 40 ? `, at ${JSON.stringify(r.where)} (x, y, pixel, background)` : ''}`);
  }
  await p.context.close();
}

// 10. no GPU stall per frame: after the first frame the live tier never reads pixels back. (A harvested line, `!this.dataset.drawn`,
//     was true for the empty string that data-drawn holds, so every drawn frame did a readPixels: a GPU sync that cost 14 ms a
//     frame once anything else drew beside the picture. --break puts the line back.)
{
  const fix = "if (!this.#ready || this.dataset.drawn === undefined) {", bug = "if (!this.#ready || !this.dataset.drawn) {";
  const p = await open({ register: 'warm', spyReads: true, dpPatch: BREAK ? src => src.replace(fix, bug) : null });
  const t = await tierAndWait(p, 'live');
  await p.page.waitForTimeout(500);
  const reads = await p.page.evaluate(async () => {
    const dp = window.__dp, before = window.__reads;
    await new Promise(res => { let i = 0; const f = () => { dp.set({ dolly: (i % 60) / 60 }); if (++i < 60) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return window.__reads - before;
  });
  check('no GPU stall per frame: sixty frames of a moving camera on the live tier read no pixels back', t.tier === 'live' && reads <= 2, `${reads} readPixels calls in 60 frames`);
  await p.context.close();
}

await browser.close(); await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} pass${BREAK ? ' (--break: the still-before-three check and the depth check should FAIL)' : ''}`);
process.exit(BREAK ? 0 : failed ? 1 : 0);
