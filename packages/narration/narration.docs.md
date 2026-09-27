# Narration

Recorded or synthesised speech, plus a WebVTT timing track that drives captions and word-by-word highlighting. Captions are always available; the play control is the consent (decision 0015) — nothing plays on its own.

## The pieces

- **`phrase.js`** — `splitPhrases(text, { maxChars = 220 })`. Breaks a script at sentence ends (including the Devanagari danda `।` and double danda `॥`), then clause punctuation, then word boundaries, so a call never exceeds Sarvam's 2,500-character limit and never splits a word.
- **`wav.js`** — `parseWav(bytes)` reads a WAV's real sample rate, channel count, bit depth and duration by walking its chunks (never trusting a provider's own word count); `writeSilentWav(opts)` makes a deterministic silent WAV for the stub provider; `concatWav(parts)` lays several clips end to end with silence held between them, for one playable track.
- **`weights.js`** — `wordWeight(word)`: a Latin word's weight is its vowel-group count; a Devanagari or Kannada word's weight is its akshara count, with a real segmenter (a consonant starts a new akshara unless the one before it ends in a virama, which makes a conjunct; matras, anusvara and visarga attach to the current akshara; an independent vowel starts its own).
- **`timing.js`** — `timePhrase({ text, durationSec })` spreads a phrase's real, WAV-measured duration over its words by weight, holding a pause after punctuation (longer at a sentence end or the danda than at a comma).
- **`vtt.js`** — `writeVtt(phrases)` / `parseVtt(text)`: one WebVTT cue per phrase, with a `<HH:MM:SS.mmm>` tag before every word after the first, in the standard karaoke-tag form, so a caption renderer that ignores the tags still shows plain words.
- **`cache.js`** — the fixture cache: `fixtureKey({ text, lang, voice, model, pace })` hashes exactly the fields that change the audio; `readFixture`/`writeFixture` store `audio.wav` and `request.json` (never a key) under `fixtures/<key>/`.
- **`providers/`** — `synthesize({ text, lang, voice, model, pace }) => { audio, mime, meta }`. `stub.js` makes a silent WAV of a plausible length, no network, deterministic. `sarvam.js` calls Sarvam's bulbul text-to-speech (`POST https://api.sarvam.ai/text-to-speech`), reading the key from `SARVAM_API_KEY` at call time only.
- **`index.js`** — `synthesizeScript(text, opts)` and `synthesizePhrases(phraseList, opts)` tie it together: split (or take a pre-split script), read the cache, call the provider on a miss, measure the real duration, spread the words, and lay phrases end to end into one track with a matching VTT.
- **`synth.mjs`** — a CLI that fills the fixture cache from a script file, calling the network only on a miss.
- **`reader.js`** — `<sg-narration>`, the highlight driver, and `speakFallback(text, opts)`, the offline fallback over `speechSynthesis`.

## `<sg-narration>`

```html
<sg-narration lang="en-IN">
  <audio controls preload="none">
    <source src="story.wav" type="audio/wav">
    <track kind="captions" src="story.vtt" default>
  </audio>
  <p><span data-word>Rain</span> <span data-word>came</span> <span data-word>to</span> <span data-word>the</span> <span data-word>window.</span></p>
</sg-narration>
```

- The native `<audio>` and its `<track kind="captions">` are the whole thing without JavaScript: captions work, nothing autoplays.
- With JavaScript, the element marks the current `[data-word]` span with `aria-current="true"` as the audio plays, matching words in playback order so a repeated word still lines up. No live-region chatter — the words are already visible as captions or as the page's own text.
- `[data-word]` spans are optional: build them however fits your page (the storybook-spread recipe's `wrapWords(el)` wraps a paragraph's text automatically). Without them, `<sg-narration>` still drives native captions and fires `sg-word` (`{ word, start, end }`) so a page can render its own highlight, and `sg-phrase` (`{ index, start, end }`) once per phrase, useful for driving a scene's params off the same beats as the narration.
- A scrub (forward or back) resets the match so it searches from the start again, so seeking never leaves a stale word marked.
- The track is read independently of the browser's own caption loading (its `load` event can race the custom element's upgrade), so highlighting works even when `preload="none"` delays the native track fetch.

## The offline fallback

`speakFallback(text, { lang, onWord, onDone })` speaks with the browser's own voice when no audio is available at all (no key at build time, a network-free demo, or a failed `<audio>` load). It reports `'speech-synthesis'` when it started speaking, or `'captions-only'` when `speechSynthesis` doesn't exist — either way, the page's own text and captions are the narration a person can always fall back to, which the charter requires regardless of which mode ran.

## Building a script

```js
import { synthesizePhrases } from 'susegad/narration/index.js';
import sarvam from 'susegad/narration/providers/sarvam.js';

const result = await synthesizePhrases(
  [{ beat: 'sky-turns', text: 'The sky turned the colour of an old kadai.', pace: 0.88, pause_after: 'short' }, /* … */],
  { lang: 'en-IN', voice: 'shubh', model: 'bulbul:v3', provider: sarvam },
);
// result.audio: one WAV, phrases laid end to end with held silence between them
// result.vtt: one WebVTT track, captions and word highlighting together
// result.phrases[i].beat: kept from the input, for driving a scene's cues off the same beats
```

Every call goes through the fixture cache first; a repeat build costs nothing. `synthesizeScript(text, opts)` does the same from a plain string, splitting it with `splitPhrases` first.

## Accessibility and honesty

- Captions are always present; nothing about the story is said only by the highlight.
- The play control is the only consent narration needs (decision 0015); it is never wired to the global sound switch and never autoplays.
- `aria-current` is the only state a word span carries — no colour-only signal, and the transition (see `narration.css`) is skipped under reduced motion by relying on the CSS `prefers-reduced-motion: no-preference` guard, so word changes still happen, just without the colour transition's motion.
- Pronunciation and register are a native speaker's job, not this package's: `story/spread.json`'s `pronunciation_notes` and `owner_to_confirm` are the pattern to follow for a new script.

## Known limits

- No word-level timestamps come from Sarvam; `timing.js`'s weights are an estimate, not a measurement. They read naturally in testing but are not perfectly synced to the real audio's stresses.
- Seeking while paused does not recompute the highlighted word (only a scrub during playback does); this is a minor, documented gap, not a broken state — nothing incorrect is shown, only nothing until play resumes.
- `concatWav` requires every clip to share sample rate, channels and bit depth, which holds for a script synthesised in one pass with one provider, but would need resampling to mix providers within a track.
