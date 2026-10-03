// Browser checks for Maun that a Node test cannot reach:
//
//   node packages/scenes/maun/maun.check.mjs
//
// 1. the same seed paints the same pixels on two separate pages (control: the
//    next seed paints different ones);
// 2. the still is the finished painting: under reduced motion, warm shows all
//    34 passes and the same pixels as quiet (control: a frozen clock at the
//    start of the making shows one pass and different pixels);
// 3. once finished, the painting barely moves (the breath), where the making
//    changes it plainly from one second to the next;
// 4. the breath keeps away from the words laid over the painting (control: the
//    same box with no words does change);
// 5. playful: Enter scrapes a band back where the keyboard hand is;
// 6. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=maun&${q}`;
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  // a scene that never draws its first frame never becomes ready: say so, then stop
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 20 s'); await h.done(); });
  return r;
};
const grab = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const s = 4, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), px = new Array(w * hh * 3);
  let hash = 0;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; px[o] = d[i]; px[o + 1] = d[i + 1]; px[o + 2] = d[i + 2]; hash = (hash * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) >>> 0; }
  return { w, h: hh, kx: 1200 / w, ky: 800 / hh, px, hash, passes: window.__piece.shadowRoot.querySelector('.stage').dataset.passes };
});
async function frozen(q) {
  const { ctx, page } = await h.open(scene(q));
  await page.waitForFunction(() => window.__frozen === true, null, { timeout: 60000 });
  const img = await grab(page);
  // the words' own boxes in the scene's units: what the element reports as calm
  img.words = await page.evaluate(() => {
    const el = window.__piece, s = el.shadowRoot.querySelector('.stage').getBoundingClientRect(), k = 1200 / s.width;
    return [...el.children].map(c => { const r = c.getBoundingClientRect(); return { x: (r.left - s.left) * k, y: (r.top - s.top) * k, w: r.width * k, h: r.height * k }; });
  });
  await ctx.close();
  return img;
}
function diff(a, b, box = { x: 0, y: 0, w: 1200, h: 800 }, th = 6) {
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

// 1. a seed is a painting
{
  const once = async seed => { const { ctx, page } = await open(scene(`register=quiet&seed=${seed}`)); await page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.passes === '34/34', null, { timeout: 8000 }).catch(() => {}); const g = await grab(page); await ctx.close(); return g; };
  const a = await once(5), b = await once(5), c = await once(6);
  check('the same seed paints the same pixels on two pages', a.hash === b.hash, `${a.hash} and ${b.hash}`);
  check('control: the next seed paints different pixels', a.hash !== c.hash, `${a.hash} and ${c.hash}`);
}

// 2. the still is the finished painting
{
  const q = await open(scene('register=quiet&seed=2'));
  await q.page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.passes === '34/34', null, { timeout: 8000 }).catch(() => {});
  const quiet = await grab(q.page); await q.ctx.close();
  const r = await open(scene('register=warm&seed=2'), { reduced: true });
  await r.page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.passes === '34/34', null, { timeout: 5000 }).catch(() => {});
  const still = await grab(r.page); await r.ctx.close();
  check('reduced motion: warm shows the finished painting, the same pixels as quiet', still.passes === '34/34' && diff(still, quiet) < 0.001, `${still.passes} passes, ${pct(diff(still, quiet))} of pixels differ from quiet`);
  const start = await frozen('register=warm&seed=2&freeze=0.05');
  check('control: at the start of the making, one pass and different pixels', start.passes === '1/34' && diff(start, quiet) > 0.2, `${start.passes} passes, ${pct(diff(start, quiet))} differ`);
}

// 3. finished, it barely moves
{
  const m1 = await frozen('register=warm&seed=2&freeze=3'), m2 = await frozen('register=warm&seed=2&freeze=4');
  const f1 = await frozen('register=warm&seed=2&freeze=20'), f2 = await frozen('register=warm&seed=2&freeze=21');
  const making = diff(m1, m2, undefined, 40), resting = diff(f1, f2, undefined, 40);
  check('finished, a second changes under 2% of the painting; making, far more', resting < 0.02 && making > 5 * Math.max(resting, 0.002), `making ${pct(making)} a second, resting ${pct(resting)}`);
}

// 4. the breath keeps away from the words
{
  const w1 = await frozen('register=warm&seed=2&freeze=14&content=1'), w2 = await frozen('register=warm&seed=2&freeze=44&content=1');
  const b1 = await frozen('register=warm&seed=2&freeze=14'), b2 = await frozen('register=warm&seed=2&freeze=44');
  // the breath is the plate's: soft-light at 10% moves a pixel by 1 to 3 levels, so count any change at all,
  // inside the heading's and the paragraph's own boxes
  const avg = f => w1.words.reduce((m, box) => m + f(box), 0) / w1.words.length;
  const under = avg(box => diff(w1, w2, box, 0)), bare = avg(box => diff(b1, b2, box, 0));
  check('under the words the painting holds still while the breath drifts', under < 0.005, `${pct(under)} of the box changed`);
  check('control: the same box with no words does change', bare > 0.02, `${pct(bare)}`);
}

// 5. playful: Enter scrapes where the hand is
{
  const { ctx, page, errors } = await open('/packages/scenes/maun/demo.html?register=playful&content=0');
  await page.evaluate(() => window.__piece.still());
  await page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.passes === '34/34', null, { timeout: 8000 }).catch(() => {});
  const before = await grab(page);
  await page.locator('sg-scene').locator('.stage').focus();
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const after = await grab(page);
  const band = diff(before, after, { x: 300, y: 330, w: 600, h: 70 }, 12), far = diff(before, after, { x: 0, y: 600, w: 1200, h: 200 }, 12);
  check('playful: Enter scrapes a band back where the hand is, and nowhere else', band > 0.2 && far < 0.005, `${pct(band)} of the band changed, ${pct(far)} far from it`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 6. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/maun/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/maun/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
