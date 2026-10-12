// Event: the pure core, shared by <sg-event-card> and <sg-event-list>. Runs in Node.
//
// An event card is only honest while it knows what time it is. This works out,
// from "now", the start and the end, which of four things is true (coming up,
// today, on now, over), says it in words, writes the date the way people say it
// ("Sun 4 Oct, 11 am to 1 pm"), and decides what may show: a seats line only
// when someone gave a number, a call to action only while there is something to
// book. Times are wall-clock times in a named zone (Asia/Kolkata unless told
// otherwise), so a visitor in another zone still sees the venue's own clock.

import { rng } from '../../engine/src/rng.js';
import { IST, MONTHS, zoneOffset, wall, parseWhen, datetimeOf, clock, formatWhen } from '../../core/intl.core.js';

export const ZONE = IST;
export const KINDS = { workshop: 'Workshop', 'supper-club': 'Supper club', 'pop-up': 'Pop-up', class: 'Class' };

export const STRINGS = {
  over: 'This one has happened. Booking is closed.',
  tomorrow: 'Tomorrow',
  inDays: n => `In ${n} days`,
  inWeeks: n => `In ${n} weeks`,
  today: at => `Today at ${at}`,
  todayFrom: at => `Today from ${at}`,
  on: until => (until ? `On now, until ${until}` : 'On now'),
  soldOut: 'Sold out',
  seat: '1 seat left',
  seats: n => `${n} seats left`,
  empty: 'Nothing on the calendar right now. Ask about a private session.',
  before: 'Before',
  beforeCount: n => `Before (${n})`,
};

// The zone and clock arithmetic lives in core/intl.core.js, shared with every page that
// says a time in IST; it is re-exported here so this module's callers and tests keep one door.
export { zoneOffset, wall, parseWhen, datetimeOf, clock, formatWhen };
const pad = n => String(n).padStart(2, '0');

// ── the clock ────────────────────────────────────────────────────────────

const hasEnd = (start, end) => Number.isFinite(end) && end > start;

/**
 * 'upcoming' | 'today' | 'now' | 'past' | 'unknown'.
 * 'now' needs an end to be sure of: the start is inclusive, the end is not. With no end
 * the event is 'today' from midnight until its day is over, and never claims to be on now.
 */
export function eventPhase(now, start, end, zone = ZONE) {
  if (!Number.isFinite(now) || !Number.isFinite(start)) return 'unknown';
  const nowDay = wall(now, zone).day, startDay = wall(start, zone).day;
  if (hasEnd(start, end)) {
    if (now >= end) return 'past';
    if (now >= start) return 'now';
  } else if (nowDay > startDay) return 'past';
  return nowDay === startDay ? 'today' : 'upcoming';
}

/** The first moment after `now` when the phase changes, or Infinity. */
export function nextChange(now, start, end, zone = ZONE) {
  if (!Number.isFinite(start)) return Infinity;
  const w = wall(start, zone), iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const midnight = parseWhen(iso(w.y, w.m, w.d), zone);
  const next = new Date(Date.UTC(w.y, w.m - 1, w.d + 1));
  const over = hasEnd(start, end) ? end : parseWhen(iso(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()), zone);
  return [midnight, start, over].find(t => t > now) ?? Infinity;
}

/** How far off a coming event is, in words. */
export function awayInWords(now, start, zone = ZONE) {
  const n = wall(start, zone).day - wall(now, zone).day;
  if (n === 1) return STRINGS.tomorrow;
  if (n < 14) return STRINGS.inDays(n);
  if (n < 70) return STRINGS.inWeeks(Math.floor(n / 7));
  const w = wall(start, zone);
  return `On ${w.d} ${MONTHS[w.m - 1]}${w.y !== wall(now, zone).y ? ` ${w.y}` : ''}`;
}

/**
 * What the seats line says. Only a whole number of 0 or more counts: anything else (no
 * attribute, empty, "lots", -2) is unknown, and an unknown number says nothing at all.
 * Sold out means seats-left="0" was set, never a guess.
 */
