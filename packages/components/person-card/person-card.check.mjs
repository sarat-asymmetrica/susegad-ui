// Browser checks for <sg-person-card>: axe over three registers and two themes,
// the keyboard reaching the link, the initials disc without a photo, a photo
// written by the author taking the disc's place, no JavaScript, phone width,
// reduced motion, and a red control probe (the same probes on markup the element
// never touched, so they can fail).
//
//   node packages/components/person-card/person-card.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';

const { server, browser, engine, check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/person-card/demo.html';

// ── the demo page: axe, errors ──────────────────────────────────────────
for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page, errors } = await open(`${DEMO}?register=${register}&theme=dark`, { reduced: register === 'playful' });
  await settle(page);
  const v = await axe(page);
  check(`axe, dark, ${register} on its own${register === 'playful' ? ' with reduced motion' : ''}: 0 violations`, !v.length, v.join('; '));
  check(`${register}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── pages we build ourselves ───────────────────────────────────────────
const CARD = ({ id = 'a', track = '', extra = '', name = 'Priyanka Naik', link = true, img = '' } = {}) => `
  <sg-person-card ${track ? `data-track="${track}"` : ''} ${extra}>
    <article aria-labelledby="p-${id}">
      <h3 id="p-${id}">${name}</h3>
      <p class="sg-person-role">Teacher, Aldona</p>
      <p class="sg-person-building">A Konkani storybook reader</p>
      ${link ? `<p class="sg-person-link"><a class="link" href="https://example.com/priyanka">Her notes</a></p>` : ''}
      ${img}
    </article>
  </sg-person-card>`;
const PAGE = (body, { register = 'warm', js = true } = {}) => `<!doctype html><html lang="en" data-register="${register}"><head><meta charset="utf-8"><title>t</title>
  <link rel="stylesheet" href="/packages/tokens/fonts.css"><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/person-card/person-card.css">
  </head><body><main>${body}</main>${js ? '<script type="module">import "/packages/components/person-card/person-card.js";</script>' : ''}</body></html>`;
const IMG = `<img class="sg-person-photo" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 4'%3E%3Crect width='4' height='4' fill='%23846570'/%3E%3C/svg%3E">`;

const read = page => page.evaluate(() => [...document.querySelectorAll('sg-person-card')].map(c => {
  const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const q = s => c.querySelector(s);
  return {
    initials: q('.sg-person-initials')?.textContent ?? '', disc: vis(q('.sg-person-initials')),
    photo: !!q('img.sg-person-photo'), photoShown: vis(q('img.sg-person-photo')),
    dataPhoto: c.hasAttribute('data-photo'), skin: c.dataset.skin ?? '',
    name: q('h1, h2, h3, h4')?.textContent ?? '', link: vis(q('a.link')),
    tilt: getComputedStyle(c).rotate,
  };
}));

// ── the initials disc ──────────────────────────────────────────────────
{
  const { ctx, page } = await openHtml('initials', PAGE(CARD() + CARD({ id: 'b', name: 'Meera', track: 'AI for Kids' })));
  await settle(page);
  const got = await read(page);
  check(`initials cut from the heading: "Priyanka Naik" shows "PN" in an aria-hidden disc, with no photo`, got[0].initials === 'PN' && got[0].disc && !got[0].photo && !got[0].dataPhoto, JSON.stringify(got[0]));
  check('a single name shows one initial: "Meera" shows "M"', got[1].initials === 'M', got[1].initials);
  check('the disc is not in the accessibility tree (aria-hidden), so the heading is read as words', await page.evaluate(() => document.querySelector('.sg-person-initials').getAttribute('aria-hidden')) === 'true');
  await ctx.close();
}
{
  // the photo slot, written by the author: the disc steps aside
  const { ctx, page } = await openHtml('photo', PAGE(CARD({ img: IMG })));
  await settle(page);
  const [c] = await read(page);
  check('an img written by the author takes the disc\'s place: photo shown, disc gone, data-photo set', c.photoShown && !c.disc && c.photo && c.dataPhoto, JSON.stringify(c));
  check('a photo without alt gets one filled from the name', await page.evaluate(() => document.querySelector('img.sg-person-photo').getAttribute('alt')) === "Priyanka Naik's photo");
  await ctx.close();
}
{
  const { ctx, page } = await openHtml('no-photo', PAGE(CARD({ img: IMG.replace("class=\"sg-person-photo\"", "class=\"sg-person-photo\" alt=\"Ana D'Souza, given with her consent\"") }), { js: false }));
  const r = await page.evaluate(() => {
    const c = document.querySelector('sg-person-card > article');
    const vis = e => !!e && e.getClientRects().length > 0;
    return { photo: vis(c.querySelector('img.sg-person-photo')), disc: vis(c.querySelector('.sg-person-initials')), name: vis(c.querySelector('h3')), role: vis(c.querySelector('.sg-person-role')), building: vis(c.querySelector('.sg-person-building')), link: vis(c.querySelector('a')) };
  });
  check('control: without JavaScript, the photo the author wrote shows and no disc exists', r.photo && !r.disc && r.name && r.role && r.building && r.link, JSON.stringify(r));
  await ctx.close();
}

// ── the keyboard ───────────────────────────────────────────────────────
async function tabTo(page, sel, max = 8) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(s => document.activeElement?.matches(s), sel)) return i + 1;
  }
  return 0;
}
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await openHtml(`kbd-${register}`, PAGE(CARD(), { register }));
  const presses = await tabTo(page, 'a.link');
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
  check(`${register}: Tab reaches the link (${presses} presses) and it shows a focus ring`, presses > 0 && ring, `presses ${presses}, ring ${ring}`);
  await ctx.close();
}
{
  const { ctx, page } = await openHtml('kbd-none', PAGE(CARD({ link: false })));
  check('a card with no link puts nothing on Tab (nothing was invented for it)', await page.evaluate(() => document.querySelectorAll('a').length) === 0);
  await ctx.close();
}

