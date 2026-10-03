import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STRINGS, MAX_QTY, formatMoney, groupIndian, parsePrice, normalizeTag, parseTags, normalizeAvailability,
  normalizeMenu, clampQty, summarize, totalLine, announce, settleMotion, menuHTML,
} from './menu.core.js';

const SAMPLE = [
  { title: 'Fresh pasta', items: [
    { name: 'Fresh fettuccine', line: 'Plain, rolled thin', price: 450, unit: '10 pieces', tags: ['egg-less', 'veg'] },
    { name: 'Spinach ravioli', line: 'Ricotta and lemon', price: '₹520', unit: 'serves 2', tags: 'veg, contains nuts' },
    { name: 'Squid ink tagliolini', price: 640, availability: 'sold out' },
  ] },
  { title: 'Sauces', items: [
    { name: 'Tomato and basil', price: 'Rs. 1,20,000.50', unit: '1 jar' },
    { name: 'Chilli oil', availability: 'ask' },
    { name: 'Pesto', price: 'ask us' },
  ] },
];

test('runs in Node with no DOM', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(formatMoney(450), '₹450');
});

test('rupees group the Indian way', () => {
  assert.equal(formatMoney(123450), '₹1,23,450');
  assert.equal(formatMoney(1234567), '₹12,34,567');
  assert.equal(formatMoney(12345678), '₹1,23,45,678');
  assert.equal(formatMoney(999), '₹999');
  assert.equal(formatMoney(1000), '₹1,000');
  assert.equal(formatMoney(100000), '₹1,00,000');
  assert.equal(formatMoney(0), '₹0');
  assert.equal(groupIndian('1234'), '1,234');
});

test('money: decimals only when there are some, and never float noise', () => {
  assert.equal(formatMoney(450.5), '₹450.50');
  assert.equal(formatMoney(0.1 + 0.2), '₹0.30');
  assert.equal(formatMoney(1234.05), '₹1,234.05');
  assert.equal(formatMoney(-450), '-₹450');
  assert.equal(formatMoney(NaN), '');
  assert.equal(formatMoney('450'), '');
});

test('money: another currency groups in thousands; a word gets a space', () => {
  assert.equal(formatMoney(123450, '$'), '$123,450');
  assert.equal(formatMoney(123450, 'Rs'), 'Rs 1,23,450');
  assert.equal(formatMoney(450, 'INR'), 'INR 450');
});

test('prices parse as people write them', () => {
  assert.equal(parsePrice('₹450'), 450);
  assert.equal(parsePrice(' ₹ 1,23,450 '), 123450);
  assert.equal(parsePrice('Rs. 99.50'), 99.5);
  assert.equal(parsePrice('INR 300'), 300);
  assert.equal(parsePrice(450), 450);
  assert.equal(parsePrice('0'), 0);
  for (const bad of ['', 'ask', 'free-ish', '-5', null, undefined, NaN, '₹', '12.345', '1e3', -1]) assert.equal(parsePrice(bad), null, String(bad));
});

test('the same tag, however it is written', () => {
  for (const w of ['egg-less', 'Eggless', 'EGG-FREE', ' egg  less ']) assert.deepEqual(normalizeTag(w), { key: 'egg-less', label: 'Egg-less' }, w);
  assert.deepEqual(normalizeTag('Vegetarian'), { key: 'veg', label: 'Veg' });
  assert.deepEqual(normalizeTag('contains nuts'), { key: 'nuts', label: 'Contains nuts' });
  assert.deepEqual(normalizeTag('Gluten-light'), { key: 'gluten-light', label: 'Gluten-light' }, 'an unknown tag keeps its words');
  assert.equal(normalizeTag('  '), null);
});

test('tags: lists and commas, no repeats, text always', () => {
  assert.deepEqual(parseTags('veg, Vegetarian, spicy').map(t => t.key), ['veg', 'spicy']);
  assert.deepEqual(parseTags(['Egg-less', 'nuts']).map(t => t.label), ['Egg-less', 'Contains nuts']);
  assert.deepEqual(parseTags(undefined), []);
  for (const t of parseTags('veg, vegan, egg-less, nuts, spicy')) assert.ok(t.label.length > 2, 'every tag has words, so it never rests on colour or a glyph');
});

