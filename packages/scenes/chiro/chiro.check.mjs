// Browser checks for Chiro that a Node test cannot reach:
//
//   node packages/scenes/chiro/chiro.check.mjs
//
// 1. the still is the plate's monsoon green, the same pixels in quiet and in
//    warm under reduced motion, on two separate pages (control: the running
//    scene two seconds in, pits half grown, is different);
// 2. the rain keeps off the page's words (control: the same boxes with no
//    words do catch it);
// 3. playful: Enter presses a hand to the wall where the keyboard hand is;
// 4. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=chiro&${q}`;
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 30 s'); await h.done(); });
  return r;
};
const grab = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const s = 2, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), px = new Array(w * hh * 3);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; px[o] = d[i]; px[o + 1] = d[i + 1]; px[o + 2] = d[i + 2]; }
  const el = window.__piece, st = el.shadowRoot.querySelector('.stage').getBoundingClientRect(), k = 1200 / st.width;
  const words = [...el.children].map(c => { const r = c.getBoundingClientRect(); return { x: (r.left - st.left) * k, y: (r.top - st.top) * k, w: r.width * k, h: r.height * k }; });
  return { w, h: hh, kx: 1200 / w, ky: 800 / hh, px, words };
});
async function frozen(q) {
  const { ctx, page } = await h.open(scene(q));
  await page.waitForFunction(() => window.__frozen === true, null, { timeout: 90000 });
  const img = await grab(page);
  await ctx.close();
  return img;
}
function diff(a, b, box = { x: 0, y: 0, w: 1200, h: 800 }, th = 40) {
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

// 1. the still
{
  const stillOf = async (q, opts) => {
    const { ctx, page } = await open(scene(q), opts);
    await page.waitForTimeout(300);
    const g = await grab(page); await ctx.close(); return g;
  };
  const quiet = await stillOf('register=quiet&seed=1'), quiet2 = await stillOf('register=quiet&seed=1'), reduced = await stillOf('register=warm&seed=1', { reduced: true });
  check('the still: quiet twice and warm under reduced motion paint the same wall', diff(quiet, quiet2, undefined, 0) === 0 && diff(quiet, reduced, undefined, 6) < 0.002, `${pct(diff(quiet, quiet2, undefined, 0))} and ${pct(diff(quiet, reduced, undefined, 6))} differ`);
  const early = await frozen('register=warm&seed=1&freeze=2');
  check('control: two seconds into the running scene, the wall differs from the still', diff(quiet, early) > 0.05, `${pct(diff(quiet, early))} differ`);
}

// 2. the rain keeps off the words (warm: the first rain falls about 21 s in). Two frames 0.05 s apart:
//    the rain moves about 30 units in that time, the wet front and the moss hardly at all
{
  const w1 = await frozen('register=warm&seed=1&freeze=24&content=1'), w2 = await frozen('register=warm&seed=1&freeze=24.05&content=1');
  const b1 = await frozen('register=warm&seed=1&freeze=24'), b2 = await frozen('register=warm&seed=1&freeze=24.05');
  const avg = (a, b) => w1.words.reduce((m, box) => m + diff(a, b, box), 0) / w1.words.length;
  const under = avg(w1, w2), bare = avg(b1, b2), rest = diff(w1, w2, { x: 700, y: 100, w: 450, h: 400 });
  check('rain: under the words nothing moves while it rains elsewhere', under < 0.001 && rest > 0.005, `${pct(under)} under the words, ${pct(rest)} elsewhere`);
  check('control: the same boxes with no words catch the rain', bare > 0.005, pct(bare));
}

// 3. playful: Enter presses a hand to the wall
{
  const { ctx, page, errors } = await open('/packages/scenes/chiro/demo.html?register=playful&content=0');
  await page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.steps === '1500', null, { timeout: 20000 }).catch(() => {}); // the pits are grown; the first rain is still to come
  const stage = page.locator('sg-scene').locator('.stage');
  await stage.focus();
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200);
  const before = await grab(page);
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  const after = await grab(page);
  const hand = diff(before, after, { x: 540, y: 290, w: 120, h: 150 }, 20), far = diff(before, after, { x: 0, y: 450, w: 400, h: 200 }, 20);
  // the frond's shadow sways over the whole wall, so 'nowhere else' means an order of magnitude less
  check('playful: Enter leaves a damp print where the keyboard hand is, and nowhere else', hand > 0.15 && hand > 10 * far, `${pct(hand)} of the hand's box changed, ${pct(far)} far from it`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 4. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/chiro/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/chiro/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
