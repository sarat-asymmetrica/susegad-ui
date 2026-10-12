import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  IST, groupIndian, groupWestern, formatMoney, rupees, zoneOffset, istDay, parseWhen, datetimeOf,
  clock, clock24, uses24Hour, formatTime, weekday, formatDate, formatWhen, daysFrom, relativeDay,
} from './intl.core.js';

// ── money ───────────────────────────────────────────────────────────────

test('rupees group lakh and crore, never the Western way', () => {
  const cases = [[0, '₹0'], [7, '₹7'], [999, '₹999'], [1000, '₹1,000'], [99999, '₹99,999'], [100000, '₹1,00,000'], [125000, '₹1,25,000'],
    [1234567, '₹12,34,567'], [12500000, '₹1,25,00,000'], [1000000000, '₹1,00,00,00,000']];
  for (const [n, want] of cases) assert.equal(rupees(n), want, String(n));
});

test('paise appear when asked, or when the amount has them', () => {
  assert.equal(rupees(1250), '₹1,250');
  assert.equal(rupees(1250, { paise: true }), '₹1,250.00');
  assert.equal(rupees(99.5), '₹99.50');
  assert.equal(rupees(0.1 + 0.2), '₹0.30', 'no float noise');
  assert.equal(rupees(1234.05), '₹1,234.05');
  assert.equal(rupees(99.5, { paise: false }), '₹100', 'false rounds to whole rupees');
  assert.equal(rupees(999.6, { paise: false }), '₹1,000');
  assert.equal(rupees(0, { paise: true }), '₹0.00');
});

test('zero, negatives and things that are not numbers', () => {
  assert.equal(rupees(0), '₹0');
  assert.equal(rupees(-500), '-₹500');
  assert.equal(rupees(-125000.5), '-₹1,25,000.50');
  assert.equal(rupees(-0), '₹0');
  assert.equal(rupees(-0.001), '₹0', 'a negative that rounds to nothing has no sign');
  assert.equal(rupees('125000'), '₹1,25,000', 'a numeric string reads');
  for (const bad of [NaN, Infinity, null, undefined, '', 'soon']) assert.equal(rupees(bad), '', String(bad));
});

test('other currencies group in thousands; a word takes a space, a symbol does not', () => {
  assert.equal(formatMoney(1234567, '$'), '$1,234,567');
  assert.equal(formatMoney(1234567, 'USD'), 'USD 1,234,567');
  assert.equal(formatMoney(1234567, 'Rs.'), 'Rs. 12,34,567', 'Rs. and INR are the rupee');
  assert.equal(formatMoney(1234567, 'INR'), 'INR 12,34,567');
});

test('groupIndian keeps signs and fractions, and refuses what it cannot read', () => {
  assert.equal(groupIndian(-125000), '-1,25,000');
  assert.equal(groupIndian(125000.5), '1,25,000.5');
  assert.equal(groupIndian('1234'), '1,234');
  assert.equal(groupIndian('  12,00,000 '), null);
  assert.equal(groupIndian(NaN), null);
  assert.equal(groupWestern('1234567'), '1,234,567');
});

// ── IST ─────────────────────────────────────────────────────────────────

const at = s => new Date(s).getTime();

test('IST has no daylight saving and is five and a half hours ahead', () => {
  assert.equal(zoneOffset(at('2026-01-01T00:00:00Z')), 5.5 * 3600000);
  assert.equal(zoneOffset(at('2026-07-01T00:00:00Z')), 5.5 * 3600000);
});

test('istDay: the IST calendar day, either side of midnight', () => {
  assert.equal(istDay(at('2026-10-05T18:29:59Z')), '2026-10-05'); // 23:59:59 IST
  assert.equal(istDay(at('2026-10-05T18:30:00Z')), '2026-10-06'); // 00:00:00 IST
  assert.equal(istDay(new Date('2026-12-31T20:00:00Z')), '2027-01-01', 'across a year');
  assert.equal(istDay(at('2028-02-28T19:00:00Z')), '2028-02-29', 'a leap day');
  assert.equal(istDay(NaN), '');
  assert.equal(istDay(new Date('nonsense')), '');
});

