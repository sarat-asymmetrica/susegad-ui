// Core: rupees and the Indian clock. Pure, no DOM, runs in Node.
//
//   Money. formatMoney() and rupees() write 125000 as "₹1,25,000" (lakh and crore,
//   the 2-2-3 rhythm) by hand, so the grouping is the same in every engine and
//   every ICU build; any other currency groups in thousands. Paise show when
//   asked, or when the amount has them. A negative reads "-₹1,000", and anything
//   that is not a finite number reads as an empty string, never "NaN".
//
//   Time. Every function takes the instant it should read (a Date or milliseconds)
//   and a zone that defaults to Asia/Kolkata, so a visitor's own zone never
//   changes what the venue's clock says. istDay() is the IST calendar day of an
//   instant even when the machine is in New York. Nothing here reads the clock:
//   the caller passes `now`, which is what lets a test fake it. No Temporal yet
//   (it is not in stable Safari); Intl.DateTimeFormat does the zone arithmetic.

export const IST = 'Asia/Kolkata';

// ── money ───────────────────────────────────────────────────────────────

const INDIAN = new Set(['₹', 'rs', 'rs.', 'inr']);
// Money past this has lost its paise to the float; say nothing rather than print digits that are not there.
const MAX = Number.MAX_SAFE_INTEGER / 100;
const num = n => (n == null || n === '' ? NaN : typeof n === 'number' ? n : Number(String(n).trim()));

/** "1234567" gives "12,34,567": the last three digits, then pairs. A sign and a fraction pass through; non-finite input gives null. */
export function groupIndian(n) {
  const t = num(n);
  if (!Number.isFinite(t) || Math.abs(t) > MAX) return null;
  const neg = t < 0, [int, frac] = (neg ? -t : t).toString().split('.');
  const rest = int.slice(0, -3), groups = [int.slice(-3)];
  for (let i = rest.length; i > 0; i -= 2) groups.unshift(rest.slice(Math.max(0, i - 2), i));
  return (neg ? '-' : '') + groups.join(',') + (frac !== undefined ? '.' + frac : '');
}

/** "1234567" gives "1,234,567": for a currency that is not the rupee. */
export const groupWestern = digits => String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Money for people. The rupee (₹, Rs, INR) groups the Indian way; anything else
 * groups in thousands. A symbol sits against the number, a word gets a space.
 * `paise`: 'auto' (default) shows two decimals only when the amount has paise;
 * true always shows two; false rounds to whole rupees.
 * @param {number|string} n
 * @param {string} [currency]
 * @param {{ paise?: boolean|'auto' }} [opts]
 */
export function formatMoney(n, currency = '₹', { paise = 'auto' } = {}) {
  const t = num(n);
  if (!Number.isFinite(t) || Math.abs(t) > MAX) return '';
  // round on the digits of the shortest text of the number (what Intl rounds), half up: 1.005 gives 1.01
  const shift = x => {
    const q = String(x);
    if (/e/.test(q)) return Math.round(x * 100);
    const [i, f = ''] = q.split('.'), d = (f + '000').slice(0, 3);
    return Number(i + d.slice(0, 2)) + (d[2] >= '5' ? 1 : 0);
  };
  const minor = paise === false ? Math.round(Math.abs(t)) * 100 : shift(Math.abs(t));
  const whole = Math.floor(minor / 100), cents = minor % 100;
  const group = INDIAN.has(String(currency).trim().toLowerCase()) ? digits => groupIndian(digits) : groupWestern;
  const body = `${group(whole)}${paise === true || (paise === 'auto' && cents) ? `.${String(cents).padStart(2, '0')}` : ''}`;
  const cur = String(currency);
  return `${t < 0 && minor ? '-' : ''}${/^[A-Za-z]/.test(cur) ? `${cur} ` : cur}${body}`;
}

/** "₹1,25,000". Same as formatMoney with the rupee. */
export const rupees = (n, opts) => formatMoney(n, '₹', opts);

// ── zones ───────────────────────────────────────────────────────────────

const DAY = 86400000, MIN = 60000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = n => String(n).padStart(2, '0');
const bad = t => !Number.isFinite(ms(t));
const ms = t => (t instanceof Date ? t.getTime() : typeof t === 'string' ? Date.parse(t) : t);

