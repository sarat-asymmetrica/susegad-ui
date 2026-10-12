// Browser checks for Abri that a Node test cannot reach:
//
//   node packages/scenes/abri/abri.check.mjs
//   node packages/scenes/abri/abri.check.mjs --break   (planted faults: the checks marked --break must FAIL)
//
// 1. the still is the lifted print, the same pixels in quiet (twice) and in
//    warm under reduced motion (control: the running tray three seconds in is
//    different);
// 2. the size holds still under the page's words while the drift moves it
//    elsewhere (control: the same boxes with no words do move; --break: the
//    size is not held under the words), and the veins under the words survive
//    the governor dropping below half quality (forced: stepped frames never
//    slow it; --break: the veins are dropped everywhere);
// 3. playful: Enter drops a colour where the keyboard hand is, and the arrow
//    keys drag the colours with the hand (--break: Enter does nothing);
// 4. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.
//
// Scene time is stepped, not waited for (tools/lib/virtual-time.mjs): the pages
// that move run on virtual frames, each step a sixtieth of a second of the
// scene's time, and a frozen moment is the same pixels the real clock gives.
// That is what settles the calm check's old flake: it read two screenshots half
// a second of real time apart, and a slow frame under load carried the second
// across a stage change (the 2.6% to 33% drift). Two grabs 30 frames apart are
// always half a second of the scene's time apart. On the real clock still: the
// stills (nothing moves), "no request leaves the page" (it watches the
// network), and axe.

import { harness } from '../../../tools/lib/component-check.mjs';
import { forceQuality, frames, frozenAt, grabPixels, openStepped, plantFault, until } from '../../../tools/lib/virtual-time.mjs';

