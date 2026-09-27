/* ============================================================================
   dates.js: pure date arithmetic on ISO day strings.

   Every date in the portal is a 'YYYY-MM-DD' string and every night is the
   night *starting* on that date. Internally a date is an integer day count so
   no Date object, no timezone, no DST can move a booking by a night.

   Ported unchanged in behaviour from the villa redesign; only comments differ.
   ========================================================================== */

const MS_DAY = 86400000;

/** 'YYYY-MM-DD' -> integer days since 1970-01-01 (UTC). */
export function toDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) throw new TypeError(`bad ISO date: ${iso}`);
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const back = fromDay(t / MS_DAY);
  if (back !== iso) throw new TypeError(`invalid calendar date: ${iso}`);
  return t / MS_DAY;
}

/** integer day -> 'YYYY-MM-DD'. */
export function fromDay(day) {
  const d = new Date(day * MS_DAY);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso, n) { return fromDay(toDay(iso) + n); }
export function diffDays(a, b) { return toDay(b) - toDay(a); }
export function isValidISO(iso) { try { toDay(iso); return true; } catch { return false; } }

/** 0 = Monday … 6 = Sunday (ISO weekday, zero-based). */
export function weekday(iso) {
  // 1970-01-01 was a Thursday (ISO 4 -> zero-based 3)
  return (((toDay(iso) + 3) % 7) + 7) % 7;
}

export function isWeekendNight(iso) { const w = weekday(iso); return w === 4 || w === 5; } // Fri, Sat nights

export function daysInMonth(year, month) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }

export function ym(iso) { return iso.slice(0, 7); }
export function pad2(n) { return String(n).padStart(2, "0"); }

/** 'YYYY-MM' + n months -> 'YYYY-MM'. */
export function addMonths(yyyymm, n) {
  const [y, m] = yyyymm.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${pad2((idx % 12) + 1)}`;
}

export function isValidYM(s) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(s || ""); }

/**
 * A month as rows of 7 cells, Monday first. Cells outside the month are null.
 * Pure: same input, same grid.
 */
export function monthGrid(yyyymm) {
  const [y, m] = yyyymm.split("-").map(Number);
  const n = daysInMonth(y, m);
  const first = `${y}-${pad2(m)}-01`;
  const lead = weekday(first);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= n; d++) cells.push(`${y}-${pad2(m)}-${pad2(d)}`);
  while (cells.length % 7) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export function monthName(yyyymm) { const [y, m] = yyyymm.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; }

/** 'Sat 19 Dec 2026' */
export function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${DOW[weekday(iso)]} ${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}
/** '19 Dec' */
export function shortDate(iso) { const [, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS_SHORT[m - 1]}`; }

/** every date in [from, to) */
export function eachDay(from, to) {
  const out = [];
  for (let d = toDay(from), e = toDay(to); d < e; d++) out.push(fromDay(d));
  return out;
}

/** today's ISO date from a clock (ms since epoch), in a fixed offset (IST by default). */
export function todayISO(nowMs = Date.now(), offsetMinutes = 330) {
  return fromDay(Math.floor((nowMs + offsetMinutes * 60000) / MS_DAY));
}
