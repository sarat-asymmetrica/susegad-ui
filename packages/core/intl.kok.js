// Core: Konkani days, months and the hours of the day. Pure, no DOM, runs in Node.
//
//   formatKonkani(at, { locale: 'gom-Deva', time: true })   "शेनवार 21 नोव्हेंबर, सांजे 7:00"
//   formatKonkani(at, { locale: 'gom-Latn', time: true })   "Sonvar 21 Novembr, sanje 7:00"
//
// Why this file exists. What Intl knows about Konkani depends on the engine (probed 8 October 2026):
//   Node, Firefox     full: the words come out in the right script.
//   Chromium 153      kok and kok-Deva resolve to kok with the ROOT pattern, so the month reads "M10".
//   WebKit 26.6       gom and gom-Latn fall back to en-GB, because WebKit has no gom alias.
// So the tag is mapped gom to kok (the script subtag kept), the output is probed with formatToParts (is
// the month a word, in the script asked for, and not English?), and when the probe fails the words come
// from the table below, which holds ICU's own forms. The same day then reads the same in every engine.
//
// What is always the table's, never Intl's: the four parts of the day (सकाळीं, दनपारां, सांजे, राती),
// because "PM" in Latin letters reads badly on a Devanagari page and Chromium has no word to give. Digits
// stay western, there is no ending on a date (no -क), and the year is left off unless asked for.
// The words are a draft for a native reader (see KONKANI-FOR-READER.md in the event template).
// Times are read in IST by default, from core-intl, so a visitor's own zone never moves the venue's clock.

import { IST, wall } from './intl.core.js';
import { normalizeTag, scriptOf, languageOf } from './strings.js';

const TABLE = {
  Deva: {
    days: ['आयतार', 'सोमार', 'मंगळार', 'बुधवार', 'बिरेस्तार', 'शुक्रार', 'शेनवार'],
    months: ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रील', 'मे', 'जून', 'जुलय', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'],
    // 04:00 to 11:59, 12:00 to 15:59, 16:00 to 19:59, 20:00 to 03:59 (ICU's bands)
    parts: ['सकाळीं', 'दनपारां', 'सांजे', 'राती'],
  },
  Latn: {
    days: ['Aitar', 'Somar', 'Mongllar', 'Budhvar', 'Birestar', 'Sukrar', 'Sonvar'],
    months: ['Janer', 'Febrer', 'Mars', 'Abril', 'Mai', 'Jun', 'Julai', 'Agost', 'Setembr', 'Otubr', 'Novembr', 'Dezembr'],
    parts: ['sokallim', 'donparam', 'sanje', 'rati'],
  },
};

/** The script a Konkani tag is written in: Devanagari unless the tag says Latn. */
const scriptFor = tag => (scriptOf(tag) === 'Latn' ? 'Latn' : 'Deva');

/** True for kok and gom, in any script: the one language with two codes. */
export const isKonkani = tag => /^(kok|gom)$/.test(languageOf(tag ?? ''));

/** 'gom-Deva' gives 'kok-Deva', 'gom' gives 'kok'; the script subtag is kept. Null for any other language. */
export function konkaniTag(tag) {
  if (!isKonkani(tag)) return null;
  return normalizeTag(tag).replace(/^gom/, 'kok');
}

/** The part of the day an hour (0 to 23) falls in: 0 morning, 1 afternoon, 2 evening, 3 night. */
export const partOfDay = h => (h >= 4 && h < 12 ? 0 : h >= 12 && h < 16 ? 1 : h >= 16 && h < 20 ? 2 : 3);

/** The word for the part of the day an hour falls in, in the tag's script: "सांजे" for 19, "sanje" for 19. */
export const dayPartWord = (h, tag = 'kok-Deva') => TABLE[scriptFor(tag)].parts[partOfDay(h)];

/** "सांजे 7:00": the part of the day, then the hour on a twelve-hour clock with its minutes. */
export function konkaniClock(at, { locale = 'kok-Deva', zone = IST } = {}) {
  const w = wall(at, zone);
  if (!w) return '';
  return `${dayPartWord(w.h, locale)} ${w.h % 12 || 12}:${String(w.min).padStart(2, '0')}`;
}

