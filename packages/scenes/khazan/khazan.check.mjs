// Browser checks for Khazan that a Node test cannot reach:
//
//   node packages/scenes/khazan/khazan.check.mjs
//
// 1. progress: the status names the work; more progress, more in step; and
//    with progress set, time does not change how in step the bank is
//    (control: with no progress, the swarm's synchrony does change);
// 2. the still is a wave, the same pixels in quiet and in warm under reduced
//    motion;
// 3. fireflies under the page's words glow low and steady (control: the same
//    boxes with no words flicker);
// 4. playful: once the bank is in step, Enter sweeps the hand through it and
//    knocks it out of step;
// 5. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=khazan&${q}`;
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 30 s'); await h.done(); });
  return r;
};
const orderOf = page => page.evaluate(() => Number(window.__piece.shadowRoot.querySelector('.stage').dataset.order));
const grab = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const s = 2, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), px = new Array(w * hh * 3);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; px[o] = d[i]; px[o + 1] = d[i + 1]; px[o + 2] = d[i + 2]; }
  const el = window.__piece, st = el.shadowRoot.querySelector('.stage').getBoundingClientRect(), k = 1200 / st.width;
  const words = [...el.children].map(c => { const r = c.getBoundingClientRect(); return { x: (r.left - st.left) * k, y: (r.top - st.top) * k, w: r.width * k, h: r.height * k }; });
  return { w, h: hh, kx: 1200 / w, ky: 800 / hh, px, words };
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

// 1. progress is synchrony
{
  const at = async p => { const { ctx, page } = await open(scene(`register=warm&progress=${p}&label=Syncing`)); await page.waitForTimeout(1200); const a = await orderOf(page); await page.waitForTimeout(3000); const b = await orderOf(page); const said = await page.evaluate(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent); await ctx.close(); return { a, b, said }; };
  const lo = await at(0.2), hi = await at(0.8);
  check('progress: the status names the work', hi.said === 'Syncing: 80% done', `"${hi.said}"`);
  check('progress: 0.8 is more in step than 0.2', hi.a > lo.a + 0.2, `${lo.a} against ${hi.a}`);
  check('progress: time does not change how in step the bank is', Math.abs(lo.a - lo.b) < 0.002 && Math.abs(hi.a - hi.b) < 0.002, `${lo.a} then ${lo.b}; ${hi.a} then ${hi.b}`);
  const { ctx, page } = await open(scene('register=warm'));
  await page.waitForTimeout(1200); const a = await orderOf(page); await page.waitForTimeout(3000); const b = await orderOf(page); await ctx.close();
  check('control: with no progress, the swarm’s synchrony changes by itself', Math.abs(a - b) > 0.01, `${a} then ${b}`);
}

// 2. the still
{
  const stillOf = async (q, opts) => { const { ctx, page } = await open(scene(q), opts); await page.waitForTimeout(300); const g = await grab(page); await ctx.close(); return g; };
  const quiet = await stillOf('register=quiet'), reduced = await stillOf('register=warm', { reduced: true });
  check('the still: quiet and warm under reduced motion paint the same wave', diff(quiet, reduced, undefined, 6) < 0.002, `${pct(diff(quiet, reduced, undefined, 6))} differ`);
}

// 3. calm under the words: the words sit in the middle, over the mangroves, where the fireflies are
{
  const pair = async content => {
    const { ctx, page } = await open(`/packages/scenes/khazan/demo.html?register=warm&place=center&content=${content}`);
    await page.waitForTimeout(2500); const a = await grab(page); await page.waitForTimeout(700); const b = await grab(page);
    await ctx.close(); return [a, b];
  };
  const [w1, w2] = await pair(1), [b1, b2] = await pair(0);
  const boxes = w1.words, avg = (a, b) => boxes.reduce((m, box) => m + diff(a, b, box), 0) / boxes.length;
  const under = avg(w1, w2), bare = avg(b1, b2);
  check('calm: under the words the fireflies glow low and steady', boxes.length > 0 && under < 0.002, `${pct(under)} in ${boxes.length} boxes`);
  check('control: the same boxes with no words flicker', bare > 0.004, pct(bare));
}

// 4. playful: Enter knocks the bank out of step
{
  const { ctx, page, errors } = await open('/packages/scenes/khazan/demo.html?register=playful&content=0');
  await page.waitForFunction(() => Number(window.__piece.shadowRoot.querySelector('.stage').dataset.order) > 0.85, null, { timeout: 60000 }).catch(() => {});
  const stage = page.locator('sg-scene').locator('.stage');
  await stage.focus();
  // the hand starts in the middle; walk it into the second clump of mangroves (x about 470)
  for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(600);
  const before = await orderOf(page);
  for (let k = 0; k < 8; k++) { await page.keyboard.press('Enter'); await page.waitForTimeout(60); }
  await page.waitForTimeout(1200);
  const after = await orderOf(page);
  check('playful: Enter sweeps the hand through the swarm and knocks it out of step', before > 0.8 && after < before - 0.03, `${before} before, ${after} after`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 5. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/khazan/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/khazan/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
