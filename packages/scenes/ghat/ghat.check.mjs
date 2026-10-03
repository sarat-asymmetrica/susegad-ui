// Browser checks for Ghat that a Node test cannot reach:
//
//   node packages/scenes/ghat/ghat.check.mjs
//
// 1. with progress set the canvas holds still and the status says how far
//    the sheet is inked (control: with no progress, the same canvas changes);
// 2. reduced motion and quiet show the fully inked sheet;
// 3. the height of the ground is real text: hover in warm, and the keyboard
//    hand in playful, said once in a live region;
// 4. the demo's second sheet follows the page's scroll through progress;
// 5. no request leaves the page; axe (WCAG 2.2 AA) on the demo in every
//    register, light and dark; no console errors.

import { harness } from '../../../tools/lib/component-check.mjs';

const h = await harness();
const { check } = h;
const scene = q => `/tools/harness/scene.html?name=ghat&${q}`;
const open = async (path, opts) => {
  const r = await h.open(path, opts);
  await r.page.waitForFunction(() => window.__ready === true, null, { timeout: 40000 })
    .catch(async () => { check(`ready: ${path}`, false, 'no sg-ready in 40 s'); await h.done(); });
  await r.page.evaluate(() => document.fonts.ready);
  return r;
};
const hash = page => page.evaluate(() => {
  const cv = window.__piece.shadowRoot.querySelector('canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let s = 0; for (let i = 0; i < d.length; i += 16) s = (s * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) >>> 0; return s;
});
const stageData = (page, k) => page.evaluate(k => window.__piece.shadowRoot.querySelector('.stage').dataset[k], k);

// 1. a set progress holds, and is said
{
  const held = await open('/packages/scenes/ghat/demo.html?register=warm&progress=0.4');
  await held.page.waitForTimeout(1200);
  const a = await hash(held.page); await held.page.waitForTimeout(3000); const b = await hash(held.page);
  const said = await held.page.evaluate(() => window.__piece.shadowRoot.querySelector('[role=status]').textContent);
  const inked = await stageData(held.page, 'inked');
  check('progress=0.4: inked exactly that far, and the canvas is unchanged over three seconds', a === b && inked === '0.400', `${a} then ${b}; inked ${inked}`);
  check('progress=0.4: the status says it', said === 'A survey sheet of the ghats: 40% done', `"${said}"`);
  check('no console errors (progress)', held.errors.length === 0, held.errors.join(' | '));
  await held.ctx.close();
  const free = await open(scene('register=warm'));
  await free.page.waitForTimeout(500);
  const c = await hash(free.page); await free.page.waitForTimeout(3000); const d = await hash(free.page);
  check('control: with no progress, the same canvas changes over three seconds', c !== d, `${c} then ${d}`);
  await free.ctx.close();
}

// 2. the still is the inked sheet
{
  for (const [q, opts, name] of [['register=quiet', {}, 'quiet'], ['register=warm', { reduced: true }, 'warm under reduced motion']]) {
    const { ctx, page } = await open(scene(q), opts);
    await page.waitForTimeout(300);
    const a = await hash(page), inked = await stageData(page, 'inked');
    await page.waitForTimeout(2000);
    const b = await hash(page);
    check(`${name}: the fully inked sheet, holding still`, inked === '1.000' && a === b, `inked ${inked}; ${a} then ${b}`);
    await ctx.close();
  }
}

// 3. the height as text
{
  const warm = await open('/packages/scenes/ghat/demo.html?register=warm&content=0');
  const box = await warm.page.locator('sg-scene#ghat').locator('.stage').boundingBox(), k = box.width / 1200;
  await warm.page.mouse.move(box.x + 1000 * k, box.y + 450 * k); await warm.page.waitForTimeout(300);
  await warm.page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.inked > '0.3', null, { timeout: 20000 }).catch(() => {});
  await warm.page.mouse.move(box.x + 1001 * k, box.y + 451 * k); await warm.page.waitForTimeout(300);
  const ridge = await warm.page.locator('#height').textContent();
  await warm.page.mouse.move(box.x + 80 * k, box.y + 450 * k); await warm.page.waitForTimeout(300);
  const sea = await warm.page.locator('#height').textContent();
  check('warm: hovering reads the ground as text, high on the ridge and deep at sea', /Height here: \d+ m$/.test(ridge) && parseInt(ridge.match(/\d+/)[0], 10) > 300 && / m deep$/.test(sea), `ridge "${ridge}", sea "${sea}"`);
  await warm.ctx.close();

  const pl = await open('/packages/scenes/ghat/demo.html?register=playful&content=0');
  await pl.page.waitForFunction(() => window.__piece.shadowRoot.querySelector('.stage').dataset.inked > '0.3', null, { timeout: 20000 }).catch(() => {});
  const stage = pl.page.locator('sg-scene#ghat').locator('.stage');
  await stage.focus();
  for (let i = 0; i < 4; i++) { await pl.page.keyboard.press('ArrowRight'); await pl.page.waitForTimeout(120); }
  await pl.page.waitForTimeout(300);
  const said = await pl.page.evaluate(() => window.__piece.shadowRoot.querySelector('[aria-live=polite]').textContent);
  check('playful: the keyboard hand says the height under it', /^Height here: \d+ m( deep)?$/.test(said), `"${said}"`);
  check('no console errors (playful)', pl.errors.length === 0, pl.errors.join(' | '));
  await pl.ctx.close();
}

// 4. the page's scroll drives the second sheet
{
  const { ctx, page } = await open('/packages/scenes/ghat/demo.html?register=warm');
  const before = Number(await page.locator('#scrolled').getAttribute('progress'));
  await page.locator('#scrolled').evaluate(el => el.scrollIntoView({ block: 'end' }));
  await page.waitForTimeout(400);
  const after = Number(await page.locator('#scrolled').getAttribute('progress'));
  check('demo: scrolling the second sheet into view inks it through progress', before < 0.2 && after > 0.6, `${before} before, ${after} in view`);
  await ctx.close();
}

// 5. no request leaves the page; axe everywhere
{
  const out = [];
  const { ctx, page, errors } = await open('/packages/scenes/ghat/demo.html?register=warm');
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => { out.push(new URL(r.request().url()).host); r.abort(); });
  await page.reload(); await page.waitForTimeout(1500);
  check('no request leaves the page', out.length === 0, out.join(', ') || 'none');
  check('no console errors (demo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`/packages/scenes/ghat/demo.html?register=${register}&theme=${theme}`);
  const v = await h.axe(page);
  check(`axe: ${register}, ${theme}`, v.length === 0, v.join('; ') || '0 violations');
  if (errors.length) check(`no console errors (${register}, ${theme})`, false, errors.join(' | '));
  await ctx.close();
}

await h.done();
