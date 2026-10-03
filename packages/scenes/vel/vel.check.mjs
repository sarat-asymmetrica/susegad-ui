// Browser checks for Vel that a Node test cannot reach:
//
//   node packages/scenes/vel/vel.check.mjs
//
// 1. the vine grows: two seconds in, stems are still drawing on; by twenty
//    seconds every growth animation has run its course and been let go;
// 2. the still is the grown vine: under reduced motion, warm paints the same
//    pixels as quiet (control: two seconds into the growing, different pixels);
// 3. pause stops every animation: all of the vine's Web Animations are paused
//    or idle and two shots a second apart are the same (control: playing, they
//    differ; and play resumes it);
// 4. a bract that falls where the page's words are rests instead (control: the
//    same moment with no words, it crosses the box);
// 5. playful: an arrow key stirs the branch at the hand, Enter shakes a
//    bract loose there, hovering a cane stirs it and a click drops a bract
//    (control: in warm, Enter drops nothing);
// 6. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';
import { sceneOf } from './model.js';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=vel&${q}`;
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  // a scene that never draws its first frame never becomes ready: say so, then stop
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 20 s'); await h.done(); });
  // the pause button sits over the drawing and differs by register: keep it out of the pixels
  await r.page.evaluate(() => { const b = window.__piece.shadowRoot.querySelector('button'); if (b) b.style.visibility = 'hidden'; });
  return r;
};
const info = page => page.evaluate(() => {
  const [, front] = window.__piece.shadowRoot.querySelectorAll('svg');
  const anims = front.getAnimations({ subtree: true });
  return {
    growing: Number(window.__piece.shadowRoot.querySelector('[data-growing]')?.dataset.growing ?? -1),
    anims: anims.length,
    states: [...new Set(anims.map(a => a.playState))].join(','),
    drops: [...front.children].filter(n => n.tagName === 'g' && n.getAttribute('transform')?.startsWith('translate')).length,
    stirred: front.querySelectorAll('g.br[data-sw]').length,
  };
});
const shot = (page, clip) => clip ? page.screenshot({ clip }) : page.locator('sg-scene').screenshot();
async function frozen(q, words = false) {
  const { ctx, page } = await h.open(scene(q));
  await page.waitForFunction(() => window.__frozen === true, null, { timeout: 60000 });
  await page.evaluate(() => { const b = window.__piece.shadowRoot.querySelector('button'); if (b) b.style.visibility = 'hidden'; });
  const out = { info: await info(page) };
  if (words) {
    // the words' own boxes: in page pixels for the shot, and in the scene's units
    out.boxes = await page.evaluate(() => {
      const el = window.__piece, s = el.shadowRoot.querySelector('.stage').getBoundingClientRect(), k = 1200 / s.width;
      return [...el.children].map(c => { const r = c.getBoundingClientRect(); return { page: { x: r.left, y: r.top, width: r.width, height: r.height }, x: (r.left - s.left) * k, y: (r.top - s.top) * k, w: r.width * k, h: r.height * k }; });
    });
    // take the words out of the picture but not out of the layout, so the calm stays
    await page.evaluate(() => { for (const c of window.__piece.children) c.style.visibility = 'hidden'; window.__piece.shadowRoot.querySelectorAll('.panel, [part~="panel"]').forEach(p => { p.style.background = 'none'; p.style.boxShadow = 'none'; p.style.backdropFilter = 'none'; }); });
  }
  out.img = await shot(page, out.clip);
  out.page = page; out.ctx = ctx;
  return out;
}
const same = (a, b) => Buffer.compare(a, b) === 0;

// 1. the vine grows, then lets its growth go
{
  const a = await frozen('register=warm&seed=1&freeze=2'); await a.ctx.close();
  const b = await frozen('register=warm&seed=1&freeze=20'); await b.ctx.close();
  check('two seconds in, the vine is still drawing on', a.info.growing > 100, `${a.info.growing} growth animations waiting or running`);
  check('by twenty seconds every growth animation is let go; only the breeze and the bracts remain', b.info.growing === 0 && b.info.anims > 0 && b.info.anims < 30, `${b.info.growing} growing, ${b.info.anims} animations left`);
}

// 2. the still is the grown vine
{
  const q = await open(scene('register=quiet&seed=2'));
  const quiet = await shot(q.page); const qi = await info(q.page); await q.ctx.close();
  const r = await open(scene('register=warm&seed=2'), { reduced: true });
  await r.page.waitForTimeout(400);
  const still = await shot(r.page); const ri = await info(r.page); await r.ctx.close();
  check('reduced motion: warm shows the grown vine, the same pixels as quiet, with no animation', same(still, quiet) && ri.anims === 0 && qi.anims === 0, `same pixels: ${same(still, quiet)}; animations ${ri.anims} and ${qi.anims}`);
  const early = await frozen('register=warm&seed=2&freeze=2'); await early.ctx.close();
  check('control: two seconds into the growing, the pixels differ', !same(early.img, quiet), `same: ${same(early.img, quiet)}`);
}

// 3. pause stops every animation
{
  const { ctx, page, errors } = await open('/packages/scenes/vel/demo.html?register=warm&content=0');
  await page.evaluate(() => { const b = window.__piece.shadowRoot.querySelector('button'); if (b) b.style.visibility = 'hidden'; });
  await page.waitForTimeout(2500);
  const p1 = await shot(page); await page.waitForTimeout(1000); const p2 = await shot(page);
  check('control: playing, two shots a second apart differ', !same(p1, p2), `same: ${same(p1, p2)}`);
  await page.evaluate(() => window.__piece.pause());
  await page.waitForTimeout(200);
  const i = await info(page);
  const s1 = await shot(page); await page.waitForTimeout(1200); const s2 = await shot(page);
  const i2 = await info(page);
  check('paused: every Web Animation on the vine is paused or idle', i.anims > 0 && /^(paused|idle)(,(paused|idle))*$/.test(i.states), `${i.anims} animations, states ${i.states}`);
  check('paused: two shots over a second are the same pixels', same(s1, s2) && i.growing === i2.growing, `same: ${same(s1, s2)}; growing ${i.growing} then ${i2.growing}`);
  await page.evaluate(() => window.__piece.play());
  await page.waitForTimeout(300);
  const r1 = await shot(page); await page.waitForTimeout(1000); const r2 = await shot(page);
  check('play resumes the growing', !same(r1, r2), `same: ${same(r1, r2)}`);
  check('no console errors (warm demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 4. bracts rest where the words are
{
  const probe = await frozen('register=warm&seed=1&freeze=1&content=1', true); await probe.ctx.close();
  const S = sceneOf(1), box = probe.boxes.reduce((a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), r: Math.max(a.r, b.x + b.w), b: Math.max(a.b, b.y + b.h) }), { x: 1e9, y: 1e9, r: -1e9, b: -1e9 });
  // a bract whose fall crosses the words' box, and the moment it is in the middle of it
  const f = S.falls.slice(0, 3).find(f => f.x > box.x + 20 && f.x < box.r - 20 && f.land > box.y);
  if (!f) check('a falling bract crosses the words for seed 1', false, `box ${JSON.stringify(box)}`);
  else {
    const fallTime = 4.2 + (f.land - f.y) / 160, mid = Math.min((box.y + box.b) / 2, f.land - 10);
    const u = Math.pow(Math.max(0, mid - f.y) / (f.land - f.y), 1 / 1.15);
    const t = (f.delay + 0.01 * f.period + u * (fallTime - 0.01 * f.period)).toFixed(2), t0 = (f.delay - 0.6).toFixed(2);
    const clipOf = (fr) => { const all = fr.boxes.map(b => b.page); const x = Math.min(...all.map(b => b.x)), y = Math.min(...all.map(b => b.y)); return { x, y, width: Math.max(...all.map(b => b.x + b.width)) - x, height: Math.max(...all.map(b => b.y + b.height)) - y }; };
    const grab = async (q, words) => { const fr = await frozen(q, words); const img = await fr.page.screenshot({ clip: clipOf(words ? fr : probe) }); await fr.ctx.close(); return img; };
    const w0 = await grab(`register=warm&seed=1&freeze=${t0}&content=1`, true), w1 = await grab(`register=warm&seed=1&freeze=${t}&content=1`, true);
    const b0 = await grab(`register=warm&seed=1&freeze=${t0}`, false), b1 = await grab(`register=warm&seed=1&freeze=${t}`, false);
    check('under the words, the bract that would fall there rests', same(w0, w1), `${t0} s and ${t} s: same pixels ${same(w0, w1)}`);
    check('control: the same moment with no words, it crosses the box', !same(b0, b1), `same pixels ${same(b0, b1)}`);
  }
}

// 5. playful: the hand stirs and Enter shakes a bract loose
{
  const { ctx, page, errors } = await open('/packages/scenes/vel/demo.html?register=playful&content=0');
  await page.waitForTimeout(14000);   // the vine is grown
  await page.locator('sg-scene').locator('.stage').focus();
  const before = await info(page);
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  const moved = await info(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const after = await info(page);
  check('playful: an arrow key stirs the branch at the hand', moved.stirred > 0, `${before.stirred} stirred, then ${moved.stirred}`);
  check('playful: Enter shakes a bract loose at the hand', after.drops === before.drops + 1, `${before.drops} dropped, then ${after.drops}`);
  const box = await page.locator('sg-scene').locator('.stage').boundingBox();
  await page.waitForTimeout(2700);    // the keyboard's stirs have died away
  const calmNow = await info(page);
  // a point on a thick hanging cane of seed 1, in page pixels
  const cane = sceneOf(1).vine.stems.filter(s => s.depth >= 1 && s.pts.length > 20).map(s => s.pts[Math.floor(s.pts.length / 2)]).find(([, y]) => y > 360);
  const at = [box.x + cane[0] / 1200 * box.width, box.y + cane[1] / 800 * box.height];
  await page.mouse.move(at[0], at[1]);
  await page.waitForTimeout(150);
  const hovered = await info(page);
  await page.mouse.click(at[0], at[1]);
  await page.waitForTimeout(300);
  const clicked = await info(page);
  check('playful: a click shakes a bract loose, and hovering the vine stirs it', clicked.drops === after.drops + 1 && calmNow.stirred === 0 && hovered.stirred > 0, `${after.drops} dropped, then ${clicked.drops}; ${calmNow.stirred} stirred before the hover, ${hovered.stirred} after`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
  const w = await open('/packages/scenes/vel/demo.html?register=warm&content=0');
  await w.page.locator('sg-scene').locator('.stage').focus().catch(() => {});
  const wb = await info(w.page);
  await w.page.keyboard.press('ArrowUp'); await w.page.keyboard.press('Enter'); await w.page.waitForTimeout(300);
  const wa = await info(w.page);
  check('control: in warm, Enter drops nothing and nothing is stirred', wa.drops === wb.drops && wa.stirred === 0, `${wb.drops} then ${wa.drops} dropped, ${wa.stirred} stirred`);
  await w.ctx.close();
}

// 6. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/vel/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/vel/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