// ── what the engine knows ───────────────────────────────────────────────

const SCRIPT_RE = { Deva: /^[ऀ-ॿ]+$/, Latn: /^[A-Za-z]+$/ };
// a Saturday in November, 5:30 pm in Panjim: the engine's words for it are what the probe reads
const PROBE_AT = Date.UTC(2026, 10, 21, 12, 0);
const ENGLISH = new Set(['Saturday', 'November', 'Sat', 'Nov']);

const makeFormat = (tag, opts) => new Intl.DateTimeFormat(tag, opts);

/**
 * Does this engine give real Konkani words for the tag? `make(tag, options)` returns a formatter
 * (default: Intl.DateTimeFormat; tests pass a fake). It must resolve to Konkani, and its weekday and month
 * must each be one word in the script asked for, not English and not a root pattern such as "M11".
 * Returns { ok, why } so a failing engine says how it failed.
 */
export function probeKonkani(tag, make = makeFormat) {
  const kok = konkaniTag(tag);
  if (!kok) return { ok: false, why: 'not Konkani' };
  const script = scriptFor(kok);
  try {
    const f = make(kok, { weekday: 'long', month: 'long', day: 'numeric', timeZone: IST });
    const resolved = f.resolvedOptions?.().locale ?? kok;
    if (languageOf(resolved) !== 'kok') return { ok: false, why: `resolved to ${resolved}` };
    const parts = f.formatToParts(PROBE_AT);
    const word = type => parts.find(p => p.type === type)?.value ?? '';
    for (const type of ['weekday', 'month']) {
      const v = word(type);
      if (!SCRIPT_RE[script].test(v) || ENGLISH.has(v)) return { ok: false, why: `${type} reads "${v}"` };
    }
    return { ok: true, why: '' };
  } catch (e) {
    return { ok: false, why: String(e?.message ?? e) };
  }
}

const verdicts = new Map();
/** probeKonkani for the engine we are in, asked once per tag. */
function supported(tag, make) {
  if (make) return probeKonkani(tag, make).ok; // a fake engine is never cached
  const key = konkaniTag(tag);
  if (!verdicts.has(key)) verdicts.set(key, probeKonkani(tag).ok);
  return verdicts.get(key);
}

/** { weekday, month } words for an instant: the engine's when it passes the probe, otherwise the table's. */
function words(at, zone, tag, make) {
  const w = wall(at, zone), t = TABLE[scriptFor(tag)];
  const own = { weekday: t.days[w.wd], month: t.months[w.m - 1] };
  if (!supported(tag, make)) return own;
  try {
    const f = (make ?? makeFormat)(konkaniTag(tag), { weekday: 'long', month: 'long', day: 'numeric', timeZone: zone });
    const parts = f.formatToParts(ms(at));
    const pick = type => parts.find(p => p.type === type)?.value;
    return { weekday: pick('weekday') || own.weekday, month: pick('month') || own.month };
  } catch { return own; }
}
const ms = t => (t instanceof Date ? t.getTime() : typeof t === 'string' ? Date.parse(t) : t);

/**
 * A date, and optionally the time, in Konkani: "शेनवार 21 नोव्हेंबर", "Sonvar 21 Novembr, sanje 7:00".
 * Read in `zone` (IST). `locale` is any gom or kok tag. `weekday: false` drops the day name; `year: true`
 * adds it; `time: true` adds the part of the day and the clock. `make` swaps the formatter (tests).
 * An empty string for a bad instant or a language that is not Konkani.
 */
export function formatKonkani(at, { locale = 'kok-Deva', zone = IST, weekday = true, year = false, time = false, make } = {}) {
  if (!isKonkani(locale)) return '';
  const w = wall(at, zone);
  if (!w) return '';
  const { weekday: day, month } = words(at, zone, locale, make);
  const date = `${weekday ? `${day} ` : ''}${w.d} ${month}${year ? ` ${w.y}` : ''}`;
  return time ? `${date}, ${konkaniClock(at, { locale, zone })}` : date;
}
