// Browser checks for the menu: the plain list with no JavaScript, the steppers by
// keyboard, the live total, the order the page hears, tabular figures and leader
// dots, tags as words, reduced motion, and the phone. Run by hand or with `npm run check`:
//
//   node packages/components/menu/menu.check.mjs
//   node packages/components/menu/menu.check.mjs --break=<mode>   a deliberately broken piece;
//                                                                 the checks named for the mode must go red
//
// Break modes (each rewrites one served file, and the run fails if the text to break has moved):
//   no-leader      the dots between a name and its price are gone          -> "leader dots"
//   disabled       the minus button is natively disabled at 0              -> "focus stays"
//   no-live        the total is not a live region                         -> "live total"
//   tag-glyph-only a tag's words are hidden, leaving the glyph             -> "tags are words"
//   motion-always  the settle plays whatever the motion setting says       -> "reduced motion"
//   proportional   prices use proportional figures                         -> "tabular figures"
//   wrong-total    the total adds the unit price once, not times the count -> "sg-change"
//   unnamed        the plus button has no accessible name                  -> "axe", "reading order"
//   low-contrast   the sauce line is a pale grey                            -> "contrast"

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';
import { contrastReport } from '../../../tools/lib/contrast.mjs';

const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const BREAK = process.argv.find(a => a.startsWith('--break='))?.slice('--break='.length) ?? '';
const shots = process.argv.includes('--shots');
if (shots) fs.mkdirSync('.shots/menu', { recursive: true });
const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const PAGE = (reg, extra = '') => `${server.url}/packages/components/menu/demo.html?register=${reg}${extra}`;

