import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZONE, KINDS, STRINGS, zoneOffset, wall, parseWhen, datetimeOf, clock, formatWhen, eventPhase, nextChange,
  awayInWords, seatsOf, describeEvent, partitionEvents, nextChangeOf, perforation, lean,
} from './event.core.js';

const IST = s => parseWhen(s, ZONE);
const START = IST('2026-10-04T11:00'), END = IST('2026-10-04T13:00');

// ── zones and parsing ────────────────────────────────────────────────────

test('Asia/Kolkata is five and a half hours ahead of UTC, all year', () => {
  assert.equal(zoneOffset(Date.UTC(2026, 0, 1), ZONE), 5.5 * 3600000);
  assert.equal(zoneOffset(Date.UTC(2026, 6, 1), ZONE), 5.5 * 3600000);
});

test('a time with no offset is the wall clock in the venue\'s zone', () => {
  assert.equal(START, Date.UTC(2026, 9, 4, 5, 30));
  assert.equal(parseWhen('2026-10-04 11:00', ZONE), START);
  assert.equal(parseWhen('2026-10-04T11:00:00', ZONE), START);
});

test('an explicit offset wins over the zone', () => {
  assert.equal(parseWhen('2026-10-04T05:30:00Z', ZONE), START);
  assert.equal(parseWhen('2026-10-04T11:00+05:30', 'Europe/Lisbon'), START);
  assert.equal(parseWhen('2026-10-03T20:00-09:30', ZONE), Date.UTC(2026, 9, 4, 5, 30));
});

test('a date alone is midnight in the zone', () => {
  assert.equal(parseWhen('2026-10-04', ZONE), Date.UTC(2026, 9, 3, 18, 30));
});

test('a zone with summer time parses either side of the change', () => {
  assert.equal(parseWhen('2026-10-24T12:00', 'Europe/Lisbon'), Date.UTC(2026, 9, 24, 11, 0), 'summer time, UTC+1');
  assert.equal(parseWhen('2026-10-26T12:00', 'Europe/Lisbon'), Date.UTC(2026, 9, 26, 12, 0), 'winter time, UTC+0');
});

test('things that are not dates are NaN, and so is a day not on the calendar', () => {
  for (const bad of ['', null, undefined, 'soon', '4 Oct', '2026-13-01', '2026-02-30', '2026-10-04T25:00', '2026-10-04T11:61']) {
    assert.ok(Number.isNaN(parseWhen(bad)), String(bad));
  }
});

test('datetimeOf writes the offset a <time> wants', () => {
  assert.equal(datetimeOf(START), '2026-10-04T11:00:00+05:30');
  assert.equal(datetimeOf(START, 'Europe/Lisbon'), '2026-10-04T06:30:00+01:00');
  assert.equal(parseWhen(datetimeOf(START)), START, 'it reads back');
});

test('wall: the weekday and day of the zone, not of UTC', () => {
  const w = wall(Date.UTC(2026, 9, 3, 19, 0), ZONE); // 3 Oct 19:00 UTC is 4 Oct 00:30 in Goa
  assert.deepEqual([w.y, w.m, w.d, w.h, w.min, w.wd], [2026, 10, 4, 0, 30, 0]);
});

// ── words ────────────────────────────────────────────────────────────────

test('the date, the way people say it', () => {
  assert.equal(formatWhen(START, END), 'Sun 4 Oct, 11 am to 1 pm');
  assert.equal(formatWhen(START, NaN), 'Sun 4 Oct, 11 am');
  assert.equal(formatWhen(IST('2026-10-09T19:30'), IST('2026-10-09T22:00')), 'Fri 9 Oct, 7:30 pm to 10 pm');
  assert.equal(formatWhen(IST('2026-12-31T09:00'), IST('2026-12-31T12:00')), 'Thu 31 Dec, 9 am to 12 noon');
  assert.equal(formatWhen(START, END, ZONE, { year: true }), 'Sun 4 Oct 2026, 11 am to 1 pm');
});

test('midnight and noon say what they are', () => {
  assert.equal(clock(IST('2026-10-04T00:00')), '12 am');
  assert.equal(clock(IST('2026-10-04T00:05')), '12:05 am');
  assert.equal(clock(IST('2026-10-04T12:00')), '12 noon');
  assert.equal(clock(IST('2026-10-04T12:30')), '12:30 pm');
  assert.equal(clock(IST('2026-10-04T23:59')), '11:59 pm');
});

