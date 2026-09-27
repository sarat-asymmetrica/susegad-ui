import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RATES } from '../../kernels/booking/rates.js';
import { occupiedNights } from '../../kernels/booking/availability.js';
import {
  dayInfo, canDepart, pick, selectable, shortPrice, labelFor, hintFor, moveFocus, viewFor, seasonRuns, seasonRows, rangeReasons, inWords, dayMonth, STRINGS,
} from './date-range.core.js';

const occupied = occupiedNights([
  { arrival: '2026-11-13', departure: '2026-11-16', kind: 'booking' },
  { arrival: '2026-11-20', departure: '2026-11-22', kind: 'hold' },
]);
const ctx = { occupied, today: '2026-10-20', window: RATES.window };

test('a day knows its night, its turnover and its price', () => {
  const d = dayInfo('2026-11-16', ctx, RATES);
  assert.equal(d.night, 'free');
  assert.equal(d.arrivalOk, true);
  assert.equal(d.departureOk, false, 'the night before is taken');
  assert.equal(d.rate, 20000, 'a Monday in the shoulder band');
  assert.equal(dayInfo('2026-12-26', ctx, RATES).peak, true);
  assert.equal(dayInfo('2026-11-16', ctx).rate, 0, 'no rates, no prices');
});

test('arrival then departure; turnover days are fine; taken nights stop the range', () => {
  let s = { arr: null, dep: null };
  s = pick(s, '2026-11-10', ctx);
  assert.deepEqual(s, { arr: '2026-11-10', dep: null });
  assert.equal(canDepart(s.arr, '2026-11-13', ctx), true, 'leave the morning the next guests arrive');
  assert.equal(canDepart(s.arr, '2026-11-14', ctx), false, 'cannot cross a taken night');
  assert.equal(canDepart(s.arr, '2026-11-10', ctx), false);
  assert.equal(pick(s, '2026-11-14', ctx), null, 'the 14th is taken: no arrival there either');
  s = pick(s, '2026-11-13', ctx);
  assert.deepEqual(s, { arr: '2026-11-10', dep: '2026-11-13' });
  s = pick(s, '2026-11-16', ctx);
  assert.deepEqual(s, { arr: '2026-11-16', dep: null }, 'a pick after a full range starts again');
  assert.equal(pick({ arr: '2026-11-16', dep: null }, '2026-11-16', ctx), null, 'the arrival again: nothing changes');
  assert.equal(pick({ arr: null, dep: null }, '2026-10-21', ctx), null, 'too soon');
});

test('selectable days follow the state', () => {
  const s = { arr: '2026-11-16', dep: null };
  assert.equal(selectable(s, '2026-11-20', ctx), true, 'the hold arrives on the 20th: leaving that morning is fine');
  assert.equal(selectable(s, '2026-11-21', ctx), false);
  assert.equal(selectable(s, '2026-11-16', ctx), true, 'the arrival itself');
  assert.equal(selectable({ arr: null, dep: null }, '2026-11-14', ctx), false);
});

test('short prices are lakh-aware; full prices in labels use Indian grouping', () => {
  assert.equal(shortPrice(28000), '28k');
  assert.equal(shortPrice(70000), '70k');
  assert.equal(shortPrice(100000), '1L');
  assert.equal(shortPrice(125000), '1.3L');
  assert.equal(shortPrice(0), '');
  const s = { arr: '2026-11-16', dep: null };
  assert.equal(labelFor('2026-11-16', dayInfo('2026-11-16', ctx, RATES), s, RATES.window), 'Mon 16 Nov 2026, your arrival, free night, ₹20,000');
  assert.equal(labelFor('2026-11-13', dayInfo('2026-11-13', ctx, RATES), s, RATES.window), 'Fri 13 Nov 2026, taken, you can leave on this day');
  assert.equal(labelFor('2026-12-26', dayInfo('2026-12-26', ctx, RATES), s, RATES.window), 'Sat 26 Dec 2026, free night, ₹48,000, Christmas week');
  assert.equal(labelFor('2026-11-21', dayInfo('2026-11-21', ctx, RATES), s, RATES.window), 'Sat 21 Nov 2026, on hold for another guest');
  assert.equal(labelFor('2026-10-21', dayInfo('2026-10-21', ctx, RATES), s, RATES.window), "Wed 21 Oct 2026, too soon, arrivals need 2 days' notice");
  assert.match(labelFor('2027-07-10', dayInfo('2027-07-10', ctx, RATES), s, RATES.window), /not open for booking yet$/);
});

test('the hint says what to do next', () => {
  assert.equal(hintFor({ arr: null, dep: null }), STRINGS.pickArrival);
  assert.equal(hintFor({ arr: '2026-11-16', dep: null }), 'Arriving 16 Nov. Now pick your departure.');
  assert.equal(hintFor({ arr: '2026-11-16', dep: '2026-11-20' }), '4 nights. Pick a new arrival to start again.');
  assert.equal(hintFor({ arr: '2026-11-16', dep: '2026-11-17' }), '1 night. Pick a new arrival to start again.');
});