test('times: 12 hour, 24 hour, and the locale chooses', () => {
  const t = at('2026-10-06T17:30:00Z'); // 11 pm IST
  assert.equal(clock(t), '11 pm');
  assert.equal(clock24(t), '23:00');
  assert.equal(clock(at('2026-10-06T06:30:00Z')), '12 noon');
  assert.equal(clock(at('2026-10-05T18:30:00Z')), '12 am');
  assert.equal(clock(at('2026-10-06T01:00:00Z')), '6:30 am');
  assert.equal(clock24(at('2026-10-05T18:30:00Z')), '00:00');
  assert.equal(uses24Hour('en-IN'), false);
  assert.equal(uses24Hour('de-DE'), true);
  assert.equal(formatTime(t), '11 pm', 'en-IN says 11 pm by default');
  assert.equal(formatTime(t, { locale: 'de-DE' }), '23:00');
  assert.equal(formatTime(t, { hour12: false }), '23:00');
  assert.equal(formatTime(t, { locale: 'de-DE', hour12: true }), '11 pm');
});

test('dates: weekday, day and month in IST, not the machine', () => {
  const t = at('2026-10-04T20:00:00Z'); // 1:30 am Mon 5 Oct in IST, still Sun 4 Oct in UTC
  assert.equal(weekday(t), 'Mon');
  assert.equal(weekday(t, IST, { long: true }), 'Monday');
  assert.equal(formatDate(t), 'Mon 5 Oct');
  assert.equal(formatDate(t, IST, { year: true }), 'Mon 5 Oct 2026');
  assert.equal(formatDate(t, IST, { weekday: false }), '5 Oct');
  assert.equal(formatDate(NaN), '');
  assert.equal(formatWhen(at('2026-10-04T05:30:00Z'), at('2026-10-04T07:30:00Z')), 'Sun 4 Oct, 11 am to 1 pm');
  assert.equal(formatWhen(at('2026-10-03T14:30:00Z'), at('2026-10-03T19:30:00Z')), 'Sat 3 Oct, 8 pm to Sun 4 Oct, 1 am');
});

test('parseWhen reads a wall clock in IST and refuses a day that is not on the calendar', () => {
  assert.equal(parseWhen('2026-10-04T11:00'), at('2026-10-04T05:30:00Z'));
  assert.equal(parseWhen('2026-10-04T11:00Z'), at('2026-10-04T11:00:00Z'));
  assert.equal(parseWhen('2026-10-04'), at('2026-10-03T18:30:00Z'));
  assert.ok(Number.isNaN(parseWhen('2026-02-30')));
  assert.equal(datetimeOf(at('2026-10-04T05:30:00Z')), '2026-10-04T11:00:00+05:30');
  assert.equal(datetimeOf(at('2026-10-04T05:30:00Z'), 'America/New_York'), '2026-10-04T01:30:00-04:00');
});

test('relative days count calendar days in IST: 11 pm to 1 am is tomorrow', () => {
  const now = at('2026-10-06T17:30:00Z'); // 11 pm Tue 6 Oct IST
  assert.equal(relativeDay(now, now), 'today');
  assert.equal(relativeDay(now, now + 2 * 3600000), 'tomorrow', 'two hours later but the next calendar day');
  assert.equal(relativeDay(now, now - 22 * 3600000), 'today');
  assert.equal(relativeDay(now, now - 24 * 3600000), 'yesterday');
  assert.equal(relativeDay(now, now + 5 * 86400000), 'in 5 days');
  assert.equal(relativeDay(now, now - 3 * 86400000), '3 days ago');
  assert.equal(daysFrom(now, now + 86400000), 1);
});

// ── the machine's zone and locale must not matter ───────────────────────

