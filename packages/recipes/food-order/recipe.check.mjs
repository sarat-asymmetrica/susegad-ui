// Browser checks for the food-order recipe: the whole journey as a customer takes it, on a phone
// and by keyboard, from landing on the page to a Send link that decodes to the message they read;
// the page with no JavaScript; the page's honesty; contrast and axe at both ends of the journey.
// Run by hand or with `npm run check`:
//
//   node packages/recipes/food-order/recipe.check.mjs
//   node packages/recipes/food-order/recipe.check.mjs --break=<mode>   a deliberately broken page;
//                                                                      the checks named for the mode must go red
//
// Break modes:
//   no-continue   the menu's way on to the order is gone               -> "journey"
//   says-booked   the steps say the order is booked                    -> "honest"
//   no-fallback   the page has no plain wa.me link                     -> "no JS"
//   steps-last    the steps are drawn after the menu though they come first in the markup -> "reading order"

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';
import { contrastReport } from '../../../tools/lib/contrast.mjs';

const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const BREAK = process.argv.find(a => a.startsWith('--break='))?.slice('--break='.length) ?? '';
const shots = process.argv.includes('--shots');
if (shots) fs.mkdirSync('.shots/food-order', { recursive: true });
const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const PAGE = (reg, extra = '') => `${server.url}/packages/recipes/food-order/index.html?register=${reg}${extra}`;

