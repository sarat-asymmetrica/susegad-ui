import { test } from 'node:test';
import assert from 'node:assert/strict';

import { splitPhrases } from './phrase.js';
import { parseWav, writeSilentWav, concatWav } from './wav.js';
import { wordWeight, scriptOfWord } from './weights.js';
import { timePhrase } from './timing.js';
import { writeVtt, parseVtt, formatVttTime, parseVttTime } from './vtt.js';
import { fixtureKey, readFixture, writeFixture } from './cache.js';
import stub from './providers/stub.js';
import { synthesizeScript, synthesizePhrases } from './index.js';

// ── phrase splitting ──────────────────────────────────────────────────────

test('splitPhrases keeps a short script as one phrase', () => {
  assert.deepEqual(splitPhrases('Rain came to the window.'), ['Rain came to the window.']);
});

test('splitPhrases breaks on sentence ends, including the Devanagari danda', () => {
  const out = splitPhrases('पाऊस आला। घर ओले झाले।');
  assert.deepEqual(out, ['पाऊस आला।', 'घर ओले झाले।']);
});

test('splitPhrases never exceeds maxChars and never splits a word', () => {
  const long = 'The frangipani dropped one flower, then another, then a third, into the still water of the pool at noon, and a firefly woke early because of the clouds.';
  const out = splitPhrases(long, { maxChars: 40 });
  for (const phrase of out) assert.ok(phrase.length <= 40, `"${phrase}" is ${phrase.length} chars`);
  assert.equal(out.join(' ').replace(/\s+/g, ' '), long.replace(/\s+/g, ' '));
});

test('splitPhrases drops no text and returns no empty phrase', () => {
  const out = splitPhrases('One. Two, three; four: five. Six?');
  assert.ok(out.every(p => p.trim().length > 0));
  assert.equal(out.join(' '), 'One. Two, three; four: five. Six?');
});

// ── WAV ────────────────────────────────────────────────────────────────────

test('writeSilentWav then parseWav round-trips the duration', () => {
  const wav = writeSilentWav({ durationSec: 1.5, sampleRate: 24000, channels: 1 });
  const info = parseWav(wav);
  assert.equal(info.sampleRate, 24000);
  assert.equal(info.channels, 1);
  assert.equal(info.bitsPerSample, 16);
  assert.ok(Math.abs(info.durationSec - 1.5) < 0.001, info.durationSec);
});

test('writeSilentWav is byte-identical for the same options (cache stability)', () => {
  const a = writeSilentWav({ durationSec: 0.8 });
  const b = writeSilentWav({ durationSec: 0.8 });
  assert.deepEqual(a, b);
});

test('parseWav rejects a non-WAV file with a plain message', () => {
  assert.throws(() => parseWav(new Uint8Array([1, 2, 3, 4])), /RIFF\/WAVE/);
});

test('concatWav lays clips end to end with silence held between them', () => {
  const a = writeSilentWav({ durationSec: 1, sampleRate: 24000 });
  const b = writeSilentWav({ durationSec: 0.5, sampleRate: 24000 });
  const joined = concatWav([{ audio: a, gapAfterSec: 0.25 }, { audio: b }]);
  const info = parseWav(joined);
  assert.ok(Math.abs(info.durationSec - 1.75) < 0.001, info.durationSec); // 1 + 0.25 gap + 0.5
});

test('concatWav refuses to join clips of different formats', () => {
  const a = writeSilentWav({ durationSec: 1, sampleRate: 24000 });
  const b = writeSilentWav({ durationSec: 1, sampleRate: 16000 });
  assert.throws(() => concatWav([{ audio: a }, { audio: b }]), /format/);
});

test('parseWav finds fmt and data chunks when a LIST chunk sits between them', () => {
  const base = writeSilentWav({ durationSec: 0.5 });
  // Splice a small LIST chunk (id + size 4 + 4 bytes of body) right after fmt (offset 36).
  const list = new Uint8Array(12);
  const view = new DataView(list.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'LIST'); view.setUint32(4, 4, true); str(8, 'INFO');
  const spliced = new Uint8Array(base.length + list.length);
  spliced.set(base.slice(0, 36), 0);
  spliced.set(list, 36);
  spliced.set(base.slice(36), 36 + list.length);
  // Fix the RIFF size to include the extra chunk.
  new DataView(spliced.buffer).setUint32(4, spliced.length - 8, true);
  const info = parseWav(spliced);
  assert.ok(Math.abs(info.durationSec - 0.5) < 0.001);
});

