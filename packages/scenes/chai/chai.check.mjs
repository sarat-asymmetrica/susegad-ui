// Browser checks for Chai that a Node test cannot reach:
//
//   node packages/scenes/chai/chai.check.mjs
//
// 1. lit is the lamp's state: lit="false" leaves no flame at the wick
//    (control: lit="true" shows one), and changing the attribute lights it;
// 2. the still is the plate's moment, the same pixels in quiet and in warm
//    under reduced motion;
// 3. steam never drifts through the page's words (control: the same boxes
//    with no words catch it);
// 4. playful: Enter by the lamp puts it out;
// 5. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';
import { FLAME, DIYA } from './model.js';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=chai&${q}`;
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 30 s'); await h.done(); });
  await r.page.evaluate(() => document.fonts.ready);
  return r;
};
const grab = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const s = 2, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), px = new Array(w * hh * 3);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; px[o] = d[i]; px[o + 1] = d[i + 1]; px[o + 2] = d[i + 2]; }
  const el = window.__piece, st = el.shadowRoot.querySelector('.stage').getBoundingClientRect(), k = 1200 / st.width;
  const words = [...el.children].map(c => { const r = c.getBoundingClientRect(); return { x: (r.left - st.left) * k, y: (r.top - st.top) * k, w: r.width * k, h: r.height * k }; });
  return { w, h: hh, kx: 1200 / w, ky: 520 / hh, px, words };
});
function count(a, box, test) {
  let n = 0, c = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const lx = x * a.kx, ly = y * a.ky;
    if (lx < box.x || lx > box.x + box.w || ly < box.y || ly > box.y + box.h) continue;
    const o = (y * a.w + x) * 3; n++;
    if (test(a.px[o], a.px[o + 1], a.px[o + 2])) c++;
  }
  return n ? c / n : 0;
}
function diff(a, b, box, th = 18) {
  let n = 0, c = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const lx = x * a.kx, ly = y * a.ky;
    if (lx < box.x || lx > box.x + box.w || ly < box.y || ly > box.y + box.h) continue;
    const o = (y * a.w + x) * 3; n++;
    if (Math.abs(a.px[o] - b.px[o]) + Math.abs(a.px[o + 1] - b.px[o + 1]) + Math.abs(a.px[o + 2] - b.px[o + 2]) > th) c++;
  }
  return n ? c / n : 0;
}
const pct = v => `${(v * 100).toFixed(2)}%`;
const FLAMEBOX = { x: FLAME.x - 16, y: FLAME.y - 64, w: 32, h: 60 };
const flame = (r, g, b) => r > 220 && g > 130 && b < 150 && r - b > 90;

// 1. lit is the lamp's state
{
  const { ctx, page } = await open(scene('register=warm&lit=false'));
  await page.waitForTimeout(1200);
  const out = count(await grab(page), FLAMEBOX, flame);
  await page.evaluate(() => window.__piece.setAttribute('lit', 'true'));
  await page.waitForTimeout(1500);
  const relit = count(await grab(page), FLAMEBOX, flame);
  await ctx.close();
  const on = await open(scene('register=warm'));
  await on.page.waitForTimeout(1200);
  const lit = count(await grab(on.page), FLAMEBOX, flame);
  await on.ctx.close();
  check('lit="false": no flame at the wick', out < 0.005, `${pct(out)} flame pixels`);
  check('control: lit (the default) shows a flame there', lit > 0.05, `${pct(lit)}`);
  check('setting lit="true" lights it again', relit > 0.05, `${pct(relit)}`);
}

// 2. the still
{
  const stillOf = async (q, opts) => { const { ctx, page } = await open(scene(q), opts); await page.waitForTimeout(400); const g = await grab(page); await ctx.close(); return g; };
  const quiet = await stillOf('register=quiet'), reduced = await stillOf('register=warm', { reduced: true });
  check('the still: quiet and warm under reduced motion paint the same sheet', diff(quiet, reduced, { x: 0, y: 0, w: 1200, h: 520 }, 0) === 0, pct(diff(quiet, reduced, { x: 0, y: 0, w: 1200, h: 520 }, 0)));
}

// 3. steam keeps off the words (they sit top left, over the glass's steam)
{
  const pair = async content => {
    const { ctx, page } = await open(`/packages/scenes/chai/demo.html?register=warm&content=${content}`);
    // five moments 400 ms apart: a wisp is thin, so one pair of frames can miss it on a loaded machine
    await page.waitForTimeout(3000); const shots = [];
    for (let k = 0; k < 5; k++) { shots.push(await grab(page)); await page.waitForTimeout(400); }
    await ctx.close(); return shots;
  };
  const W1 = await pair(1), B1 = await pair(0), words = W1[0].words;
  const total = shots => shots.slice(1).reduce((m, s, k) => m + words.reduce((n, box) => n + diff(shots[k], s, box), 0) / words.length, 0);
  const w1 = W1[0], under = total(W1), bare = total(B1);
  check('calm: no steam drifts through the words', w1.words.length > 0 && under < 0.0005, `${pct(under)} in ${w1.words.length} boxes`);
  check('control: the same boxes with no words catch the steam (summed over four intervals)', bare > 0.003, pct(bare));
}

// 4. playful: Enter by the lamp puts it out
{
  const { ctx, page, errors } = await open('/packages/scenes/chai/demo.html?register=playful&content=0');
  await page.locator('sg-scene').locator('.stage').focus();
  // the hand starts in the middle of the sheet, beside the lamp
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
  const before = await page.evaluate(() => window.__piece.shadowRoot.querySelector('.stage').dataset.lit);
  await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  const after = await page.evaluate(() => window.__piece.shadowRoot.querySelector('.stage').dataset.lit);
  const out = count(await grab(page), FLAMEBOX, flame);
  check('playful: Enter by the lamp puts it out', before === '1' && after === '0' && out < 0.005, `lit ${before} to ${after}; ${pct(out)} flame pixels`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 5. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/chai/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/chai/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}
void DIYA;

await h.done();
