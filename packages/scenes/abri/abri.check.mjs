// Browser checks for Abri that a Node test cannot reach:
//
//   node packages/scenes/abri/abri.check.mjs
//
// 1. the still is the lifted print, the same pixels in quiet (twice) and in
//    warm under reduced motion (control: the running tray three seconds in is
//    different);
// 2. the size holds still under the page's words while the drift moves it
//    elsewhere (control: the same boxes with no words do move);
// 3. playful: Enter drops a colour where the keyboard hand is, and the arrow
//    keys drag the colours with the hand;
// 4. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=abri&${q}`;
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 90 s'); await h.done(); });
  return r;
};
const grab = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const s = 2, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), px = new Array(w * hh * 3);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; px[o] = d[i]; px[o + 1] = d[i + 1]; px[o + 2] = d[i + 2]; }
  const el = window.__piece, st = el.shadowRoot.querySelector('.stage'), sr = st.getBoundingClientRect(), k = 1200 / sr.width;
  const words = [...el.children].map(c => { const r = c.getBoundingClientRect(); return { x: (r.left - sr.left) * k, y: (r.top - sr.top) * k, w: r.width * k, h: r.height * k }; });
  return { w, h: hh, kx: 1200 / w, ky: 860 / hh, px, words, stage: st.dataset.stage, colours: +st.dataset.colours };
});
async function frozen(q) {
  const { ctx, page } = await h.open(scene(q));
  await page.waitForFunction(() => window.__frozen === true, null, { timeout: 180000 });
  const img = await grab(page);
  await ctx.close();
  return img;
}
function diff(a, b, box = { x: 0, y: 0, w: 1200, h: 860 }, th = 40) {
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

// 1. the still is the print
{
  const stillOf = async (q, opts) => { const { ctx, page } = await open(scene(q), opts); await page.waitForTimeout(300); const g = await grab(page); await ctx.close(); return g; };
  const [a, b, c] = await Promise.all([stillOf('register=quiet&seed=1'), stillOf('register=quiet&seed=1'), stillOf('register=warm&seed=1', { reduced: true })]);
  check('the still: quiet twice and warm under reduced motion show the same print', a.stage === 'print' && diff(a, b, undefined, 0) === 0 && diff(a, c, undefined, 6) < 0.002, `stage ${a.stage}; ${pct(diff(a, b, undefined, 0))} and ${pct(diff(a, c, undefined, 6))} differ`);
  const early = await frozen('register=playful&seed=1&freeze=3');
  check('control: three seconds into the running tray, the picture differs from the print', early.stage === 'drops' && diff(a, early) > 0.2, `stage ${early.stage}, ${pct(diff(a, early))} differ`);
}

// 2. the size holds still under the words while the drift moves it elsewhere. Live pages (a frozen clock
//    runs one frame per real frame, too slow for 34 s of tray on a loaded machine): wait for the drift, then
//    two grabs half a second apart on the same page
{
  const drift = async q => {
    const { ctx, page } = await open(scene(q));
    // early in the drift, so a slow frame cannot carry the second grab into the sheet's laying
    await page.waitForFunction(() => { const u = +window.__piece.shadowRoot.querySelector('.stage').dataset.u; return u > 31.8 && u < 34; }, null, { timeout: 120000, polling: 50 }).catch(() => {});
    const a = await grab(page); await page.waitForTimeout(500); const b = await grab(page);
    await ctx.close();
    return [a, b];
  };
  const [w1, w2] = await drift('register=playful&seed=1&content=1'), [b1, b2] = await drift('register=playful&seed=1');
  const avg = (a, b) => w1.words.reduce((m, box) => m + diff(a, b, box), 0) / w1.words.length;
  const under = avg(w1, w2), bare = avg(b1, b2), rest = diff(w1, w2, { x: 700, y: 100, w: 400, h: 350 });
  check('calm: under the words the size holds still while it drifts elsewhere', w1.stage === 'drift' && w2.stage === 'drift' && under < 0.003 && rest > 0.01, `stage ${w1.stage}/${w2.stage}; ${pct(under)} under the words, ${pct(rest)} elsewhere`);
  check('control: the same boxes with no words drift', bare > 0.01, pct(bare));
}

// 3. playful: the keyboard hand drops and drags colour
{
  const { ctx, page, errors } = await open('/packages/scenes/abri/demo.html?register=playful&content=0');
  // wait for the stylus: every natural drop has landed by then
  await page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.stage === 'comb', null, { timeout: 60000 }).catch(() => {});
  const stage = page.locator('sg-scene').locator('.stage');
  await stage.focus();
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(150);
  const before = await grab(page);
  await page.keyboard.press('Enter'); await page.waitForTimeout(900);
  const after = await grab(page);
  // the hand starts at the middle (600, 430) and one press down moves it 36 units
  const hand = diff(before, after, { x: 560, y: 420, w: 80, h: 80 }), far = diff(before, after, { x: 100, y: 100, w: 200, h: 200 });
  check('playful: Enter drops one colour where the keyboard hand is', after.colours === before.colours + 1 && hand > 0.3, `${before.colours} then ${after.colours} colours; ${pct(hand)} of the hand's box changed, ${pct(far)} far away`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 4. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/abri/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/abri/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