test('an evening that runs past midnight names both days', () => {
  assert.equal(formatWhen(IST('2026-10-03T20:00'), IST('2026-10-04T01:00')), 'Sat 3 Oct, 8 pm to Sun 4 Oct, 1 am');
});

test('an end that is not after the start is ignored', () => {
  assert.equal(formatWhen(START, START), 'Sun 4 Oct, 11 am');
  assert.equal(formatWhen(START, START - 1), 'Sun 4 Oct, 11 am');
});

test('the kinds have names', () => {
  assert.deepEqual(Object.keys(KINDS), ['workshop', 'supper-club', 'pop-up', 'class']);
});

// ── the clock: four phases ───────────────────────────────────────────────

const at = s => IST(s);
test('upcoming, today, on now, past: one event, walked through its day', () => {
  const p = t => eventPhase(at(t), START, END);
  assert.equal(p('2026-10-02T09:00'), 'upcoming');
  assert.equal(p('2026-10-03T23:59:59'), 'upcoming', 'the last second before its day');
  assert.equal(p('2026-10-04T00:00'), 'today', 'midnight starts the day');
  assert.equal(p('2026-10-04T10:59:59'), 'today');
  assert.equal(p('2026-10-04T11:00'), 'now', 'the start is inclusive');
  assert.equal(p('2026-10-04T12:59:59'), 'now');
  assert.equal(p('2026-10-04T13:00'), 'past', 'the end is not');
  assert.equal(p('2026-10-05T09:00'), 'past');
});

test('the venue\'s midnight, not UTC\'s: 00:30 in Goa is still the evening before in UTC', () => {
  const lateNightUtc = Date.UTC(2026, 9, 3, 19, 0); // 4 Oct 00:30 IST
  assert.equal(eventPhase(lateNightUtc, START, END), 'today');
  assert.equal(eventPhase(Date.UTC(2026, 9, 3, 18, 29, 59), START, END), 'upcoming', 'a second before IST midnight');
  assert.equal(eventPhase(Date.UTC(2026, 9, 3, 18, 30, 0), START, END), 'today');
});

test('a visitor\'s own zone makes no difference: the clock is one instant', () => {
  // the same instant, asked about for a Lisbon venue and a Goa venue, gives each its own day
  const now = Date.UTC(2026, 9, 3, 19, 0);
  const goa = eventPhase(now, IST('2026-10-04T11:00'), IST('2026-10-04T13:00'), ZONE);
  const lisbon = eventPhase(now, parseWhen('2026-10-04T11:00', 'Europe/Lisbon'), parseWhen('2026-10-04T13:00', 'Europe/Lisbon'), 'Europe/Lisbon');
  assert.equal(goa, 'today');
  assert.equal(lisbon, 'upcoming');
});

test('an evening across midnight is on now after midnight, and over at its end', () => {
  const s = at('2026-10-03T20:00'), e = at('2026-10-04T01:00');
  assert.equal(eventPhase(at('2026-10-03T19:59'), s, e), 'today');
  assert.equal(eventPhase(at('2026-10-04T00:30'), s, e), 'now');
  assert.equal(eventPhase(at('2026-10-04T01:00'), s, e), 'past');
});

test('with no end it is today all day, never on now, and over when the day is', () => {
  const p = t => eventPhase(at(t), START, NaN);
  assert.equal(p('2026-10-03T23:59'), 'upcoming');
  assert.equal(p('2026-10-04T00:00'), 'today');
  assert.equal(p('2026-10-04T15:00'), 'today');
  assert.equal(p('2026-10-04T23:59:59'), 'today');
  assert.equal(p('2026-10-05T00:00'), 'past');
});

test('no readable start: unknown, whatever the time', () => {
  assert.equal(eventPhase(Date.now(), NaN, NaN), 'unknown');
  assert.equal(eventPhase(NaN, START, END), 'unknown');
});

