// Browser checks for Prahar that a Node test cannot reach:
//
//   node packages/scenes/prahar/prahar.check.mjs
//
// 1. with hour set the canvas does not change over three seconds (control:
//    without it, the day moves the same canvas plainly);
// 2. the sky at 07:00 is lighter and bluer than at 23:00, read from the pixels;
// 3. the plate's perf fix holds: the tinted land is repainted on well under a
//    quarter of the frames in warm (control: a hand-forced repaint every frame
//    reads 1.0, so the counter can tell);
// 4. playful: the arrow keys move the day, and a drag along the ruler sets it;
// 5. the status says the watch in words when the page sets the hour;
// 6. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';
import { rulerX, RULER, wrapHour } from './model.js';

const h = await harness();
const { check } = h;
// the harness page declares __ready only once the scene has drawn, so wait for true, then for the fonts
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await r.page.evaluate(() => document.fonts.ready);
  return r;
};
const scene = q => `/tools/harness/scene.html?name=prahar&${q}`;
const hash = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let s = 0; for (let i = 0; i < d.length; i += 16) s = (s * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) >>> 0; return s;
});
const px = (page, x, y) => page.evaluate(([x, y]) => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), k = cv.width / 1200;
  return [...cv.getContext('2d').getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data].slice(0, 3);
}, [x, y]);
const stageData = (page, key) => page.evaluate(k => window.__piece.shadowRoot.querySelector('.stage').dataset[k], key);

// 1. a set hour holds still
{
  const held = await open(scene('register=warm&hour=19.2'));
  await held.page.waitForTimeout(500);
  const a = await hash(held.page); await held.page.waitForTimeout(3000); const b = await hash(held.page);
  check('hour=19.2: the canvas is unchanged over three seconds', a === b, `${a} then ${b}`);
  await held.ctx.close();
  const free = await open(scene('register=warm'));
  await free.page.waitForTimeout(500);
  const c = await hash(free.page); await free.page.waitForTimeout(3000); const d = await hash(free.page);
  check('control: with no hour, the same canvas changes over three seconds', c !== d, `${c} then ${d}`);
  await free.ctx.close();
}

// 2. morning sky against night sky, from the pixels
{
  const read = async hour => { const { ctx, page } = await open(scene(`register=quiet&hour=${hour}`)); const v = await px(page, 600, 120); await ctx.close(); return v; };
  const am = await read(7), pm = await read(23);
  const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  check('07:00 sky is lighter and bluer than 23:00 sky', lum(am) > lum(pm) + 60 && am[2] > am[0], `07:00 ${am}, 23:00 ${pm}`);
}

// 3. the tint cache: repaints on few frames
{
  const { ctx, page } = await open(scene('register=warm'));
  await page.waitForTimeout(6000);
  const [tints, frames] = (await stageData(page, 'tints')).split('/').map(Number);
  check('warm: tinted land repainted on under a quarter of drawn frames (the plate’s perf fix)', frames > 30 && tints / frames < 0.25, `${tints} repaints in ${frames} frames`);
  await ctx.close();
}

// 4. playful: the keys and the ruler move the day
{
  const { ctx, page, errors } = await open(scene('register=playful'));
  await page.waitForTimeout(400);
  const stage = page.locator('sg-scene').locator('.stage');
  await stage.focus();
  const before = Number(await stageData(page, 'hour'));
  for (let k = 0; k < 3; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60); }
  await page.waitForTimeout(300);
  const after = Number(await stageData(page, 'hour'));
  const moved = wrapHour(after - before);
  check('playful: three presses of the right arrow move the day on about 2.4 hours', moved > 2.2 && moved < 3.4, `${before.toFixed(2)} to ${after.toFixed(2)} (${moved.toFixed(2)} h, time runs too)`);
  // drag: press on the ruler at 13:00 and hold
  const box = await stage.boundingBox(), k = box.width / 1200;
  await page.mouse.move(box.x + rulerX(13) * k, box.y + RULER.y * k);
  await page.mouse.down();
  await page.waitForTimeout(300);
  const dragging = Number(await stageData(page, 'hour'));
  await page.mouse.up();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.waitForTimeout(600);
  const released = Number(await stageData(page, 'hour'));
  check('playful: a press on the ruler at 13:00 sets the hour, and the day carries on from there', Math.abs(dragging - 13) < 0.15 && wrapHour(released - 13) < 0.6, `holding ${dragging}, then ${released}`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 5. the status names the watch
{
  const { ctx, page } = await open('/packages/scenes/prahar/demo.html?register=warm&hour=19.2');
  // the element speaks at most once a second, counted from page load
  await page.waitForFunction(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent !== '', null, { timeout: 3000 }).catch(() => {});
  const said = await page.evaluate(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent);
  check('hour=19.2: the status says the watch in words', said === 'The light in the village: Evening, Yaman, 19:10', `"${said}"`);
  await ctx.close();
}

// 6. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/prahar/demo.html?register=playful');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/prahar/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
