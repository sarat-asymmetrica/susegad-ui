// The booking kernels: dates, the rate card, quotes and availability.
// Expected values are worked by hand from the rate card, not read back from the code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toDay, fromDay, addDays, diffDays, isValidISO, weekday, isWeekendNight, daysInMonth, ym, pad2,
  addMonths, isValidYM, monthGrid, monthName, longDate, shortDate, eachDay, todayISO,
} from './dates.js';
import { RATES, bandFor } from './rates.js';
import { inr, rupees, nightlyRate, quote, fromRate } from './pricing.js';
import { occupiedNights, classifyDay, validateRange, maxDepartureFrom } from './availability.js';
import * as all from './index.js';

// ── dates ────────────────────────────────────────────────────────────────

test('ISO days round-trip and reject impossible dates', () => {
  assert.equal(toDay('1970-01-01'), 0);
  assert.equal(fromDay(0), '1970-01-01');
  assert.equal(fromDay(toDay('2026-10-15')), '2026-10-15');
  assert.throws(() => toDay('2026-02-30'), /invalid calendar date/);
  assert.throws(() => toDay('2026-2-3'), /bad ISO date/);
  assert.throws(() => toDay(undefined), /bad ISO date/);
  assert.equal(isValidISO('2028-02-29'), true, 'leap day');
  assert.equal(isValidISO('2027-02-29'), false);
});

test('adding and counting days crosses months, years and leap days', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-12-20', '2027-01-05'), 16);
  assert.equal(diffDays('2027-01-05', '2026-12-20'), -16);
  assert.deepEqual(eachDay('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01']);
  assert.deepEqual(eachDay('2026-12-30', '2026-12-30'), []);
});

test('weekdays are ISO, Monday = 0; weekend nights are Friday and Saturday', () => {
  assert.equal(weekday('1970-01-01'), 3, 'a Thursday');
  assert.equal(weekday('2026-10-15'), 3, 'Thursday');
  assert.equal(weekday('2026-10-19'), 0, 'Monday');
  assert.equal(weekday('2026-10-18'), 6, 'Sunday');
  assert.equal(weekday('1969-12-29'), 0, 'before the epoch still works');
  assert.deepEqual(eachDay('2026-10-12', '2026-10-19').map(isWeekendNight), [false, false, false, false, true, true, false]);
});

test('months: length, stepping, validity, names', () => {
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2026, 12), 31);
  assert.equal(ym('2026-10-15'), '2026-10');
  assert.equal(pad2(7), '07');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2027-01', -1), '2026-12');
  assert.equal(addMonths('2026-10', 14), '2027-12');
  assert.equal(isValidYM('2026-10'), true);
  assert.equal(isValidYM('2026-13'), false);
  assert.equal(isValidYM(''), false);
  assert.equal(monthName('2026-10'), 'October 2026');
  assert.equal(longDate('2026-12-19'), 'Sat 19 Dec 2026');
  assert.equal(shortDate('2026-12-19'), '19 Dec');
});