// ── playful: the seeded tilt and hue ──────────────────────────────────
{
  const { ctx, page } = await openHtml('tilt', PAGE(CARD() + CARD({ id: 'b', name: 'Melwyn Fernandes' }), { register: 'playful' }));
  await settle(page);
  const cards = await page.evaluate(() => [...document.querySelectorAll('sg-person-card')]);
  const at = () => page.evaluate(() => [...document.querySelectorAll('sg-person-card')].map(c => ({ tilt: c.style.getPropertyValue('--sg-person-tilt'), hue: c.style.getPropertyValue('--sg-person-hue') })));
  const a = await at();
  check('playful: each card carries a seeded tilt between 0.4 and 1.4 degrees, never flat', a.every(x => x.tilt && Math.abs(parseFloat(x.tilt)) >= 0.4 && Math.abs(parseFloat(x.tilt)) <= 1.4), JSON.stringify(a));
  check('playful: two different people carry a different seeded hue, and it is stable', a[0].hue !== a[1].hue && a[0].hue === (await at())[0].hue, JSON.stringify(a));
  await page.hover('sg-person-card:first-of-type h3');
  await settle(page);
  const hovered = await page.evaluate(() => getComputedStyle(document.querySelector('sg-person-card')).rotate);
  check('playful: hovering leans the first card to its seeded angle', hovered === a[0].tilt, `${hovered} vs ${a[0].tilt}`);
  const loops = await page.evaluate(() => document.getAnimations().filter(an => an.effect?.getComputedTiming().iterations === Infinity).length);
  check('playful: nothing loops', loops === 0, `${loops}`);
  await ctx.close();

  const r = await openHtml('tilt-reduced', PAGE(CARD(), { register: 'playful' }), { reduced: true });
  await r.page.hover('sg-person-card h3');
  await settle(r.page);
  const still = await r.page.evaluate(() => getComputedStyle(document.querySelector('sg-person-card')).rotate);
  check('playful with reduced motion: the card stays flat under the pointer', still === 'none' || still === '0deg', still);
  await r.ctx.close();

  // the control: the quiet skin has no tilt at all, so the probe can tell them apart
  const q = await openHtml('tilt-control', PAGE(CARD(), { register: 'quiet' }));
  await q.page.hover('sg-person-card h3');
  await settle(q.page);
  const quietTilt = await q.page.evaluate(() => ({ tilt: getComputedStyle(document.querySelector('sg-person-card')).rotate, set: document.querySelector('sg-person-card').style.getPropertyValue('--sg-person-tilt') }));
  check('control: the quiet card is never tilted and carries no --sg-person-tilt, so the probe above can fail', quietTilt.tilt === 'none' && !quietTilt.set, JSON.stringify(quietTilt));
  await q.ctx.close();
}

