import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RATES } from '../../kernels/booking/rates.js';
import { quoteView, heldMessage, STRINGS, CODE_STRINGS, ROOMS, codeFor, spaced, asciiDigits, codeMatches } from './booking.core.js';

test('before dates: what to do next', () => {
  assert.deepEqual(quoteView(null, null), { state: 'empty', message: STRINGS.empty });
  assert.deepEqual(quoteView('2026-11-16', null), { state: 'half', message: 'Arriving 16 Nov. Pick your departure to see the price.' });
});

test('a shoulder stay: nights grouped, GST on its own line, the deposit', () => {
  const v = quoteView('2026-10-15', '2026-10-18', 2); // Thu 20,000; Fri and Sat 26,000
  assert.equal(v.state, 'ok');
  assert.equal(v.stay, '15 Oct to 18 Oct, 3 nights');
  assert.equal(v.guests, '2 guests');
  assert.deepEqual(v.lines, [
    { label: 'Shoulder, 1 weeknight', detail: '1 × ₹20,000', amount: '₹20,000', provisional: true },
    { label: 'Shoulder, 2 Friday and Saturday nights', detail: '2 × ₹26,000', amount: '₹52,000', provisional: true },
  ]);
  assert.deepEqual(v.subtotal, { label: 'Rooms', amount: '₹72,000' });
  assert.deepEqual(v.gst, { label: 'GST at 18%', amount: '₹12,960' });
  assert.deepEqual(v.total, { label: 'Total', amount: '₹84,960', value: 84960 });
  assert.deepEqual(v.deposit, { label: 'Refundable deposit', amount: '₹15,000', provisional: true });
  assert.equal(v.gstNote, STRINGS.gstExclusive);
  assert.equal(v.provisional, true, 'the card says so, and so must the quote');
});

test('a stay across Christmas week prices each band on its own line, in lakhs', () => {
  const v = quoteView('2026-12-18', '2026-12-23', 4);
  assert.deepEqual(v.lines.map(l => [l.label, l.amount]), [
    ['Shoulder, 2 Friday and Saturday nights', '₹52,000'],
    ['Christmas week, 3 weeknights', '₹1,20,000'],
  ]);
  assert.equal(v.subtotal.amount, '₹1,72,000');
  assert.equal(v.gst.amount, '₹30,960');
  assert.equal(v.total.amount, '₹2,02,960');
  assert.equal(v.guests, '4 guests');
});

test('a refused stay keeps its figures and says why', () => {
  const v = quoteView('2026-12-22', '2026-12-25', 2);
  assert.equal(v.state, 'refused');
  assert.deepEqual(v.reasons, ['The Christmas band has a 4-night minimum.']);
  assert.equal(v.lines.length, 1);
});

test('inclusive GST and no GST are said plainly', () => {
  const inc = quoteView('2026-10-15', '2026-10-18', 2, { ...RATES, gst: { ...RATES.gst, inclusive: true } });
  assert.equal(inc.total.amount, '₹72,000');
  assert.equal(inc.gst.amount, '₹10,983');
  assert.equal(inc.gstNote, STRINGS.gstInclusive);
  const cheap = { ...RATES, deposit: { ...RATES.deposit, provisional: false }, bands: [{ id: 'x', label: 'Any time', from: '01-01', to: '12-31', weekday: 7000, weekend: 7000, minNights: 1, provisional: false, tone: 'free' }] };
  const v = quoteView('2026-10-12', '2026-10-14', 1, cheap);
  assert.deepEqual(v.gst, { label: 'GST', amount: 'none below ₹7,500 a night' });
  assert.equal(v.provisional, false, 'settled figures are not called provisional');
  assert.equal(v.guests, '1 guest');
  assert.equal(v.lines[0].label, 'Any time, 2 weeknights');
});