test('a month grid starts on Monday and pads with nulls', () => {
  const g = monthGrid('2026-10'); // 1 Oct 2026 is a Thursday
  assert.equal(g.length, 5);
  assert.ok(g.every(r => r.length === 7));
  assert.deepEqual(g[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.deepEqual(g[4], ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
  assert.equal(g.flat().filter(Boolean).length, 31);
  assert.equal(monthGrid('2027-02')[0][0], '2027-02-01', 'Feb 2027 starts on a Monday');
  assert.deepEqual(monthGrid('2026-10'), g, 'pure');
});

test("today's date comes from the clock in India's offset", () => {
  assert.equal(todayISO(Date.UTC(2026, 8, 24, 20, 0)), '2026-09-25', '01:30 IST on the 25th');
  assert.equal(todayISO(Date.UTC(2026, 8, 24, 18, 29)), '2026-09-24', '23:59 IST');
  assert.equal(todayISO(Date.UTC(2026, 8, 24, 20, 0), 0), '2026-09-24', 'UTC');
});

// ── the rate card ────────────────────────────────────────────────────────

test('every night of the year falls in exactly one band, including across the year end', () => {
  for (const d of eachDay('2027-01-01', '2028-01-01')) {
    const hits = RATES.bands.filter(b => (b.from <= b.to ? d.slice(5) >= b.from && d.slice(5) <= b.to : d.slice(5) >= b.from || d.slice(5) <= b.to));
    assert.equal(hits.length, 1, d);
  }
  assert.equal(bandFor('2026-12-20').id, 'peak');
  assert.equal(bandFor('2027-01-05').id, 'peak');
  assert.equal(bandFor('2027-01-06').id, 'shoulder');
  assert.equal(bandFor('2026-12-19').id, 'shoulder');
  assert.equal(bandFor('2027-02-01').id, 'late');
  assert.equal(bandFor('2027-04-01').id, 'launch');
  assert.equal(bandFor('2026-01-01', { ...RATES, bands: [] }), null);
});

test('the card keeps its epistemic flags', () => {
  assert.ok(RATES.bands.every(b => b.provisional === true), 'every band is still provisional');
  assert.equal(RATES.deposit.provisional, true);
  assert.equal(RATES.gst.inclusive, false);
  assert.equal(RATES.gst.rate, 0.18);
  assert.equal(RATES.gst.threshold, 7500);
  assert.equal(fromRate(), 12000);
});

// ── pricing ──────────────────────────────────────────────────────────────

test('rupees in Indian grouping: thousands, then lakhs and crores', () => {
  assert.equal(inr(0), '0');
  assert.equal(inr(999), '999');
  assert.equal(inr(1000), '1,000');
  assert.equal(inr(99999), '99,999');
  assert.equal(inr(100000), '1,00,000');
  assert.equal(inr(174000), '1,74,000');
  assert.equal(inr(12345678), '1,23,45,678');
  assert.equal(inr(1500.6), '1,501');
  assert.equal(inr(-1500), '-1,500');
  assert.equal(rupees(84960), '₹84,960');
});

test('a night is priced by its band and whether it is a weekend night', () => {
  assert.deepEqual({ ...nightlyRate('2026-10-15'), band: nightlyRate('2026-10-15').band.id }, { band: 'shoulder', rate: 20000, weekend: false });
  assert.equal(nightlyRate('2026-10-16').rate, 26000, 'Friday night');
  assert.equal(nightlyRate('2026-12-26').rate, 48000, 'a Christmas-week Saturday');
  assert.equal(nightlyRate('2026-06-01', { ...RATES, bands: [] }), null);
});

test('a shoulder stay: every night, GST on its own line, the deposit', () => {
  const q = quote('2026-10-15', '2026-10-18'); // Thu, Fri, Sat nights
  assert.equal(q.ok, true);
  assert.deepEqual(q.reasons, []);
  assert.equal(q.nightCount, 3);
  assert.deepEqual(q.nights.map(n => [n.date, n.rate, n.weekend]), [['2026-10-15', 20000, false], ['2026-10-16', 26000, true], ['2026-10-17', 26000, true]]);
  assert.equal(q.subtotal, 72000);
  assert.equal(q.gst, 12960);
  assert.equal(q.total, 84960);
  assert.equal(q.gstMode, 'exclusive');
  assert.equal(q.gstRate, 0.18);
  assert.equal(q.deposit, 15000);
  assert.equal(q.minNights, 3);
  assert.deepEqual(q.bands, ['shoulder']);
  assert.equal(q.provisional, true);
});

test('minimum nights: the Christmas band says so by name', () => {
  const q = quote('2026-12-22', '2026-12-25');
  assert.equal(q.ok, false);
  assert.deepEqual(q.reasons, ['The Christmas band has a 4-night minimum.']);
  assert.equal(q.minNights, 4);
  const s = quote('2026-10-20', '2026-10-22');
  assert.deepEqual(s.reasons, ['This band has a 3-night minimum.']);
  // a stay that touches Christmas week takes its minimum
  assert.equal(quote('2026-12-18', '2026-12-21').minNights, 4);
});

test('a stay across bands prices each night by its own band', () => {
  const q = quote('2026-12-18', '2026-12-23'); // 18, 19 shoulder (Fri, Sat); 20, 21, 22 peak (Sun, Mon, Tue)
  assert.deepEqual(q.nights.map(n => n.band), ['shoulder', 'shoulder', 'peak', 'peak', 'peak']);
  assert.equal(q.subtotal, 26000 + 26000 + 40000 * 3);
  assert.deepEqual(q.bands, ['shoulder', 'peak']);
  assert.equal(q.ok, true);
});

test('malformed ranges, long stays and unpriced nights give reasons', () => {
  assert.deepEqual(quote('2026-10-20', '2026-10-20').reasons, ['Departure must be after arrival.']);
  assert.equal(quote('2026-10-20', '2026-10-20').nightCount, 0);
  const bad = quote('2026-02-30', '2026-03-02');
  assert.deepEqual(bad.reasons, ['Dates are not valid.']);
  assert.equal(bad.total, 0);
  assert.ok(quote('2026-10-15', '2026-11-06').reasons.includes('Stays are capped at 21 nights; write to us for longer.'));
  const gap = quote('2026-10-15', '2026-10-19', { ...RATES, bands: [] });
  assert.ok(gap.reasons.includes('Part of this stay is not priced yet.'));
  assert.equal(gap.provisional, true, 'an unpriced night is never presented as settled');
});

test('GST: inclusive mode takes it out of the total; below the threshold there is none', () => {
  const inc = quote('2026-10-15', '2026-10-18', { ...RATES, gst: { ...RATES.gst, inclusive: true } });
  assert.equal(inc.total, 72000);
  assert.equal(inc.gst, Math.round(72000 - 72000 / 1.18)); // 10983
  assert.equal(inc.gst, 10983);
  assert.equal(inc.subtotal + inc.gst, inc.total);
  assert.equal(inc.gstMode, 'inclusive');
  const cheap = { ...RATES, bands: [{ id: 'x', label: 'X', from: '01-01', to: '12-31', weekday: 7000, weekend: 8000, minNights: 1, provisional: false, tone: 'free' }] };
  const q = quote('2026-10-12', '2026-10-15', cheap); // three weekday nights at 7,000: average under 7,500
  assert.equal(q.gst, 0);
  assert.equal(q.total, 21000);
  assert.equal(q.provisional, false);
  const avg = quote('2026-10-15', '2026-10-18', cheap); // 7,000 + 8,000 + 8,000 = 23,000, average 7,667: taxable
  assert.equal(avg.gst, Math.round(23000 * 0.18));
});

// ── availability ─────────────────────────────────────────────────────────

const WINDOW = RATES.window;
const blocks = [
  { arrival: '2026-11-10', departure: '2026-11-14', kind: 'booking' },
  { arrival: '2026-11-13', departure: '2026-11-16', kind: 'hold' },
  { arrival: '2026-11-20', departure: '2026-11-22', kind: 'owner' },
];
const occupied = occupiedNights(blocks);
const ctx = { occupied, today: '2026-10-20', window: WINDOW };

test('occupied nights: departure day is free, and a booking outranks a hold', () => {
  assert.deepEqual([...occupied.keys()].sort(), ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-20', '2026-11-21']);
  assert.equal(occupied.get('2026-11-13'), 'booking', 'overlap: booking wins');
  assert.equal(occupied.get('2026-11-15'), 'hold');
  assert.equal(occupied.get('2026-11-21'), 'owner');
  assert.equal(occupied.has('2026-11-22'), false, 'the owner block leaves on the 22nd');
});

test('each day says whether you can arrive and whether you can leave', () => {
  assert.deepEqual(classifyDay('2026-11-10', ctx), { night: 'taken', arrivalOk: false, departureOk: true }, 'turnover: leave as they arrive');
  assert.deepEqual(classifyDay('2026-11-11', ctx), { night: 'taken', arrivalOk: false, departureOk: false });
  assert.deepEqual(classifyDay('2026-11-15', ctx), { night: 'hold', arrivalOk: false, departureOk: false });
  assert.deepEqual(classifyDay('2026-11-16', ctx), { night: 'free', arrivalOk: true, departureOk: false }, 'arrive the day the hold leaves; the night before is held');
  assert.deepEqual(classifyDay('2026-11-17', ctx), { night: 'free', arrivalOk: true, departureOk: true });
  assert.deepEqual(classifyDay('2026-10-21', ctx), { night: 'past', arrivalOk: false, departureOk: false }, 'inside the two-day lead');
  assert.equal(classifyDay('2026-10-22', ctx).night, 'free', 'two days after today is the first day you can arrive');
  assert.equal(classifyDay('2026-10-10', { ...ctx, today: '2026-09-01' }).night, 'closed', 'before the house opens');
  assert.equal(classifyDay('2027-07-01', ctx).night, 'closed', 'after the calendar closes');
  assert.equal(classifyDay('2026-10-15', { ...ctx, today: '2026-09-01' }).departureOk, false, 'no departure on the opening day');
});

test('ranges are checked against occupancy and the window, with every reason', () => {
  assert.deepEqual(validateRange('2026-11-16', '2026-11-20', ctx), { ok: true, reasons: [] }, 'between two stays, turning over at both ends');
  assert.deepEqual(validateRange('2026-11-05', '2026-11-10', ctx), { ok: true, reasons: [] }, 'leave the day the booking arrives');
  assert.deepEqual(validateRange('2026-11-08', '2026-11-12', ctx).reasons, ['The night of 2026-11-10 is already taken.']);
  assert.deepEqual(validateRange('2026-11-20', '2026-11-18', ctx).reasons, ['Departure must be after arrival.']);
  assert.deepEqual(validateRange('2026-10-01', '2026-10-05', { ...ctx, today: '2026-09-01' }).reasons, ['The house opens for stays from 2026-10-15. Earlier dates are enquiries.']);
  assert.deepEqual(validateRange('2027-06-28', '2027-07-03', ctx).reasons, ['The calendar is open until 2027-06-30.']);
  assert.deepEqual(validateRange('2027-06-28', '2027-07-01', ctx).reasons, [], 'leaving the morning after the last open night is fine');
  assert.deepEqual(validateRange('2026-10-21', '2026-10-25', ctx).reasons, ["Arrivals need at least 2 days' notice."]);
});

test('the furthest you can stay from an arrival stops at the next taken night', () => {
  assert.equal(maxDepartureFrom('2026-11-05', occupied, WINDOW), '2026-11-10');
  assert.equal(maxDepartureFrom('2026-11-16', occupied, WINDOW), '2026-11-20');
  assert.equal(maxDepartureFrom('2026-11-10', occupied, WINDOW), '2026-11-10', 'a taken night: nowhere to go');
  assert.equal(maxDepartureFrom('2027-06-25', new Map(), WINDOW), '2027-07-01', 'the calendar closes');
  assert.equal(maxDepartureFrom('2027-01-10', new Map(), WINDOW, 5), '2027-01-15', 'capped');
});

test('the index re-exports every kernel', () => {
  for (const k of ['toDay', 'monthGrid', 'RATES', 'bandFor', 'quote', 'inr', 'rupees', 'classifyDay', 'validateRange', 'maxDepartureFrom']) assert.equal(typeof all[k] === 'undefined', false, k);
});
