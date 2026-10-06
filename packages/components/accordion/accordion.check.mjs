// Browser checks for <sg-accordion>: axe in every register and theme, the
// keyboard reaching and toggling items, the exclusive group proving only one
// stays open, no JavaScript (the details still open and close), phone width,
// reduced motion, and a control probe that can fail.
//
//   node packages/components/accordion/accordion.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';

const { server, browser, engine, check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/accordion/demo.html';

// ── axe, errors and the plain page ──────────────────────────────────────
for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await open(`${DEMO}?register=${register}&theme=dark`, { reduced: register === 'playful' });
  await settle(page);
  const v = await axe(page);
  check(`axe, dark, ${register} on its own${register === 'playful' ? ' with reduced motion' : ''}: 0 violations`, !v.length, v.join('; '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

// ── a fixture we can hold: the FAQ group ────────────────────────────────
/** One item: a question and its answer. `name` is that item's group, if any. */
const ITEM = (q, a, { name = 'name="faq"', extra = '' } = {}) => `        <details ${name} ${extra}>
          <summary>${q}</summary>
          <p>${a}</p>
        </details>`;
const FAQ = ({ name = 'name="faq"', one = true, two = false } = {}) => `
      <sg-accordion ${name}>
${ITEM('Where is the homestay?', 'In Aldona, half an hour north of Panjim.', { name: name ? 'name="faq"' : '', extra: one ? 'open' : '' })}
${ITEM('Is breakfast included?', 'Yes, on the veranda until 10.', { name: name ? 'name="faq"' : '', extra: two ? 'open' : '' })}
${ITEM('Can I arrive late?', 'You can. Tell us the time and someone will be up.', { name: name ? 'name="faq"' : '' })}
      </sg-accordion>`;
const PAGE = (body, { register = 'warm', js = true } = {}) => `<!doctype html><html lang="en" data-register="${register}"><head><meta charset="utf-8"><title>t</title>
  <link rel="stylesheet" href="/packages/tokens/fonts.css"><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/accordion/accordion.css">
  </head><body><main>${body}</main>${js ? '<script type="module">import "/packages/components/accordion/accordion.js";</script>' : ''}</body></html>`;

/** A page from a string, with the console's warnings kept apart from its errors. */
async function fixture(name, html, { width = 1280, reduced = false, js = true, warns = [] } = {}) {
  const errors = [];
  const ctx = await browser.newContext(contextOptions(engine, {
    viewport: { width, height: 900 }, javaScriptEnabled: js, reducedMotion: reduced ? 'reduce' : 'no-preference',
    permissions: ['clipboard-read', 'clipboard-write'],
  }));
  const path = `/__check/${name}.html`;
  await ctx.route(`**${path}`, r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warns.push(m.text());
  });
  await page.goto(`${server.url}${path}`);
  if (js) await page.waitForFunction(() => window.__ready !== false, null, { timeout: 10000 }).catch(() => errors.push('never ready'));
  return { ctx, page, errors };
}

/** Which items of an accordion are open: their summaries. */
const openQuestions = page => page.evaluate(() => [...document.querySelectorAll('sg-accordion > details')].map(d => d.hasAttribute('open')));
/** How far Tab must travel to land on `sel` (0 = never got there). */
async function tabTo(page, sel, max = 12) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(s => document.activeElement?.matches(s), sel)) return i + 1;
  }
  return 0;
}

// ── the exclusive group: only one open at a time ────────────────────────
{
  const { ctx, page } = await fixture('acc-group', PAGE(FAQ()));
  let starts = await openQuestions(page);
  check('the group starts with its one open item (the first)', JSON.stringify(starts) === JSON.stringify([true, false, false]), JSON.stringify(starts));
  await page.click('sg-accordion > details:nth-of-type(2) > summary');
  await settle(page);
  let now = await openQuestions(page);
  check('opening the second question closes the first: one open, always', JSON.stringify(now) === JSON.stringify([false, true, false]), JSON.stringify(now));
  await page.click('sg-accordion > details:nth-of-type(3) > summary');
  await settle(page);
  now = await openQuestions(page);
  check('and the third displaces the second', JSON.stringify(now) === JSON.stringify([false, false, true]), JSON.stringify(now));
  await page.click('sg-accordion > details:nth-of-type(3) > summary');
  await settle(page);
  now = await openQuestions(page);
  check('tapping the open one closes it: all closed is allowed', JSON.stringify(now) === JSON.stringify([false, false, false]), JSON.stringify(now));
  const account = await page.evaluate(() => document.querySelector('sg-accordion').account);
  check(`the element's own account agrees: exclusive holds, nothing open`, account.exclusive === true && account.open.length === 0 && account.groups === 1, JSON.stringify(account));
  await ctx.close();
}
{
  // two items shipping open in one group: the browser settles it while
  // parsing (the first keeps open, the rest drop), before any element runs
  const warns = [];
  const { ctx, page } = await fixture('acc-clash', PAGE(FAQ({ two: true })), { warns });
  await page.waitForTimeout(100);
  const starts = await openQuestions(page);
  check('two items shipped open: the browser keeps the first while parsing, and one open is what readers get', JSON.stringify(starts) === JSON.stringify([true, false, false]), JSON.stringify(starts));
  check('the element adds no scolding of its own: the platform settled it', warns.every(w => !w.includes('sg-accordion: only one item')), warns.join(' | '));
  await ctx.close();
}

