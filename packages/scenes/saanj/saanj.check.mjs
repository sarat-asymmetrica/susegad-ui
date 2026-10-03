// Browser checks for Saanj that a Node test cannot reach:
//
//   node packages/scenes/saanj/saanj.check.mjs
//
// 1. the calm zone: with words at the top of the sky, bird ink (dark pixels on
//    the dusk sky) almost never lands under them over 24 seconds (control: the
//    same box with no words does catch birds);
// 2. the still (reduced motion) is the murmuration mid-sky, the same pixels on
//    every load (control: another seed gives other pixels);
// 3. no request leaves the page (control: a Google Fonts link is caught);
// 4. playful: the drawing takes focus, the arrow keys fly a hawk you can see,
//    and Enter startles the flock, with no errors;
// 5. axe (WCAG 2.2 AA) on the demo in every register, light and dark.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const demo = q => `/packages/scenes/saanj/demo.html?${q}`;
/** h.open waits only for a page that set __ready to false; the demo sets it true on sg-ready, so wait for that. */
async function open(path, opts) {
  const o = await h.open(path, opts);
  await o.page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  return o;
}

/** Bird ink in a box (logical units): pixels much darker than their own row of sky (the sky is a
 *  smooth vertical gradient, so a row's mean is the sky there; a bird's ink is far below it). */
const birdInk = (page, box) => page.evaluate(box => {
  const el = window.__piece, cv = el.shadowRoot.querySelector('canvas'), { W, H } = el.meta;
  const kx = cv.width / W, ky = cv.height / H, g = cv.getContext('2d');
  const x = Math.round(box.x * kx), y = Math.round(box.y * ky), w = Math.round(box.w * kx), hh = Math.round(box.h * ky);
  const d = g.getImageData(x, y, w, hh).data, lum = i => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
  let n = 0;
  for (let r = 0; r < hh; r++) {
    let sum = 0;
    for (let c = 0; c < w; c++) sum += lum((r * w + c) * 4);
    const mean = sum / w;
    for (let c = 0; c < w; c++) { const l = lum((r * w + c) * 4); if (l < mean * 0.7 && mean - l > 18) n++; }
  }
  return n;
}, box);
const hash = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let s = 0; for (let i = 0; i < d.length; i += 16) s = (s * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) >>> 0; return s;
});

// 1. the flock flies round the words
{
  const run = async q => {
    const { ctx, page, errors } = await open(demo(q));
    await page.waitForTimeout(600);
    let total = 0;
    for (let k = 0; k < 48; k++) { total += await birdInk(page, BOX); await page.waitForTimeout(500); }
    await ctx.close();
    return { total, errors };
  };
  // the panel's box with words at the top of the sky, measured once
  var BOX;
  {
    const { ctx, page } = await open(demo('register=playful&place=topc'));
    BOX = await page.evaluate(() => {
      const el = window.__piece, p = el.shadowRoot.querySelector('.panel').getBoundingClientRect(), c = el.shadowRoot.querySelector('canvas').getBoundingClientRect(), { W, H } = el.meta;
      return { x: ((p.left - c.left) / c.width) * W, y: ((p.top - c.top) / c.height) * H, w: (p.width / c.width) * W, h: (p.height / c.height) * H };
    });
    await ctx.close();
  }
  const withWords = await run('register=playful&place=topc&seed=1');
  const bare = await run('register=playful&place=topc&seed=1&content=0');
  const box = `box ${BOX.x.toFixed(0)},${BOX.y.toFixed(0)} ${BOX.w.toFixed(0)}x${BOX.h.toFixed(0)}`;
  check('calm: over 24 s, almost no bird ink lands under the words (under a fifth of the bare sky’s)', withWords.total < bare.total * 0.2, `${withWords.total} dark pixels under the words, ${bare.total} in the same box with no words; ${box}`);
  check('control: with no words, the flock does cross that box', bare.total > 200, `${bare.total} dark pixels`);
  check('no console errors (calm)', withWords.errors.length === 0 && bare.errors.length === 0, [...withWords.errors, ...bare.errors].join(' | '));
}

// 2. the still: the murmuration mid-sky, the same on every load
{
  const still = async seed => {
    const { ctx, page, errors } = await open(demo(`register=warm&content=0&seed=${seed}`), { reduced: true });
    // settle first: a resize after the first paint repaints the still once more, later on a loaded machine
    let prev = -1, now = await hash(page);
    for (let k = 0; k < 20 && now !== prev; k++) { await page.waitForTimeout(300); prev = now; now = await hash(page); }
    const out = { hash: now, birds: await birdInk(page, { x: 0, y: 0, w: 1200, h: 440 }), errors };
    await ctx.close();
    return out;
  };
  const a = await still(1), b = await still(1), c = await still(2);
  check('still: the murmuration is in the sky (bird ink above the palms)', a.birds > 300, `${a.birds} dark pixels in the sky`);
  check('still: the same pixels on every load', a.hash === b.hash, `${a.hash} and ${b.hash}`);
  check('control: another seed is another evening', a.hash !== c.hash, `${a.hash} and ${c.hash}`);
  check('no console errors (still)', !a.errors.length && !b.errors.length && !c.errors.length, [...a.errors, ...b.errors, ...c.errors].join(' | '));
}

// 3. no request leaves the page
{
  const count = async open => {
    const out = [];
    const { ctx, page } = await open();
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
    await page.reload();
    await page.waitForTimeout(1500);
    await ctx.close();
    return [...new Set(out)];
  };
  const ours = await count(() => open(demo('register=playful')));
  check('no request leaves the page', ours.length === 0, ours.join(', ') || 'none');
  const theirs = await count(() => h.openHtml('saanj-fonts-control', '<!doctype html><html lang="en"><title>control</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kalam&display=swap"><p>control</p></html>'));
  check('control: a page with a Google Fonts link is caught', theirs.length > 0, theirs.join(', ') || 'nothing caught');
}

// 4. playful: the keyboard hawk
{
  const { ctx, page, errors } = await open(demo('register=playful&content=0'));
  const stage = page.locator('sg-scene').locator('.stage');
  check('playful: the drawing takes focus as an interactive drawing', (await stage.getAttribute('role')) === 'application', await stage.getAttribute('role'));
  await stage.focus();
  await page.evaluate(() => window.__piece.pause());
  const before = await hash(page);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(300);
  const after = await hash(page);
  check('playful: an arrow key brings the hawk into the paused sky, where you can see it', before !== after, `${before} then ${after}`);
  await page.evaluate(() => window.__piece.play());
  for (let k = 0; k < 4; k++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(100); }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  check('no console errors (playful keys)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 5. axe in every register, light and dark
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(demo(`register=${register}&theme=${theme}`));
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
