// Browser checks for <sg-postcard>: axe, one tab stop per card with the link
// covering the card (the probe also runs on a card with a nested second link,
// to show it can fail), the flip on focus, and the details visible without
// hovering on touch screens and under reduced motion.
//
//   node packages/components/postcard/postcard.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';

const { check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/postcard/demo.html';

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

// One tab stop per card, and clicking anywhere on the card follows its link.
const oneLink = page => page.evaluate(() => [...document.querySelectorAll('sg-postcard')].map(pc => {
  const focusables = pc.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])').length;
  pc.scrollIntoView({ block: 'center' }); // elementFromPoint sees only what is in the viewport
  const card = pc.querySelector('article').getBoundingClientRect();
  // sample three points away from the heading: the bottom-left, the centre, the bottom-right
  const pts = [[card.left + 30, card.bottom - 30], [card.left + card.width / 2, card.top + card.height / 2], [card.right - 30, card.bottom - 30]]; // 30 px in: a tilted card's bounding box is wider than the card
  const hits = pts.map(([x, y]) => document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href') ?? null);
  return { focusables, hits };
}));
{
  const { ctx, page } = await open(DEMO);
  await settle(page);
  const r = await oneLink(page);
  const ok = r.length === 9 && r.every(c => c.focusables === 1 && c.hits.every(h => h && h === c.hits[0]));
  check('nine cards, each exactly one tab stop, and the whole card is its link', ok, JSON.stringify(r.map(c => `${c.focusables}:${c.hits.join('|')}`)));
  // Tab order: six stops, one per card, in reading order
  const order = [];
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.click(2, 2); // the sequential focus point goes back to the top of the page
  for (let i = 0; i < 9; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement.getAttribute('href'))); }
  check('Tab walks the cards one stop each, in order', order.join() === ['quiet', 'warm', 'playful'].flatMap(r => ['aldona', 'tides', 'ledger'].map(c => `#${c}-${r}`)).join(), order.join());
  await ctx.close();
}
{
  // broken on purpose: a card with a second link nested inside it
  const { ctx, page } = await openHtml('nested', `<!doctype html><html lang="en"><head><title>t</title>
    <link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/postcard/postcard.css"></head><body>
    <sg-postcard><article><h3><a href="#one">One</a></h3><div class="sg-postcard-face"><p class="sg-postcard-problem">A problem, and <a href="#two">another link</a>.</p></div>
    <dl class="sg-postcard-back"><dt>Built</dt><dd>x</dd></dl></article></sg-postcard></body></html>`);
  const r = await oneLink(page);
  check('control: a card with a second link fails the same probe', r[0].focusables !== 1, JSON.stringify(r[0]));
  await ctx.close();
}

