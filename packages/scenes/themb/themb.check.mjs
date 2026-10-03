// Browser checks for Themb that a Node test cannot reach:
//
//   node packages/scenes/themb/themb.check.mjs
//
// Headless Chromium draws WebGL on the CPU (SwiftShader), so the governor
// soon hands a running leaf to the 2D painting here; checks that are about the
// shader pass renderer=webgl to keep it.
//
// 1. the still: quiet and warm under reduced motion show the same leaf, pixel
//    for pixel (control: the running leaf a second in is different);
// 2. renderer=2d paints a real leaf: mostly green where the leaf is, dark round it;
// 3. losing the WebGL context hands the leaf to the 2D painting;
// 4. the rain and the splashes keep off the page's words (control: the same
//    boxes with no words do catch them);
// 5. playful: Enter pours the cup, and the drawing takes focus;
// 6. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=themb&${q}`;
const ignore = e => /GPU stall due to ReadPixels|GL Driver Message/.test(e);
const open = async (path, opts = {}) => {
  const errors = [];
  const r = await h.open(path, { ...opts, errors });
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 30 s'); await h.done(); });
  return { ...r, errors: { get length() { return errors.filter(e => !ignore(e)).length; }, join: s => errors.filter(e => !ignore(e)).join(s) } };
};
const data = (page, k) => page.evaluate(k => window.__piece.shadowRoot.querySelector('.stage').dataset[k], k);
// the element's pause button sits over the stage in warm; hide it so the pictures compare the leaf alone
const shot = async page => { await page.evaluate(() => { window.__piece.shadowRoot.querySelector('button').style.visibility = 'hidden'; }); return page.locator('sg-scene').locator('.stage').screenshot(); };
/** Share of the 2D canvas's pixels in `box` (scene units) that pass `test`, over the canvas as drawn now. */
const share = (page, box, test) => page.evaluate(([box, test]) => {
  const cv = window.__piece.shadowRoot.querySelectorAll('.stage canvas')[1], k = cv.width / 1200, g = cv.getContext('2d');
  const x = Math.round(box.x * k), y = Math.round(box.y * k), w = Math.round(box.w * k), hh = Math.round(box.h * k);
  const d = g.getImageData(x, y, w, hh).data, fn = new Function('return ' + test)();
  let n = 0; for (let i = 0; i < d.length; i += 4) if (fn(d[i], d[i + 1], d[i + 2], d[i + 3])) n++;
  return n / (w * hh);
}, [box, test]);
const pct = v => `${(v * 100).toFixed(2)}%`;

// 1. the still
{
  const a = await open(scene('register=quiet&renderer=webgl'));
  await a.page.waitForTimeout(400); const quiet = await shot(a.page); await a.ctx.close();
  const b = await open(scene('register=warm&renderer=webgl'), { reduced: true });
  await b.page.waitForTimeout(400); const reduced = await shot(b.page); await b.ctx.close();
  const c = await open(scene('register=warm&renderer=webgl'));
  await c.page.waitForTimeout(1000); const running = await shot(c.page); await c.ctx.close();
  check('the still: quiet and warm under reduced motion are the same leaf, pixel for pixel', quiet.equals(reduced), `${quiet.length} and ${reduced.length} bytes`);
  check('control: the running leaf a second in is a different picture', !quiet.equals(running));
}

// 2. the 2D painting is a real leaf
{
  const { ctx, page } = await open(scene('register=quiet&renderer=2d'));
  const leaf = await data(page, 'leaf');
  const green = await share(page, { x: 460, y: 300, w: 300, h: 200 }, '(r, g, b) => g > r + 25 && g > b + 25 && g > 90');
  const dark = await share(page, { x: 10, y: 10, w: 160, h: 120 }, '(r, g, b) => r + g + b < 150');
  check('renderer=2d: the stage paints in 2D, a green leaf on the dark ground', leaf === '2d' && green > 0.6 && dark > 0.8, `data-leaf=${leaf}, leaf ${pct(green)} green, corner ${pct(dark)} dark`);
  await ctx.close();
}

// 3. context loss
{
  const { ctx, page, errors } = await open(scene('register=warm&renderer=webgl'));
  const before = await data(page, 'leaf');
  await page.evaluate(() => window.__piece.shadowRoot.querySelector('.stage canvas').getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForTimeout(600);
  const after = await data(page, 'leaf');
  const green = await share(page, { x: 460, y: 300, w: 300, h: 200 }, '(r, g, b) => g > r + 25 && g > b + 25 && g > 90');
  check('context lost: the shader hands the leaf to the 2D painting', before === 'webgl' && after === '2d' && green > 0.5, `${before} then ${after}, leaf ${pct(green)} green on the 2D canvas`);
  check('no console errors (context loss)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 4. the rain keeps off the words (renderer=webgl, so the 2D canvas carries only rain, streaks and splashes)
{
  const count = async content => {
    const { ctx, page } = await open(scene(`register=playful&renderer=webgl${content ? '&content=1' : ''}`));
    const boxes = await page.evaluate(() => {
      const el = window.__piece, st = el.shadowRoot.querySelector('.stage').getBoundingClientRect(), k = 1200 / st.width;
      return [{ x: 40, y: 560, w: 540, h: 200 }, ...[...el.children].map(c => { const r = c.getBoundingClientRect(); return { x: (r.left - st.left) * k, y: (r.top - st.top) * k, w: r.width * k, h: r.height * k }; })];
    });
    const boxesOfWords = content ? boxes.slice(1) : [{ x: 60, y: 655, w: 560, h: 40 }, { x: 60, y: 710, w: 560, h: 30 }];
    let sum = 0;
    for (let k = 0; k < 16; k++) {
      await page.waitForTimeout(250);
      for (const b of boxesOfWords) sum += await share(page, b, '(r, g, b, a) => a > 12');
    }
    await ctx.close();
    return { sum, boxesOfWords };
  };
  const words = await count(true), bare = await count(false);
  check('rain: under the words no streak or splash is drawn over four seconds of showers', words.sum < 0.002, `${pct(words.sum)} summed over 16 frames`);
  check('control: the same boxes with no words catch rain', bare.sum > 0.01, `${pct(bare.sum)} summed over 16 frames`);
}

// 5. playful: Enter pours
{
  const { ctx, page, errors } = await open('/packages/scenes/themb/demo.html?register=playful&content=0&renderer=webgl');
  const stage = page.locator('sg-scene').locator('.stage');
  await stage.focus();
  await page.waitForFunction(() => +window.__piece.shadowRoot.querySelector('.stage').dataset.water > 1200, null, { timeout: 20000 }).catch(() => {});
  const phase0 = await data(page, 'phase'), water0 = +(await data(page, 'water'));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const phase1 = await data(page, 'phase');
  const role = await stage.getAttribute('role');
  check('playful: with water in the cup, Enter makes the leaf dip and pour', phase0 !== 'dip' && phase1 === 'dip', `${phase0} with ${water0} of water, then ${phase1}`);
  check('playful: the drawing takes focus as an interactive drawing', role === 'application', role);
  check('no console errors (playful)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 6. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/themb/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/themb/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
