// Narration: the pure timing core, the provider interface, the fixture
// cache and the orchestration that ties them together. Node-safe; the
// custom element (`reader.js`) is the only part that touches the DOM.

export * from './phrase.js';
export * from './wav.js';
export * from './weights.js';
export * from './timing.js';
export * from './vtt.js';
export { fixtureKey, readFixture, writeFixture, fixturesPath, FIXTURES_DIR } from './cache.js';

import { splitPhrases } from './phrase.js';
import { parseWav, concatWav } from './wav.js';
import { timePhrase } from './timing.js';
import { writeVtt } from './vtt.js';
import { fixtureKey, readFixture, writeFixture } from './cache.js';

/**
 * Synthesise a script phrase by phrase, using the cache on a hit and the
 * given provider on a miss, and lay the phrases end to end into one track
 * with a WebVTT caption-and-highlight file. Never throws away work: a
 * provider failure on one phrase stops the run and reports which phrase and
 * how many were already cached, so a retry only pays for the misses.
 *
 * @param {string} text the full script
 * @param {{ lang: string, voice?: string, model?: string, pace?: number, provider: import('./providers/index.js').Provider, maxChars?: number, gapSec?: number }} opts
 * @returns {Promise<{ phrases: { text: string, start: number, end: number, words: { word: string, start: number, end: number }[], durationSec: number, fromCache: boolean }[], vtt: string, durationSec: number, calls: { text: string, fromCache: boolean }[] }>}
 */
export async function synthesizeScript(text, { lang, voice, model, pace, provider, maxChars, gapSec = 0.25 }) {
  const phraseTexts = splitPhrases(text, { maxChars });
  return synthesizePhrases(
    phraseTexts.map(t => ({ text: t })),
    { lang, voice, model, pace, provider, gapSec },
  );
}

// Extra silence after a phrase whose script called for a longer beat, on
// top of the punctuation pause `timePhrase` already holds inside the audio.
const PAUSE_GAP_SEC = { short: 0.15, medium: 0.35, long: 0.6 };

/**
 * Synthesise a script that has already been split into phrases (as
 * `story/spread.json` ships, one object per narration beat), keeping each
 * phrase's own `beat` id and any per-phrase `pace`, so a player can align
 * scene cues to the same beats without re-deriving them from plain text.
 *
 * @param {{ beat?: string, text: string, pace?: number, pause_after?: 'short'|'medium'|'long' }[]} phraseList
 * @param {{ lang: string, voice?: string, model?: string, pace?: number, provider: import('./providers/index.js').Provider, gapSec?: number }} opts
 * @returns {Promise<{ phrases: { beat: string|null, text: string, start: number, end: number, words: { word: string, start: number, end: number }[], durationSec: number, fromCache: boolean }[], vtt: string, audio: Uint8Array, durationSec: number, calls: { text: string, fromCache: boolean }[] }>}
 */
export async function synthesizePhrases(phraseList, { lang, voice, model, pace, provider, gapSec = 0.25 }) {
  const phrases = [];
  const calls = [];
  const clips = [];
  let cursor = 0;

  for (const item of phraseList) {
    const phraseText = item.text;
    const request = { text: phraseText, lang, voice, model, pace: item.pace ?? pace };
    const key = fixtureKey(request);
    let entry = await readFixture(key);
    const fromCache = !!entry;
    if (!entry) {
      const result = await provider.synthesize(request);
      await writeFixture(key, { audio: result.audio, request });
      entry = { audio: result.audio, request };
    }
    calls.push({ text: phraseText, fromCache });

    const { durationSec } = parseWav(entry.audio);
    const { words } = timePhrase({ text: phraseText, durationSec });
    const start = cursor;
    const end = start + durationSec;
    const gapAfterSec = PAUSE_GAP_SEC[item.pause_after] ?? gapSec;
    phrases.push({
      beat: item.beat ?? null,
      text: phraseText,
      start,
      end,
      words: words.map(w => ({ word: w.word, start: start + w.start, end: start + w.end })),
      durationSec,
      fromCache,
    });
    clips.push({ audio: entry.audio, gapAfterSec });
    cursor = end + gapAfterSec;
  }

  return {
    phrases,
    vtt: writeVtt(phrases),
    audio: concatWav(clips),
    durationSec: phrases.length ? phrases[phrases.length - 1].end : 0,
    calls,
  };
}
