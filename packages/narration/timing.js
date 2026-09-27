// Spread a phrase's measured audio duration over its words. Pure, runs in
// Node. Sarvam gives phrase-level audio and no word timings (see
// docs/briefs/wave-4.md), so the phrase's real duration (from its WAV
// header) is split by each word's relative weight (weights.js), with a
// pause held out at punctuation, including the Devanagari danda and double
// danda.

import { wordWeight } from './weights.js';

// Punctuation that earns a pause after the word it follows, and how many
// word-weight-units long that pause is relative to an average word. A danda
// pauses like a comma; a double danda and sentence enders pause longer.
const PAUSE_AFTER = [
  { test: /[।]$/u, units: 0.7 },
  { test: /[॥]$/u, units: 1.1 },
  { test: /[.!?]$/u, units: 1.1 },
  { test: /[,;:]$/u, units: 0.55 },
];

function pauseUnits(token) {
  for (const { test, units } of PAUSE_AFTER) if (test.test(token)) return units;
  return 0;
}

/** Split text into words, each carrying its trailing punctuation for pause detection. */
function tokenize(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** The bare word, punctuation stripped, for weighing and for display. */
const bareWord = token => token.replace(/^[("'“‘]+|[)"'”’,;:.!?।॥]+$/gu, '');

/**
 * Spread `durationSec` of speech over the words in `text`, weighted by
 * script-aware syllable estimate, with pauses held out at punctuation.
 * @param {{ text: string, durationSec: number }} args
 * @returns {{ words: { word: string, start: number, end: number }[], duration: number }}
 */
export function timePhrase({ text, durationSec }) {
  const tokens = tokenize(text);
  if (!tokens.length || !(durationSec > 0)) return { words: [], duration: Math.max(0, durationSec || 0) };

  const weighed = tokens.map(token => ({ token, word: bareWord(token), weight: wordWeight(bareWord(token)), pause: pauseUnits(token) }));
  const avgWeight = weighed.reduce((s, w) => s + w.weight, 0) / weighed.length;
  const totalUnits = weighed.reduce((s, w) => s + w.weight + w.pause * avgWeight, 0);
  const secPerUnit = durationSec / totalUnits;

  let t = 0;
  const words = weighed.map(w => {
    const start = t;
    const end = start + w.weight * secPerUnit;
    t = end + w.pause * avgWeight * secPerUnit;
    return { word: w.word, start, end };
  });
  return { words, duration: durationSec };
}
