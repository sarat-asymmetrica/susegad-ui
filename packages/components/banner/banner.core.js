// Banner: the pure core. When it shows, what it remembers, and the date words. Runs in Node.
//
//   A banner has one of three phases: 'shown', 'dismissed' (the visitor sent it away, and the browser
//   remembered) or 'expired' (its `until` date has passed). Expired wins: a banner that is out of date
//   shows nothing, whatever the visitor did. Nothing here reads the clock or the storage: the caller
//   passes `now` and a store, which is what lets a test fake both.
//
//   Storage is the visitor's own browser, and it can be missing (a private window, blocked site data,
//   a sandboxed frame). Every read and write is wrapped, and a banner with no storage simply shows on
//   every visit and stays dismissed for the page's life.

import { IST, parseWhen, wall } from '../../core/intl.core.js';
import { formatKonkani, isKonkani } from '../../core/intl.kok.js';

const DAY = 86400000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The instant a banner stops showing, from its `until` text, read in IST. A date alone ("2026-10-01") means
 * the whole of that day, so the banner goes at midnight when the day ends; a date with a time
 * ("2026-10-01T18:00") goes at that time. NaN when there is no `until` or it is not a date.
 */
export function expiryOf(until, zone = IST) {
  const text = String(until ?? '').trim();
  if (!text) return NaN;
  const at = parseWhen(text, zone);
  if (Number.isNaN(at)) return NaN;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? at + DAY : at;
}

/** True once `now` has reached the banner's expiry. A banner with no (or a bad) `until` never expires. */
export const isExpired = (until, now, zone = IST) => {
  const end = expiryOf(until, zone);
  return Number.isFinite(end) && Number(now) >= end;
};

/** 'expired', 'dismissed' or 'shown'. Expired beats dismissed. */
export const phaseOf = ({ expired = false, dismissed = false } = {}) => (expired ? 'expired' : dismissed ? 'dismissed' : 'shown');

/**
 * A short, stable number for a piece of text: the key of a banner that has no id, so that a banner
 * whose words change is a new banner and shows again. FNV-1a, in base 36.
 */
export function hashText(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text ?? '').replace(/\s+/g, ' ').trim()) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** The storage key: the banner's id when it has one (so edits to the words keep a dismissal), else its words. */
export const storageKey = (id, text) => `sg-banner:${String(id ?? '').trim() || hashText(text)}`;

/**
 * A store that never throws. `get` is called each time (so a blocked localStorage is found out at use, not
 * at import); a read that fails reads as nothing, and a write that fails says so by returning false.
 */
export function safeStore(get = () => globalThis.localStorage) {
  return {
    read(key) { try { return get()?.getItem(key) ?? null; } catch { return null; } },
    write(key, value) { try { get().setItem(key, value); return true; } catch { return false; } },
    remove(key) { try { get().removeItem(key); return true; } catch { return false; } },
  };
}

/** Has this banner been dismissed on this browser? */
export const wasDismissed = (store, key) => store.read(key) != null;

/** Remember a dismissal. Returns whether the browser kept it. */
export const rememberDismissed = (store, key, now) => store.write(key, String(Number.isFinite(+now) ? +now : 1));

/**
 * A date as the banner prints it, in the page's language, with no weekday and no year: "1 October",
 * or "1 ऑक्टोबर" for a Konkani page. Read in IST. Empty for a bad date. `datetime` is what a
 * <time datetime> holds ("2026-10-01" or a full stamp).
 */
export function dateText(datetime, lang = 'en', zone = IST) {
  const at = parseWhen(datetime, zone);
  if (Number.isNaN(at)) return '';
  if (isKonkani(lang)) return formatKonkani(at, { locale: lang, zone, weekday: false });
  const w = wall(at, zone);
  return `${w.d} ${MONTHS[w.m - 1]}`;
}

/** The sentence a screen reader hears once, from the words and the strings table. Whitespace tidied. */
export const announcement = (S, message) => {
  const text = String(message ?? '').replace(/\s+/g, ' ').trim();
  return text ? S.announced(text) : '';
};

/** The sessionStorage key that says this visit has already heard this banner. */
export const heardKey = key => `${key}:heard`;

/**
 * Should the banner be said aloud now? Once per visit (a tab's session): the first page that shows it says it, and the
 * pages after it do not, so a visitor walking through a site hears it once. With no session storage there is no memory,
 * so it is said on every page load. Marks the visit as having heard it when it says yes.
 * @param {{ read: Function, write: Function }} session a safeStore over sessionStorage
 */
export function shouldSay(session, key) {
  if (session.read(heardKey(key)) != null) return false;
  session.write(heardKey(key), '1');
  return true;
}