test('availability', () => {
  assert.equal(normalizeAvailability('Sold out'), 'sold-out');
  assert.equal(normalizeAvailability('soldout'), 'sold-out');
  assert.equal(normalizeAvailability('ask'), 'ask');
  assert.equal(normalizeAvailability('Ask first'), 'ask');
  assert.equal(normalizeAvailability(undefined), 'available');
  assert.equal(normalizeAvailability('available'), 'available');
});

test('normalizeMenu: sections, ids, orderable', () => {
  const m = normalizeMenu(SAMPLE);
  assert.equal(m.sections.length, 2);
  assert.equal(m.items.length, 6);
  assert.deepEqual(m.items.map(i => i.id), ['fresh-fettuccine', 'spinach-ravioli', 'squid-ink-tagliolini', 'tomato-and-basil', 'chilli-oil', 'pesto']);
  assert.deepEqual(m.items.map(i => i.orderable), [true, true, false, true, false, false]);
  assert.equal(m.items[1].price, 520);
  assert.equal(m.items[3].price, 120000.5);
  assert.equal(m.items[5].price, null);
  assert.deepEqual(m.items[1].tags.map(t => t.key), ['veg', 'nuts']);
});

test('normalizeMenu: a flat list is one untitled section; { sections } works; nameless dishes drop', () => {
  assert.equal(normalizeMenu([{ name: 'Tea', price: 40 }, { name: 'Coffee', price: 60 }, { price: 5 }]).sections.length, 1);
  assert.equal(normalizeMenu([{ name: 'Tea', price: 40 }, { price: 5 }]).items.length, 1);
  assert.equal(normalizeMenu({ sections: SAMPLE }).items.length, 6);
  assert.deepEqual(normalizeMenu(undefined), { sections: [], items: [] });
  assert.deepEqual(normalizeMenu([]), { sections: [], items: [] });
});

test('normalizeMenu: ids never repeat, across sections too', () => {
  const m = normalizeMenu([{ title: 'A', items: [{ name: 'Pasta' }, { name: 'Pasta' }] }, { title: 'B', items: [{ name: 'pasta!' }] }]);
  assert.deepEqual(m.items.map(i => i.id), ['pasta', 'pasta-2', 'pasta-3']);
});

test('ids from names with accents and symbols', () => {
  const m = normalizeMenu([{ items: [{ name: 'Crème brûlée' }, { name: 'Mac & cheese!' }, { name: '!!!' }] }]);
  assert.deepEqual(m.items.map(i => i.id), ['creme-brulee', 'mac-cheese', 'dish']);
});

test('normalizeMenu: a given id wins; names are tidied', () => {
  const m = normalizeMenu([{ items: [{ id: 'f1', name: '  Fresh   fettuccine ' }] }]);
  assert.equal(m.items[0].id, 'f1');
  assert.equal(m.items[0].name, 'Fresh fettuccine');
});

test('quantities are whole numbers in range', () => {
  assert.equal(clampQty(3), 3);
  assert.equal(clampQty(-2), 0);
  assert.equal(clampQty(2.9), 2);
  assert.equal(clampQty('4'), 4);
  assert.equal(clampQty('x'), 0);
  assert.equal(clampQty(undefined), 0);
  assert.equal(clampQty(500), MAX_QTY);
  assert.equal(clampQty(500, 12), 12);
});

test('summarize: lines in menu order, total in rupees, tags as words', () => {
  const m = normalizeMenu(SAMPLE);
  const s = summarize(m, { 'spinach-ravioli': 1, 'fresh-fettuccine': 2 });
  assert.deepEqual(s.lines.map(l => l.id), ['fresh-fettuccine', 'spinach-ravioli']);
  assert.equal(s.total, 2 * 450 + 520);
  assert.equal(s.count, 3);
  assert.deepEqual(s.lines[0], { id: 'fresh-fettuccine', name: 'Fresh fettuccine', unit: '10 pieces', qty: 2, unitPrice: 450, tags: ['Egg-less', 'Veg'] });
});

test('summarize: dishes that cannot be ordered never reach the order', () => {
  const m = normalizeMenu(SAMPLE);
  const s = summarize(m, { 'squid-ink-tagliolini': 3, 'chilli-oil': 1, pesto: 2, 'no-such-dish': 4, 'fresh-fettuccine': 1 });
  assert.deepEqual(s.lines.map(l => l.id), ['fresh-fettuccine']);
  assert.equal(s.total, 450);
});