const BREAK = process.argv.includes('--break');
const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=abri&${q}`;
/** A planted fault: one of Abri's files with `from` replaced; fails loudly if the line has moved. */
const plant = (...rows) => plantFault(import.meta.url, check, ...rows);
/** A page on the real clock (the stills, the network and axe). */
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 90 s'); await h.done(); });
  return r;
};
const stepped = (path, opts) => openStepped(h, path, { ms: 90000, ...opts });
const UNITS = [1200, 860];
const grab = page => grabPixels(page, { units: UNITS });
const frozen = (q, opts) => frozenAt(h, scene(q), { ...opts, grab: { units: UNITS }, ms: 180000 });
function diff(a, b, box = { x: 0, y: 0, w: 1200, h: 860 }, th = 40) {
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

// 1. the still is the print
{
  const stillOf = async (q, opts) => { const { ctx, page } = await open(scene(q), opts); await page.waitForTimeout(300); const g = await grab(page); await ctx.close(); return g; };
  const [a, b, c] = await Promise.all([stillOf('register=quiet&seed=1'), stillOf('register=quiet&seed=1'), stillOf('register=warm&seed=1', { reduced: true })]);
  check('the still: quiet twice and warm under reduced motion show the same print', a.data.stage === 'print' && diff(a, b, undefined, 0) === 0 && diff(a, c, undefined, 6) < 0.002, `stage ${a.data.stage}; ${pct(diff(a, b, undefined, 0))} and ${pct(diff(a, c, undefined, 6))} differ`);
  const early = await frozen('register=playful&seed=1&freeze=3');
  check('control: three seconds into the running tray, the picture differs from the print', early.data.stage === 'drops' && diff(a, early) > 0.2, `stage ${early.data.stage}, ${pct(diff(a, early))} differ`);
}

// 2. the size holds still under the words while the drift moves it elsewhere. Virtual frames: step to early in
//    the drift (so the second grab cannot reach the sheet's laying), then two grabs 30 frames (half a second) apart
//    on the same page
{
  // --break: the physics does not hold the size under the words
  const sizeMoves = BREAK ? plant(['render.js', 'B.hold = calm;', 'B.hold = [];']) : [];
  const drift = async (q, routes, lowQuality = false) => {
    const { ctx, page } = await stepped(scene(q), { routes });
    const inWindow = await until(page, () => { const u = +window.__piece.shadowRoot.querySelector('.stage').dataset.u; return u > 31.8 && u < 34; }, { ms: 120000, batch: 3 });
    if (!inWindow) check(`calm: the page reached the drift window (instrument): ${q}`, false, 'u never read 31.8 to 34 in 120 s');
    const a = await grab(page);
    if (lowQuality) await page.evaluate(() => { globalThis.__q = 0.25; }); // below half quality the veins go, except round the words
    await frames(page, 30); const b = await grab(page);
    await ctx.close();
    return [a, b];
  };
  const [w1, w2] = await drift('register=playful&seed=1&content=1', sizeMoves), [b1, b2] = await drift('register=playful&seed=1');
  const avg = (a, b) => w1.words.reduce((m, box) => m + diff(a, b, box), 0) / w1.words.length;
  const under = avg(w1, w2), bare = avg(b1, b2), rest = diff(w1, w2, { x: 700, y: 100, w: 400, h: 350 });
  check('calm: under the words the size holds still while it drifts elsewhere', w1.data.stage === 'drift' && w2.data.stage === 'drift' && under < 0.003 && rest > 0.01, `stage ${w1.data.stage}/${w2.data.stage}; ${pct(under)} under the words, ${pct(rest)} elsewhere`);
  check('control: the same boxes with no words drift', bare > 0.01, pct(bare));
  // Stepped frames are always 16.7 ms, so the governor never leaves 1 and this branch would never run (the veins fix
  // of 12 October could be reverted and every other clause stayed green). Force the level between the two grabs.
  // --break: the veins are dropped everywhere below half quality, words or not
  const veinsGo = BREAK ? plant(['render.js', 'fillPolys(g, q < 0.5 ? 0 : 0.28, calm.map(r => ({ x: r.x - 30, y: r.y - 30, w: r.w + 60, h: r.h + 60 })), 0.28)', 'fillPolys(g, q < 0.5 ? 0 : 0.28)']) : [];
  const [l1, l2] = await drift('register=playful&seed=1&content=1', [...forceQuality(), ...veinsGo], true);
  const low = l1.words.reduce((m, box) => m + diff(l1, l2, box), 0) / l1.words.length;
  check('calm: the veins under the words survive the governor dropping below half quality', l1.data.stage === 'drift' && l2.data.stage === 'drift' && low < 0.003, `stage ${l1.data.stage}/${l2.data.stage}; ${pct(low)} under the words`);
}

// 3. playful: the keyboard hand drops and drags colour (150 ms is 9 frames, 900 ms 54)
{
  // --break: Enter does nothing
  const { ctx, page, errors } = await stepped('/packages/scenes/abri/demo.html?register=playful&content=0',
    { routes: BREAK ? plant(['render.js', 'if (!p || !B || !built) return;', 'if (p || !B || !built) return;']) : [] });
  // step to the stylus: every natural drop has landed by then
  await until(page, () => window.__piece.shadowRoot.querySelector('.stage').dataset.stage === 'comb', { ms: 60000, batch: 30 });
  const stage = page.locator('sg-scene').locator('.stage');
  await stage.focus();
  await page.keyboard.press('ArrowDown'); await frames(page, 9);
  const before = await grab(page);
  await page.keyboard.press('Enter'); await frames(page, 54);
  const after = await grab(page);
  // the hand starts at the middle (600, 430) and one press down moves it 36 units
  const hand = diff(before, after, { x: 560, y: 420, w: 80, h: 80 }), far = diff(before, after, { x: 100, y: 100, w: 200, h: 200 });
  const colours = g => Number(g.data.colours);
  check('playful: Enter drops one colour where the keyboard hand is', colours(after) === colours(before) + 1 && hand > 0.3, `${colours(before)} then ${colours(after)} colours; ${pct(hand)} of the hand's box changed, ${pct(far)} far away`);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 4. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/abri/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/abri/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

if (BREAK) console.log('\n--break: "calm: under the words the size holds still", "calm: the veins under the words survive the governor" and "playful: Enter drops one colour" should FAIL');
await h.done();