test('nextChange: the next phase boundary, in order, then nothing', () => {
  const n = t => nextChange(at(t), START, END);
  assert.equal(n('2026-10-02T09:00'), at('2026-10-04T00:00'));
  assert.equal(n('2026-10-04T00:00'), at('2026-10-04T11:00'));
  assert.equal(n('2026-10-04T11:00'), at('2026-10-04T13:00'));
  assert.equal(n('2026-10-04T13:00'), Infinity);
  assert.equal(nextChange(at('2026-10-04T12:00'), START, NaN), at('2026-10-05T00:00'), 'with no end, the day\'s own end');
  assert.equal(nextChange(0, NaN, NaN), Infinity);
});

test('awayInWords: tomorrow, days, weeks, then the date', () => {
  const w = t => awayInWords(at(t), START);
  assert.equal(w('2026-10-03T23:00'), 'Tomorrow', 'by the calendar, not by 24 hours');
  assert.equal(w('2026-10-02T09:00'), 'In 2 days');
  assert.equal(w('2026-09-21T09:00'), 'In 13 days');
  assert.equal(w('2026-09-20T09:00'), 'In 2 weeks');
  assert.equal(w('2026-07-01T09:00'), 'On 4 Oct');
  assert.equal(w('2025-07-01T09:00'), 'On 4 Oct 2026');
});

// ── seats: never invented ────────────────────────────────────────────────

test('seats are known only when someone gave a whole number', () => {
  for (const none of [undefined, null, '', '  ', 'lots', '-1', '2.5', '1e2', 'NaN']) {
    assert.deepEqual(seatsOf(none), { known: false, n: null, soldOut: false, line: '' }, String(none));
  }
  assert.equal(seatsOf('4').line, '4 seats left');
  assert.equal(seatsOf('1').line, '1 seat left');
  assert.equal(seatsOf(' 12 ').n, 12);
});

test('sold out means seats-left="0" and nothing else', () => {
  assert.equal(seatsOf('0').soldOut, true);
  assert.equal(seatsOf('0').line, 'Sold out');
  assert.equal(seatsOf('1').soldOut, false);
  assert.equal(seatsOf(null).soldOut, false);
});

// ── what a card shows ────────────────────────────────────────────────────

const card = (now, extra = {}) => describeEvent(at(now), { start: START, end: END, ...extra });

test('upcoming: the booking shows, and the words say how far off', () => {
  const d = card('2026-10-02T09:00');
  assert.equal(d.phase, 'upcoming');
  assert.equal(d.status, 'In 2 days');
  assert.equal(d.showCta, true);
  assert.equal(d.when, 'Sun 4 Oct, 11 am to 1 pm');
  assert.equal(d.datetime, '2026-10-04T11:00:00+05:30');
  assert.equal(d.seatsLine, '', 'no number given, so no seats line, ever');
});

test('today and on now say the time', () => {
  assert.equal(card('2026-10-04T08:00').status, 'Today at 11 am');
  assert.equal(card('2026-10-04T11:30').status, 'On now, until 1 pm');
  assert.equal(describeEvent(at('2026-10-04T15:00'), { start: START }).status, 'Today from 11 am');
});

test('past: no call to action, and it says so; no seats either', () => {
  const d = card('2026-10-05T09:00', { seatsLeft: '3' });
  assert.equal(d.phase, 'past');
  assert.equal(d.showCta, false);
  assert.equal(d.status, STRINGS.over);
  assert.equal(d.seatsLine, '', 'seats on a finished event would be a lie');
  assert.equal(d.soldOut, false, 'a finished event is over, not sold out');
});

test('sold out: only with seats-left="0", and the booking goes', () => {
  const d = card('2026-10-02T09:00', { seatsLeft: '0' });
  assert.equal(d.soldOut, true);
  assert.equal(d.showCta, false);
  assert.equal(d.seatsLine, 'Sold out');
  assert.equal(card('2026-10-02T09:00', { seatsLeft: '' }).soldOut, false);
  assert.equal(card('2026-10-02T09:00', { seatsLeft: 'full' }).soldOut, false, 'a word is not a number');
});

test('a seats line shows only when a number was given', () => {
  assert.equal(card('2026-10-02T09:00', { seatsLeft: '6' }).seatsLine, '6 seats left');
  assert.equal(card('2026-10-02T09:00').seatsLine, '');
});

test('an unreadable date: no phase is claimed and the booking is left alone', () => {
  const d = describeEvent(at('2026-10-02T09:00'), { start: NaN });
  assert.equal(d.phase, 'unknown');
  assert.equal(d.showCta, true);
  assert.equal(d.status, '');
  assert.equal(d.when, '');
  assert.equal(d.nextAt, Infinity);
});

