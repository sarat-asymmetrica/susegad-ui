// Now note: the pure core. Runs in Node.
//
// A short "what I'm up to" note is only honest while it's fresh. This says
// how long ago it was updated, in words, and when it has gone stale.

import { rng } from '../../engine/src/rng.js';

export const STRINGS = {
  today: 'today',
  yesterday: 'yesterday',
  days: n => `${n} days ago`,
  weeks: n => (n === 1 ? 'a week ago' : `${n} weeks ago`),
  months: n => (n === 1 ? 'a month ago' : `${n} months ago`),
  years: 'over a year ago',
  stale: 'This note may be out of date.',
};

const DAY = 86400000;
/** "2026-09-27" (or a full ISO date-time) to a UTC day number; NaN if it isn't a date. */
export function dayNumber(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : NaN;
}

/** Whole days from `then` to `now` (both ISO dates). */
export const daysBetween = (then, now) => dayNumber(now) - dayNumber(then);

/**
 * How long ago, in words: today, yesterday, 3 days ago, 2 weeks ago,
 * 4 months ago, over a year ago. '' for a date in the future or not a date.
 * @param {string} then
 * @param {string} now
 */
export function ageInWords(then, now) {
  const d = daysBetween(then, now);
  if (!Number.isFinite(d) || d < 0) return '';
  if (d === 0) return STRINGS.today;
  if (d === 1) return STRINGS.yesterday;
  if (d < 14) return STRINGS.days(d);
  if (d < 60) return STRINGS.weeks(Math.floor(d / 7));
  if (d < 365) return STRINGS.months(Math.floor(d / 30.44));
  return STRINGS.years;
}

/** Older than `staleAfter` days? A date that can't be read counts as stale. */
export function isStale(then, now, staleAfter = 45) {
  const d = daysBetween(then, now);
  return !Number.isFinite(d) || d > staleAfter;
}

/** Today as "YYYY-MM-DD" in the reader's own calendar. */
export const todayIso = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** The warm sticky note's lean: a small seeded angle, never flat. */
export function lean(seed) {
  const r = rng(`now-note:${seed}`);
  return +((r.chance(0.5) ? 1 : -1) * r.range(0.8, 2)).toFixed(2);
}
