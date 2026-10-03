import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STRINGS, MAX_HREF, normalizeNumber, waLink, readWaLink, wellFormed, formatDate, earliestDate, clip,
  composeOrder, estimate, validateOrder, prepareOrder,
} from './wa-order.core.js';

const LINES = [
  { id: 'fresh-fettuccine', name: 'Fresh fettuccine', unit: '10 pieces', qty: 2, unitPrice: 450, tags: ['Egg-less', 'Veg'] },
  { id: 'spinach-ravioli', name: 'Spinach ravioli', unit: 'serves 2', qty: 1, unitPrice: 520, tags: [] },
];
const ORDER = {
  business: 'Sample Pasta Studio', lines: LINES, date: '2026-10-11', slot: 'Morning (10 am to 1 pm)',
  fulfilment: 'delivery', area: 'Porvorim', name: 'Anjali', notes: 'Please ring the bell twice.', dietary: 'No nuts',
};
const NOW = new Date(2026, 9, 2, 14, 30); // 2 Oct 2026, 2:30 pm local

test('runs in Node with no DOM', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof composeOrder, 'function');
});

// ── numbers ──

test('Indian numbers, however they are written', () => {
  for (const n of ['98765 43210', '9876543210', '98765-43210', '098765 43210', '+91 98765 43210', '+91-98765-43210', '91 98765 43210',
    '919876543210', '0091 98765 43210', '+91 (98765) 43210', ' +91 98765.43210 ', '+91 098765 43210', '(+91) 98765 43210']) {
    assert.deepEqual(normalizeNumber(n), { ok: true, digits: '919876543210', reason: '' }, n);
  }
});

test('other countries keep their own code; a plus is taken as written', () => {
  assert.equal(normalizeNumber('+44 7700 900123').digits, '447700900123');
  assert.equal(normalizeNumber('+971 50 123 4567').digits, '971501234567');
  assert.equal(normalizeNumber('+372 5555 555').digits, '3725555555', 'a ten-digit number with a plus is not an Indian mobile');
  assert.equal(normalizeNumber('00971501234567').digits, '971501234567');
});

test('numbers it cannot use say why', () => {
  assert.equal(normalizeNumber('').reason, 'empty');
  assert.equal(normalizeNumber(undefined).reason, 'empty');
  assert.equal(normalizeNumber('call me').reason, 'empty');
  assert.equal(normalizeNumber('12345').reason, 'length');
  assert.equal(normalizeNumber('+1234567890123456').reason, 'length');
  assert.equal(normalizeNumber('2251234567').reason, 'not-mobile');
});

test('waLink builds the link, and refuses a number it cannot open', () => {
  assert.equal(waLink('+91 98765 43210'), 'https://wa.me/919876543210');
  assert.equal(waLink('98765 43210', 'Hello there'), 'https://wa.me/919876543210?text=Hello%20there');
  assert.throws(() => waLink('12345', 'Hi'), /not a number WhatsApp can open/);
  assert.throws(() => waLink('', 'Hi'));
});

test('waLink encodes everything a message can hold, and reads back the same', () => {
  const texts = [
    'Hello\nSecond line\n\nThird',
    '2 × Fresh fettuccine (egg-less): ₹900',
    'ampersand & equals = question ? hash # plus + percent % slash / quote " \' backslash \\',
    'Emoji 🍝 and a family 👩‍👩‍👧 and a flag 🇮🇳 and नमस्ते and ಕನ್ನಡ',
    '   leading and trailing   ',
    'a'.repeat(1500),
  ];
  for (const t of texts) {
    const href = waLink('+91 98765 43210', t);
    assert.deepEqual(readWaLink(href), { digits: '919876543210', text: t }, t.slice(0, 30));
    assert.ok(!/[\s]/.test(href), 'the link has no raw whitespace');
    assert.ok(!href.includes('+') || href.includes('%2B') || !t.includes('+'), 'a plus in the text is %2B, never a bare +');
  }
});

test('emoji-safe: a lone half of an emoji cannot break the link', () => {
  const broken = `Hello \uD83D world ${'🍝'.slice(0, 1)}`; // lone high surrogates
  assert.doesNotThrow(() => waLink('9876543210', broken));
  assert.equal(readWaLink(waLink('9876543210', broken)).text, 'Hello � world �');
  assert.equal(wellFormed('ok 🍝'), 'ok 🍝');
  assert.equal(wellFormed('x\uDC00y'), 'x�y');
});