test('the year appears only when it is not this year', () => {
  assert.equal(describeEvent(at('2026-10-02T09:00'), { start: at('2027-01-09T10:00') }).when, 'Sat 9 Jan 2027, 10 am');
  assert.equal(describeEvent(at('2026-10-02T09:00'), { start: START }).when, 'Sun 4 Oct, 11 am');
});

// ── a calendar ───────────────────────────────────────────────────────────

const ev = (name, s, e) => ({ name, start: IST(s), end: e ? IST(e) : NaN });

test('partition: soonest first, the past moved aside, most recent past first', () => {
  const items = [
    ev('later', '2026-10-18T11:00', '2026-10-18T13:00'),
    ev('old', '2026-08-02T11:00', '2026-08-02T13:00'),
    ev('soon', '2026-10-04T11:00', '2026-10-04T13:00'),
    ev('recent', '2026-09-27T11:00', '2026-09-27T13:00'),
    ev('middle', '2026-10-09T19:00', '2026-10-09T22:00'),
  ];
  const { upcoming, past } = partitionEvents(items, at('2026-10-02T09:00'));
  assert.deepEqual(upcoming.map(e => e.name), ['soon', 'middle', 'later']);
  assert.deepEqual(past.map(e => e.name), ['recent', 'old']);
});

test('partition moves an event the moment its end passes, not before', () => {
  const items = [ev('a', '2026-10-04T11:00', '2026-10-04T13:00'), ev('b', '2026-10-09T19:00', '2026-10-09T22:00')];
  assert.deepEqual(partitionEvents(items, at('2026-10-04T12:59:59')).upcoming.map(e => e.name), ['a', 'b']);
  assert.deepEqual(partitionEvents(items, at('2026-10-04T13:00')).upcoming.map(e => e.name), ['b']);
});

test('partition: an empty calendar, and one with nothing to come', () => {
  assert.deepEqual(partitionEvents([], Date.now()), { upcoming: [], past: [] });
  const r = partitionEvents([ev('gone', '2026-01-04T11:00', '2026-01-04T13:00')], at('2026-10-02T09:00'));
  assert.equal(r.upcoming.length, 0);
  assert.equal(r.past.length, 1);
});

test('partition: equal starts keep the order they were given, an unreadable date goes last', () => {
  const items = [ev('x', '2026-10-09T19:00'), { name: 'undated', start: NaN }, ev('y', '2026-10-09T19:00'), ev('z', '2026-10-05T19:00')];
  assert.deepEqual(partitionEvents(items, at('2026-10-02T09:00')).upcoming.map(e => e.name), ['z', 'x', 'y', 'undated']);
});

test('nextChangeOf: the soonest of all of them', () => {
  const items = [ev('a', '2026-10-04T11:00', '2026-10-04T13:00'), ev('b', '2026-10-09T19:00', '2026-10-09T22:00')];
  assert.equal(nextChangeOf(items, at('2026-10-02T09:00')), at('2026-10-04T00:00'));
  assert.equal(nextChangeOf(items, at('2026-10-04T13:00')), at('2026-10-09T00:00'));
  assert.equal(nextChangeOf([], 0), Infinity);
});

// ── the ticket ───────────────────────────────────────────────────────────

test('the perforation: holes along the tear, inside the ends, the same every time', () => {
  const a = perforation(300, 'x'), b = perforation(300, 'x');
  assert.deepEqual(a, b);
  assert.ok(a.length > 20);
  assert.ok(a.every(h => h.at >= 11 && h.at <= 289 && h.r > 1 && h.r < 2));
  assert.deepEqual(a.map(h => h.at), [...a.map(h => h.at)].sort((p, q) => p - q), 'in order');
  assert.notDeepEqual(a, perforation(300, 'y'), 'another seed, another wheel');
  assert.deepEqual(perforation(20, 'x'), [], 'too short to perforate');
});

test('the lean is small, signed and seeded', () => {
  assert.equal(lean('a'), lean('a'));
  for (const s of ['a', 'b', 'c', 'd', 'e']) assert.ok(Math.abs(lean(s)) >= 0.2 && Math.abs(lean(s)) <= 0.7);
});