const BREAKS = {
  'no-leader': ['menu.css', 'sg-menu .sg-menu-name::after {\n  content: "";', 'sg-menu .sg-menu-name::after {\n  content: none;'],
  disabled: ['menu.js', "ui.minus.setAttribute('aria-disabled', String(q === 0));", 'ui.minus.disabled = q === 0;'],
  'no-live': ['menu.js', "this.#total.setAttribute('role', 'status');", ''],
  'tag-glyph-only': ['menu.css', 'sg-menu .sg-menu-tag { display: inline-flex;', 'sg-menu .sg-menu-tag { font-size: 0; display: inline-flex;'],
  'motion-always': ['menu.core.js', "if (motion !== 'full') return null;", ''],
  proportional: ['menu.css', 'font-variant-numeric: tabular-nums lining-nums;\n  font-feature-settings: "tnum" 1, "lnum" 1;', 'font-variant-numeric: proportional-nums;\n  font-feature-settings: "pnum" 1;'],
  unnamed: ['menu.js', "plus.setAttribute('aria-label', STRINGS.add(it.name));", ''],
  'low-contrast': ['menu.css', 'sg-menu .sg-menu-line { grid-column: 1; grid-row: 2; color: var(--sg-text-soft);', 'sg-menu .sg-menu-line { grid-column: 1; grid-row: 2; color: color-mix(in oklch, var(--sg-text) 35%, var(--sg-surface));'],
  'wrong-total': ['menu.core.js', 'paise += qty * Math.round(it.price * 100);', 'paise += Math.round(it.price * 100);'],
};
if (BREAK && !BREAKS[BREAK]) { console.error(`unknown --break mode "${BREAK}"`); process.exit(2); }
let broke = false;
async function ctxFor(opts = {}) {
  const ctx = await browser.newContext(opts);
  if (BREAK) {
    const [file, from, to] = BREAKS[BREAK];
    await ctx.route(u => u.pathname.endsWith(`/menu/${file}`) || u.pathname.endsWith(`/menu/skins/${file}`), async route => {
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
  p.errors = errors;
  return p;
}
const names = p => p.$$eval('sg-menu#menu .sg-menu-qty button', bs => bs.map(b => b.getAttribute('aria-label')));

// ── Without JavaScript: a plain list that reads fine ──
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(PAGE('quiet'));
  await p.waitForLoadState('load');
  const r = await p.evaluate(() => {
    const m = document.getElementById('menu');
    const items = [...m.querySelectorAll('li.sg-menu-item')];
    const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    return {
      items: items.length,
      allVisible: items.every(li => vis(li) && vis(li.querySelector('.sg-menu-name'))),
      prices: items.map(li => li.querySelector('.sg-menu-price')?.textContent.replace(/\s+/g, ' ').trim() ?? null),
      steppers: m.querySelectorAll('.sg-menu-qty, .sg-menu-bar, button').length,
      heads: [...m.querySelectorAll('.sg-menu-section-title')].map(h => h.textContent.trim()),
      soldOut: m.querySelector('[data-id=tagliolini] .sg-menu-status')?.textContent,
      tags: [...m.querySelectorAll('[data-id=pesto] .sg-menu-tag')].map(t => t.textContent),
      overflow: document.documentElement.scrollWidth - innerWidth,
      leader: getComputedStyle(m.querySelector('.sg-menu-name'), '::after').content,
    };
  });
  check('no JS: every dish shows, as a list item with its name', r.items === 9 && r.allVisible, `${r.items} items`);
  check('no JS: prices and units are there, grouped the Indian way', r.prices[0] === '₹450 10 pieces' && r.prices.includes('₹1,23,450 serves 100') && r.prices[3] === '₹640 serves 2', JSON.stringify(r.prices.slice(0, 4)));
  check('no JS: no steppers, no buttons, no total (nothing that would not work)', r.steppers === 0, `${r.steppers}`);
  check('no JS: section heads, the sold-out word, the tags as words', r.heads.join('|') === 'Fresh pasta|Sauces|For a crowd' && r.soldOut === 'Sold out' && r.tags.join('|') === 'Veg|Contains nuts', JSON.stringify([r.heads, r.soldOut, r.tags]));
  check('no JS: nothing scrolls sideways at 390', r.overflow <= 0, `${r.overflow}px`);
  check('no JS: the leader dots are drawn with CSS alone', r.leader !== 'none', r.leader);
  if (shots) await p.screenshot({ path: '.shots/menu/no-js-390.png', fullPage: true });
  await ctx.close();
}

// ── With JavaScript, in each register ──
for (const reg of ['quiet', 'warm', 'playful']) {
  const ctx = await ctxFor({ viewport: { width: 1100, height: 1000 } });
  const p = await open(ctx, reg);
  const m = p.locator('sg-menu#menu');
  check(`${reg}: six dishes get steppers; sold-out and ask-first ones do not, and say so`, await (async () => {
    const r = await p.evaluate(() => ({
      qty: document.querySelectorAll('#menu .sg-menu-qty').length,
      sold: !!document.querySelector('#menu [data-id=tagliolini] .sg-menu-qty'),
      ask: !!document.querySelector('#menu [data-id=chilli-oil] .sg-menu-qty') || !!document.querySelector('#menu [data-id=festival] .sg-menu-qty'),
      askWords: document.querySelector('#menu [data-id=festival] .sg-menu-status')?.textContent,
    }));
    return r.qty === 6 && !r.sold && !r.ask && r.askWords === 'Ask first';
  })());

  // keyboard: Tab walks - and + of each dish in reading order
  const order = await names(p);
  check(`${reg}: the buttons are in reading order, each named for its dish`, order.slice(0, 4).join('|') === 'Remove one Fresh fettuccine|Add one Fresh fettuccine|Remove one Spinach ravioli|Add one Spinach ravioli' && order.length === 12, order.slice(0, 4).join('|'));
  await p.evaluate(() => { document.querySelector('#menu [data-id=fettuccine] .sg-menu-minus').focus(); });
  const seen = [];
  const events = await p.evaluate(() => { window.__ev = []; document.getElementById('menu').addEventListener('sg-change', e => window.__ev.push(e.detail)); return 0; });
  void events;
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Tab'); seen.push(await p.evaluate(() => document.activeElement.getAttribute('aria-label'))); }
  check(`${reg}: Tab moves minus, plus, then the next dish's minus`, seen.join('|') === 'Add one Fresh fettuccine|Remove one Spinach ravioli|Add one Spinach ravioli', seen.join('|'));
  // back to the first plus; Enter, then Space
  await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Shift+Tab');
  await p.keyboard.press('Tab'); // plus of fettuccine
  await p.keyboard.press('Enter');
  await p.keyboard.press('Space');
  await p.waitForTimeout(60);
  const afterKeys = await p.evaluate(() => ({ count: document.querySelector('#menu [data-id=fettuccine] .sg-menu-count').textContent, focus: document.activeElement.getAttribute('aria-label'), total: document.querySelector('#menu .sg-menu-total').textContent }));
  check(`${reg}: Enter and Space on + each add one, and focus stays on +`, afterKeys.count === '2' && afterKeys.focus === 'Add one Fresh fettuccine', JSON.stringify(afterKeys));

  // the live total
  const live = await p.evaluate(() => { const t = document.querySelector('#menu .sg-menu-total'); return { role: t.getAttribute('role'), live: t.getAttribute('aria-live'), atomic: t.getAttribute('aria-atomic'), text: t.textContent }; });
  check(`${reg}: the total is one polite live region that says the dish, the count and the total`, live.role === 'status' && live.live === 'polite' && live.atomic === 'true' && live.text === 'Fresh fettuccine: 2 in your order. 2 items, ₹900', JSON.stringify(live));

  // what the page hears
  await p.click('#menu [data-id=ravioli] .sg-menu-plus');
  await p.click('#menu [data-id=pesto] .sg-menu-plus');
  await p.waitForTimeout(40);
  const ev = await p.evaluate(() => window.__ev.at(-1));
  check(`${reg}: sg-change carries the lines in menu order and the total`,
    ev.total === 450 * 2 + 520 + 340 && ev.count === 4 && ev.lines.map(l => l.id).join() === 'fettuccine,ravioli,pesto' && ev.lines[0].qty === 2 && ev.lines[0].unitPrice === 450 && ev.lines[0].unit === '10 pieces' && ev.lines[0].tags.join() === 'Egg-less,Veg',
    JSON.stringify(ev));
  check(`${reg}: the total on screen is the total in sg-change`, await p.evaluate(t => document.querySelector('#menu .sg-menu-total-text').textContent === `4 items, ₹${t.toLocaleString('en-IN')}`, ev.total), String(ev.total));

  // minus: down to zero and past it; focus stays (aria-disabled, not disabled)
  await p.focus('#menu [data-id=pesto] .sg-menu-minus');
  await p.keyboard.press('Enter');
  const atZero = await p.evaluate(() => ({ c: document.querySelector('#menu [data-id=pesto] .sg-menu-count').textContent, f: document.activeElement.getAttribute('aria-label'), dis: document.querySelector('#menu [data-id=pesto] .sg-menu-minus').getAttribute('aria-disabled') }));
  await p.keyboard.press('Enter'); // past zero: nothing
  const still = await p.evaluate(() => ({ c: document.querySelector('#menu [data-id=pesto] .sg-menu-count').textContent, f: document.activeElement.getAttribute('aria-label') }));
  check(`${reg}: focus stays on a button that has run out (aria-disabled, never removed from the page)`, atZero.c === '0' && atZero.dis === 'true' && atZero.f === 'Remove one Walnut pesto' && still.c === '0' && still.f === 'Remove one Walnut pesto', JSON.stringify([atZero, still]));

  // the way on, and starting again
  const cont = await p.evaluate(() => { const a = document.querySelector('#menu .sg-menu-continue'); return { href: a.getAttribute('href'), shown: a.getClientRects().length > 0 }; });
  check(`${reg}: a way on to the order shows once something is added`, cont.href === '#after' && cont.shown, JSON.stringify(cont));
  await p.click('#menu .sg-menu-clear');
  await p.waitForTimeout(40);
  const cleared = await p.evaluate(() => ({ text: document.querySelector('#menu .sg-menu-total').textContent, counts: [...document.querySelectorAll('#menu .sg-menu-count')].map(c => c.textContent).join(''), last: window.__ev.at(-1), cont: document.querySelector('#menu .sg-menu-continue').getClientRects().length, f: document.activeElement.className }));
  check(`${reg}: Start again empties the order, says so, tells the page, and focus is not lost`, cleared.text === 'Your order is empty again. Nothing added yet.' && /^0+$/.test(cleared.counts) && cleared.last.total === 0 && cleared.last.lines.length === 0 && cleared.cont === 0 && cleared.f === 'sg-menu-clear', JSON.stringify(cleared));

  // big money, and the limit
  const big = await p.evaluate(async () => {
    const t = document.createElement('sg-menu');
    t.setAttribute('orderable', ''); t.setAttribute('max-qty', '3');
    document.body.append(t);
    t.items = [{ items: [{ id: 'hamper', name: 'Hamper', price: 123450, unit: '1 hamper' }, { id: 'tea', name: 'Tea', price: 40.5 }] }];
    t.setQty('hamper', 1);
    const one = t.querySelector('.sg-menu-total-text').textContent;
    t.setQty('tea', 2);
    const two = t.querySelector('.sg-menu-total-text').textContent;
    for (let i = 0; i < 5; i++) t.querySelector('[data-id=tea] .sg-menu-plus').click();
    const cap = { count: t.querySelector('[data-id=tea] .sg-menu-count').textContent, plus: t.querySelector('[data-id=tea] .sg-menu-plus').getAttribute('aria-disabled'), said: t.querySelector('.sg-menu-sr').textContent };
    t.remove();
    return { one, two, cap };
  });
  check(`${reg}: ₹1,23,450 groups the Indian way in the total; decimals show; the limit is kept and said`,
    big.one === '1 item, ₹1,23,450' && big.two === '3 items, ₹1,23,531' && big.cap.count === '3' && big.cap.plus === 'true' && /3 is the most we can take/.test(big.cap.said), JSON.stringify(big));

  // numbers and leaders
  const geo = await p.evaluate(() => {
    const m = document.getElementById('menu');
    const probe = txt => { const d = document.createElement('div'); d.className = 'sg-menu-price'; d.style.cssText = 'position:absolute;visibility:hidden;'; const s = document.createElement('data'); s.textContent = txt; d.append(s); m.querySelector('.sg-menu-item').append(d); const w = s.getBoundingClientRect().width; d.remove(); return w; };
    const names = [...m.querySelectorAll('.sg-menu-name')].filter(n => n.nextElementSibling?.classList.contains('sg-menu-price'));
    const gaps = names.map(n => { const p = n.nextElementSibling; return Math.round(p.getBoundingClientRect().left - n.getBoundingClientRect().right); });
    const widths = names.map(n => Math.round(n.getBoundingClientRect().width));
    return { w1: probe('1111111'), w0: probe('0000000'), w8: probe('8888888'), gaps, widths, content: getComputedStyle(names[0], '::after').content, style: getComputedStyle(names[0], '::after').borderBottomStyle, display: getComputedStyle(names[0], '::after').display };
  });
  check(`${reg}: figures are tabular (1111111, 0000000 and 8888888 are the same width)`, Math.abs(geo.w1 - geo.w0) < 0.05 && Math.abs(geo.w8 - geo.w0) < 0.05, `${geo.w1.toFixed(2)} / ${geo.w0.toFixed(2)} / ${geo.w8.toFixed(2)}`);
  if (reg !== 'playful') {
    check(`${reg}: leader dots run from every name to its price (the box reaches the price, within the column gap)`, geo.content !== 'none' && geo.display !== 'none' && geo.style === 'dotted' && geo.gaps.every(g => g >= 0 && g <= 20) && geo.widths.every(w => w > 120), JSON.stringify({ gaps: geo.gaps, widths: geo.widths, style: geo.style }));
  } else {
    check(`${reg}: playful has price pills, not leader dots`, geo.display === 'none', geo.display);
  }

  // tags are words
  const tags = await p.evaluate(() => [...document.querySelectorAll('#menu .sg-menu-tag')].map(t => {
    const r = document.createRange(); r.selectNodeContents(t);
    const box = r.getBoundingClientRect();
    return { text: t.textContent.trim(), w: Math.round(box.width), size: parseFloat(getComputedStyle(t).fontSize), glyph: getComputedStyle(t, '::before').content, gw: parseFloat(getComputedStyle(t, '::before').width) || 0, known: ['veg', 'vegan', 'egg-less', 'nuts', 'spicy'].includes(t.dataset.tag) };
  }));
  check(`${reg}: every tag is words you can see (12 px or more), and the glyph, where there is one, comes with them`, tags.length === 11 && tags.every(t => t.text.length >= 3 && t.w >= 20 && t.size >= 12 && (!t.known || (t.glyph !== 'none' && t.gw > 4))), JSON.stringify(tags.slice(0, 2)));

  // the data path: items written by script
  const list = await p.evaluate(() => { const l = document.getElementById('list'); return { items: l.querySelectorAll('li.sg-menu-item').length, price: l.querySelector('[data-id=pasta-by-hand] .sg-menu-price')?.textContent.trim(), sold: l.querySelector('[data-id=supper-club] .sg-menu-status')?.textContent, steppers: l.querySelectorAll('.sg-menu-qty').length, data: l.items.length }; });
  check(`${reg}: menu.items = [...] writes the same list (and no steppers when not orderable)`, list.items === 2 && list.price === '₹2,500 per person' && list.sold === 'Sold out' && list.steppers === 0 && list.data === 1, JSON.stringify(list));

  // a register swap mid-use keeps what you chose
  await p.click('#menu [data-id=gnocchi] .sg-menu-plus');
  await p.evaluate(r => { document.documentElement.dataset.register = r === 'quiet' ? 'warm' : 'quiet'; }, reg);
  await p.waitForTimeout(400);
  check(`${reg}: a register change keeps the order`, await p.evaluate(() => document.querySelector('#menu [data-id=gnocchi] .sg-menu-count').textContent === '1' && document.getElementById('menu').order.count === 1));

  if (reg === 'warm') {
    await p.evaluate(r => { document.documentElement.dataset.register = r; }, 'warm');
    await p.waitForFunction(() => document.getElementById('menu').dataset.skin === 'warm');
    await p.waitForTimeout(250);
    const w = await p.evaluate(() => { const m = document.getElementById('menu'); const f = m.querySelector('.sg-menu-frame'); const b = m.getBoundingClientRect(), fb = f.getBoundingClientRect(); return { paths: f.querySelectorAll('path').length, dw: Math.round(fb.width - b.width), dh: Math.round(fb.height - b.height), rules: m.querySelectorAll(".sg-menu-frame .sg-menu-underline").length, hidden: f.getAttribute('aria-hidden'), box: [Math.round(b.width), Math.round(b.height)], font: getComputedStyle(m.querySelector('.sg-menu-section-title')).fontFamily.split(',')[0] }; });
    check('warm: a double frame ruled by hand round the card (8 strokes per rule, drawn to the card\'s size), a ruled line under each script head', w.paths >= 16 && Math.abs(w.dw) <= 1 && Math.abs(w.dh) <= 1 && w.rules === 3 && w.hidden === 'true' && /Kalam/.test(w.font), JSON.stringify(w));
    if (shots) await p.screenshot({ path: '.shots/menu/warm-1100.png', fullPage: false });
  }
  check(`${reg}: no console errors`, p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

// ── Playful: the count settles once; reduced motion is still ──
for (const reduced of [false, true]) {
  const ctx = await ctxFor({ viewport: { width: 1100, height: 1000 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await open(ctx, 'playful');
  await p.waitForFunction(() => document.getElementById('menu').dataset.skin === 'playful');
  await p.click('#menu [data-id=fettuccine] .sg-menu-plus');
  const anims = await p.evaluate(() => document.getAnimations().map(a => ({ target: a.effect.target?.className, dur: a.effect.getTiming().duration, iter: a.effect.getTiming().iterations, state: a.playState })));
  if (!reduced) {
    check('playful: adding a dish settles its count, once (one animation, on the count, a finite short run)', anims.length === 1 && anims[0].target === 'sg-menu-count' && anims[0].iter === 1 && anims[0].dur > 100 && anims[0].dur <= 500, JSON.stringify(anims));
    await p.waitForTimeout(700);
    check('playful: and it is over (nothing left running, nothing looping)', await p.evaluate(() => document.getAnimations().length) === 0);
    const strip = await p.evaluate(async () => {
      const c = document.querySelector('#menu [data-id=ravioli] .sg-menu-count');
      document.querySelector('#menu [data-id=ravioli] .sg-menu-plus').click();
      const seen = [];
      for (let i = 0; i < 9; i++) { seen.push(getComputedStyle(c).transform); await new Promise(r => setTimeout(r, 50)); }
      return seen;
    });
    check('playful: the count really moves (the transform changes during the settle and ends at rest)', new Set(strip).size >= 3 && (strip.at(-1) === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(strip.at(-1))), JSON.stringify([...new Set(strip)].slice(0, 4)));
  } else {
    check('reduced motion: playful adds a dish with no animation at all', anims.length === 0, JSON.stringify(anims));
  }
  await ctx.close();
}

// ── Contrast, measured from the painted colours (axe cannot decide over the card's frame) ──
for (const reg of ['quiet', 'warm', 'playful']) {
  for (const theme of ['light', 'dark']) {
    const ctx = await ctxFor({ viewport: { width: 1100, height: 1000 } });
    const p = await open(ctx, reg, `&theme=${theme}`);
    await p.waitForFunction(r => document.getElementById('menu').dataset.skin === r, reg);
    await p.click('#menu [data-id=fettuccine] .sg-menu-plus');
    await p.click('#menu [data-id=fettuccine] .sg-menu-plus');
    await p.waitForTimeout(500);
    const r = await contrastReport(p, 'sg-menu#menu');
    check(`contrast ${reg}/${theme}: every piece of text meets 4.5:1 (3:1 when large), measured from painted colours`, r.checked > 60 && r.failures.length === 0 && r.skipped.length === 0,
      `${r.checked} measured, ${r.failures.length} failing${r.failures[0] ? `: ${JSON.stringify(r.failures.slice(0, 3))}` : ''}${r.skipped.length ? `, ${r.skipped.length} could not be measured: ${r.skipped[0].path} (${r.skipped[0].why})` : ''}`);
    await ctx.close();
  }
}

// ── axe on the open state: something added, the total bar and the way on showing ──
for (const reg of ['quiet', 'warm', 'playful']) {
  const ctx = await ctxFor({ viewport: { width: 1100, height: 1000 } });
  const p = await open(ctx, reg);
  await p.waitForFunction(r => document.getElementById('menu').dataset.skin === r, reg);
  await p.click('#menu [data-id=fettuccine] .sg-menu-plus');
  await p.click('#menu [data-id=pesto] .sg-menu-plus');
  await p.waitForTimeout(500);
  await p.addScriptTag({ content: AXE });
  const v = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(x => `${x.id}: ${x.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')}`));
  check(`axe ${reg} with an order in progress: no violations (WCAG 2.2 AA)`, v.length === 0, v.join('; '));
  await ctx.close();
}

// ── The phone ──
{
  const ctx = await ctxFor({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  for (const reg of ['quiet', 'warm', 'playful']) {
    const p = await open(ctx, reg);
    await p.waitForFunction(r => document.getElementById('menu').dataset.skin === r, reg);
    const r = await p.evaluate(() => {
      const m = document.getElementById('menu');
      const bs = [...m.querySelectorAll('.sg-menu-qty button')].map(b => b.getBoundingClientRect());
      const q = m.querySelector('.sg-menu-qty').getBoundingClientRect();
      return { minW: Math.round(Math.min(...bs.map(b => b.width))), minH: Math.round(Math.min(...bs.map(b => b.height))), right: Math.round(Math.max(...bs.map(b => b.right))), overflow: document.documentElement.scrollWidth - innerWidth, qtyW: Math.round(q.width) };
    });
    check(`phone ${reg}: every stepper button is at least 44 by 44, inside the screen, nothing scrolls sideways`, r.minW >= 44 && r.minH >= 44 && r.right <= 390 && r.overflow <= 0, JSON.stringify(r));
    await p.tap('#menu [data-id=ravioli] .sg-menu-plus');
    await p.tap('#menu [data-id=ravioli] .sg-menu-plus');
    const bar = await p.evaluate(() => { const b = document.querySelector('#menu .sg-menu-bar').getBoundingClientRect(); return { bottomGap: Math.round(innerHeight - b.bottom), text: document.querySelector('#menu .sg-menu-total-text').textContent }; });
    check(`phone ${reg}: two taps add two, and the total bar waits at the foot of the screen`, bar.text === '2 items, ₹1,040' && Math.abs(bar.bottomGap) <= 1, JSON.stringify(bar));
    if (shots) await p.screenshot({ path: `.shots/menu/${reg}-390.png` });
    await p.close();
  }
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} menu checks pass${BREAK ? ` (--break=${BREAK}: ${broke ? 'the break was served' : 'THE BREAK WAS NEVER SERVED'})` : ''}`);
if (BREAK && !broke) process.exit(2);
process.exit(failed ? 1 : 0);
