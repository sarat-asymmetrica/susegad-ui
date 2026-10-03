// Browser checks for Vad that a Node test cannot reach:
//
//   node packages/scenes/vad/vad.check.mjs
//
// 1. progress holds the growth: the canvas is unchanged over three seconds and
//    the status names the work (control: with no progress the tree grows);
// 2. the still is the grown tree, the same pixels in quiet and in warm under
//    reduced motion (control: a frame early in the growth differs);
// 3. under the page's words the tree is shown grown and still while it grows
//    elsewhere (control: the same boxes with no words change);
// 4. playful: Enter grows a new banyan;
// 5. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=vad&${q}`;
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
  return { w, h: hh, kx: 1200 / w, ky: 800 / hh, px, words, grown: Number(el.shadowRoot.querySelector('.stage').dataset.grown) };
});
function diff(a, b, box = { x: 0, y: 0, w: 1200, h: 800 }, th = 24) {
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

// 1. progress holds
{
  const { ctx, page } = await open(scene('register=warm&progress=0.4&label=Setting%20up'));
  await page.waitForTimeout(1200);
  const a = await grab(page); await page.waitForTimeout(3000); const b = await grab(page);
  const said = await page.evaluate(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent);
  await ctx.close();
  check('progress=0.4: the growth holds still over three seconds', diff(a, b, undefined, 0) === 0 && Math.abs(a.grown - 0.4) < 0.01, `${pct(diff(a, b, undefined, 0))} changed; grown ${a.grown}`);
  check('progress=0.4: the status names the work', said === 'Setting up: 40% done', `"${said}"`);
  const free = await open(scene('register=warm'));
  await free.page.waitForTimeout(8000); const c = await grab(free.page); await free.page.waitForTimeout(3000); const d = await grab(free.page); await free.ctx.close();
  check('control: with no progress, the tree grows', d.grown > c.grown && diff(c, d) > 0.005, `grown ${c.grown} to ${d.grown}; ${pct(diff(c, d))} changed`);
}

// 2. the still
{
  const stillOf = async (q, opts) => { const { ctx, page } = await open(scene(q), opts); await page.waitForTimeout(400); const g = await grab(page); await ctx.close(); return g; };
  const quiet = await stillOf('register=quiet'), reduced = await stillOf('register=warm', { reduced: true }), early = await stillOf('register=warm&progress=0.2');
  check('the still: quiet and warm under reduced motion paint the same grown tree', quiet.grown === 1 && diff(quiet, reduced, undefined, 0) === 0, `grown ${quiet.grown}; ${pct(diff(quiet, reduced, undefined, 0))} differ`);
  check('control: a tree a fifth grown differs from the still', diff(quiet, early) > 0.05, pct(diff(quiet, early)));
}

// 3. calm: grown and still under the words
{
  const pair = async content => {
    const { ctx, page } = await open(`/packages/scenes/vad/demo.html?register=warm&place=center&content=${content}`);
    // the canopy round the middle grows from about ten seconds in
    await page.waitForTimeout(11000); const a = await grab(page); await page.waitForTimeout(4000); const b = await grab(page);
    await ctx.close(); return [a, b];
  };
  const [w1, w2] = await pair(1), [b1, b2] = await pair(0);
  const avg = (a, b) => w1.words.reduce((m, box) => m + diff(a, b, box), 0) / w1.words.length;
  const under = avg(w1, w2), bare = avg(b1, b2);
  check('calm: under the words the tree is shown grown and still while it grows', w1.words.length > 0 && under < 0.001 && w2.grown < 1, `${pct(under)} in ${w1.words.length} boxes; grown ${w2.grown}`);
  check('control: the same boxes with no words change as it grows', bare > 0.01, pct(bare));
}

// 4. playful: Enter grows a new banyan
{
  const { ctx, page, errors } = await open('/packages/scenes/vad/demo.html?register=playful&content=0&progress=1');
  const seedBefore = await page.evaluate(() => window.__piece.seed);
  const before = await grab(page);
  await page.locator('sg-scene').locator('.stage').focus();
  await page.keyboard.press('Enter'); await page.waitForTimeout(600);
  const after = await grab(page), seedAfter = await page.evaluate(() => window.__piece.seed);
  check('playful: Enter grows a new banyan (a new seed, a different tree)', seedAfter !== seedBefore && diff(before, after) > 0.05, `seed ${seedBefore} to ${seedAfter}; ${pct(diff(before, after))} changed`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 5. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/vad/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/vad/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