const A_FALLBACK = '<a class="sg-wa-send" href="https://wa.me/919000012345?text=Hello%20Sample%20Pasta%20Studio!%20I%20would%20like%20to%20order.%20What%20is%20available%3F">Order on WhatsApp</a>';
const BREAKS = {
  'no-continue': ['index.html', ' continue="#order"', ''],
  'says-booked': ['index.html', 'Nothing is final until we reply and confirm.', 'Your order is booked.'],
  'no-fallback': ['index.html', A_FALLBACK, ''],
  'steps-last': ['index.html', '<section class="food-order__how"', '<section style="position:relative;top:3000px" class="food-order__how"'],
};
if (BREAK && !BREAKS[BREAK]) { console.error(`unknown --break mode "${BREAK}"`); process.exit(2); }
let broke = false;
async function ctxFor(opts = {}) {
  const ctx = await browser.newContext({ timezoneId: 'Asia/Kolkata', locale: 'en-IN', ...opts });
  await ctx.clock.setFixedTime(new Date('2026-10-02T14:30:00+05:30'));
  await ctx.route(/^https:\/\/wa\.me\//, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
  if (BREAK) {
    const [file, from, to] = BREAKS[BREAK];
    await ctx.route(u => u.pathname.endsWith(`/food-order/${file}`), async route => {
      const res = await route.fetch();
      const body = await res.text();
      if (!body.includes(from)) { console.error(`break "${BREAK}": the text to break is not in ${file} any more`); process.exit(2); }
      broke = true;
      await route.fulfill({ response: res, body: body.replace(from, to) });
    });
  }
  return ctx;
}
async function open(ctx, reg, extra = '') {
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(PAGE(reg, extra));
  await p.waitForFunction(() => window.__ready === true);
  await p.waitForFunction(r => document.getElementById('order').dataset.skin === r && document.getElementById('menu').dataset.skin === r, reg);
  p.errors = errors;
  return p;
}
const linkState = p => p.evaluate(() => {
  const a = document.querySelector('#order a.sg-wa-send');
  const href = a.getAttribute('href');
  let text = null, digits = null;
  if (href) { const u = new URL(href); text = u.searchParams.get('text'); digits = u.pathname.slice(1); }
  return { href, text, digits, disabled: a.getAttribute('aria-disabled'), preview: document.querySelector('#order .sg-wa-text').textContent, written: document.querySelector('#order .sg-wa-written').textContent };
});
const headings = p => p.$$eval('h1, h2', hs => hs.map(h => h.textContent.trim()));

// ── No JavaScript: the steps, a readable menu, one plain link ──
{
  const ctx = await ctxFor({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(PAGE('quiet'));
  await p.waitForLoadState('load');
  const r = await p.evaluate(() => {
    const vis = e => !!e && e.getClientRects().length > 0;
    const a = [...document.querySelectorAll('#order a')];
    return {
      steps: [...document.querySelectorAll('.food-order__how li')].map(li => li.querySelector('strong')?.textContent),
      stepsVisible: [...document.querySelectorAll('.food-order__how li')].every(vis),
      dishes: document.querySelectorAll('#menu li.sg-menu-item').length,
      dishesVisible: [...document.querySelectorAll('#menu li.sg-menu-item')].every(vis),
      links: a.map(x => x.getAttribute('href')),
      controls: document.querySelectorAll('#menu button, #order button, #order input, #order select, #order textarea').length,
      overflow: document.documentElement.scrollWidth - innerWidth,
      height: Math.round(a[0]?.getBoundingClientRect().height ?? 0),
    };
  });
  check('no JS: the three steps read in order', r.steps.join('|') === 'Choose.|Say when and where.|Send it in WhatsApp.' && r.stepsVisible, JSON.stringify(r.steps));
  check('no JS: the menu is a readable list of every dish', r.dishes === 9 && r.dishesVisible, `${r.dishes} dishes`);
  check('no JS: one plain wa.me link, 44 px or more, and nothing that would not work (no buttons, no fields)', r.links.length === 1 && /^https:\/\/wa\.me\/919000012345\?text=/.test(r.links[0]) && r.height >= 44 && r.controls === 0, JSON.stringify({ links: r.links.length, h: r.height, c: r.controls }));
  check('no JS: nothing scrolls sideways at 390', r.overflow <= 0, `${r.overflow}px`);
  if (shots) await p.screenshot({ path: '.shots/food-order/no-js-390.png', fullPage: true });
  await ctx.close();
}

// ── The journey on a phone, in each register: tap, tap, on, fill, read, send ──
const EXPECT = [
  'Hello Sample Pasta Studio! I would like to order:',
  '',
  '2 × Fresh fettuccine (10 pieces, egg-less, veg): ₹900',
  '1 × Walnut pesto (1 jar, veg, contains nuts): ₹340',
  '',
  'Estimated total: ₹1,240. Please confirm the total and any delivery charge.',
  '',
  'When: Sun 4 Oct 2026, Afternoon (12 to 4)',
  'Delivery to: Calangute',
  'Name: Meera',
  'Notes: Gate code 4821',
  '',
  'Thank you!',
].join('\n');
for (const reg of ['quiet', 'warm', 'playful']) {
  const ctx = await ctxFor({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await open(ctx, reg);
  const first = await headings(p);
  check(`phone ${reg}: reading order of the page: heading, how it works, the menu, your order`, first.join('|') === 'Order fresh pasta, in a few taps|How ordering works|The menu|Your order', first.join('|'));
  await p.tap('#menu [data-id=fettuccine] .sg-menu-plus');
  await p.tap('#menu [data-id=fettuccine] .sg-menu-plus');
  await p.tap('#menu [data-id=pesto] .sg-menu-plus');
  const bar = await p.evaluate(() => ({ text: document.querySelector('#menu .sg-menu-total-text').textContent, next: !!document.querySelector('#menu .sg-menu-continue')?.getClientRects().length }));
  check(`phone ${reg}: journey: three taps and the menu says "3 items, ₹1,240" with a way on to the order`, bar.text === '3 items, ₹1,240' && bar.next, JSON.stringify(bar));
  await p.tap('#menu .sg-menu-continue');
  await p.waitForTimeout(250);
  const at = await p.evaluate(() => ({ hash: location.hash, top: Math.round(document.getElementById('order').getBoundingClientRect().top) }));
  check(`phone ${reg}: journey: the way on lands on the order`, at.hash === '#order' && Math.abs(at.top) <= 120, JSON.stringify(at));
  let s = await linkState(p);
  check(`phone ${reg}: journey: the order is already in the message, but the link waits for a day and a name`, s.preview.startsWith('Hello Sample Pasta Studio!') && !s.href && s.disabled === 'true', s.preview.slice(0, 40));
  await p.fill('#order [name=date]', '2026-10-04');
  await p.selectOption('#order [name=slot]', 'Afternoon (12 to 4)');
  await p.fill('#order [name=area]', 'Calangute');
  await p.fill('#order [name=name]', 'Meera');
  await p.fill('#order [name=notes]', 'Gate code 4821');
  await p.waitForTimeout(80);
  s = await linkState(p);
  check(`phone ${reg}: journey: the link is there, and it decodes to the exact message they can read`, s.href && s.text === s.preview && s.preview === EXPECT && s.digits === '919000012345', s.preview === EXPECT ? '' : JSON.stringify(s.preview));
  const popup = ctx.waitForEvent('page');
  await p.tap('#order a.sg-wa-send');
  const pop = await popup;
  await pop.waitForLoadState('domcontentloaded').catch(() => {});
  const popUrl = pop.url();
  await pop.close();
  await p.waitForTimeout(100);
  s = await linkState(p);
  check(`phone ${reg}: journey: the tap opens that link, and the page says it is written, not placed`, popUrl === s.href && s.written === "Your order is written; send it in WhatsApp and we'll confirm.", s.written);
  const everything = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  check(`phone ${reg}: honest: nowhere does the page say the order is placed, booked, confirmed or received`, !/\b(is|been|was) (placed|booked|confirmed|received)\b|\border (placed|booked|confirmed|received)\b|thank you for your order/i.test(everything) && /Nothing is final until we reply and confirm/.test(everything), '');
  if (shots) { await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `.shots/food-order/${reg}-390-top.png` }); await p.evaluate(() => document.getElementById('order').scrollIntoView()); await p.screenshot({ path: `.shots/food-order/${reg}-390-order.png` }); }
  check(`phone ${reg}: no console errors, nothing scrolls sideways`, p.errors.length === 0 && (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, p.errors.join(' | '));
  await ctx.close();
}

// ── The same journey by keyboard alone ──
{
  const ctx = await ctxFor({ viewport: { width: 1280, height: 900 } });
  const p = await open(ctx, 'warm');
  const active = () => p.evaluate(() => { const a = document.activeElement; return a.getAttribute('aria-label') || a.name || a.className || a.localName; });
  const tabTo = async (want, max = 40) => { for (let i = 0; i < max; i++) { await p.keyboard.press('Tab'); if ((await active()) === want) return true; } return false; };
  await p.evaluate(() => document.querySelector('.food-order__how').scrollIntoView());
  const reached = await tabTo('Add one Fresh fettuccine');
  await p.keyboard.press('Enter');
  await p.keyboard.press('Space');
  const reachedPesto = await tabTo('Add one Walnut pesto');
  await p.keyboard.press('Enter');
  check('keyboard: Tab reaches the first dish\'s plus, and Enter and Space add; Tab reaches another dish and Enter adds', reached && reachedPesto && (await p.evaluate(() => document.getElementById('menu').order.count)) === 3, '');
  const onward = await tabTo('sg-menu-continue');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  check('keyboard: Tab reaches the way on, Enter takes you to the order', onward && (await p.evaluate(() => location.hash)) === '#order', '');
  const gotDate = await tabTo('date');
  await p.keyboard.type('04102026');
  const gotSlot = await tabTo('slot');
  await p.keyboard.press('A'); // Afternoon
  const how = await p.evaluate(() => document.querySelector('#order input[type=radio]:checked').name);
  const gotRadio = await tabTo(how);
  const gotArea = await tabTo('area');
  await p.keyboard.type('Calangute');
  const gotName = await tabTo('name');
  await p.keyboard.type('Meera');
  const gotNotes = await tabTo('notes');
  await p.keyboard.type('Gate code 4821');
  const gotLink = await tabTo('sg-wa-send');
  const s = await linkState(p);
  check('keyboard: Tab walks date, time, how, area, name, notes and ends on the Send link, and the order is complete', gotDate && gotSlot && gotRadio && gotArea && gotName && gotNotes && gotLink && s.href && s.text === s.preview && s.preview === EXPECT, s.preview === EXPECT ? '' : JSON.stringify(s.preview));
  const popup = ctx.waitForEvent('page');
  await p.keyboard.press('Enter');
  const pop = await popup;
  const url = pop.url();
  await pop.close();
  check('keyboard: Enter on the Send link opens WhatsApp with that message', url === s.href, url.slice(0, 50));
  await ctx.close();
}

// ── Reading order at 1280, and the steps in markup order ──
{
  const ctx = await ctxFor({ viewport: { width: 1280, height: 900 } });
  const p = await open(ctx, 'quiet');
  const geo = await p.evaluate(() => { const top = id => document.querySelector(id).getBoundingClientRect().top + scrollY; return { how: top('.food-order__how'), cols: top('.food-order__cols') }; });
  check('reading order: the steps come before the menu and the order, on the screen as in the markup', geo.how < geo.cols, JSON.stringify(geo));
  await ctx.close();
}

// ── Contrast of the whole page, from painted colours ──
for (const reg of ['quiet', 'warm', 'playful']) {
  for (const theme of ['light', 'dark']) {
    const ctx = await ctxFor({ viewport: { width: 1280, height: 1000 } });
    const p = await open(ctx, reg, `&theme=${theme}`);
    await p.tap?.call(p, '#menu [data-id=fettuccine] .sg-menu-plus').catch(() => p.click('#menu [data-id=fettuccine] .sg-menu-plus'));
    const r = await contrastReport(p, 'main.food-order', { ruled: 'sg-field textarea' });
    check(`contrast ${reg}/${theme}: every piece of text on the page meets 4.5:1 (3:1 when large), from painted colours`, r.checked > 80 && r.failures.length === 0 && r.skipped.length === 0,
      `${r.checked} measured${r.failures[0] ? `, failing: ${JSON.stringify(r.failures.slice(0, 3))}` : ''}${r.skipped[0] ? `, unmeasured: ${r.skipped[0].path} (${r.skipped[0].why})` : ''}`);
    await ctx.close();
  }
}

// ── axe at both ends of the journey ──
for (const reg of ['quiet', 'warm', 'playful']) {
  const ctx = await ctxFor({ viewport: { width: 1280, height: 1000 } });
  const p = await open(ctx, reg);
  await p.addScriptTag({ content: AXE });
  const run = () => p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(x => `${x.id}: ${x.nodes.map(n => n.target.join(' ')).slice(0, 2).join(' | ')}`));
  const start = await run();
  await p.click('#menu [data-id=fettuccine] .sg-menu-plus');
  await p.fill('#order [name=date]', '2026-10-04');
  await p.fill('#order [name=area]', 'Calangute');
  await p.fill('#order [name=name]', 'Meera');
  await p.evaluate(() => document.querySelector('#order a.sg-wa-send').addEventListener('click', e => e.preventDefault()));
  await p.click('#order a.sg-wa-send');
  await p.waitForTimeout(400);
  const end = await run();
  check(`axe ${reg}: the page as it loads and as it ends (written) has no violations (WCAG 2.2 AA)`, start.length + end.length === 0, [...start.map(x => `start ${x}`), ...end.map(x => `end ${x}`)].join('; '));
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} food-order checks pass${BREAK ? ` (--break=${BREAK}: ${broke ? 'the break was served' : 'THE BREAK WAS NEVER SERVED'})` : ''}`);
if (BREAK && !broke) process.exit(2);
process.exit(failed ? 1 : 0);