const MODULE = pathToFileURL(fileURLToPath(new URL('./intl.core.js', import.meta.url))).href;
const PROBE = `
  import * as m from ${JSON.stringify(MODULE)};
  const t = Date.parse('2026-10-05T19:00:00Z'); // 00:30 Tue 6 Oct in IST, 15:00 Mon 5 Oct in New York
  console.log(JSON.stringify([m.istDay(t), m.formatDate(t), m.clock(t), m.clock24(t), m.relativeDay(Date.parse('2026-10-05T10:00:00Z'), t), m.rupees(125000), m.formatTime(t), Intl.DateTimeFormat().resolvedOptions().timeZone, new Date(t).getDate()]));
`;
const run = env => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', PROBE], { env: { ...process.env, ...env }, encoding: 'utf8' }));

test('the same answers when the machine is in New York, London, Auckland or Kolkata, in any locale', () => {
  const want = ['2026-10-06', 'Tue 6 Oct', '12:30 am', '00:30', 'tomorrow', '₹1,25,000', '12:30 am'];
  for (const [TZ, LANG] of [['America/New_York', 'en_US.UTF-8'], ['Europe/London', 'en_GB.UTF-8'], ['Pacific/Auckland', 'de_DE.UTF-8'], ['Asia/Kolkata', 'en_IN.UTF-8'], ['UTC', 'C']]) {
    assert.deepEqual(run({ TZ, LANG, LC_ALL: LANG }).slice(0, 7), want, TZ);
  }
});

test('the control: the child really ran in the zone we set, so the machine-local day differs while istDay holds', () => {
  const ny = run({ TZ: 'America/New_York' }), nz = run({ TZ: 'Pacific/Auckland' });
  assert.equal(ny[7], 'America/New_York');
  assert.equal(nz[7], 'Pacific/Auckland');
  assert.notEqual(ny[8], nz[8], 'the local day of the month is 5 in New York and 6 in Auckland');
  assert.equal(ny[0], nz[0], 'and istDay is the same in both');
});

// ── rounding, size and bad instants ─────────────────────────────────────

test('half a paisa rounds the way Intl does, not the way a float falls', () => {
  assert.equal(rupees(1.005, { paise: true }), '₹1.01');
  assert.equal(rupees(0.145), '₹0.15');
  assert.equal(rupees(2.675), '₹2.68');
  assert.equal(rupees(0.285), '₹0.29');
  assert.equal(rupees(0.005), '₹0.01');
  assert.equal(rupees(-1.005), '-₹1.01');
  assert.equal(rupees(1e-7), '₹0');
});

test('fuzz: two decimals agree with Intl.NumberFormat en-IN over thousands of values', () => {
  const f = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let bad = [];
  for (let i = 0; i < 6000; i++) {
    const cents = Math.floor(rnd() * 1e7), v = i % 2 ? cents / 100 + 0.005 : cents / 100 + 0.0049 * rnd(); // half-paisa cases and the rest
    const want = '₹' + f.format(v), got = rupees(v, { paise: true });
    if (want !== got) bad.push([v, want, got]);
  }
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} differ`);
});

test('numbers too big to be money give an empty string, not garbage', () => {
  assert.equal(rupees(1e21), '');
  assert.equal(rupees(1e15 + 0.5), '');
  assert.equal(groupIndian(1e21), null);
  assert.equal(rupees(9e13), '₹9,00,00,00,00,00,000');
});

test('a bad instant gives an empty string from every time function', () => {
  for (const f of [clock, clock24, weekday, datetimeOf, relativeDay, formatWhen, formatTime]) assert.equal(f(NaN, NaN), '', f.name);
  assert.equal(clock(new Date('nope')), '');
});

test('uses24Hour answers the same twice (cached by locale)', () => {
  assert.equal(uses24Hour('de-DE'), uses24Hour('de-DE'));
  assert.equal(uses24Hour('not a locale'), false);
});