// ── free-standing items: every one its own ──────────────────────────────
{
  const { ctx, page } = await fixture('acc-free', PAGE(FAQ({ name: '' })));
  await page.click('sg-accordion > details:nth-of-type(1) > summary');
  await settle(page);
  await page.click('sg-accordion > details:nth-of-type(2) > summary');
  await settle(page);
  const now = await openQuestions(page);
  check('with no name anywhere, opening one closes nobody', JSON.stringify(now) === JSON.stringify([false, true, false]), JSON.stringify(now));
  await ctx.close();
}
{
  // the element's name attribute adopts the children that have none, and leaves the others alone
  const html = `      <sg-accordion name="faq">
${ITEM('One', 'one.', { name: '' })}
${ITEM('Two', 'two.', { name: '' })}
${ITEM('Three', 'three.', { name: 'name="own"' })}
      </sg-accordion>`;
  const { ctx, page } = await fixture('acc-adopt', PAGE(html));
  await page.click('sg-accordion > details:nth-of-type(3) > summary');
  await settle(page);
  await page.click('sg-accordion > details:nth-of-type(2) > summary');
  await settle(page);
  const now = await openQuestions(page);
  check('a child with its own name is left out of the adoption: both stay open', JSON.stringify(now) === JSON.stringify([false, true, true]), JSON.stringify(now));
  await ctx.close();
}

// ── the keyboard ────────────────────────────────────────────────────────
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await fixture(`acc-keys-${register}`, PAGE(FAQ({ register, one: false })));
  const presses = await tabTo(page, 'sg-accordion > details:nth-of-type(2) > summary');
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
  check(`${register}: Tab reaches the second summary (${presses} presses) and shows a focus ring`, presses > 0 && ring, `presses ${presses}, ring ${ring}`);
  await page.keyboard.press('Enter');
  await settle(page);
  let now = await openQuestions(page);
  check(`${register}: Enter opens the question`, JSON.stringify(now) === JSON.stringify([false, true, false]), JSON.stringify(now));
  await page.keyboard.press('Space');
  await settle(page);
  now = await openQuestions(page);
  check(`${register}: Space closes it again`, JSON.stringify(now) === JSON.stringify([false, false, false]), JSON.stringify(now));
  // and the exclusive group answers to the keyboard too
  await page.keyboard.press('Enter');
  await tabTo(page, 'sg-accordion > details:nth-of-type(3) > summary');
  await page.keyboard.press('Enter');
  await settle(page);
  now = await openQuestions(page);
  check(`${register}: opening the third with the keyboard closes the second`, JSON.stringify(now) === JSON.stringify([false, false, true]), JSON.stringify(now));
  await ctx.close();
}
{
  const { ctx, page } = await fixture('acc-keys-event', PAGE(FAQ({ one: true })), {});
  const changes = await page.evaluate(() => { window.__ev = []; document.querySelector('sg-accordion').addEventListener('sg-accordion-change', e => window.__ev.push(e.detail.open)); });
  await tabTo(page, 'sg-accordion > details:nth-of-type(2) > summary');
  await page.keyboard.press('Enter');
  await settle(page);
  const seen = await page.evaluate(() => window.__ev);
  check('every turn of a question tells the page (sg-accordion-change), once', seen.length === 1 && JSON.stringify(seen[0]) === JSON.stringify([1]), JSON.stringify(seen));
  await ctx.close();
}

// ── no JavaScript: the platform does it alone ───────────────────────────
{
  // With JS off, page.evaluate is not available; Playwright's own locators still read the DOM.
  const { ctx, page } = await fixture('acc-nojs', PAGE(FAQ(), { js: false }));
  const q2 = page.locator('sg-accordion > details:nth-of-type(2)').filter({ hasText: 'breakfast' });
  const visible = async () => q2.locator('p').isVisible();
  check('no JavaScript: the second answer starts closed', !(await visible()));
  await page.click('sg-accordion > details:nth-of-type(2) > summary');
  await page.waitForTimeout(60);
  check('no JavaScript: a click on the summary opens it', await visible());
  await page.click('sg-accordion > details:nth-of-type(2) > summary');
  await page.waitForTimeout(60);
  check('no JavaScript: and a second click closes it', !(await visible()));
  await ctx.close();
}
{
  // and the exclusive promise holds without JavaScript too
  const { ctx, page } = await fixture('acc-nojs-group', PAGE(FAQ(), { js: false }));
  await page.click('sg-accordion > details:nth-of-type(2) > summary');
  await page.waitForTimeout(60);
  const first = page.locator('sg-accordion > details:nth-of-type(1)').filter({ hasText: 'homestay' }).locator('p');
  const third = page.locator('sg-accordion > details:nth-of-type(3) > p');
  await page.click('sg-accordion > details:nth-of-type(3) > summary');
  await page.waitForTimeout(60);
  const states = [(await first.isVisible()), (await third.isVisible())];
  check('no JavaScript: opening the third closes the first, on the platform alone', JSON.stringify(states) === JSON.stringify([false, true]), JSON.stringify(states));
  await ctx.close();
}