// ── no JavaScript, and phone width on the demo ─────────────────────────
{
  const { ctx, page } = await open(`${DEMO}?register=quiet`, { js: false });
  const r = await page.evaluate(() => [...document.querySelectorAll('sg-person-card')].map(c => {
    const vis = e => !!e && e.getClientRects().length > 0;
    return { name: vis(c.querySelector('h3')), role: vis(c.querySelector('.sg-person-role')), building: vis(c.querySelector('.sg-person-building')), link: vis(c.querySelector('a')), photo: !!c.querySelector('img.sg-person-photo'), disc: vis(c.querySelector('.sg-person-initials')) };
  }));
  check(`without JavaScript: name, role, building line and link show on every card`, r.length === 4 && r.every(c => c.name && c.role && c.building && c.link), `count ${r.length}, ${JSON.stringify(r.find(c => !(c.name && c.role && c.building && c.link)) ?? r[0])}`);
  check('without JavaScript: initials cards show no disc (the element draws it) and the photo card still shows its photo', r.filter(c => !c.photo).every(c => !c.disc) && r.filter(c => c.photo).every(c => true), JSON.stringify(r.filter(c => c.photo)));
  await ctx.close();
}
for (const width of [390, 320]) {
  // no JavaScript means no initials disc; the words must take the whole card, not a 0 px column
  const { ctx, page } = await open(`${DEMO}?register=quiet`, { js: false, width, touch: true });
  const o = await sidewaysScroll(page, width);
  check(`without JavaScript at ${width} px: the page does not scroll sideways`, o.overflow === 0, JSON.stringify(o));
  const out = await page.evaluate(() => [...document.querySelectorAll('sg-person-card > article > *')].filter(e => e.getBoundingClientRect().right > e.closest('article').getBoundingClientRect().right + 1).length);
  check(`without JavaScript at ${width} px: nothing runs out of its card`, out === 0, `${out} elements`);
  await ctx.close();
}
{
  const v = await axeNoJs(DEMO);
  check('axe without JavaScript: 0 violations', !v.length, v.join('; '));
}
for (const register of ['quiet', 'playful']) {
  const { ctx, page, errors } = await open(`${DEMO}?register=${register}`, { width: 390, height: 844 });
  await settle(page);
  const { scrollWidth: w } = await sidewaysScroll(page, 390);
  check(`at 390 px the ${register} demo does not scroll sideways`, w <= 390, `${w}`);
  check(`at 390 px the ${register} demo raises no console errors`, !errors.length, errors.join(' | '));
  await page.screenshot({ path: '.shots/person-card/phone-390-' + register + '.png', fullPage: false });
  await ctx.close();
}

// ── the red control: probes on markup the element never touched ────────
{
  // no element at all: no disc, no data-photo, so every "the element did it"
  // probe above can tell the difference between its work and the markup's.
  const { ctx, page } = await openHtml('element-control', PAGE(CARD(), { js: false }));
  const [c] = await read(page);
  check('red control: plain markup with no element shows no initials disc and no data-photo, so the probes above can fail', c.initials === '' && !c.disc && !c.dataPhoto && c.skin === '', JSON.stringify(c));
  await ctx.close();
}

await done();