test('readWaLink only reads a wa.me link', () => {
  assert.equal(readWaLink('https://example.com/919876543210?text=x'), null);
  assert.equal(readWaLink('https://wa.me/12?text=x'), null);
  assert.equal(readWaLink('nonsense'), null);
  assert.deepEqual(readWaLink('https://wa.me/919876543210'), { digits: '919876543210', text: '' });
});

// ── dates ──

test('dates read as a person writes them', () => {
  assert.equal(formatDate('2026-10-11'), 'Sun 11 Oct 2026');
  assert.equal(formatDate('2026-01-01'), 'Thu 1 Jan 2026');
  assert.equal(formatDate('2026-02-30'), '');
  assert.equal(formatDate('11/10/2026'), '');
  assert.equal(formatDate(''), '');
  assert.equal(formatDate(undefined), '');
});

test('earliest day: now plus the notice, in local time', () => {
  assert.equal(earliestDate(NOW, 0), '2026-10-02');
  assert.equal(earliestDate(NOW, 8), '2026-10-02'); // 10:30 pm still today
  assert.equal(earliestDate(NOW, 10), '2026-10-03'); // 12:30 am tomorrow
  assert.equal(earliestDate(NOW, 24), '2026-10-03');
  assert.equal(earliestDate(NOW, 48), '2026-10-04');
  assert.equal(earliestDate(new Date(2026, 11, 31, 23, 0), 2), '2027-01-01', 'across a year');
  assert.equal(earliestDate(new Date(2026, 1, 28, 12, 0), 24), '2026-03-01', 'across a month');
  assert.equal(earliestDate(NOW, -5), '2026-10-02', 'negative notice is none');
  assert.equal(earliestDate(NOW, 'x'), '2026-10-02');
});

// ── the message ──

test('the message, the way the seller reads it', () => {
  const text = composeOrder(ORDER);
  assert.equal(text, [
    'Hello Sample Pasta Studio! I would like to order:',
    '',
    '2 × Fresh fettuccine (10 pieces, egg-less, veg): ₹900',
    '1 × Spinach ravioli (serves 2): ₹520',
    '',
    'Estimated total: ₹1,420. Please confirm the total and any delivery charge.',
    '',
    'When: Sun 11 Oct 2026, Morning (10 am to 1 pm)',
    'Delivery to: Porvorim',
    'Name: Anjali',
    'Dietary: No nuts',
    'Notes: Please ring the bell twice.',
    '',
    'Thank you!',
  ].join('\n'));
});

test('pickup says so, and carries no area', () => {
  const text = composeOrder({ ...ORDER, fulfilment: 'pickup', area: 'Porvorim' });
  assert.match(text, /^Pickup: I will collect it$/m);
  assert.ok(!text.includes('Porvorim'));
});

test('missing details leave no empty lines behind', () => {
  const text = composeOrder({ lines: LINES });
  assert.ok(!/Name:|When:|Delivery|Pickup|Notes:|Dietary:/.test(text), text);
  assert.ok(!/\n\n\n/.test(text));
  assert.match(composeOrder({ lines: LINES, fulfilment: 'delivery' }), /Delivery \(address to follow\)/);
  assert.match(composeOrder({ lines: LINES }), /^Hello! I would like to order:/);
});

test('the total is an estimate, said so, and added exactly', () => {
  assert.equal(estimate(LINES), 1420);
  assert.match(composeOrder(ORDER), /Estimated total: ₹1,420\. Please confirm/);
  assert.equal(estimate([{ name: 'a', qty: 3, unitPrice: 19.99 }]), 59.97);
  assert.match(composeOrder({ lines: [{ name: 'Big', qty: 5, unitPrice: 24690 }] }), /Estimated total: ₹1,23,450\./);
});

