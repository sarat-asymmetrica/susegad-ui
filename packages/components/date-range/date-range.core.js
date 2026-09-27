// <sg-date-range>, the pure core: which days can be picked, what each day is
// called, where the keyboard goes, and the season runs for the ribbon. No DOM;
// runs in Node. Availability and prices come from the booking kernels, so the
// calendar and the quote can never disagree.

import { addDays, addMonths, diffDays, eachDay, longDate, shortDate, weekday, ym, daysInMonth } from '../../kernels/booking/dates.js';
import { classifyDay, maxDepartureFrom, validateRange } from '../../kernels/booking/availability.js';
import { bandFor } from '../../kernels/booking/rates.js';
import { nightlyRate, rupees, quote } from '../../kernels/booking/pricing.js';

/** Every word the calendar shows or says. Kathakar edits these. */
export const STRINGS = {
  prev: 'Previous month',
  next: 'Next month',
  pickArrival: 'Pick your arrival.',
  pickDeparture: d => `Arriving ${d}. Now pick your departure.`,
  picked: n => `${n} ${n === 1 ? 'night' : 'nights'}. Pick a new arrival to start again.`,
  arrival: 'your arrival',
  departure: 'your departure',
  free: (price, peak) => `free night${price ? `, ${price}` : ''}${peak ? ', Christmas week' : ''}`,
  taken: 'taken',
  hold: 'on hold for another guest',
  owner: 'closed by the house',
  before: d => `before the house opens on ${d}`,
  after: 'not open for booking yet',
  past: n => `too soon, arrivals need ${n} ${n === 1 ? "day's" : "days'"} notice`,
  canLeave: 'you can leave on this day',
  legend: { free: 'Free night', peak: 'Christmas week', taken: 'Taken', dep: 'Departure only' },
  seasons: 'Seasons and rates',
  seasonCols: ['Season', 'When', 'A night', 'Minimum'],
  nights: n => `${n} ${n === 1 ? 'night' : 'nights'}`,
  // The booking kernels speak the portal's language (ISO dates, "bands"); these are the words guests read.
  reasons: {
    order: 'Your departure needs to be after your arrival.',
    invalid: 'Those dates are not real dates. Check the day and the month.',
    opens: d => `The house opens for stays on ${d}. For earlier dates, send us an enquiry.`,
    until: d => `Bookings are open until ${d}.`,
    notice: n => `Arrivals need at least ${n} ${n === 1 ? "day's" : "days'"} notice.`,
    taken: d => `The night of ${d} is already taken.`,
    christmas: n => `Stays over Christmas week are at least ${n} nights.`,
    minimum: n => `Stays at this time of year are at least ${n} nights.`,
    longest: n => `Stays are up to ${n} nights. Write to us for a longer one.`,
    unpriced: 'Part of this stay does not have a price yet. Write to us about it.',
  },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** '2026-11-13' as a guest would say it: '13 November', with the year when asked. */
export const dayMonth = (iso, year = false) => `${+iso.slice(8)} ${MONTHS[+iso.slice(5, 7) - 1]}${year ? ` ${iso.slice(0, 4)}` : ''}`;

// Each kernel reason, recognised by its shape, and the words a guest reads instead.
const R = STRINGS.reasons;
const RULES = [
  [/^Departure must be after arrival\.$/, () => R.order],
  [/^Dates are not valid\.$/, () => R.invalid],
  [/^The house opens for stays from (\d{4}-\d{2}-\d{2})\./, m => R.opens(dayMonth(m[1], true))],
  [/^The calendar is open until (\d{4}-\d{2}-\d{2})\.$/, m => R.until(dayMonth(m[1], true))],
  [/^Arrivals need at least (\d+) days' notice\.$/, m => R.notice(+m[1])],
  [/^The night of (\d{4}-\d{2}-\d{2}) is already taken\.$/, m => R.taken(dayMonth(m[1]))],
  [/^The Christmas band has a (\d+)-night minimum\.$/, m => R.christmas(+m[1])],
  [/^This band has a (\d+)-night minimum\.$/, m => R.minimum(+m[1])],
  [/^Stays are capped at (\d+) nights/, m => R.longest(+m[1])],
  [/^Part of this stay is not priced yet\.$/, () => R.unpriced],
];

/** A kernel reason in people's words. Anything not recognised passes through unchanged. */
export function inWords(reason) {
  for (const [re, say] of RULES) { const m = re.exec(reason); if (m) return say(m); }
  return reason;
}

/**
 * What one day is: its night (free, taken, hold, owner, past, closed), whether
 * you can arrive or leave on it, and its price and band when rates are known.
 * @param {string} iso @param {{ occupied: Map<string,string>, today: string, window: object }} ctx @param {object} [rates]
 */
export function dayInfo(iso, ctx, rates) {
  const c = classifyDay(iso, ctx);
  const nr = rates ? nightlyRate(iso, rates) : null;
  return { ...c, rate: nr?.rate ?? 0, band: nr?.band ?? null, peak: nr?.band?.tone === 'peak' };
}

/** Can `iso` be the departure for an arrival on `arr`? Turnover days count; taken nights in between do not. */
export function canDepart(arr, iso, ctx, cap) {
  if (!arr || iso <= arr) return false;
  const reach = maxDepartureFrom(arr, ctx.occupied, ctx.window, cap ?? ctx.window.maxNights ?? 30);
  return iso <= reach && (classifyDay(iso, ctx).departureOk || iso === reach);
}

/**
 * Pick a day. The first pick is the arrival; the next valid later day is the
 * departure; a pick after that starts again. Returns the new { arr, dep }, or
 * null when the day cannot be picked now.
 */
export function pick({ arr, dep }, iso, ctx) {
  if (arr && !dep && canDepart(arr, iso, ctx)) return { arr, dep: iso };
  if (iso === arr && !dep) return null;
  if (classifyDay(iso, ctx).arrivalOk) return { arr: iso, dep: null };
  return null;
}

/** Can this day be pressed at all right now? */
export const selectable = ({ arr, dep }, iso, ctx) => iso === arr || classifyDay(iso, ctx).arrivalOk || (!!arr && !dep && canDepart(arr, iso, ctx));

/** A cell's price, short: 28k, 70k, 1.2L. The full figure, in lakh grouping, is in its label. */
export function shortPrice(n) {
  if (!n) return '';
  if (n >= 100000) return `${+(n / 100000).toFixed(n % 100000 ? 1 : 0)}L`;
  return `${Math.round(n / 1000)}k`;
}

/** The accessible name of a day: its date, your choice, and what it is. */
export function labelFor(iso, info, { arr, dep }, win) {
  const p = [longDate(iso)];
  if (iso === arr) p.push(STRINGS.arrival);
  if (iso === dep) p.push(STRINGS.departure);
  if (info.night === 'free') p.push(STRINGS.free(info.rate ? rupees(info.rate) : '', info.peak));
  else if (info.night === 'closed') p.push(iso < win.openFrom ? STRINGS.before(longDate(win.openFrom)) : STRINGS.after);
  else if (info.night === 'past') p.push(STRINGS.past(win.minLeadDays));
  else p.push(STRINGS[info.night]);
  if (info.night !== 'free' && info.departureOk) p.push(STRINGS.canLeave);
  return p.join(', ');
}

/** The hint above the grid, which is also read out as it changes. */
export const hintFor = ({ arr, dep }) => (!arr ? STRINGS.pickArrival : !dep ? STRINGS.pickDeparture(shortDate(arr)) : STRINGS.picked(diffDays(arr, dep)));

/**
 * Where focus goes for a key, per the APG date picker grid: arrows by a day or
 * a week, Home and End to the ends of the week, Page Up and Page Down by a
 * month (by a year with Shift), keeping the day of the month where it can.
 */
export function moveFocus(iso, key, shift = false) {
  const byMonths = n => {
    const m = addMonths(ym(iso), n), [y, mo] = m.split('-').map(Number);
    return `${m}-${String(Math.min(+iso.slice(8), daysInMonth(y, mo))).padStart(2, '0')}`;
  };
  switch (key) {
    case 'ArrowLeft': return addDays(iso, -1);
    case 'ArrowRight': return addDays(iso, 1);
    case 'ArrowUp': return addDays(iso, -7);
    case 'ArrowDown': return addDays(iso, 7);
    case 'Home': return addDays(iso, -weekday(iso));
    case 'End': return addDays(iso, 6 - weekday(iso));
    case 'PageUp': return byMonths(shift ? -12 : -1);
    case 'PageDown': return byMonths(shift ? 12 : 1);
    default: return null;
  }
}

/** The first of the two months on show, so that `iso` is visible, kept within [first, last]. */
export function viewFor(iso, view, first, last) {
  let v = view;
  if (ym(iso) < v) v = ym(iso);
  else if (ym(iso) > addMonths(v, 1)) v = addMonths(ym(iso), -1);
  const lastStart = addMonths(last, -1) < first ? first : addMonths(last, -1);
  return v < first ? first : v > lastStart ? lastStart : v;
}

/**
 * The year ahead as contiguous runs for the ribbon and the season table:
 * { kind: band id | 'before' | 'after', band, from, to }.
 */
export function seasonRuns(today, rates) {
  const win = rates.window, start = `${ym(today)}-01`, end = addDays(`${addMonths(ym(today), 13)}-01`, -1);
  const runs = [];
  for (const d of eachDay(start, addDays(end, 1))) {
    const b = bandFor(d, rates);
    const kind = d < win.openFrom ? 'before' : d > win.openUntil ? 'after' : b?.id ?? 'unpriced';
    const last = runs.at(-1);
    if (last && last.kind === kind) last.to = d;
    else runs.push({ kind, band: b, from: d, to: d });
  }
  return { start, end, days: diffDays(start, end) + 1, runs };
}

/** Rows for the plain season table: one per band, with every stretch of the year it covers. */
export function seasonRows(today, rates) {
  const { runs } = seasonRuns(today, rates), rows = new Map();
  for (const r of runs) {
    if (!r.band || r.kind === 'before' || r.kind === 'after') continue;
    const row = rows.get(r.kind) ?? { kind: r.kind, band: r.band, when: [] };
    row.when.push(`${shortDate(r.from)} to ${shortDate(r.to)}`);
    rows.set(r.kind, row);
  }
  return [...rows.values()].map(r => ({
    kind: r.kind, label: r.band.label, when: r.when.join(', '), provisional: !!r.band.provisional,
    price: `${rupees(r.band.weekday)} to ${rupees(r.band.weekend)}`, minimum: STRINGS.nights(r.band.minNights),
  }));
}

/**
 * Why a range cannot be booked, in words, from both kernels: occupancy and the
 * window, then the rate card's rules (minimum nights, the longest stay).
 */
export function rangeReasons(arr, dep, ctx, rates) {
  if (!arr || !dep) return [];
  const a = validateRange(arr, dep, ctx).reasons;
  const q = rates ? quote(arr, dep, rates).reasons.filter(r => !a.includes(r)) : [];
  return [...a, ...q].map(inWords);
}