// ── the status: a level badge by default; the stamp and postmark only when asked for ──
const statusProbe = page => page.evaluate(() => [...document.querySelectorAll('sg-postcard')].map(pc => {
  const badge = pc.querySelector('.sg-postcard-where sg-badge');
  return {
    style: pc.getAttribute('status-style') || 'default',
    reg: pc.closest('[data-register]')?.dataset.register,
    badge: !!badge && getComputedStyle(badge).transform === 'none' && getComputedStyle(badge.closest('.sg-postcard-where')).transform === 'none',
    stamps: pc.querySelectorAll('sg-stamp').length,
    postmark: pc.querySelectorAll('.sg-postcard-postmark').length,
    postage: [...pc.querySelectorAll('.sg-postcard-postage')].filter(p => getComputedStyle(p).display !== 'none' && p.getAttribute('aria-hidden') === 'true' && !p.textContent.trim()).length,
  };
}));
const defaultsOk = r => r.filter(c => c.style === 'default').every(c => c.badge && c.stamps === 0 && c.postmark === 0);
{
  const { ctx, page } = await open(DEMO);
  await settle(page);
  const r = await statusProbe(page);
  const def = r.filter(c => c.style === 'default'), st = r.filter(c => c.style === 'stamp');
  check('default: every card shows a level badge on its where-line and no sg-stamp, no postmark', def.length === 6 && defaultsOk(r), JSON.stringify(def));
  check('warm default: a printed postage square with no word, aria-hidden, in each card', r.filter(c => c.style === 'default' && c.reg === 'warm').every(c => c.postage === 1), JSON.stringify(r.filter(c => c.reg === 'warm')));
  check('status-style="stamp": the stamp shows in every register, and a postmark only in warm; no postage square beside it', st.length === 3 && st.every(c => c.stamps === 1 && c.postage === 0 && c.postmark === (c.reg === 'warm' ? 1 : 0)), JSON.stringify(st));
  await ctx.close();
}
{
  // broken on purpose: the old default, a stamp on a card that didn't ask for one
  const { ctx, page } = await openHtml('default-stamp', `<!doctype html><html lang="en" data-register="warm"><head><title>t</title>
    <link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/postcard/postcard.css"></head><body>
    <sg-postcard><article><h3><a href="#x">X</a></h3><p class="sg-postcard-where">Here</p><div class="sg-postcard-face"><p class="sg-postcard-problem">P</p></div>
    <dl class="sg-postcard-back"><dt>Built</dt><dd>x</dd></dl><sg-stamp role="none"><p class="sg-stamp-words"><strong>Live</strong></p></sg-stamp></article></sg-postcard>
    <script type="module">import '/packages/components/postcard/postcard.js'; import '/packages/components/stamp/stamp.js';</script></body></html>`);
  const warned = [];
  page.on('console', m => { if (m.type() === 'warning') warned.push(m.text()); });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('sg-postcard')?.dataset.skin);
  const r = await statusProbe(page);
  check('control: a default card carrying a stamp fails the same probe, and the element warns', !defaultsOk(r) && warned.some(w => w.includes('badge by default')), JSON.stringify(r[0]));
  await ctx.close();
}

// ── the playful flip: focus turns it over; the details are always in the DOM ──
const faces = (page, sel) => page.evaluate(s => {
  const pc = document.querySelector(s);
  const m = el => new DOMMatrix(getComputedStyle(el).transform);
  const face = pc.querySelector('.sg-postcard-face'), back = pc.querySelector('.sg-postcard-back');
  const shown = el => { const t = m(el); return t.m11 > 0.5 && el.getBoundingClientRect().height > 20; }; // m11 = cos(rotateY)
  return { flip: pc.hasAttribute('data-flip'), face: shown(face), back: shown(back), backText: back.textContent.trim().length };
}, sel);
{
  const { ctx, page } = await open(DEMO);
  const PC = '[data-register="playful"] sg-postcard';
  await settle(page);
  const rest = await faces(page, PC);
  await page.focus(`${PC} a`);
  await page.waitForTimeout(900);
  const focused = await faces(page, PC);
  check('playful with a mouse: the picture face at rest, the back after the link takes focus', rest.flip && rest.face && !rest.back && focused.back && !focused.face, JSON.stringify({ rest, focused }));
  await page.locator(`${PC} article`).first().screenshot({ path: '.shots/postcard-playful-flipped.png' });
  await ctx.close();
}
for (const [name, opts] of [['reduced motion', { reduced: true }], ['a touch screen', { touch: true, width: 390 }]]) {
  const { ctx, page } = await open(DEMO, opts);
  await settle(page);
  const r = await faces(page, '[data-register="playful"] sg-postcard');
  check(`playful on ${name}: no flip, both faces lie flat and the details show`, !r.flip && r.face && r.back, JSON.stringify(r));
  await ctx.close();
}

