// Person: the pure core of <sg-person-card>, shared by the skins and the
// member-directory recipe. Runs in Node with no DOM.
//
// A person card is a name, a role, one line on what they are building, and a
// link. It shows their initials instead of a photo unless the author put a
// photo there, and a photo belongs on the card only with that person's
// consent; the element never fetches one of its own.

import { rng } from '../../engine/src/rng.js';

/** The words the element itself owns, in one place. */
export const STRINGS = {
  noLink: 'No link yet',
  photoAlt: (name) => `${name}'s photo`,
};

// ── initials ─────────────────────────────────────────────────────────────

const LETTER = /\p{L}|\p{Nd}/u; // a letter, including Devanagari, or a numeral

/**
 * The initials a disc shows for a name: the first letter of the first and last
 * word with letters (or one letter for a single name). Extra middle names are
 * skipped, spaces and punctuation at the edges ignored, and accents kept as
 * written ("É"," é" reads É, not é). "" for anything with no letters at all:
 * the card then shows a plain disc and the name is read as usual.
 *
 *   initialsOf('Sarita Fernandes') // 'SF'
 *   initialsOf('Ana Julia de Souza D\'Cruz') // 'AD'
 *   initialsOf('Meera') // 'M'
 *   initialsOf('  Melwyn  ') // 'M'
 *
 * @param {string} name
 * @returns {string}
 */
export function initialsOf(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(w => [...w].some(ch => LETTER.test(ch)));
  if (!words.length) return '';
  const first = [...words[0]].find(ch => LETTER.test(ch)) ?? '';
  if (words.length === 1) return first.toUpperCase();
  const last = [...words.at(-1)].find(ch => LETTER.test(ch)) ?? '';
  return `${first.toUpperCase()}${last.toUpperCase()}`;
}

// ── what the skins read ──────────────────────────────────────────────────

/**
 * A seeded small tilt for a card or a disc, in degrees: −1.4 to −0.4 or
 * 0.4 to 1.4, never flat, always the same for the same seed.
 * @param {string | number} seed
 * @returns {number}
 */
export function tiltOf(seed) {
  const r = rng(seed);
  return +((r.chance(0.5) ? 1 : -1) * r.range(0.4, 1.4)).toFixed(2);
}

/**
 * A hue (0 to 359) for the playful disc, seeded, so a person always wears the
 * same colour.
 * @param {string | number} seed
 * @returns {number}
 */
export function hueOf(seed) {
  return rng(`${seed}:hue`).int(0, 359);
}

// ── the directory's filter, so it can be tested without a browser ────────

/** Lowercase, and fold accents so "Fernandes" matches "fernandés". */
export const fold = t => String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * What the directory asks of one person card. Reads the card's own markup:
 * the name heading, the role line and the building line carry the words, and
 * `track` is an attribute on the card.
 */
export function personOf(card) {
  if (!card) return { name: '', words: '', track: '' };
  const name = card.querySelector('h1, h2, h3, h4')?.textContent ?? '';
  const role = card.querySelector('.sg-person-role')?.textContent ?? '';
  const building = card.querySelector('.sg-person-building')?.textContent ?? '';
  return {
    name,
    track: card.getAttribute('data-track') ?? '',
    words: fold(`${name} ${role} ${building}`),
  };
}

/**
 * The members a filter leaves showing, in their given order.
 * @param {{ name: string, track: string, words: string }[]} people
 * @param {{ q?: string, tracks?: string[] }} f
 * @returns {boolean[]} which people show
 */
export function filterPeople(people, { q = '', tracks = [] } = {}) {
  const needle = fold(q).trim();
  const words = needle.split(/\s+/).filter(Boolean);
  const want = new Set(tracks);
  return people.map(p =>
    (want.size === 0 || want.has(p.track)) && words.every(w => p.words.includes(w)));
}