test('no markdown the seller\'s WhatsApp would garble', () => {
  const text = composeOrder({ ...ORDER, business: '*Sample* _Pasta_ ~Studio~', lines: [{ name: '**Bold** `code` _x_', qty: 1, unitPrice: 10, tags: ['Egg-less'] }] });
  assert.ok(!/[*_~`]/.test(text), text);
  assert.ok(!/^[#>]/m.test(text), 'no heading or quote lines');
  assert.ok(!/^\s*[-*•]\s/m.test(text), 'no bullet lines it would turn into a list');
  assert.ok(!/^\d+\.\s/m.test(text), 'no numbered lines it would turn into a list');
  assert.ok(!/[—–]/.test(text), 'no dashes to garble');
});

test('what the customer types is tidied, not trusted', () => {
  const text = composeOrder({ ...ORDER, name: '  Anjali \n Kamat \u0000', area: 'Porvorim\n\n\nBardez', slot: '' });
  assert.match(text, /^Name: Anjali Kamat$/m);
  assert.match(text, /^Delivery to: Porvorim Bardez$/m);
  assert.ok(!/\u0000/.test(text));
  const notes = composeOrder({ ...ORDER, notes: 'one\n\n\n\n\ntwo   spaced' });
  assert.match(notes, /Notes: one\n\ntwo spaced/);
});

test('long free text is cut on a whole character, never through an emoji', () => {
  const notes = '🍝'.repeat(700);
  const text = composeOrder({ ...ORDER, notes });
  const line = text.split('\n').find(l => l.startsWith('Notes: '));
  assert.ok(Array.from(line).length <= 'Notes: '.length + 600 + 3);
  assert.doesNotThrow(() => waLink('9876543210', text));
  assert.ok(!/�/.test(text), 'no broken half left behind');
  assert.equal(clip('🍝🍝🍝', 2), '🍝🍝...');
});

test('dishes with no name or no quantity are not in the message; fractions round down', () => {
  const text = composeOrder({ lines: [{ name: 'Tea', qty: 0, unitPrice: 10 }, { name: '', qty: 2 }, { name: 'Coffee', qty: 2.9, unitPrice: 20 }] });
  assert.match(text, /^2 × Coffee: ₹40$/m);
  assert.ok(!text.includes('Tea'));
});

test('an empty cart composes nothing', () => {
  assert.equal(composeOrder({ ...ORDER, lines: [] }), '');
  assert.equal(composeOrder({}), '');
  assert.equal(composeOrder(), '');
});

test('another currency', () => {
  assert.match(composeOrder({ lines: [{ name: 'Tea', qty: 1, unitPrice: 123456 }], currency: '$' }), /Estimated total: \$123,456\./);
});

// ── checking ──

test('validateOrder lists what is missing, in the order the form asks', () => {
  const p = validateOrder({ lines: [], fulfilment: 'delivery' }, { now: NOW, minNoticeHours: 24 });
  assert.deepEqual(p.map(x => x.field), ['lines', 'date', 'area', 'name']);
  assert.deepEqual(validateOrder({ ...ORDER, date: '2026-10-11' }, { now: NOW, minNoticeHours: 24 }), []);
  assert.deepEqual(validateOrder({ ...ORDER, fulfilment: 'pickup', area: '' }, { now: NOW }).map(x => x.field), [], 'pickup needs no area');
});

test('validateOrder: a date inside the notice says when the earliest day is', () => {
  const p = validateOrder({ ...ORDER, date: '2026-10-02' }, { now: NOW, minNoticeHours: 24 });
  assert.equal(p.length, 1);
  assert.equal(p[0].field, 'date');
  assert.equal(p[0].message, 'We need a day of notice. The earliest day is Sat 3 Oct 2026.');
  assert.equal(validateOrder({ ...ORDER, date: '2026-10-03' }, { now: NOW, minNoticeHours: 24 }).length, 0, 'the earliest day itself is fine');
  assert.equal(validateOrder({ ...ORDER, date: '2026-10-04' }, { now: NOW, minNoticeHours: 36 }).length, 0);
  assert.match(validateOrder({ ...ORDER, date: '2026-10-02' }, { now: NOW, minNoticeHours: 36 })[0].message, /36 hours of notice/);
  assert.match(validateOrder({ ...ORDER, date: '2026-10-02' }, { now: NOW, minNoticeHours: 72 })[0].message, /3 days of notice/);
  assert.equal(validateOrder({ ...ORDER, date: 'soon' }, { now: NOW })[0].message, STRINGS.noDate);
});

// ── the whole thing ──

test('prepareOrder: a good order gives the link, and the link says what the preview says', () => {
  const r = prepareOrder(ORDER, { number: '+91 98765 43210', now: NOW, minNoticeHours: 24 });
  assert.equal(r.ok, true);
  assert.equal(r.reason, '');
  assert.equal(r.level, 0);
  assert.deepEqual(readWaLink(r.href), { digits: '919876543210', text: r.text });
  assert.equal(r.text, composeOrder(ORDER));
});

test('prepareOrder: an empty cart has no link, and says why', () => {
  const r = prepareOrder({ ...ORDER, lines: [] }, { number: '9876543210', now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.href, null);
  assert.equal(r.text, '');
  assert.equal(r.reason, 'Choose something from the menu first.');
  assert.equal(r.problems[0].field, 'lines');
});

test('prepareOrder: missing details keep the message but not the link', () => {
  const r = prepareOrder({ ...ORDER, name: '' }, { number: '9876543210', now: NOW, minNoticeHours: 24 });
  assert.equal(r.ok, false);
  assert.equal(r.href, null);
  assert.ok(r.text.startsWith('Hello Sample Pasta Studio!'), 'the preview still shows');
  assert.equal(r.reason, STRINGS.noName);
  assert.deepEqual(r.problems.map(p => p.field), ['name']);
});

test('prepareOrder: a number it cannot use is said, not guessed', () => {
  for (const number of [undefined, '', '12345', 'abc']) {
    const r = prepareOrder(ORDER, { number, now: NOW, minNoticeHours: 24 });
    assert.equal(r.ok, false, String(number));
    assert.equal(r.href, null);
    assert.equal(r.reason, STRINGS.badNumber);
  }
});

test('prepareOrder: a long order is shortened a level at a time until the link fits', () => {
  const lines = Array.from({ length: 60 }, (_, i) => ({ name: `Dish number ${i + 1} with a long name`, qty: 2, unit: 'serves 2 people', unitPrice: 450, tags: ['Egg-less'] }));
  const order = { ...ORDER, lines, notes: 'x'.repeat(500) };
  const full = prepareOrder(order, { number: '9876543210', now: NOW, minNoticeHours: 24, maxHref: 1e9 });
  assert.equal(full.level, 0);
  const cap = full.href.length - 100;
  const r = prepareOrder(order, { number: '9876543210', now: NOW, minNoticeHours: 24, maxHref: cap });
  assert.ok(r.level >= 1, 'it had to shorten');
  if (r.ok) {
    assert.ok(r.href.length <= cap);
    assert.equal(r.text.split('\n').filter(l => /^\d+ × /.test(l)).length, 60, 'no dish is ever dropped to make it fit');
    assert.match(r.text, /egg-less/, 'a tag that matters stays');
    assert.deepEqual(readWaLink(r.href).text, r.text);
  }
});

test('prepareOrder: too long even when shortest says so, with no link', () => {
  const lines = Array.from({ length: 60 }, (_, i) => ({ name: `Dish ${i}`, qty: 1, unitPrice: 10 }));
  const r = prepareOrder({ ...ORDER, lines }, { number: '9876543210', now: NOW, minNoticeHours: 24, maxHref: 200 });
  assert.equal(r.ok, false);
  assert.equal(r.href, null);
  assert.equal(r.reason, STRINGS.tooLong);
  assert.equal(r.level, 2);
});

test('a real long order (25 dishes, notes, emoji) stays under the ceiling at full length', () => {
  const lines = Array.from({ length: 25 }, (_, i) => ({ name: `Dish ${i + 1}`, qty: 3, unit: '10 pieces', unitPrice: 450, tags: ['Egg-less'] }));
  const r = prepareOrder({ ...ORDER, lines, notes: 'Thank you 🍝 '.repeat(20) }, { number: '9876543210', now: NOW, minNoticeHours: 24 });
  assert.equal(r.ok, true);
  assert.equal(r.level, 0);
  assert.ok(r.href.length < MAX_HREF, `${r.href.length} chars`);
});

test('words: the honest line, and no em dash anywhere', () => {
  assert.equal(STRINGS.written, "Your order is written; send it in WhatsApp and we'll confirm.");
  assert.equal(STRINGS.previewTitle, "This is what we'll send");
  const all = Object.values(STRINGS).map(v => (typeof v === 'function' ? v(24, 24) : v));
  for (const s of all) assert.ok(!/[—–]/.test(s), s);
  assert.ok(!/placed|confirmed order|order is in/i.test(STRINGS.written), 'it never says the order is placed');
});