// ── real-length copy: a 560 px card reads comfortably in every register ──
// Fictional copy about as long as a real portfolio card: four lines of problem,
// thirty to fifty words each for what was built and the outcome.
const LONG = {
  problem: 'A spice trader in Mapusa kept orders in three notebooks, a phone full of messages and his nephew’s memory, so every Monday began with an hour of working out who had paid for what.',
  built: 'One order book on the shop computer that takes an order from a message in two taps, keeps stock by the kilo, prints a bill in Konkani or English, and works through the power cuts because nothing in it needs the internet.',
  outcome: 'Placeholder: Monday mornings now start with the delivery list instead of the argument, the nephew went back to college, and the bills stopped going missing between the counter and the cash box.',
};
const longCard = (register, style) => `<div data-register="${register}" style="width:560px;margin:40px">
  <sg-postcard${style === 'stamp' ? ' status-style="stamp" postmark="Mapusa 2026"' : ''}><article>
    <h3><a href="#spice">Mapusa spice orders</a></h3>
    <p class="sg-postcard-where">Spice orders · Mapusa, North Goa · 2026${style === 'stamp' ? '' : ' <sg-badge tone="success">Live</sg-badge>'}</p>
    <div class="sg-postcard-face"><p class="sg-postcard-problem">${LONG.problem}</p></div>
    <dl class="sg-postcard-back"><dt>Built</dt><dd>${LONG.built}</dd><dt>Outcome</dt><dd>${LONG.outcome}</dd></dl>
    ${style === 'stamp' ? '<sg-stamp role="none" tone="success"><p class="sg-stamp-words"><strong>Live</strong></p></sg-stamp>' : ''}
  </article></sg-postcard></div>`;
// Words per rendered line, from the text's own line boxes.
const reading = page => page.evaluate(() => {
  const per = el => {
    const r = document.createRange(); r.selectNodeContents(el);
    const tops = new Set([...r.getClientRects()].map(x => Math.round(x.top)));
    return +(el.textContent.trim().split(/\s+/).length / tops.size).toFixed(1);
  };
  const pc = document.querySelector('sg-postcard'), where = pc.querySelector('.sg-postcard-where');
  const badge = where.querySelector('sg-badge');
  const r = document.createRange(); r.selectNodeContents(where);
  const lines = new Set([...r.getClientRects()].filter(x => x.width > 1).map(x => Math.round(x.top + x.height / 2))).size;
  return {
    problem: per(pc.querySelector('.sg-postcard-problem')),
    dd: [...pc.querySelectorAll('.sg-postcard-back dd')].map(per),
    // one line: the where-line is no taller than its tallest single item (text line or badge).
    // offsetHeight, not the bounding box: the playful card is tilted, which makes every box taller.
    whereLines: where.offsetHeight / Math.max(parseFloat(getComputedStyle(where).lineHeight), badge ? badge.offsetHeight : 0) <= 1.3 ? 1 : lines,
    width: Math.round(pc.getBoundingClientRect().width),
  };
});
for (const register of ['quiet', 'warm', 'playful']) for (const style of ['badge', 'stamp']) {
  const { ctx, page } = await openHtml(`long-${register}-${style}`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title>
    <link rel="stylesheet" href="/packages/tokens/fonts.css"><link rel="stylesheet" href="/packages/tokens/tokens.css">
    ${['postcard', 'badge', 'stamp'].map(c => `<link rel="stylesheet" href="/packages/components/${c}/${c}.css">`).join('')}</head><body>${longCard(register, style)}
    <script type="module">import '/packages/components/postcard/postcard.js'; import '/packages/components/badge/badge.js'; import '/packages/components/stamp/stamp.js';</script></body></html>`, { width: 700, height: 1400 });
  await page.waitForFunction(() => document.querySelector('sg-postcard')?.dataset.skin);
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  const r = await reading(page);
  const ok = r.problem >= 6 && r.dd.every(n => n >= 6) && r.whereLines === 1;
  check(`${register}, ${style}, a 560 px card with real-length copy: at least 6 words a line and the where-line on one line`, ok, JSON.stringify(r));
  if (register !== 'quiet') await page.locator('sg-postcard').screenshot({ path: `.shots/postcard-long-${register}-${style}.png` });
  await ctx.close();
}

// ── no JavaScript, and phone width ──
{
  const { ctx, page } = await open(DEMO, { js: false });
  const r = await page.evaluate(() => [...document.querySelectorAll('.sg-postcard-back')].map(b => Math.round(b.getBoundingClientRect().height)));
  check('without JavaScript every card shows its details', r.length === 9 && r.every(h => h > 20), r.join(','));
  await ctx.close();
}
{
  const { ctx, page } = await open(DEMO, { width: 390, touch: true });
  await settle(page);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check('at 390 px the page does not scroll sideways', w <= 390, `${w}`);
  await ctx.close();
}

await done();