export function seatsOf(raw) {
  const t = String(raw ?? '').trim();
  const n = /^\d+$/.test(t) ? Number(t) : NaN;
  if (!Number.isFinite(n)) return { known: false, n: null, soldOut: false, line: '' };
  return { known: true, n, soldOut: n === 0, line: n === 0 ? STRINGS.soldOut : n === 1 ? STRINGS.seat : STRINGS.seats(n) };
}

/**
 * Everything a card needs, from the clock and its own attributes.
 * An event whose date can't be read ('unknown') keeps its call to action: the page can't
 * say it is over, so it does not take the booking away.
 * @param {number} now
 * @param {{ start: number, end?: number, seatsLeft?: string|null, zone?: string }} e
 */
export function describeEvent(now, { start, end = NaN, seatsLeft = null, zone = ZONE }) {
  const phase = eventPhase(now, start, end, zone);
  const seats = seatsOf(seatsLeft), open = phase !== 'past';
  const status = {
    upcoming: () => awayInWords(now, start, zone),
    today: () => (now >= start ? STRINGS.todayFrom : STRINGS.today)(clock(start, zone)),
    now: () => STRINGS.on(clock(end, zone)),
    past: () => STRINGS.over,
    unknown: () => '',
  }[phase]();
  const soldOut = open && seats.soldOut;
  return {
    phase, soldOut, status,
    seatsLine: open && seats.known ? seats.line : '',
    showCta: open && !soldOut,
    when: Number.isFinite(start) ? formatWhen(start, end, zone, { year: wall(start, zone).y !== wall(now, zone).y }) : '',
    datetime: Number.isFinite(start) ? datetimeOf(start, zone) : '',
    nextAt: nextChange(now, start, end, zone),
  };
}

// ── a calendar ───────────────────────────────────────────────────────────

/**
 * Split a calendar at `now`: what is still to come (soonest first, anything with no readable
 * date last) and what has happened (most recent first). Equal starts keep their given order.
 * @param {{ start: number, end?: number, zone?: string }[]} items
 */
export function partitionEvents(items, now) {
  const rows = items.map((e, i) => ({ e, i, phase: eventPhase(now, e.start, e.end, e.zone ?? ZONE) }));
  const key = r => (Number.isFinite(r.e.start) ? r.e.start : Infinity);
  const upcoming = rows.filter(r => r.phase !== 'past').sort((a, b) => key(a) - key(b) || a.i - b.i);
  const past = rows.filter(r => r.phase === 'past').sort((a, b) => key(b) - key(a) || a.i - b.i);
  return { upcoming: upcoming.map(r => r.e), past: past.map(r => r.e) };
}

/** The soonest moment any of them changes phase, or Infinity. */
export const nextChangeOf = (items, now) => Math.min(Infinity, ...items.map(e => nextChange(now, e.start, e.end, e.zone ?? ZONE)));

// ── the ticket ───────────────────────────────────────────────────────────

/**
 * Where the holes of a ticket's tear line go, along `length` px: evenly spaced a little
 * in from each end, each nudged and sized a touch differently, the way a perforating
 * wheel does it. Seeded, so a ticket is always perforated the same way.
 * @returns {{ at: number, r: number }[]}
 */
export function perforation(length, seed, { pitch = 9, margin = 12 } = {}) {
  if (!(length > margin * 2 + pitch)) return [];
  const r = rng(`event-perforation:${seed}`), n = Math.floor((length - margin * 2) / pitch), step = (length - margin * 2) / n;
  return Array.from({ length: n + 1 }, (_, i) => ({ at: +(margin + i * step + r.range(-0.5, 0.5)).toFixed(2), r: +(1.5 + r.range(-0.2, 0.3)).toFixed(2) }));
}

/** The warm ticket's lean: a small seeded angle, never flat. */
export function lean(seed) {
  const r = rng(`event-lean:${seed}`);
  return +((r.chance(0.5) ? 1 : -1) * r.range(0.2, 0.7)).toFixed(2);
}
