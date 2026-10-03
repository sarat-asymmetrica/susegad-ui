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

export const ZONE = 'Asia/Kolkata';
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

const DAY = 86400000, MIN = 60000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = n => String(n).padStart(2, '0');

// ── zones ────────────────────────────────────────────────────────────────

const formats = new Map();
/** Milliseconds a zone's wall clock is ahead of UTC at an instant (5.5 hours for Asia/Kolkata). */
export function zoneOffset(ms, zone = ZONE) {
  let f = formats.get(zone);
  if (!f) formats.set(zone, f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
  const p = Object.fromEntries(f.formatToParts(ms).map(x => [x.type, +x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** The wall clock in a zone at an instant: { y, m, d, h, min, wd (0 is Sunday), day (whole days since 1970) }. */
export function wall(ms, zone = ZONE) {
  const local = ms + zoneOffset(ms, zone), t = new Date(local);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), wd: t.getUTCDay(), day: Math.floor(local / DAY) };
}

const WHEN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * "2026-10-04T11:00" to an instant. With no offset it is the wall-clock time in `zone`; with
 * "Z" or "+05:30" the offset wins. A date alone means midnight. NaN for anything else,
 * including a day that is not on the calendar (30 February).
 */
export function parseWhen(text, zone = ZONE) {
  const m = WHEN.exec(String(text ?? '').trim());
  if (!m) return NaN;
  const [y, mo, d, h = 0, mi = 0, s = 0] = m.slice(1, 7).map(x => (x == null ? undefined : Number(x)));
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const back = new Date(guess);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59 || s > 59) return NaN;
  if (m[7]) {
    if (/^z$/i.test(m[7])) return guess;
    const sign = m[7][0] === '-' ? -1 : 1, digits = m[7].slice(1).replace(':', '');
    return guess - sign * (+digits.slice(0, 2) * 60 + +digits.slice(2)) * MIN;
  }
  const first = guess - zoneOffset(guess, zone);
  return guess - zoneOffset(first, zone);
}

/** "2026-10-04T11:00:00+05:30": what goes in a <time datetime>. */
export function datetimeOf(ms, zone = ZONE) {
  const w = wall(ms, zone), off = Math.round(zoneOffset(ms, zone) / MIN), a = Math.abs(off);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}T${pad(w.h)}:${pad(w.min)}:00${off < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

// ── words ────────────────────────────────────────────────────────────────

/** "11 am", "6:30 pm", "12 noon", "12 am" for midnight. */
export function clock(ms, zone = ZONE) {
  const { h, min } = wall(ms, zone);
  if (h === 12 && !min) return '12 noon';
  return `${h % 12 || 12}${min ? `:${pad(min)}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

const dayWords = w => `${WEEKDAYS[w.wd]} ${w.d} ${MONTHS[w.m - 1]}`;

/**
 * "Sun 4 Oct, 11 am to 1 pm". Across midnight both ends carry their day:
 * "Sat 3 Oct, 8 pm to Sun 4 Oct, 1 am". No end, no "to". `year: true` adds it.
 */
export function formatWhen(start, end, zone = ZONE, { year = false } = {}) {
  const a = wall(start, zone), y = w => (year ? ` ${w.y}` : '');
  let out = `${dayWords(a)}${y(a)}, ${clock(start, zone)}`;
  if (Number.isFinite(end) && end > start) {
    const b = wall(end, zone);
    out += ` to ${b.day === a.day ? '' : `${dayWords(b)}${y(b)}, `}${clock(end, zone)}`;
  }
  return out;
}

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
