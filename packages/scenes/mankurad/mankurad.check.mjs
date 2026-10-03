// Browser checks for Mankurad that a Node test cannot reach:
//
//   node packages/scenes/mankurad/mankurad.check.mjs
//
// 1. progress holds the story at a beat: the status names the work, the canvas
//    does not change over three seconds (control: with no progress it does),
//    0 is the hanging fruit and 1 the fallen one;
// 2. the still is the plate's: the same pixels in quiet and in warm under
//    reduced motion;
// 3. the rain keeps off the page's words (control: the same boxes with no
//    words catch it);
// 4. playful: Enter tells the story again from the start;
// 5. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=mankurad&${q}`;
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 30 s'); await h.done(); });
  return r;
};
const stageData = (page, k) => page.evaluate(k => window.__piece.shadowRoot.querySelector('.stage').dataset[k], k);
const grab = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const s = 2, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), px = new Array(w * hh * 3);
  let hash = 0;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; px[o] = d[i]; px[o + 1] = d[i + 1]; px[o + 2] = d[i + 2]; hash = (hash * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) >>> 0; }
  const el = window.__piece, st = el.shadowRoot.querySelector('.stage').getBoundingClientRect(), k = 1000 / st.width;
  const words = [...el.children].map(c => { const r = c.getBoundingClientRect(); return { x: (r.left - st.left) * k, y: (r.top - st.top) * k, w: r.width * k, h: r.height * k }; });
  return { w, h: hh, kx: 1000 / w, ky: 1000 / hh, px, hash, words };
});
async function frozen(q) {
  const { ctx, page } = await h.open(scene(q));
  await page.waitForFunction(() => window.__frozen === true, null, { timeout: 90000 });
  const img = await grab(page);
  await ctx.close();
  return img;
}
function diff(a, b, box = { x: 0, y: 0, w: 1000, h: 1000 }, th = 30) {
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

// 1. progress holds the story
{
  const { ctx, page } = await open('/packages/scenes/mankurad/demo.html?register=warm&progress=0.4&content=0');
  await page.waitForTimeout(1200);
  const a = await grab(page); await page.waitForTimeout(3000); const b = await grab(page);
  const said = await page.evaluate(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent);
  check('progress: the status names the work', said === 'Order progress: 40% done', `"${said}"`);
  check('progress=0.4: the canvas does not change over three seconds', a.hash === b.hash, `${a.hash} then ${b.hash}`);
  await page.evaluate(() => window.__piece.setAttribute('progress', '1'));
  await page.waitForTimeout(600);
  const done = await stageData(page, 'mango');
  await page.evaluate(() => window.__piece.setAttribute('progress', '0'));
  await page.waitForTimeout(600);
  const start = await stageData(page, 'mango');
  check('progress 1 is the fallen mango, 0 the hanging one', done === 'down' && start === 'hang', `1: ${done}, 0: ${start}`);
  await ctx.close();
  const free = await open('/packages/scenes/mankurad/demo.html?register=warm&content=0');
  await free.page.waitForTimeout(1200);
  const c = await grab(free.page); await free.page.waitForTimeout(3000); const d = await grab(free.page);
  check('control: with no progress, the same canvas changes', c.hash !== d.hash, `${c.hash} then ${d.hash}`);
  await free.ctx.close();
}

// 2. the still
{
  const stillOf = async (q, opts) => { const { ctx, page } = await open(scene(q), opts); await page.waitForTimeout(400); const g = await grab(page); await ctx.close(); return g; };
  const quiet = await stillOf('register=quiet'), reduced = await stillOf('register=warm', { reduced: true });
  check('the still: quiet and warm under reduced motion paint the same frame', diff(quiet, reduced, undefined, 6) < 0.002, `${pct(diff(quiet, reduced, undefined, 6))} differ`);
}

// 3. the rain keeps off the words (playful: the story's own clock; the rain is heavy at 25 s)
{
  const w1 = await frozen('register=playful&freeze=25&content=1'), w2 = await frozen('register=playful&freeze=25.05&content=1');
  const b1 = await frozen('register=playful&freeze=25'), b2 = await frozen('register=playful&freeze=25.05');
  const avg = (a, b) => w1.words.reduce((m, box) => m + diff(a, b, box), 0) / w1.words.length;
  const under = avg(w1, w2), bare = avg(b1, b2);
  check('rain: under the words nothing moves while it rains', w1.words.length > 0 && under < 0.001, `${pct(under)} in ${w1.words.length} boxes`);
  check('control: the same boxes with no words catch the rain', bare > 0.004, pct(bare));
}

// 4. playful: Enter tells it again
{
  const { ctx, page, errors } = await open('/packages/scenes/mankurad/demo.html?register=playful&content=0');
  await page.waitForTimeout(6000);
  const before = Number(await stageData(page, 'lt'));
  await page.locator('sg-scene').locator('.stage').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const after = Number(await stageData(page, 'lt'));
  check('playful: Enter tells the story again from the start', before > 4 && after < 1.5, `${before} s into the story, then ${after} s`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 5. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/mankurad/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/mankurad/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