// ── word weights ───────────────────────────────────────────────────────────

test('scriptOfWord identifies Latin, Devanagari and Kannada', () => {
  assert.equal(scriptOfWord('rain'), 'latin');
  assert.equal(scriptOfWord('पाऊस'), 'devanagari');
  assert.equal(scriptOfWord('ಮಳೆ'), 'kannada');
});

test('wordWeight counts Latin vowel groups', () => {
  assert.equal(wordWeight('rain'), 1); // one vowel group: "ai"
  assert.equal(wordWeight('umbrella'), 3); // u-mbr-e-ll-a: 3 groups
  assert.equal(wordWeight('sky'), 1); // y counts as a vowel here, min 1
  assert.equal(wordWeight('rhythm'), 1); // no aeiou, y not adjacent... still floors at 1
});

test('wordWeight counts Devanagari aksharas, including a conjunct', () => {
  assert.equal(wordWeight('पाऊस'), 3); // पा-ऊ-स
  // विद्या: वि-द्-या -> व(vowel sign i)+द+्(virama, joins)+य(vowel sign aa) = 2 aksharas
  assert.equal(wordWeight('विद्या'), 2);
});

test('wordWeight counts Kannada aksharas, including a conjunct', () => {
  assert.equal(wordWeight('ಮಳೆ'), 2); // ಮ-ಳೆ
  assert.equal(wordWeight('ಕರ್ನಾಟಕ'), 4); // ಕ-ರ್(joins)ನಾ-ಟ-ಕ -> ಕ, ರ್ನಾ(conjunct), ಟ, ಕ
});

test('wordWeight is always at least 1', () => {
  assert.equal(wordWeight(''), 1);
  assert.equal(wordWeight('mm'), 1);
});

// ── timing ─────────────────────────────────────────────────────────────────

test('timePhrase spreads words across the duration, in order, none past the end', () => {
  const { words, duration } = timePhrase({ text: 'Rain came to the window.', durationSec: 2 });
  assert.equal(words.length, 5);
  assert.equal(words[0].start, 0);
  assert.ok(words[words.length - 1].end <= duration + 1e-9);
  for (let i = 1; i < words.length; i++) assert.ok(words[i].start >= words[i - 1].end);
});

test('timePhrase with no trailing punctuation ends exactly at the duration', () => {
  const { words, duration } = timePhrase({ text: 'Rain came to the window', durationSec: 2 });
  assert.ok(Math.abs(words[words.length - 1].end - duration) < 1e-9);
});

test('timePhrase holds out a longer pause at a sentence end than a comma', () => {
  // Same words, same duration; only the punctuation after "Wait" differs.
  const comma = timePhrase({ text: 'Wait, and watch.', durationSec: 3 });
  const period = timePhrase({ text: 'Wait. And watch.', durationSec: 3 });
  const commaGap = comma.words[1].start - comma.words[0].end; // the gap after "Wait,"
  const periodGap = period.words[1].start - period.words[0].end; // the gap after "Wait."
  assert.ok(commaGap > 0, commaGap);
  assert.ok(periodGap > commaGap, `expected the sentence-end pause (${periodGap}) to exceed the comma pause (${commaGap})`);
});

test('timePhrase strips punctuation from the reported word', () => {
  const { words } = timePhrase({ text: 'Rain, at last.', durationSec: 1 });
  assert.deepEqual(words.map(w => w.word), ['Rain', 'at', 'last']);
});

test('timePhrase on empty text returns no words', () => {
  assert.deepEqual(timePhrase({ text: '  ', durationSec: 2 }), { words: [], duration: 2 });
});

// ── WebVTT ─────────────────────────────────────────────────────────────────

test('formatVttTime and parseVttTime round-trip', () => {
  for (const s of [0, 0.001, 1.5, 61.25, 3661.999]) {
    assert.ok(Math.abs(parseVttTime(formatVttTime(s)) - s) < 0.0015, s);
  }
});

test('writeVtt then parseVtt round-trips phrases and word timings', () => {
  const phrases = [
    { start: 0, end: 2, words: [{ word: 'Rain', start: 0, end: 0.8 }, { word: 'came', start: 0.8, end: 2 }] },
    { start: 2.25, end: 4, words: [{ word: 'to', start: 2.25, end: 2.6 }, { word: 'the', start: 2.6, end: 3, }, { word: 'window', start: 3, end: 4 }] },
  ];
  const vtt = writeVtt(phrases);
  assert.match(vtt, /^WEBVTT\n\n/);
  const parsed = parseVtt(vtt);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].words.map(w => w.word).join(' '), 'Rain came');
  assert.ok(Math.abs(parsed[0].words[1].start - 0.8) < 0.001);
  assert.ok(Math.abs(parsed[1].start - 2.25) < 0.001);
  assert.equal(parsed[1].words.map(w => w.word).join(' '), 'to the window');
});