test('summarize: a Map works, an empty order is empty, and money does not drift', () => {
  const m = normalizeMenu([{ items: [{ name: 'Tea', price: 0.1 }, { name: 'Cake', price: 19.99 }] }]);
  const s = summarize(m, new Map([['tea', 3], ['cake', 3]]));
  assert.equal(s.total, 60.27);
  assert.equal(summarize(m, { tea: 3 }).total, 0.3, 'three at ten paise is thirty paise, not 0.30000000000000004');
  assert.deepEqual(summarize(m, {}), { lines: [], total: 0, count: 0 });
});

test('summarize: respects the quantity ceiling', () => {
  const m = normalizeMenu([{ items: [{ name: 'Tea', price: 10 }] }]);
  assert.equal(summarize(m, { tea: 400 }, 20).lines[0].qty, 20);
});

test('the total line and what is announced', () => {
  const m = normalizeMenu(SAMPLE);
  const none = summarize(m, {}), one = summarize(m, { 'fresh-fettuccine': 1 }), many = summarize(m, { 'fresh-fettuccine': 3, 'spinach-ravioli': 1 });
  assert.equal(totalLine(none), 'Nothing added yet.');
  assert.equal(totalLine(one), '1 item, ₹450');
  assert.equal(totalLine(many), '4 items, ₹1,870');
  assert.equal(announce({ name: 'Fresh fettuccine', now: 1, was: 0 }), 'Fresh fettuccine: 1 in your order.');
  assert.equal(announce({ name: 'Fresh fettuccine', now: 3, was: 4 }), 'Fresh fettuccine: 3 in your order.');
  assert.equal(announce({ name: 'Fresh fettuccine', now: 0, was: 1 }), 'Fresh fettuccine taken out of your order.');
  assert.equal(announce({ name: 'Tea', now: 99, was: 99 }), 'Tea: 99 is the most we can take in one order.');
  assert.equal(announce({ name: 'Tea', now: 0, was: 0 }), '', 'a press that changes nothing says nothing about the dish');
});

test('the settle moves only in playful, and only once', () => {
  assert.equal(settleMotion('still'), null);
  assert.equal(settleMotion('state'), null);
  assert.equal(settleMotion('ambient'), null);
  const s = settleMotion('full');
  assert.ok(s.keyframes.length >= 2);
  assert.equal(s.keyframes.at(-1).transform, 'translateY(0) scale(1)', 'it ends where it began');
  assert.ok(s.options.iterations === undefined || s.options.iterations === 1, 'never loops');
  assert.ok(s.options.duration <= 500);
  assert.ok(settleMotion('full', -1).options.duration < s.options.duration, 'taking one out is quieter');
});

test('menuHTML: the semantic list, escaped, readable with no script', () => {
  const html = menuHTML(SAMPLE);
  assert.match(html, /<h3 class="sg-menu-section-title">Fresh pasta<\/h3>/);
  assert.match(html, /<li class="sg-menu-item" data-id="fresh-fettuccine" data-availability="available">/);
  assert.match(html, /<data value="450">₹450<\/data> <span class="sg-menu-unit">10 pieces<\/span>/);
  assert.match(html, /<li class="sg-menu-tag" data-tag="egg-less">Egg-less<\/li>/);
  assert.match(html, /<span class="sg-menu-status">Sold out<\/span>/);
  assert.match(html, /<span class="sg-menu-status">Ask first<\/span>/);
  assert.match(html, /<span class="sg-menu-status">Ask for the price<\/span>/);
  assert.match(html, /₹1,20,000\.50/);
  assert.equal(menuHTML(normalizeMenu(SAMPLE)), html, 'a normalized menu gives the same markup');
});

test('menuHTML: a dish name cannot break out of the markup', () => {
  const html = menuHTML([{ items: [{ name: '<img src=x onerror=alert(1)>', line: '"quoted" & more', price: 10 }] }]);
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&quot;quoted&quot; &amp; more/);
});

test('words: every sentence is plain, with no em dash', () => {
  const all = [STRINGS.empty, STRINGS.total(2, '₹9'), STRINGS.added('Tea', 2), STRINGS.removed('Tea'), STRINGS.atMost('Tea', 9), STRINGS.cleared, STRINGS.clear, STRINGS.group('Tea'), STRINGS.add('Tea'), STRINGS.remove('Tea'), STRINGS.soldOut, STRINGS.ask, STRINGS.noPrice];
  for (const s of all) assert.ok(!/[—–]/.test(s), s);
});
