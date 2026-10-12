// Browser checks for Mankurad that a Node test cannot reach:
//
//   node packages/scenes/mankurad/mankurad.check.mjs
//   node packages/scenes/mankurad/mankurad.check.mjs --break   (planted faults: the checks marked --break must FAIL)
//
// 1. progress holds the story at a beat: the status names the work, the canvas
//    does not change over three seconds (control: with no progress it does;
//    --break: the model ignores progress), 0 is the hanging fruit and 1 the
//    fallen one;
// 2. the still is the plate's: the same pixels in quiet and in warm under
//    reduced motion;
// 3. the rain keeps off the page's words (control: the same boxes with no
//    words catch it; --break: the rain falls across the words);
// 4. playful: Enter tells the story again from the start (--break: Enter does
//    nothing);
// 5. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.
//
// Scene time is stepped, not waited for (tools/lib/virtual-time.mjs): the pages
// that move run on virtual frames, each step a sixtieth of a second of the
// scene's time ("three seconds" are 180 frames), and a frozen moment is the
// same pixels the real clock gives. On the real clock still: the stills
// (nothing moves), "no request leaves the page" (it watches the network), and axe.

import { harness } from '../../../tools/lib/component-check.mjs';
import { frames, frozenAt, grabPixels, hashPixels, openStepped, plantFault } from '../../../tools/lib/virtual-time.mjs';

const BREAK = process.argv.includes('--break');
const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=mankurad&${q}`;
/** A planted fault: one of Mankurad's files with `from` replaced; fails loudly if the line has moved. */
const plant = (...rows) => plantFault(import.meta.url, check, ...rows);
/** A page on the real clock (the stills, the network and axe). */
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 30 s'); await h.done(); });
  return r;
};
const stepped = (path, opts) => openStepped(h, path, { ms: 30000, ...opts });
const stageData = (page, k) => page.evaluate(k => window.__piece.shadowRoot.querySelector('.stage').dataset[k], k);
const UNITS = [1000, 1000];
const grab = page => grabPixels(page, { units: UNITS });
const frozen = (q, opts) => frozenAt(h, scene(q), { ...opts, grab: { units: UNITS } });
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

// 1. progress holds the story (three seconds are 180 frames of the scene's time). The held page used to stay on the real
//    clock: before core's sleep-race fix a held scene on virtual frames sometimes never fired sg-ready (3 runs of 4); with
//    the fix it reached ready 6 of 6 (12 October).
{
  // --break: the model ignores progress, so the story runs on while the status still says 40%
  const { ctx, page } = await stepped('/packages/scenes/mankurad/demo.html?register=warm&progress=0.4&content=0',
    { routes: BREAK ? plant(['model.js', 'const held = params.progress != null;', 'const held = false;']) : [] });
  await frames(page, 72);
  const a = await grab(page); await frames(page, 180); const b = await grab(page);
  // the status is spoken at most once a second of real time (scene-element #status), whatever the frames: wait for it, not for a sleep
  await page.waitForFunction(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent !== '', null, { timeout: 5000 }).catch(() => {});
  const said = await page.evaluate(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent);
  check('progress: the status names the work', said === 'Order progress: 40% done', `"${said}"`);
  check('progress=0.4: the canvas does not change over three seconds', hashPixels(a) === hashPixels(b), `${hashPixels(a)} then ${hashPixels(b)}`);
  await page.evaluate(() => window.__piece.setAttribute('progress', '1'));
  await frames(page, 36);
  const done = await stageData(page, 'mango');
  await page.evaluate(() => window.__piece.setAttribute('progress', '0'));
  await frames(page, 36);
  const start = await stageData(page, 'mango');
  check('progress 1 is the fallen mango, 0 the hanging one', done === 'down' && start === 'hang', `1: ${done}, 0: ${start}`);
  await ctx.close();
  const free = await stepped('/packages/scenes/mankurad/demo.html?register=warm&content=0');
  await frames(free.page, 72);
  const c = await grab(free.page); await frames(free.page, 180); const d = await grab(free.page);
  check('control: with no progress, the same canvas changes', hashPixels(c) !== hashPixels(d), `${hashPixels(c)} then ${hashPixels(d)}`);
  await free.ctx.close();
}

// 2. the still
{
  const stillOf = async (q, opts) => { const { ctx, page } = await open(scene(q), opts); await page.waitForTimeout(400); const g = await grab(page); await ctx.close(); return g; };
  const quiet = await stillOf('register=quiet'), reduced = await stillOf('register=warm', { reduced: true });
  check('the still: quiet and warm under reduced motion paint the same frame', diff(quiet, reduced, undefined, 6) < 0.002, `${pct(diff(quiet, reduced, undefined, 6))} differ`);
}

// 3. the rain keeps off the words (playful: the story's own clock; the rain is heavy at 25 s). One page per pair:
//    25 s on the way to a 25.05 s freeze is the picture ?freeze=25 freezes.
{
  // --break: the rain falls across the words
  const rainsOn = BREAK ? plant(['render.js', 'if (calm.length && (inCalm(x, y, calm) || inCalm(x - d.len * 0.3, y + d.len, calm))) continue;', 'if (false) continue;']) : [];
  const [w1, w2] = await frozen('register=playful&freeze=25.05&content=1', { at: [25], routes: rainsOn });
  const [b1, b2] = await frozen('register=playful&freeze=25.05', { at: [25] });
  const avg = (a, b) => w1.words.reduce((m, box) => m + diff(a, b, box), 0) / w1.words.length;
  const under = avg(w1, w2), bare = avg(b1, b2);
  check('rain: under the words nothing moves while it rains', w1.words.length > 0 && under < 0.001, `${pct(under)} in ${w1.words.length} boxes`);
  check('control: the same boxes with no words catch the rain', bare > 0.004, pct(bare));
}

// 4. playful: Enter tells it again (six seconds are 360 frames, four tenths of a second 24)
{
  // --break: Enter does nothing
  const { ctx, page, errors } = await stepped('/packages/scenes/mankurad/demo.html?register=playful&content=0',
    { routes: BREAK ? plant(['render.js', 'activate() { sceneEl?.replay?.(); }', 'activate() { }']) : [] });
  await frames(page, 360);
  const before = Number(await stageData(page, 'lt'));
  await page.locator('sg-scene').locator('.stage').focus();
  await page.keyboard.press('Enter');
  await frames(page, 24);
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

if (BREAK) console.log('\n--break: "progress=0.4: the canvas does not change", "rain: under the words nothing moves" and "playful: Enter tells the story again" should FAIL');
await h.done();
