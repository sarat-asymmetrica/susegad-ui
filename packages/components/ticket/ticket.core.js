// Ticket: the pure core. The id, the record, what the card says in each language, and what a visitor's
// device remembers. Runs in Node; nothing here reads the clock, the machine's zone or the random number
// generator unless the caller hands it in, which is what lets a test fake all three.
//
// A ticket is four facts: the name, the event, the time (an IST instant) and an id made on the device.
// The QR on it holds the id and nothing else, so the picture and the text beside it can never disagree.
// The ticket is kept only on the visitor's own device (localStorage, every read and write wrapped), and
// nothing here sends it anywhere.

import { IST, parseWhen, wall, clock, weekday, istDay } from '../../core/intl.core.js';
import { formatKonkani, isKonkani } from '../../core/intl.kok.js';
import { strings } from '../../core/strings.js';
import { BY_LANG } from './ticket.strings.js';

/** No 0, O, 1, I or L: an id is read aloud and typed by a person at a door. 31 letters and digits. */
export const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * A new id, "K7QD-M3PX": eight characters in two groups, drawn without bias (a byte at 248 or over is thrown
 * away, so every character is equally likely). `random(n)` gives n random bytes; the default is the browser's own.
 * @param {(n: number) => Uint8Array} [random]
 */
export function newId(random = n => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  const limit = 256 - (256 % ALPHABET.length);
  let out = '';
  while (out.length < 8) for (const b of random(16)) if (b < limit && out.length < 8) out += ALPHABET[b % ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/** True for a string of the shape newId makes. */
export const isId = s => new RegExp(`^[${ALPHABET}]{4}-[${ALPHABET}]{4}$`).test(String(s ?? ''));

/** The id as it is read aloud, a character at a time: "K 7 Q D, M 3 P X". */
export const spokenId = id => String(id ?? '').split('-').map(g => [...g].join(' ')).join(', ');

const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * The record a device keeps: { v, id, name, event, eventId?, at, issued }. `at` is the event's time as text in IST;
 * `issued` is when the ticket was made, in milliseconds. `eventId` names the event in no language ("mandovi-conclave"),
 * so the ticket is still this event's when the page is read in another language, where `event` is written differently. Returns null when something needed is missing or wrong:
 * a ticket with no name, no event, no valid time or no valid id is not made.
 * @param {Record<string, any>} [rec]
 */
export function makeTicket({ name, event, eventId, at, id, issued } = {}) {
  const t = { v: 1, id: clean(id), name: clean(name), event: clean(event), at: clean(at), issued: Number.isFinite(+issued) ? +issued : 0 };
  if (clean(eventId)) t.eventId = clean(eventId);
  return validTicket(t) ? t : null;
}

/**
 * Does a kept ticket belong to this event? With an `eventId` on both sides, that decides (the name is in the page's
 * language and differs between pages); without one, the event's name and time must both match.
 */
export function isFor(t, { eventId = '', event = '', at = '' } = {}) {
  if (!t) return false;
  if (eventId && t.eventId) return t.eventId === eventId && (!at || t.at === at);
  return (!event || t.event === event) && (!at || t.at === at);
}

/** How many days after the event's day a ticket is kept on a device; then it is deleted by itself. */
export const KEEP_DAYS = 7;

/** The instant a ticket is deleted: midnight in Panjim at the start of the seventh day after the event's day. */
export function expiresAt(t, zone = IST) {
  const ms = parseWhen(t?.at, zone);
  if (Number.isNaN(ms)) return NaN;
  return parseWhen(istDay(ms + KEEP_DAYS * 86400000, zone), zone);
}

/** Has the ticket's time to be kept run out at `now` (milliseconds)? */
export const isExpired = (t, now, zone = IST) => Number(now) >= expiresAt(t, zone);

/** Is this a ticket this version understands? */
export const validTicket = t => !!t && t.v === 1 && isId(t.id) && !!clean(t.name) && !!clean(t.event) && Number.isFinite(parseWhen(t.at));

// ── the words ───────────────────────────────────────────────────────────

/** "Saturday 21 November, 9:30 am" in English; "शेनवार 21 नोव्हेंबर, सकाळीं 9:30" in Konkani. Read in IST. Empty for a bad time. */
export function timeText(at, lang = 'en', zone = IST) {
  const ms = parseWhen(at, zone);
  if (Number.isNaN(ms)) return '';
  if (isKonkani(lang)) return formatKonkani(ms, { locale: lang, zone, time: true });
  const w = wall(ms, zone);
  return `${weekday(ms, zone, { long: true })} ${w.d} ${MONTHS[w.m - 1]}, ${clock(ms, zone)}`;
}

/** The four labelled facts of the card, in the page's language: [{ key, label, value }]. */
export function rows(t, lang = 'en') {
  const S = strings(BY_LANG, lang);
  return [
    { key: 'name', label: S.name, value: t.name },
    { key: 'event', label: S.event, value: t.event },
    { key: 'time', label: S.time, value: timeText(t.at, lang) },
    { key: 'id', label: S.id, value: t.id },
  ];
}

/**
 * What a saved picture holds, in order, with no positions: the picture is a record the person keeps, so it
 * says the same labels and values as the page, in the page's language, then the code and its id, then the
 * line that ends the registration. The renderer (ticket.png.js) lays these out and wraps them.
 * The `qr` block's text is the id and nothing else.
 */
export function cardBlocks(t, lang = 'en') {
  const S = strings(BY_LANG, lang);
  return [
    { kind: 'title', text: S.heading },
    ...rows(t, lang).filter(r => r.key !== 'id').flatMap(r => [{ kind: 'label', text: r.label }, { kind: 'value', text: r.value }]),
    { kind: 'qr', text: t.id, alt: S.qrAlt(t.id) },
    { kind: 'id', text: t.id },
    { kind: 'note', text: S.qrBeside },
    { kind: 'done', text: S.done },
  ];
}

/** The picture's file name: "ticket-K7QD-M3PX.png". */
export const fileName = t => `ticket-${t.id}.png`;

/** What is said aloud once when the ticket first appears: the done line, then the id slowly. */
export const announcement = (t, lang = 'en') => {
  const S = strings(BY_LANG, lang);
  return `${S.done} ${S.id}: ${spokenId(t.id)}.`;
};

// ── what the device remembers ───────────────────────────────────────────

export const STORAGE_KEY = 'sg-ticket';

/** A store that never throws; a read that fails reads as nothing, a write that fails says false. */
export function safeStore(get = () => globalThis.localStorage) {
  return {
    read(key) { try { return get()?.getItem(key) ?? null; } catch { return null; } },
    write(key, value) { try { get().setItem(key, value); return true; } catch { return false; } },
    remove(key) { try { get().removeItem(key); return true; } catch { return false; } },
  };
}

/** Keep the ticket on this device. Returns whether the browser kept it. */
export const saveTicket = (store, t) => (validTicket(t) ? store.write(STORAGE_KEY, JSON.stringify(t)) : false);

/** The ticket this device holds, or null: nothing kept, damaged text, a record this version does not know, or one past its time. */
export function loadTicket(store, now) {
  const raw = store.read(STORAGE_KEY);
  if (raw == null) return null;
  let t = null;
  try { const o = JSON.parse(raw); t = validTicket(o) ? o : null; } catch { /* damaged text reads as no ticket */ }
  // a ticket past its keeping time is deleted when it is next looked for (pass `now` to enforce it)
  if (t && now !== undefined && isExpired(t, now)) { store.remove(STORAGE_KEY); return null; }
  return t;
}

/** Forget the ticket on this device. */
export const forgetTicket = store => store.remove(STORAGE_KEY);
