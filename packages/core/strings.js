// Strings: the library's own words, by language (decision 0025). Pure; no DOM at import.
//
//   import { strings, langOf, t } from '../../core/strings.js';
//   const s = strings(BY_LANG, langOf(this));   // this: the element
//   t(s, 'close');                               // 'Close', or its Konkani
//
// A table is a plain object of strings and functions. `byLang` maps a tag to a
// table, with `en` as the base. A key missing in Konkani is English, never blank.

const SCRIPT = { en: 'Latn', hi: 'Deva', mr: 'Deva', ne: 'Deva', sa: 'Deva', kn: 'Knda', gom: 'Deva', kok: 'Deva' };
const SAME = { gom: 'kok', kok: 'gom' };   // one language, two codes (decision 0025)

/** Canonical casing: language lower, script Title, region UPPER. 'GOM-deva' gives 'gom-Deva'. */
export function normalizeTag(tag) {
  const p = String(tag ?? '').trim().replace(/_/g, '-').split('-').filter(Boolean);
  if (!p.length || !/^[a-z]{2,3}$/i.test(p[0])) return 'en';
  return [p[0].toLowerCase(), ...p.slice(1).map(s => (s.length === 4 ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s.length === 2 ? s.toUpperCase() : s))].join('-');
}

/** The script a tag is written in: its own subtag, else the language's usual one (Konkani: Devanagari, the official script). */
export function scriptOf(tag) {
  const p = normalizeTag(tag).split('-');
  return p.find((s, i) => i && s.length === 4) ?? SCRIPT[p[0]] ?? 'Latn';
}

/** The language subtag of a tag: 'gom-Deva' gives 'gom'. */
export const languageOf = tag => normalizeTag(tag).split('-')[0];

/** True for two tags of one language, kok and gom counted as one: 'kok-Deva' and 'gom-Deva'. Script is not compared. */
export const sameLanguage = (a, b) => { const x = languageOf(a), y = languageOf(b); return x === y || SAME[x] === y; };

/** The nearest `lang` above an element, then the root's, then 'en'. */
export function langOf(el) {
  const near = el?.closest?.('[lang]')?.getAttribute('lang') || el?.ownerDocument?.documentElement?.getAttribute('lang');
  return normalizeTag(near || 'en');
}

/**
 * The lookup order for a tag, most specific first, never crossing a script:
 * 'gom-Deva' gives gom-Deva, kok-Deva, gom, kok, en; 'gom-Latn' gives gom-Latn, kok-Latn, en.
 * A table kept under a bare code is written in the language's usual script.
 */
export function chain(tag) {
  const t = normalizeTag(tag), lang = languageOf(t), script = scriptOf(t);
  const out = [t];
  const add = x => { if (!out.includes(x)) out.push(x); };
  if (SAME[lang]) add(`${lang}-${script}`);
  if (SAME[lang]) add(`${SAME[lang]}-${script}`);
  if (script === SCRIPT[lang]) { add(lang); if (SAME[lang]) add(SAME[lang]); }
  add('en');
  return out;
}

/** The table for a tag: the chain's tables laid over each other, `en` at the bottom. */
export function strings(byLang, tag) {
  const out = {};
  for (const k of chain(tag).reverse()) Object.assign(out, byLang?.[k]);
  return out;
}

/**
 * The tag of the table a key's value comes from for this language: 'gom-Deva' when the Konkani table has it,
 * 'en' when it fell back to English. Text set into a page must carry this as its lang, not the page's.
 */
export function langOfKey(byLang, tag, key) {
  return chain(tag).find(k => byLang?.[k] && key in byLang[k]) ?? 'en';
}

/** A string, or the result of a function entry called with `args`. A missing key gives the key itself, so a gap is seen. */
export function t(table, key, ...args) {
  const v = table?.[key];
  return typeof v === 'function' ? v(...args) : (v ?? key);
}

/** For a tag's own table: the keys no native reader has checked, and the English keys it lacks. */
export function unreviewed(byLang, tag, reviewed = new Set()) {
  const own = byLang?.[tag] ?? {};
  return {
    unchecked: Object.keys(own).filter(k => !reviewed.has(`${tag}:${k}`)),
    missing: Object.keys(byLang?.en ?? {}).filter(k => !(k in own)),
  };
}