test('keyboard moves follow the APG date grid', () => {
  assert.equal(moveFocus('2026-11-18', 'ArrowLeft'), '2026-11-17');
  assert.equal(moveFocus('2026-11-30', 'ArrowRight'), '2026-12-01');
  assert.equal(moveFocus('2026-11-18', 'ArrowUp'), '2026-11-11');
  assert.equal(moveFocus('2026-11-28', 'ArrowDown'), '2026-12-05');
  assert.equal(moveFocus('2026-11-18', 'Home'), '2026-11-16', 'Monday');
  assert.equal(moveFocus('2026-11-18', 'End'), '2026-11-22', 'Sunday');
  assert.equal(moveFocus('2027-01-31', 'PageDown'), '2027-02-28', 'the day is kept where the month allows');
  assert.equal(moveFocus('2026-11-18', 'PageUp'), '2026-10-18');
  assert.equal(moveFocus('2026-11-18', 'PageDown', true), '2027-11-18', 'Shift: a year');
  assert.equal(moveFocus('2028-02-29', 'PageUp', true), '2027-02-28');
  assert.equal(moveFocus('2026-11-18', 'Tab'), null);
});

test('the view keeps the focused day on show, within the open months', () => {
  assert.equal(viewFor('2026-12-05', '2026-11', '2026-10', '2027-06'), '2026-11', 'already on show');
  assert.equal(viewFor('2027-01-05', '2026-11', '2026-10', '2027-06'), '2026-12');
  assert.equal(viewFor('2026-09-05', '2026-11', '2026-10', '2027-06'), '2026-10', 'not before the first');
  assert.equal(viewFor('2027-08-05', '2026-11', '2026-10', '2027-06'), '2027-05', 'the last two months');
});

test('season runs cover the year ahead without gaps; the table lists every stretch', () => {
  const { runs, days, start, end } = seasonRuns('2026-10-20', RATES);
  assert.equal(start, '2026-10-01');
  assert.equal(end, '2027-10-31');
  assert.equal(runs.reduce((n, r) => n + (Date.parse(r.to) - Date.parse(r.from)) / 864e5 + 1, 0), days);
  assert.deepEqual(runs.map(r => r.kind), ['before', 'shoulder', 'peak', 'shoulder', 'late', 'launch', 'after']);
  const rows = seasonRows('2026-10-20', RATES);
  assert.deepEqual(rows.map(r => r.kind), ['shoulder', 'peak', 'late', 'launch']);
  assert.equal(rows[0].when, '15 Oct to 19 Dec, 6 Jan to 31 Jan');
  assert.equal(rows[1].price, '₹40,000 to ₹48,000');
  assert.equal(rows[1].minimum, '4 nights');
  assert.ok(rows.every(r => r.provisional), 'the card is still provisional, and the table can say so');
});

test('range reasons come from availability and the rate card, without repeats', () => {
  assert.deepEqual(rangeReasons('2026-11-10', '2026-11-13', ctx, RATES), []);
  assert.deepEqual(rangeReasons('2026-12-22', '2026-12-25', ctx, RATES), ['Stays over Christmas week are at least 4 nights.']);
  assert.deepEqual(rangeReasons('2026-11-12', '2026-11-18', ctx, RATES), ['The night of 13 November is already taken.']);
  assert.deepEqual(rangeReasons('2026-11-18', '2026-11-16', ctx, RATES), ['Your departure needs to be after your arrival.'], 'said once, not twice');
  assert.deepEqual(rangeReasons('2026-11-10', null, ctx, RATES), []);
});

test("every reason the kernels give reaches guests in their words, not the portal's", async () => {
  const { validateRange } = await import('../../kernels/booking/availability.js');
  const { quote } = await import('../../kernels/booking/pricing.js');
  const early = { ...ctx, today: '2026-09-01' };
  // drive the real kernels into each reason, so a change in their wording fails here
  const raw = [
    ...validateRange('2026-11-18', '2026-11-16', ctx).reasons,
    ...validateRange('2026-10-01', '2026-10-05', early).reasons,
    ...validateRange('2027-06-28', '2027-07-03', ctx).reasons,
    ...validateRange('2026-10-21', '2026-10-25', ctx).reasons,
    ...validateRange('2026-11-12', '2026-11-18', ctx).reasons,
    ...quote('2026-12-22', '2026-12-25', RATES).reasons,
    ...quote('2026-10-20', '2026-10-22', RATES).reasons,
    ...quote('2026-10-15', '2026-11-06', RATES).reasons,
    ...quote('2026-10-15', '2026-10-19', { ...RATES, bands: [] }).reasons,
    ...quote('2026-02-30', '2026-03-02', RATES).reasons,
  ];
  const said = [...new Set(raw)].map(inWords);
  assert.deepEqual(said, [
    'Your departure needs to be after your arrival.',
    'The house opens for stays on 15 October 2026. For earlier dates, send us an enquiry.',
    'Bookings are open until 30 June 2027.',
    "Arrivals need at least 2 days' notice.",
    'The night of 13 November is already taken.',
    'Stays over Christmas week are at least 4 nights.',
    'Stays at this time of year are at least 3 nights.',
    'Stays are up to 21 nights. Write to us for a longer one.',
    'Part of this stay does not have a price yet. Write to us about it.',
    'Those dates are not real dates. Check the day and the month.',
  ]);
  for (const w of said) {
    assert.doesNotMatch(w, /\d{4}-\d{2}-\d{2}/, 'no ISO dates');
    assert.doesNotMatch(w, /\bband\b/, 'no rate-card jargon');
  }
  assert.equal(inWords('Something new from the kernels.'), 'Something new from the kernels.', 'unknown reasons pass through');
  assert.equal(dayMonth('2027-01-06'), '6 January');
  assert.equal(dayMonth('2027-01-06', true), '6 January 2027');
  assert.equal(inWords("Arrivals need at least 1 days' notice."), "Arrivals need at least 1 day's notice.");
});