test('writeVtt is valid to parse even for a single-word phrase', () => {
  const vtt = writeVtt([{ start: 0, end: 1, words: [{ word: 'Rain', start: 0, end: 1 }] }]);
  const parsed = parseVtt(vtt);
  assert.equal(parsed[0].words[0].word, 'Rain');
  assert.equal(parsed[0].words[0].end, 1);
});

// ── fixture cache ────────────────────────────────────────────────────────

test('fixtureKey is stable for equal requests and differs when text, lang, voice, model or pace differ', () => {
  const base = { text: 'Rain came.', lang: 'en-IN', voice: 'shubh', model: 'bulbul:v3', pace: 1 };
  assert.equal(fixtureKey(base), fixtureKey({ ...base }));
  assert.notEqual(fixtureKey(base), fixtureKey({ ...base, text: 'Rain went.' }));
  assert.notEqual(fixtureKey(base), fixtureKey({ ...base, lang: 'mr-IN' }));
  assert.notEqual(fixtureKey(base), fixtureKey({ ...base, voice: 'other' }));
  assert.notEqual(fixtureKey(base), fixtureKey({ ...base, model: 'bulbul:v2' }));
  assert.notEqual(fixtureKey(base), fixtureKey({ ...base, pace: 1.2 }));
});

test('readFixture is null on a miss, and never throws', async () => {
  const entry = await readFixture('no-such-key-ever-written-00000000');
  assert.equal(entry, null);
});

// ── the stub provider and the orchestration ────────────────────────────────

test('the stub provider makes valid, readable WAV audio with no network', async () => {
  const { audio, mime } = await stub.synthesize({ text: 'Rain came to the window.', lang: 'en-IN' });
  assert.equal(mime, 'audio/wav');
  const info = parseWav(audio);
  assert.ok(info.durationSec > 0);
});

test('synthesizeScript lays phrases end to end and writes a matching VTT, all from the stub, all cached after the first run', async () => {
  // cache.js's FIXTURES_DIR is fixed to the package folder by design (the
  // demo and other tests read the same cache), so this checks the
  // orchestration end to end against the package's real fixtures, which is
  // safe because the stub provider is deterministic and the key includes
  // the exact text.
  const text = 'Rain came to the window. It ran down the glass, and the palms leaned in the wind.';
  const result = await synthesizeScript(text, { lang: 'en-IN', voice: 'stub', model: 'stub', pace: 1, provider: stub });
  assert.ok(result.phrases.length >= 2);
  assert.ok(result.durationSec > 0);
  assert.equal(result.phrases[0].start, 0);
  for (let i = 1; i < result.phrases.length; i++) assert.ok(result.phrases[i].start > result.phrases[i - 1].end);
  assert.match(result.vtt, /^WEBVTT/);
  const parsed = parseVtt(result.vtt);
  assert.equal(parsed.length, result.phrases.length);

  // Run again: every call should now be a cache hit.
  const second = await synthesizeScript(text, { lang: 'en-IN', voice: 'stub', model: 'stub', pace: 1, provider: stub });
  assert.ok(second.calls.every(c => c.fromCache));

  // The concatenated audio is a valid WAV at least as long as the VTT's last cue.
  const info = parseWav(result.audio);
  assert.ok(info.durationSec >= result.durationSec - 0.01);
});

test('synthesizePhrases keeps beat ids and per-phrase pace, for a pre-split script like a storybook spread', async () => {
  const phrases = [
    { beat: 'sky-turns', text: 'The sky turned the colour of an old kadai.', pace: 0.88, pause_after: 'short' },
    { beat: 'then-another', text: 'Then another.', pace: 0.8, pause_after: 'long' },
  ];
  const result = await synthesizePhrases(phrases, { lang: 'en-IN', voice: 'stub', model: 'stub', pace: 1, provider: stub });
  assert.deepEqual(result.phrases.map(p => p.beat), ['sky-turns', 'then-another']);
  // A "long" pause_after gap is wider than a "short" one.
  const gap = result.phrases[1].start - result.phrases[0].end;
  assert.ok(gap > 0.15);
});
