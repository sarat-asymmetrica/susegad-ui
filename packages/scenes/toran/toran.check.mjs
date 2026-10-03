// Browser checks for Toran that a Node test cannot reach:
//
//   node packages/scenes/toran/toran.check.mjs
//
// 1. reduced motion shows the garland hanging, and it does not move over three
//    seconds (control: the same page with motion allowed does move);
// 2. playful: a hard brush with the pointer swings the garland far more than
//    the breeze alone does in the same half second (control: no brush);
// 3. playful: the drawing takes focus and shows the keyboard hand (the sweep
//    Enter makes is proved in Node, in toran.test.js, where the breeze can be held equal);
// 4. no request leaves the page;
// 5. axe (WCAG 2.2 AA) on the demo in every register, light and dark, and no
//    console errors.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const GARLAND = { x: 330, y: 140, w: 540, h: 330 };

/** The canvas inside a box (logical units), downsampled 3x, as a flat [r, g, b, ...] array. */
const grab = (page, box = GARLAND) => page.evaluate(b => {
  const el = window.__piece, cv = el.shadowRoot.querySelector('canvas'), { W, H } = el.meta, kx = cv.width / W, ky = cv.height / H;
  const x0 = Math.round(b.x * kx), y0 = Math.round(b.y * ky), w = Math.round(b.w * kx), hh = Math.round(b.h * ky);
  const d = cv.getContext('2d').getImageData(x0, y0, w, hh).data, out = [];
  for (let y = 0; y < hh; y += 3) for (let x = 0; x < w; x += 3) { const i = (y * w + x) * 4; out.push(d[i], d[i + 1], d[i + 2]); }
  return out;
}, box);
const changed = (a, b, th = 40) => { let c = 0; for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > th) c++; return c / (a.length / 3); };
/** Share of marigold pixels (bright orange to saffron) in a grab. */
const marigold = a => { let c = 0; for (let i = 0; i < a.length; i += 3) { const [r, g, b] = [a[i], a[i + 1], a[i + 2]]; if (r > 190 && g > 70 && g < 200 && b < 90 && r - b > 130) c++; } return c / (a.length / 3); };
/** Where the marigolds in a box sit: the centroid of their pixels in logical units, and how many there are. */
const centroid = (page, box) => page.evaluate(b => {
  const el = window.__piece, cv = el.shadowRoot.querySelector('canvas'), { W, H } = el.meta, kx = cv.width / W, ky = cv.height / H;
  const x0 = Math.round(b.x * kx), y0 = Math.round(b.y * ky), w = Math.round(b.w * kx), hh = Math.round(b.h * ky);
  const d = cv.getContext('2d').getImageData(x0, y0, w, hh).data;
  let n = 0, sx = 0, sy = 0;
  for (let y = 0; y < hh; y += 2) for (let x = 0; x < w; x += 2) {
    const i = (y * w + x) * 4, r = d[i], g = d[i + 1], bl = d[i + 2];
    if (r > 190 && g > 70 && g < 200 && bl < 90 && r - bl > 130) { n++; sx += x; sy += y; }
  }
  return n ? { x: b.x + sx / n / kx, y: b.y + sy / n / ky, n } : { x: null, y: null, n: 0 };
}, box);
const moved = (a, b) => (a.x === null || b.x === null ? 0 : Math.hypot(a.x - b.x, a.y - b.y));
const pct = v => `${(v * 100).toFixed(2)}%`;

// 1. reduced motion: hanging, and still
{
  const { ctx, page, errors } = await h.open('/packages/scenes/toran/demo.html?register=warm&content=0', { reduced: true });
  await page.waitForTimeout(1500);
  const a = await grab(page);
  await page.waitForTimeout(3000);
  const b = await grab(page);
  check('reduced motion: the garland is there (marigold pixels in the doorway’s top)', marigold(a) > 0.08, `${pct(marigold(a))} marigold`);
  check('reduced motion: nothing moves over three seconds', changed(a, b) === 0, `${pct(changed(a, b))} changed`);
  check('no console errors (reduced motion)', errors.length === 0, errors.join(' | '));
  await ctx.close();
  const live = await h.open('/packages/scenes/toran/demo.html?register=warm&content=0');
  await live.page.waitForTimeout(1500);
  const c = await grab(live.page);
  await live.page.waitForTimeout(3000);
  const d = await grab(live.page);
  check('control: with motion allowed, the breeze moves it over the same three seconds', changed(c, d) > 0.01, `${pct(changed(c, d))} changed`);
  await live.ctx.close();
}

