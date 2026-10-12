// Lang: the pure core of <sg-lang> and of the pages that stand behind it
// (decision 0025). Runs in Node. Which languages a site offers, the hreflang
// links for its head, the address of a page in each language, which language a
// browser asked for, and the two small drawings the warm and playful skins use.

import { rng } from '../../engine/src/rng.js';
import { makeNoise } from '../../engine/src/noise.js';
import { normalizeTag, languageOf, scriptOf, sameLanguage, chain } from '../../core/strings.js';
import { BY_LANG } from '../../core/strings.table.js';

export { normalizeTag, languageOf, scriptOf, sameLanguage };

/** Each language named in its own script, so someone who cannot read this page can still find theirs. */
export const AUTONYMS = {
  en: 'English',
  'gom-Deva': 'कोंकणी',
  'gom-Latn': 'Konknni',
  hi: 'हिन्दी',
  mr: 'मराठी',
  kn: 'ಕನ್ನಡ',
};

/** The words <sg-lang> uses are the shared ones (core/strings.table.js): `language` names the nav. */
export const STRINGS = BY_LANG.en;

/** The name of a language in its own script: 'gom-Deva' gives 'कोंकणी'. An unknown tag is shown as written. */
export function labelFor(tag) {
  const own = languageOf(tag) === 'en';
  for (const k of chain(tag)) if (AUTONYMS[k] && (own || k !== 'en')) return AUTONYMS[k];   // the chain ends at English; an unknown tag must not become it
  return String(tag);
}

/**
 * Which of a switcher's languages is the page's: an exact tag first, then the
 * same language in the same script (en-GB on an en-IN link; kok-Deva on a
 * gom-Deva one), never another script.
 * @param {string[]} tags the links' hreflang values, in order
 * @param {string} page the page's lang
 * @returns {number} the index, or -1
 */
export function currentIndex(tags, page) {
  const p = normalizeTag(page), n = tags.map(normalizeTag);
  const exact = n.indexOf(p);
  if (exact >= 0) return exact;
  return n.findIndex(x => sameLanguage(x, p) && scriptOf(x) === scriptOf(p));
}

/**
 * The best of the languages a site offers for a browser's list (navigator.languages),
 * or null. Same rule as currentIndex: the language and its script must both match.
 * For a hint the page shows; never a redirect.
 * @param {string[]} requested in order of preference
 * @param {string[]} available tags a site offers
 */
export function matchLanguage(requested, available) {
  for (const r of requested ?? []) {
    const i = currentIndex(available, r);
    if (i >= 0) return available[i];
  }
  return null;
}

/**
 * The alternates for a page's head, as data: one per language, and x-default.
 * @param {{ lang: string, href: string }[]} alternates every language, the page itself included
 * @param {{ xDefault?: string }} [opts] the lang whose page is x-default; the first alternate when omitted
 * @returns {{ rel: 'alternate', hreflang: string, href: string }[]}
 */
export function hreflangLinks(alternates, { xDefault } = {}) {
  const seen = new Set();
  const out = alternates.map(({ lang, href }) => {
    const hreflang = normalizeTag(lang);
    if (seen.has(hreflang)) throw new Error(`hreflang: ${hreflang} is listed twice`);
    seen.add(hreflang);
    if (!href) throw new Error(`hreflang: ${hreflang} has no address`);
    return { rel: 'alternate', hreflang, href };
  });
  if (!out.length) return out;
  const def = xDefault ? out.find(a => a.hreflang === normalizeTag(xDefault)) : out[0];
  if (!def) throw new Error(`hreflang: x-default ${xDefault} is not one of the alternates`);
  return [...out, { rel: 'alternate', hreflang: 'x-default', href: def.href }];
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The same links as `<link>` tags, one per line, for a template or a build step. */
export const hreflangHtml = (alternates, opts) =>
  hreflangLinks(alternates, opts).map(a => `<link rel="alternate" hreflang="${esc(a.hreflang)}" href="${esc(a.href)}">`).join('\n');

/**
 * The address of a path in a language.
 *   prefix (the default): '/events/' becomes '/gom-deva/events/'; the default language has none.
 *   suffix: 'demo.html' becomes 'demo.gom-Deva.html'; 'dir/' becomes 'dir/index.gom-Deva.html'.
 * @param {string} path the page's path in the default language
 * @param {string} lang
 * @param {{ defaultLang?: string, scheme?: 'prefix'|'suffix' }} [opts]
 */
export function urlFor(path, lang, { defaultLang = 'en-IN', scheme = 'prefix' } = {}) {
  const l = normalizeTag(lang), p = String(path || '/');
  if (l === normalizeTag(defaultLang)) return p;
  if (scheme === 'suffix') {
    if (p.endsWith('/')) return `${p}index.${l}.html`;
    return /\.[a-z0-9]+$/i.test(p) ? p.replace(/(\.[a-z0-9]+)$/i, `.${l}$1`) : `${p}.${l}`;
  }
  return `/${l.toLowerCase()}${p.startsWith('/') ? p : `/${p}`}`;
}

/**
 * The warm underline: a pencil line under the current language, `w` wide, drawn
 * twice, with a seeded wander. Not the same line as site-nav's: this one lies
 * flatter, since the words under it are short.
 * @returns {string[]} two path strings on a viewBox of `w` by 8
 */
export function pencilLine(w, seed, wobble = 0.6) {
  const out = [];
  for (let pass = 0; pass < 2; pass++) {
    const n = makeNoise(`lang-pencil:${seed}:${pass}`), r = rng(`lang-pencil:${seed}:${pass}`);
    const x0 = r.range(-2, 0), x1 = w + r.range(0, 3), rise = r.range(0.2, 1.1);
    const pts = [];
    for (let x = x0; x <= x1; x += 4) pts.push([x, 4 - ((x - x0) / (x1 - x0)) * rise + n(x * 0.05, pass * 2) * wobble * 1.5 + pass * 0.7]);
    pts.push([x1, pts[pts.length - 1][1]]);
    out.push(`M${pts.map(([x, y]) => `${+x.toFixed(2)} ${+y.toFixed(2)}`).join('L')}`);
  }
  return out;
}

/** The playful tabs: a small seeded tilt per language, as if each were stamped by hand. */
export function tabTilt(seed, i) {
  const r = rng(`lang-tab:${seed}:${i}`);
  return +((r.chance(0.5) ? 1 : -1) * r.range(0.5, 2)).toFixed(2);
}