const formats = new Map();
/** Milliseconds a zone's wall clock is ahead of UTC at an instant (5.5 hours for Asia/Kolkata). */
export function zoneOffset(at, zone = IST) {
  at = ms(at);
  let f = formats.get(zone);
  if (!f) formats.set(zone, f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
  const p = Object.fromEntries(f.formatToParts(at).map(x => [x.type, +x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at / 1000) * 1000;
}

/** { y, m, d, h, min, wd (0 is Sunday), day (whole days since 1970) }. */
/** The wall clock in a zone at an instant, or null for a bad instant. */
export function wall(at, zone = IST) {
  if (bad(at)) return null;
  at = ms(at);
  const local = at + zoneOffset(at, zone), t = new Date(local);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), wd: t.getUTCDay(), day: Math.floor(local / DAY) };
}

/** The calendar day in a zone as "2026-10-06": the IST day of an instant, whatever the machine's own zone. An empty string for a bad instant. */
export function istDay(at, zone = IST) {
  if (bad(at)) return '';
  const w = wall(at, zone);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}`;
}

const WHEN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * "2026-10-04T11:00" to an instant. With no offset it is the wall-clock time in `zone`; with
 * "Z" or "+05:30" the offset wins. A date alone means midnight. NaN for anything else,
 * including a day that is not on the calendar (30 February).
 */
export function parseWhen(text, zone = IST) {
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
export function datetimeOf(at, zone = IST) {
  if (bad(at)) return '';
  at = ms(at);
  const w = wall(at, zone), off = Math.round(zoneOffset(at, zone) / MIN), a = Math.abs(off);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}T${pad(w.h)}:${pad(w.min)}:00${off < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

// ── words ───────────────────────────────────────────────────────────────

/** "11 am", "6:30 pm", "12 noon", "12 am" for midnight. */
export function clock(at, zone = IST) {
  if (bad(at)) return '';
  const { h, min } = wall(at, zone);
  if (h === 12 && !min) return '12 noon';
  return `${h % 12 || 12}${min ? `:${pad(min)}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

/** "23:00", "06:30": the twenty-four hour clock. */
export function clock24(at, zone = IST) {
  if (bad(at)) return '';
  const { h, min } = wall(at, zone);
  return `${pad(h)}:${pad(min)}`;
}

/** Does this locale write the hour on a 24-hour clock? en-IN does not; de and fr do. */
const hours = new Map();
export function uses24Hour(locale = 'en-IN') {
  if (!hours.has(locale)) {
    let v = false;
    try { v = /^h2[34]$/.test(new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle ?? ''); } catch { /* an unknown locale reads as 12-hour */ }
    hours.set(locale, v);
  }
  return hours.get(locale);
}

/** A time of day in the venue's zone, on the clock the locale (or `hour12`) asks for. */
export function formatTime(at, { zone = IST, locale = 'en-IN', hour12 } = {}) {
  return (hour12 === undefined ? uses24Hour(locale) : !hour12) ? clock24(at, zone) : clock(at, zone);
}

/** "Sun", or "Sunday" with long: true: the weekday in the zone. */
export function weekday(at, zone = IST, { long = false } = {}) {
  if (bad(at)) return '';
  const w = WEEKDAYS[wall(at, zone).wd];
  return long ? LONG[w] : w;
}

const dayWords = w => `${WEEKDAYS[w.wd]} ${w.d} ${MONTHS[w.m - 1]}`;

/** "Sun 4 Oct", or "Sun 4 Oct 2026" with year: true; weekday: false drops the day name. */
export function formatDate(at, zone = IST, { year = false, weekday: wd = true } = {}) {
  if (bad(at)) return '';
  const w = wall(at, zone);
  return `${wd ? `${WEEKDAYS[w.wd]} ` : ''}${w.d} ${MONTHS[w.m - 1]}${year ? ` ${w.y}` : ''}`;
}

/**
 * "Sun 4 Oct, 11 am to 1 pm". Across midnight both ends carry their day:
 * "Sat 3 Oct, 8 pm to Sun 4 Oct, 1 am". No end, no "to". `year: true` adds it.
 */
export function formatWhen(start, end, zone = IST, { year = false } = {}) {
  if (bad(start)) return '';
  const a = wall(start, zone), y = w => (year ? ` ${w.y}` : '');
  let out = `${dayWords(a)}${y(a)}, ${clock(start, zone)}`;
  if (Number.isFinite(end) && end > start) {
    const b = wall(end, zone);
    out += ` to ${b.day === a.day ? '' : `${dayWords(b)}${y(b)}, `}${clock(end, zone)}`;
  }
  return out;
}

/** Whole calendar days from `now` to `then` in the zone: 0 today, 1 tomorrow, -1 yesterday. */
export const daysFrom = (now, then, zone = IST) => (bad(now) || bad(then) ? NaN : wall(then, zone).day - wall(now, zone).day);

/** "today", "tomorrow", "yesterday", "in 5 days", "5 days ago": counted in the zone's calendar days, not 24-hour spans. */
export function relativeDay(now, then, zone = IST) {
  const n = daysFrom(now, then, zone);
  if (Number.isNaN(n)) return '';
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`;
}