// 2. playful: a hard brush swings it far more than the breeze does
{
  const swing = async brushIt => {
    const { ctx, page, errors } = await h.open('/packages/scenes/toran/demo.html?register=playful&content=0&seed=1');
    await page.waitForTimeout(2500); // let the opening brush die down
    const box = await page.locator('sg-scene').evaluate(el => { const r = el.shadowRoot.querySelector('.stage').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const at = (lx, ly) => [box.x + (lx / 1200) * box.w, box.y + (ly / 900) * box.h];
    const LEFT = { x: 290, y: 230, w: 170, h: 250 };
    const a = await centroid(page, LEFT);
    if (brushIt) {
      // back and forth across the left strand and the first swag, fast
      for (let k = 0; k < 3; k++) {
        await page.mouse.move(...at(320, 300));
        for (let i = 1; i <= 6; i++) { await page.mouse.move(...at(320 + i * 30, 300 - i * 10)); await page.waitForTimeout(30); }
      }
    } else await page.waitForTimeout(3 * 6 * 34);
    await page.mouse.move(...at(1150, 850));
    // the furthest the strand's flowers get from where they were, over the next 800 ms
    let most = 0;
    for (let k = 0; k < 16; k++) { most = Math.max(most, moved(a, await centroid(page, LEFT))); await page.waitForTimeout(50); }
    await ctx.close();
    return { d: most, errors };
  };
  const brushed = await swing(true), still = await swing(false);
  check('playful: a hard brush swings the left strand much further than the breeze alone', brushed.d > Math.max(12, still.d * 2), `the strand's flowers moved ${brushed.d.toFixed(1)} units brushed, ${still.d.toFixed(1)} with the breeze only`);
  check('no console errors (brush)', brushed.errors.length === 0, brushed.errors.join(' | '));
}

// 3. playful: keyboard
{
  const { ctx, page, errors } = await h.open('/packages/scenes/toran/demo.html?register=playful&content=0');
  await page.waitForTimeout(2500);
  const stage = page.locator('sg-scene').locator('.stage');
  const role = await stage.getAttribute('role');
  check('playful: the drawing takes focus as an interactive drawing', role === 'application', role);
  await stage.focus();
  // the keyboard hand is drawn as a small ink cross where it is, so a sighted keyboard user can follow it
  const HAND = { x: 585, y: 219, w: 30, h: 30 }; // the middle, six presses of ArrowUp from the centre: (600, 234)
  const inkCross = () => page.evaluate(b => {
    const el = window.__piece, cv = el.shadowRoot.querySelector('canvas'), { W, H } = el.meta, kx = cv.width / W, ky = cv.height / H;
    const d = cv.getContext('2d').getImageData(Math.round(b.x * kx), Math.round(b.y * ky), Math.round(b.w * kx), Math.round(b.h * ky)).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 70 && d[i + 2] > d[i] + 12 && d[i + 2] > d[i + 1]) n++;
    return n;
  }, HAND);
  const before = await inkCross();
  for (let k = 0; k < 6; k++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(40); }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const after = await inkCross();
  check('playful: the keyboard hand shows as an ink cross where it is (none there before the keys)', before === 0 && after > 8, `${before} ink pixels before, ${after} after`);
  check('no console errors (keyboard)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 4. no request leaves the page
{
  const { ctx, page } = await h.open('/packages/scenes/toran/demo.html?register=playful');
  const out = [];
  page.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(u.hostname)) out.push(u.host); });
  await page.reload();
  await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  await ctx.close();
}

// 5. axe in every register, light and dark
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await h.open(`/packages/scenes/toran/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
