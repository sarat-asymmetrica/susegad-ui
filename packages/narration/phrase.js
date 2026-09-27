// Phrase splitting: pure, runs in Node.
//
// A synthesis call costs characters and money, and Sarvam's bulbul models
// take at most 2,500 characters per call, so a script is cut into phrases
// first. A phrase breaks at a sentence or clause end when one is available;
// only a run with no such break in reach is cut at a word boundary.

// Sentence and clause enders, including the Devanagari danda and double danda.
const SENTENCE_END = /([.!?।॥]+)(\s+|$)/u;
const CLAUSE_END = /([,;:—-]+)(\s+|$)/u;

/** Split text into sentences, keeping the ending punctuation on each. */
function splitSentences(text) {
  const out = [];
  let rest = text;
  while (rest.length) {
    const m = rest.match(SENTENCE_END);
    if (!m) { out.push(rest); break; }
    const end = m.index + m[0].length;
    out.push(rest.slice(0, end).trimEnd());
    rest = rest.slice(end);
  }
  return out.filter(s => s.length);
}

/** Split one over-long sentence at clause punctuation, then at word boundaries. */
function splitLong(sentence, maxChars) {
  if (sentence.length <= maxChars) return [sentence];
  const clauses = [];
  let rest = sentence;
  while (rest.length) {
    const m = rest.match(CLAUSE_END);
    if (!m) { clauses.push(rest); break; }
    const end = m.index + m[0].length;
    clauses.push(rest.slice(0, end).trimEnd());
    rest = rest.slice(end);
  }
  const out = [];
  let buf = '';
  for (const clause of clauses) {
    const piece = buf ? `${buf} ${clause}` : clause;
    if (piece.length <= maxChars) { buf = piece; continue; }
    if (buf) out.push(buf);
    buf = clause.length <= maxChars ? clause : '';
    if (clause.length > maxChars) out.push(...splitWords(clause, maxChars));
  }
  if (buf) out.push(buf);
  return out;
}

/** Last resort: cut at word boundaries so no phrase exceeds maxChars. */
function splitWords(run, maxChars) {
  const words = run.split(/\s+/).filter(Boolean);
  const out = [];
  let buf = '';
  for (const w of words) {
    const piece = buf ? `${buf} ${w}` : w;
    if (piece.length > maxChars && buf) { out.push(buf); buf = w; }
    else buf = piece;
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * Split a script into phrases under `maxChars` (default 220, well under
 * bulbul's 2,500-character limit, so a phrase reads as one breath). Prefers
 * sentence breaks, then clause breaks, then word breaks. Never returns an
 * empty phrase, and never splits a word in two.
 * @param {string} text
 * @param {{ maxChars?: number }} [opts]
 * @returns {string[]}
 */
export function splitPhrases(text, { maxChars = 220 } = {}) {
  const sentences = splitSentences(text.trim());
  const out = [];
  for (const sentence of sentences) out.push(...splitLong(sentence, maxChars));
  return out;
}
