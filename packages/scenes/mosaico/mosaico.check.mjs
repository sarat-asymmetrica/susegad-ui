// Browser checks for Mosaico that a Node test cannot reach:
//
//   node packages/scenes/mosaico/mosaico.check.mjs
//
// 1. the same seed lays the same floor on two separate pages (control: the
//    next seed lays a different one);
// 2. the still is the finished floor: under reduced motion, warm shows the same
//    pixels as quiet (control: a frozen clock while the floor is being laid
//    shows plainly different pixels);
// 3. warm: over twelve seconds a tile turns and the ant walks to another tile;
// 4. no tile under the page's words turns: a click beside them ripples the
//    tiles round it but not theirs, and the words' box holds still (control:
//    the same click with no words does turn those tiles);
// 5. playful: Enter turns the tile under the keyboard hand by a quarter, and
//    the pointer entering a tile turns it;
// 6. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=mosaico&${q}`;
const demo = q => `/packages/scenes/mosaico/demo.html?${q}`;
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  // a scene that never draws its first frame never becomes ready: say so, then stop
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 20 s'); await h.done(); });
  return r;
};
const stageData = page => page.evaluate(() => ({ ...window.__piece.shadowRoot.querySelector('.stage').dataset }));
const grab = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const s = 4, w = Math.floor(cv.width / s), hh = Math.floor(cv.height / s), px = new Array(w * hh * 3);
  let hash = 0;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * s * cv.width + x * s) * 4, o = (y * w + x) * 3; px[o] = d[i]; px[o + 1] = d[i + 1]; px[o + 2] = d[i + 2]; hash = (hash * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) >>> 0; }
  return { w, h: hh, kx: 1200 / w, ky: 840 / hh, px, hash };
});
async function frozen(q, opts) {
  const { ctx, page } = await open(scene(q), opts);
  await page.waitForFunction(() => window.__frozen === true, null, { timeout: 60000 });
  const img = await grab(page);
  await ctx.close();
  return img;
}
function diff(a, b, box = { x: 0, y: 0, w: 1200, h: 840 }, th = 12) {
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
const changed = (a, b) => [...a].flatMap((k, n) => (k !== b[n] ? [n] : []));
/** A point in the scene's units, as a page point on the stage. */
const pagePoint = (page, x, y) => page.evaluate(([x, y]) => { const r = window.__piece.shadowRoot.querySelector('.stage').getBoundingClientRect(); return [r.left + x * r.width / 1200, r.top + y * r.height / 840]; }, [x, y]);

// 1. a seed is a floor
{
  const a = await frozen('register=quiet&seed=5&freeze=0.1'), b = await frozen('register=quiet&seed=5&freeze=0.1'), c = await frozen('register=quiet&seed=6&freeze=0.1');
  check('the same seed lays the same pixels on two pages', a.hash === b.hash, `${a.hash} and ${b.hash}`);
  check('control: the next seed lays a different floor', diff(a, c) > 0.2, `${pct(diff(a, c))} of pixels differ`);
}

// 2. the still is the finished floor
{
  const quiet = await frozen('register=quiet&seed=2&freeze=0.1');
  const r = await open(scene('register=warm&seed=2'), { reduced: true });
  await r.page.waitForTimeout(600);
  const still = await grab(r.page); await r.ctx.close();
  check('reduced motion: warm shows the finished floor, the same pixels as quiet', diff(still, quiet) < 0.001, `${pct(diff(still, quiet))} of pixels differ from quiet`);
  const laying = await frozen('register=warm&seed=2&freeze=1');
  check('control: while the floor is being laid, plainly different pixels', diff(laying, quiet) > 0.2, `${pct(diff(laying, quiet))} differ`);
}

// 3. warm: a tile turns now and then and the ant walks
{
  const { ctx, page, errors } = await open(demo('register=warm&content=0&seed=1'));
  const d0 = await stageData(page);
  await page.waitForTimeout(12000);
  const d1 = await stageData(page);
  check('warm: in twelve seconds a tile turns and the ant walks to another tile', changed(d0.ks, d1.ks).length >= 1 && d0.ant !== d1.ant, `${changed(d0.ks, d1.ks).length} tiles turned, ant ${d0.ant} → ${d1.ant}`);
  check('no console errors (warm)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 4. no tile under the words turns
async function clickBeside(content) {
  const { ctx, page } = await open(demo(`register=playful&seed=3&content=${content}`));
  await page.waitForTimeout(3200);
  const calm = new Set(((await stageData(page)).calm || '').split(',').filter(Boolean).map(Number));
  // the click: the first tile outside the words that sits next to one under them
  const words = content === '0' ? CALM : calm;
  let target = null;
  for (let n = 0; n < 70 && !target; n++) {
    const i = n % 10, j = Math.floor(n / 10);
    if (!words.has(n) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => words.has((j + b) * 10 + i + a) && i + a >= 0 && i + a < 10)) target = [i, j];
  }
  // an ant the seed set down under the words walks out (it is under the scrim meanwhile): wait until it has
  await page.waitForFunction(calm => { const [i, j] = window.__piece.shadowRoot.querySelector('.stage').dataset.ant.split(',').map(Number); return !calm.includes(j * 10 + i); }, [...calm], { timeout: 30000 }).catch(() => {});
  const before = await stageData(page), img0 = await grab(page);
  const [px, py] = await pagePoint(page, target[0] * 120 + 60, target[1] * 120 + 60);
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(2600);
  const after = await stageData(page), img1 = await grab(page);
  await ctx.close();
  return { calm, target, turned: changed(before.ks, after.ks), img0, img1 };
}
let CALM = new Set();
{
  const w = await clickBeside('1');
  CALM = w.calm;
  const under = w.turned.filter(n => w.calm.has(n)), beside = w.turned.filter(n => !w.calm.has(n));
  // each word tile's middle: a neighbour turning beside it throws its corner and shadow up to ~25 units over the
  // edge while it moves (the plate's lift), so the middle, 28 in from every edge, is the tile itself
  const boxes = [...w.calm].map(n => ({ x: (n % 10) * 120 + 28, y: Math.floor(n / 10) * 120 + 28, w: 64, h: 64 }));
  const still = boxes.reduce((m, b) => Math.max(m, diff(w.img0, w.img1, b)), 0);
  check('words on the floor: they cover some tiles', w.calm.size >= 2, `${w.calm.size} tiles under the words`);
  check('a click beside the words turns tiles round it but none under them', under.length === 0 && beside.length >= 2, `click at tile ${w.target}; ${beside.length} turned beside, ${under.length} under the words`);
  check('the tiles under the words hold still', still < 0.002, `at most ${pct(still)} of a tile changed`);
  const bare = await clickBeside('0');
  const would = bare.turned.filter(n => CALM.has(n));
  check('control: with no words the same click does turn some of those tiles', would.length >= 1, `${would.length} of them turned`);
}

// 5. playful: Enter turns the tile under the hand; the pointer entering a tile turns it
{
  const { ctx, page, errors } = await open(demo('register=playful&content=0&seed=4'));
  await page.waitForTimeout(3200);
  await page.locator('sg-scene').locator('.stage').focus();
  await page.keyboard.press('ArrowUp');
  const hand = await page.evaluate(() => window.__piece.lastPointer);
  const tile = Math.floor(hand.y / 120) * 10 + Math.floor(hand.x / 120);
  const before = await stageData(page), img0 = await grab(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1400);
  const after = await stageData(page), img1 = await grab(page);
  const box = { x: (tile % 10) * 120 + 6, y: Math.floor(tile / 10) * 120 + 6, w: 108, h: 108 };
  check('playful: Enter turns the tile under the keyboard hand by a quarter', (Number(after.ks[tile]) - Number(before.ks[tile]) + 4) % 4 === 1 && diff(img0, img1, box) > 0.1, `tile ${tile}: turn ${before.ks[tile]} → ${after.ks[tile]}, ${pct(diff(img0, img1, box))} of it redrawn`);
  // the pointer: entering a tile turns it
  const i = (tile % 10 + 3) % 10, j = Math.floor(tile / 10), t2 = j * 10 + i;
  const b2 = await stageData(page);
  const [px, py] = await pagePoint(page, i * 120 + 60, j * 120 + 60);
  await page.mouse.move(px - 200, py); await page.mouse.move(px, py, { steps: 4 });
  await page.waitForTimeout(300);
  const a2 = await stageData(page);
  check('playful: the pointer entering a tile turns it', a2.ks[t2] !== b2.ks[t2], `tile ${t2}: ${b2.ks[t2]} → ${a2.ks[t2]}`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 6. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open(demo('register=warm'));
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(demo(`register=${register}&theme=${theme}`));
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
