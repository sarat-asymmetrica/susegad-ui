// Word weights: how long a word takes to say, relative to the other words
// in its phrase, by script. Pure, runs in Node. Used to spread a phrase's
// measured audio duration over its words (timing.js): Sarvam gives phrase
// audio but no word timings, so the weight per word stands in for its
// syllable count.

/** A run of Latin vowels (including y as a vowel, as in "myth" or "rhythm"). */
const LATIN_VOWEL_GROUP = /[aeiouyAEIOUY]+/gu;

/** Maximal vowel-group count, minimum 1 so an all-consonant word still speaks. */
function latinWeight(word) {
  const matches = word.match(LATIN_VOWEL_GROUP);
  return Math.max(1, matches ? matches.length : 0);
}

// Devanagari and Kannada akshara ranges (Unicode blocks 0900–097F, 0C80–0CFF).
// An akshara is a consonant (optionally preceded by consonants joined to it
// with the virama, forming a conjunct) plus whatever vowel sign or nasal
// follows; an independent vowel is its own akshara. The virama does not
// start a new akshara: it joins the consonant before it to the one after.
const SCRIPTS = {
  devanagari: {
    test: cp => cp >= 0x0900 && cp <= 0x097f,
    consonant: cp => (cp >= 0x0915 && cp <= 0x0939) || (cp >= 0x0958 && cp <= 0x095f) || cp === 0x0933,
    virama: 0x094d,
    vowelIndep: cp => cp >= 0x0904 && cp <= 0x0914,
    // matras, anusvara, visarga, chandrabindu, nukta: attach to the current akshara
    mark: cp => (cp >= 0x093a && cp <= 0x094c && cp !== 0x094d) || (cp >= 0x0900 && cp <= 0x0903) || cp === 0x093c || (cp >= 0x0955 && cp <= 0x0957),
  },
  kannada: {
    test: cp => cp >= 0x0c80 && cp <= 0x0cff,
    consonant: cp => cp >= 0x0c95 && cp <= 0x0cb9,
    virama: 0x0ccd,
    vowelIndep: cp => cp >= 0x0c85 && cp <= 0x0c94,
    mark: cp => (cp >= 0x0cbe && cp <= 0x0ccc && cp !== 0x0ccd) || (cp >= 0x0c81 && cp <= 0x0c83),
  },
};

/** Count aksharas in one word of a known Indic script, minimum 1. */
function akshariaWeight(word, script) {
  const { consonant, virama, vowelIndep, mark } = SCRIPTS[script];
  let count = 0, afterVirama = false;
  for (const ch of word) {
    const cp = ch.codePointAt(0);
    if (consonant(cp)) {
      if (!afterVirama) count++;
      afterVirama = false;
    } else if (cp === virama) {
      afterVirama = true; // this consonant joins the next one: a conjunct, still one akshara
    } else if (vowelIndep(cp)) {
      count++;
      afterVirama = false;
    } else if (mark(cp)) {
      afterVirama = false; // a matra or nasal on the current akshara: no new count
    } else {
      afterVirama = false; // punctuation or another script's letters inside the word: ignore
    }
  }
  return Math.max(1, count);
}

/** Which script most of a word's letters belong to. */
export function scriptOfWord(word) {
  let devanagari = 0, kannada = 0, other = 0;
  for (const ch of word) {
    const cp = ch.codePointAt(0);
    if (SCRIPTS.devanagari.test(cp)) devanagari++;
    else if (SCRIPTS.kannada.test(cp)) kannada++;
    else if (/\p{L}/u.test(ch)) other++;
  }
  if (devanagari && devanagari >= kannada && devanagari >= other) return 'devanagari';
  if (kannada && kannada >= other) return 'kannada';
  return 'latin';
}

/**
 * A word's relative speaking weight: a vowel-group count for Latin, an
 * akshara count for Devanagari or Kannada. Always at least 1.
 * @param {string} word
 * @returns {number}
 */
export function wordWeight(word) {
  const script = scriptOfWord(word);
  return script === 'latin' ? latinWeight(word) : akshariaWeight(word, script);
}
