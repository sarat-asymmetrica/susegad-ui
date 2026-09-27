// Combobox: matching, pure. Runs in Node.
//
// People type place names in many ways: with or without accents ("Balcao" for
// "Balcão"), by an older name ("Bombay"), in another script ("मुंबई"), or
// spelled as they hear it ("Tiruvanantapuram"). Matching folds all of these
// together without mangling the scripts that are not Latin.

const LATIN = /\p{Script=Latin}/u;

/**
 * Fold one string for comparison. Accents are stripped from Latin letters only:
 * in Devanagari, Kannada and the other Indic scripts the combining marks are
 * vowel signs and must stay. Case, punctuation and extra spaces are dropped.
 * `loose` also folds the usual Indian romanisation variants: doubled vowels
 * (aa, ee, oo), aspirates (th, dh, bh, kh, gh, ph, jh) and w for v.
 */
export function fold(s, { loose = false } = {}) {
  let out = '';
  for (const ch of String(s).normalize('NFD')) {
    if (/\p{M}/u.test(ch) && LATIN.test(out.at(-1) ?? '')) continue; // a Latin accent: drop it
    out += ch;
  }
  out = out.normalize('NFC').toLocaleLowerCase('en').replace(/[\p{P}\p{S}\s]+/gu, ' ').trim();
  if (loose) {
    out = out.replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u')
      .replace(/([tdbkgpj])h/g, '$1').replace(/w/g, 'v');
  }
  return out;
}

/** How well `query` matches one name: 0 exact, 1 prefix, 2 word start, 3 loose prefix, 4 inside a word; -1 no match. */
export function score(query, name) {
  const q = fold(query), n = fold(name);
  if (!q) return 0;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if ((' ' + n).includes(' ' + q)) return 2;
  const ql = fold(query, { loose: true }), nl = fold(name, { loose: true });
  if (ql && (nl.startsWith(ql) || (' ' + nl).includes(' ' + ql))) return 3;
  if (q.length >= 3 && n.includes(q)) return 4;
  return -1;
}

/**
 * The options that match, best first, keeping the page's order among equals.
 * Each option is { value, label?, aliases?: string[] }. A match through an alias
 * ranks just below the same kind of match on the value, and says which alias.
 * @returns {{ option: object, index: number, score: number, via: string | null }[]}
 */
export function filterOptions(query, options) {
  const out = [];
  options.forEach((option, index) => {
    let best = -1, via = null;
    const names = [option.value, option.label].filter(Boolean);
    for (const n of names) { const s = score(query, n); if (s >= 0 && (best < 0 || s < best)) { best = s; via = null; } }
    for (const a of option.aliases ?? []) {
      const s = score(query, a);
      if (s >= 0 && (best < 0 || s + 0.5 < best)) { best = s + 0.5; via = a; }
    }
    if (best >= 0) out.push({ option, index, score: best, via });
  });
  return out.sort((a, b) => a.score - b.score || a.index - b.index);
}

/**
 * Where `query` sits in `text`, as [start, end] in the original text, for a
 * <mark>. Accents are mapped back character by character, so "balcao" marks
 * "Balcão". Loose matches are not marked. Returns null when there is nothing to mark.
 */
export function markRange(text, query) {
  const q = fold(query);
  if (!q) return null;
  let folded = '';
  const from = [];
  for (let i = 0; i < text.length; i++) {
    const f = fold(text[i]) || (text[i] === ' ' ? ' ' : '');
    for (let k = 0; k < f.length; k++) { folded += f[k]; from.push(i); }
  }
  let at = folded.startsWith(q) ? 0 : folded.indexOf(' ' + q);
  if (at > 0) at += 1;
  if (at < 0) at = q.length >= 3 ? folded.indexOf(q) : -1;
  if (at < 0) return null;
  return [from[at], from[at + q.length - 1] + 1];
}

/** Read <option>s from a <datalist> into plain data. `data-aliases` is a comma-separated list. */
export function optionsFrom(list) {
  return [...(list?.options ?? [])].map(o => ({
    value: o.value,
    label: o.label && o.label !== o.value ? o.label : '',
    aliases: (o.dataset.aliases ?? '').split(',').map(s => s.trim()).filter(Boolean),
    lang: o.lang || '',
  }));
}

/** Words people read, in one place. */
export const STRINGS = {
  count: n => (n === 0 ? 'No suggestions' : n === 1 ? '1 suggestion' : `${n} suggestions`),
  also: alias => `also ${alias}`,
};