test('the Held stamp says the stay and that it is a prototype', () => {
  const v = quoteView('2026-11-16', '2026-11-20', 2);
  assert.equal(heldMessage(v), '16 Nov to 20 Nov, 4 nights, 2 guests, the whole house. Prototype: nothing is held and nothing is charged.');
  for (const w of Object.values(STRINGS)) {
    const text = typeof w === 'function' ? w('a', 'b', 2) : w;
    assert.ok(!String(text).includes(String.fromCharCode(0x2014)));
  }
});

test('the phone code: seeded, six digits, a new one each time, read in any script', () => {
  const a = codeFor(1, '98220 12345'), b = codeFor(1, '+91 98220 12345'.slice(4));
  assert.match(a, /^\d{6}$/);
  assert.equal(a, b, 'spaces in the number do not change the code');
  assert.equal(codeFor(1, '98220 12345'), a, 'seeded: the same every time');
  assert.notEqual(codeFor(1, '98220 12345', 2), a, 'sending again gives a new code');
  assert.notEqual(codeFor(2, '98220 12345'), a);
  assert.equal(spaced('482913'), '482 913');
  assert.equal(asciiDigits('४८२ ९१३'), '482913', 'Devanagari');
  assert.equal(asciiDigits('೪೮೨೯೧೩'), '482913', 'Kannada');
  assert.equal(asciiDigits('４８２９１３'), '482913', 'full width');
  assert.equal(asciiDigits('Your code is 482 913.'), '482913');
  assert.equal(codeMatches('४८२ ९१३', '482913'), true);
  assert.equal(codeMatches('482914', '482913'), false);
  assert.equal(codeMatches('482913', null), false, 'nothing sent, nothing matches');
  assert.equal(CODE_STRINGS.sent('98220 12345', '482 913'), 'Prototype: nothing leaves this page. The code we would have texted to 98220 12345 is 482 913.');
  for (const w of Object.values(CODE_STRINGS)) assert.ok(!String(typeof w === 'function' ? w('a', 'b') : w).includes(String.fromCharCode(0x2014)));
});

test('a single room gets no figure the card does not have', () => {
  const v = quoteView('2026-11-16', '2026-11-20', 2, undefined, 'sotao');
  assert.equal(v.state, 'room');
  assert.equal(v.message, 'The rate card prices the whole house. The house will confirm the price for the Sotão when they write back.');
  assert.equal(v.lines, undefined, 'no lines');
  assert.equal(v.total, undefined, 'no total');
  assert.equal(heldMessage(v), '16 Nov to 20 Nov, 4 nights, 2 guests, the Sotão. Prototype: nothing is held and nothing is charged.');
  assert.deepEqual(quoteView('2026-12-22', '2026-12-25', 2, undefined, 'quintal').reasons, ['The Christmas band has a 4-night minimum.'], 'the stay rules still apply to a room');
  assert.equal(quoteView('2026-11-16', '2026-11-20', 2, undefined, 'whole').total.amount, '₹94,400');
  assert.equal(quoteView('2026-11-16', '2026-11-20', 2, undefined, 'nonsense').total.amount, '₹94,400', 'unknown rooms read as the whole house');
  assert.deepEqual(Object.keys(ROOMS), ['whole', 'sotao', 'balcao', 'quintal']);
});

test('the mobile number field welcomes spaces and hyphens, as the enquiry does', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const pattern = html.match(/<input[^>]*name="phone"[^>]*pattern="([^"]*)"/)[1];
  const re = new RegExp(`^(?:${pattern})$`, 'v');
  for (const ok of ['98220-12345', '+91 98220 12345', '9822012345', '९८२२० १२३४५', '೯೮೨೨೦ ೧೨೩೪೫']) assert.ok(re.test(ok), ok);
  for (const bad of ['98220 abcde', 'call me', '12345']) assert.ok(!re.test(bad), bad);
});

test('the Held stamp says it is a prototype, as the words beside it do', () => {
  assert.equal(STRINGS.held, 'Held');
  assert.equal(STRINGS.heldDetail, 'Prototype');
});
