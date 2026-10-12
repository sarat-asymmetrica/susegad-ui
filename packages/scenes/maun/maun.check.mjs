// Browser checks for Maun that a Node test cannot reach:
//
//   node packages/scenes/maun/maun.check.mjs
//   node packages/scenes/maun/maun.check.mjs --break   (planted faults: the checks marked --break must FAIL)
//
// 1. the same seed paints the same pixels on two separate pages (control: the
//    next seed paints different ones);
// 2. the still is the finished painting: under reduced motion, warm shows all
//    34 passes and the same pixels as quiet (control: a frozen clock at the
//    start of the making shows one pass and different pixels);
// 3. once finished, the painting barely moves (the breath), where the making
//    changes it plainly from one second to the next (--break: the breath
//    inverts the painting where it falls, and whips round);
// 4. the breath keeps away from the words laid over the painting (control: the
//    same box with no words does change; --break: the breath is not kept away);
// 5. playful: Enter scrapes a band back where the keyboard hand is (--break:
//    Enter does nothing);
// 6. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.
//
// Scene time is stepped, not waited for (tools/lib/virtual-time.mjs): the pages
// that move run on virtual frames, each step a sixtieth of a second of the
// scene's time, and a frozen moment is the same pixels the real clock gives.
// On the real clock still: the still under reduced motion (nothing moves),
// "no request leaves the page" (it watches the network), and axe.

import { harness } from '../../../tools/lib/component-check.mjs';
import { frames, frozenAt, grabPixels, hashPixels, openStepped, plantFault, until } from '../../../tools/lib/virtual-time.mjs';

const BREAK = process.argv.includes('--break');
const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=maun&${q}`;
/** A planted fault: one of Maun's files with `from` replaced; fails loudly if the line has moved. */
const plant = (...rows) => plantFault(import.meta.url, check, ...rows);
/** A page on the real clock (the still under reduced motion, the network and axe). */
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  // a scene that never draws its first frame never becomes ready: say so, then stop
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 20 s'); await h.done(); });
  return r;
};
const stepped = (path, opts) => openStepped(h, path, { ms: 20000, ...opts });
const grab = page => grabPixels(page, { stride: 4 });
const frozen = (q, opts) => frozenAt(h, scene(q), { ...opts, grab: { stride: 4 } });
const finished = page => until(page, () => window.__piece.shadowRoot.querySelector('.stage').dataset.passes === '34/34', { ms: 8000 });
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
  const once = async seed => { const { ctx, page } = await stepped(scene(`register=quiet&seed=${seed}`)); await finished(page); const g = await grab(page); await ctx.close(); return g; };
  const a = await once(5), b = await once(5), c = await once(6);
  check('the same seed paints the same pixels on two pages', hashPixels(a) === hashPixels(b), `${hashPixels(a)} and ${hashPixels(b)}`);
  check('control: the next seed paints different pixels', hashPixels(a) !== hashPixels(c), `${hashPixels(a)} and ${hashPixels(c)}`);
}

// 2. the still is the finished painting
{
  const q = await stepped(scene('register=quiet&seed=2'));
  await finished(q.page);
  const quiet = await grab(q.page); await q.ctx.close();
  const r = await open(scene('register=warm&seed=2'), { reduced: true });
  await r.page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.passes === '34/34', null, { timeout: 5000 }).catch(() => {});
  const still = await grab(r.page); await r.ctx.close();
  check('reduced motion: warm shows the finished painting, the same pixels as quiet', still.data.passes === '34/34' && diff(still, quiet) < 0.001, `${still.data.passes} passes, ${pct(diff(still, quiet))} of pixels differ from quiet`);
  const start = await frozen('register=warm&seed=2&freeze=0.05');
  check('control: at the start of the making, one pass and different pixels', start.data.passes === '1/34' && diff(start, quiet) > 0.2, `${start.data.passes} passes, ${pct(diff(start, quiet))} differ`);
}

// 3. finished, it barely moves (one page per pair: the second before the freeze is the picture ?freeze= of that second freezes)
{
  // --break: the breath inverts the painting where it falls, and whips round it, so a finished one changes plainly from one second to the next
  const strong = BREAK ? plant(
    ['render.js', 'strength = 0.1 * (complete ? 1 : 0.4)', 'strength = 1 * (complete ? 1 : 0.4)'],
    ['render.js', "g.globalCompositeOperation = 'soft-light'; g.fillStyle = br;", "g.globalCompositeOperation = 'difference'; g.fillStyle = br;"],
    ['model.js', 'W * (0.5 + 0.28 * Math.sin(t * 0.05))', 'W * (0.5 + 0.28 * Math.sin(t * 6))']) : [];
  const [m1, m2] = await frozen('register=warm&seed=2&freeze=4', { at: [3] });
  const [f1, f2] = await frozen('register=warm&seed=2&freeze=21', { at: [20], routes: strong });
  const making = diff(m1, m2, undefined, 40), resting = diff(f1, f2, undefined, 40);
  check('finished, a second changes under 2% of the painting; making, far more', resting < 0.02 && making > 5 * Math.max(resting, 0.002), `making ${pct(making)} a second, resting ${pct(resting)}`);
}

// 4. the breath keeps away from the words
{
  // --break: the breath is not kept away from the words
  const breathes = BREAK ? plant(['render.js', 'if (calm.length) {\n        // under the page', 'if (false) {\n        // under the page']) : [];
  const [w1, w2] = await frozen('register=warm&seed=2&freeze=44&content=1', { at: [14], routes: breathes });
  const [b1, b2] = await frozen('register=warm&seed=2&freeze=44', { at: [14] });
  // the breath is the plate's: soft-light at 10% moves a pixel by 1 to 3 levels, so count any change at all,
  // inside the heading's and the paragraph's own boxes
  const avg = f => w1.words.reduce((m, box) => m + f(box), 0) / w1.words.length;
  const under = avg(box => diff(w1, w2, box, 0)), bare = avg(box => diff(b1, b2, box, 0));
  check('under the words the painting holds still while the breath drifts', under < 0.005, `${pct(under)} of the box changed`);
  check('control: the same box with no words does change', bare > 0.02, `${pct(bare)}`);
}

// 5. playful: Enter scrapes where the hand is (a third of a second is 18 frames of the scene's time)
{
  // --break: Enter does nothing
  const { ctx, page, errors } = await stepped('/packages/scenes/maun/demo.html?register=playful&content=0',
    { routes: BREAK ? plant(['render.js', 'activate(p) {\n      if (!p) return;', 'activate(p) {\n      if (p) return;']) : [] });
  await page.evaluate(() => window.__piece.still());
  await finished(page);
  const before = await grab(page);
  await page.locator('sg-scene').locator('.stage').focus();
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await frames(page, 18);
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

if (BREAK) console.log('\n--break: "finished, a second changes under 2%", "under the words the painting holds still" and "playful: Enter scrapes a band back" should FAIL');
await h.done();
