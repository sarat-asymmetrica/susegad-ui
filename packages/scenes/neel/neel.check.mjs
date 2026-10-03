// Browser checks for Neel that a Node test cannot reach:
//
//   node packages/scenes/neel/neel.check.mjs
//
// 1. progress: exactly that share is printed, the status names the work, and
//    the canvas holds still (control: with no progress the printing moves on);
// 2. the still is the finished length, the same pixels in quiet and in warm
//    under reduced motion;
// 3. the words sit on plain cloth: no ink inside the words' own boxes
//    (control: the same boxes with no words are printed);
// 4. playful: Enter presses a block where the keyboard hand is, and nowhere else;
// 5. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=neel&${q}`;
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 30 s'); await h.done(); });
  return r;
};
const printed = page => page.evaluate(() => window.__piece.shadowRoot.querySelector('.stage').dataset.printed);
const grab = page => page.evaluate(() => {
  const el = window.__piece, cv = el.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const s = 2, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), px = new Array(w * hh * 3);
  let hash = 0;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; px[o] = d[i]; px[o + 1] = d[i + 1]; px[o + 2] = d[i + 2]; hash = (hash * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) >>> 0; }
  const st = el.shadowRoot.querySelector('.stage').getBoundingClientRect(), k = 1200 / st.width;
  const words = [...el.children].map(c => { const r = c.getBoundingClientRect(); return { x: (r.left - st.left) * k, y: (r.top - st.top) * k, w: r.width * k, h: r.height * k }; });
  return { w, h: hh, kx: 1200 / w, ky: 900 / hh, px, hash, words };
});
function share(a, box, test) {
  let n = 0, c = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const lx = x * a.kx, ly = y * a.ky;
    if (lx < box.x || lx > box.x + box.w || ly < box.y || ly > box.y + box.h) continue;
    const o = (y * a.w + x) * 3; n++;
    if (test(a.px[o], a.px[o + 1], a.px[o + 2])) c++;
  }
  return n ? c / n : 0;
}
function diff(a, b, box = { x: 0, y: 0, w: 1200, h: 900 }, th = 30) {
  let n = 0, c = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const lx = x * a.kx, ly = y * a.ky;
    if (lx < box.x || lx > box.x + box.w || ly < box.y || ly > box.y + box.h) continue;
    const o = (y * a.w + x) * 3; n++;
    if (Math.abs(a.px[o] - b.px[o]) + Math.abs(a.px[o + 1] - b.px[o + 1]) + Math.abs(a.px[o + 2] - b.px[o + 2]) > th) c++;
  }
  return n ? c / n : 0;
}
const ink = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b < 150; // indigo, madder or iron black on cloth near 225
const pct = v => `${(v * 100).toFixed(2)}%`;

// 1. progress
{
  const { ctx, page } = await open(scene('register=warm&progress=0.4&label=Printing'));
  await page.waitForFunction(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent !== '', null, { timeout: 3000 }).catch(() => {});
  const said = await page.evaluate(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent);
  const count = await printed(page), [a, n] = count.split('/').map(Number);
  const g1 = await grab(page); await page.waitForTimeout(3000); const g2 = await grab(page);
  check('progress=0.4: exactly 40% of the impressions are printed', a === Math.round(0.4 * n), count);
  check('progress: the status names the work', said === 'Printing: 40% done', `"${said}"`);
  check('progress: the canvas holds still over three seconds', g1.hash === g2.hash, `${g1.hash} then ${g2.hash}`);
  await ctx.close();
  const free = await open(scene('register=warm'));
  await free.page.waitForTimeout(1500); const f1 = await grab(free.page); await free.page.waitForTimeout(3000); const f2 = await grab(free.page);
  check('control: with no progress, the printing moves on', f1.hash !== f2.hash, `${f1.hash} then ${f2.hash}`);
  await free.ctx.close();
}

// 2. the still
{
  const stillOf = async (q, opts) => {
    const { ctx, page } = await open(scene(q), opts);
    await page.waitForTimeout(300);
    const g = await grab(page), c = await printed(page); await ctx.close(); return { g, c };
  };
  const quiet = await stillOf('register=quiet'), reduced = await stillOf('register=warm', { reduced: true });
  const [a, n] = quiet.c.split('/').map(Number);
  check('the still: quiet is the finished length', a === n && n > 40, quiet.c);
  check('the still: warm under reduced motion paints the same pixels as quiet', diff(quiet.g, reduced.g, undefined, 6) < 0.001, `${pct(diff(quiet.g, reduced.g, undefined, 6))} differ`);
}

// 3. the words sit on plain cloth
{
  const one = async content => { const { ctx, page } = await open(`/packages/scenes/neel/demo.html?register=quiet&place=center&content=${content}`); await page.waitForTimeout(300); const g = await grab(page); await ctx.close(); return g; };
  const w = await one(1), b = await one(0);
  const avg = (g, boxes) => boxes.reduce((m, box) => m + share(g, box, ink), 0) / boxes.length;
  const under = avg(w, w.words), bare = avg(b, w.words);
  check('calm: no ink inside the words’ own boxes', w.words.length > 0 && under < 0.002, `${pct(under)} ink in ${w.words.length} boxes`);
  check('control: the same boxes with no words are printed', bare > 0.02, `${pct(bare)} ink`);
}

// 4. playful: Enter presses a block where the hand is
{
  const { ctx, page, errors } = await open('/packages/scenes/neel/demo.html?register=playful&content=0');
  await page.evaluate(() => window.__piece.still());
  await page.waitForTimeout(400);
  const stage = page.locator('sg-scene').locator('.stage');
  await stage.focus();
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
  const before = await grab(page);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const after = await grab(page);
  // the hand is at the middle, one step down: (600, 477)
  const near = diff(before, after, { x: 520, y: 380, w: 160, h: 200 }), far = diff(before, after, { x: 0, y: 650, w: 400, h: 250 });
  check('playful: Enter presses a block where the keyboard hand is, and nowhere else', near > 0.03 && far < 0.001, `${pct(near)} changed by the hand, ${pct(far)} far away`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 5. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/neel/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/neel/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