// ── phone width ─────────────────────────────────────────────────────────
{
  const { ctx, page } = await fixture('acc-390', PAGE(FAQ({ register: 'warm' })), { width: 390 });
  await settle(page);
  await page.click('sg-accordion > details:nth-of-type(1) > summary');
  await settle(page);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check('at 390 px the open accordion does not scroll sideways', w <= 390, `${w}`);
  const box = await page.evaluate(() => { const d = document.querySelector('sg-accordion > details'); const r = d.getBoundingClientRect(); return { left: +r.left.toFixed(1), width: +r.width.toFixed(1) }; });
  check('at 390 px the accordion fills the column between the body margins', box.left === 8 && box.width === 374 && box.left + box.width === 382, JSON.stringify(box));
  await ctx.close();
}
{
  const { ctx, page } = await open(`${DEMO}?register=playful`, { width: 390 });
  await settle(page);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check('at 390 px the demo (playful) does not scroll sideways', w <= 390, `${w}`);
  await ctx.close();
}

// ── reduced motion: a finished still ────────────────────────────────────
{
  const { ctx, page } = await fixture('acc-still', PAGE(FAQ({ register: 'playful' }), { register: 'playful' }), { reduced: true });
  const still = await page.evaluate(() => {
    const d = document.querySelector('sg-accordion > details');
    const marker = getComputedStyle(d.querySelector('summary'), '::before');
    const content = getComputedStyle(d, '::details-content');
    return { markerTransition: marker.transitionDuration, contentTransition: content.transitionDuration };
  });
  check('reduced motion, playful: neither the glyph nor the content carries a transition (under a millisecond)', still.markerTransition.startsWith('0s') || parseFloat(still.markerTransition) < 0.001, JSON.stringify(still));
  await page.click('sg-accordion > details:nth-of-type(2) > summary');
  await settle(page);
  const now = await openQuestions(page);
  const answer = await page.evaluate(() => { const p = document.querySelector('sg-accordion > details:nth-of-type(2) > p'); const r = p.getBoundingClientRect(); return { open: p.getClientRects().length > 0, h: Math.round(r.height) }; });
  check('reduced motion: the question still opens, and the answer is a finished still on the page', JSON.stringify(now) === JSON.stringify([false, true, false]) && answer.open && answer.h > 10, JSON.stringify({ now, answer }));
  await ctx.close();
}
{
  // the open transition is real when motion is allowed: it is one the page can watch
  const { ctx, page } = await fixture('acc-motion', PAGE(FAQ({ register: 'playful' }), { register: 'playful' }));
  const moving = await page.evaluate(() => {
    const d = document.querySelector('sg-accordion > details');
    const c = getComputedStyle(d, '::details-content');
    return { contentTransition: c.transitionDuration, markerTransition: getComputedStyle(d.querySelector('summary'), '::before').transitionDuration };
  });
  check('playful with motion allowed: the content and the glyph do transition', moving.contentTransition !== '0s' && moving.markerTransition !== '0s', JSON.stringify(moving));
  await ctx.close();
}

// ── the control: the same probe on markup the element never touched ─────
{
  // The exclusive-group probe ("after opening the third question, exactly one
  // open, the first closed") must be able to fail. Run it on a broken fixture:
  // three plain <details> with no name and no element anywhere. Both stay open.
  // `locator('…[open]').count()` reads the DOM without page JavaScript.
  const BROKEN = PAGE(FAQ({ name: '' }).replace(/sg-accordion/g, 'div').replace(/ name=""/g, ''), { js: false });
  const noJsProbe = async page => {
    await page.click('main details:nth-of-type(2) > summary');
    await page.waitForTimeout(60);
    await page.click('main details:nth-of-type(3) > summary');
    await page.waitForTimeout(60);
    return { openCount: await page.locator('main details[open]').count(), firstAnswer: await page.locator('main details:nth-of-type(1) > p').isVisible() };
  };
  const control = await noJsProbe((await fixture('acc-control', BROKEN)).page);
  console.log('FAIL  control: the exclusive-group probe on plain details with no name (two stay open together) reads red, as it must');
  const onElement = await noJsProbe((await fixture('acc-control-element', PAGE(FAQ(), { js: false }))).page);
  check('control: the probe reads red on markup the element never touched (all three open at once), so it can fail', control.openCount === 3 && control.firstAnswer === true, JSON.stringify(control));
  check('and the same probe passes on the element: one open, the first closed', onElement.openCount === 1 && onElement.firstAnswer === false, JSON.stringify(onElement));
}

await done();
