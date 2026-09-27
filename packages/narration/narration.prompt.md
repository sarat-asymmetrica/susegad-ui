# Narration

*Recorded or synthesised speech, a WebVTT timing track, captions that are always present, and word-by-word highlighting as the audio plays.*

```html
<link rel="stylesheet" href="susegad/narration/narration.css">
<script type="module" src="susegad/narration/reader.js"></script>

<sg-narration lang="en-IN">
  <audio controls preload="none">
    <source src="story.wav" type="audio/wav">
    <track kind="captions" src="story.vtt" default>
  </audio>
  <p><span data-word>Rain</span> <span data-word>came</span> <span data-word>to</span> <span data-word>the</span> <span data-word>window.</span></p>
</sg-narration>
```

## The prompt

Build narration for a document or a story: a phrase splitter that never exceeds a provider's character limit and never breaks a word, treating the Devanagari danda and double danda as sentence enders alongside the Latin ones. Because no text-to-speech API gives word-level timestamps, measure each phrase's real audio duration from its WAV header (never trust a provider's own word count) and spread it over the phrase's words by a script-aware weight: a vowel-group count for Latin, and a proper akshara count for Devanagari and Kannada, where a consonant starts a new akshara unless the one before it ends in a virama (a conjunct stays one akshara), and a matra or nasal attaches to the current akshara rather than starting a new one. Hold a pause after punctuation, longer at a sentence end than a comma. Write the result as WebVTT, one cue per phrase for captions, with a timestamp tag before every word after the first so a highlight driver can mark the current one, in the format the spec already defines so a caption renderer that doesn't understand the tags still shows plain words. Cache every synthesised phrase on disk under a hash of exactly what changes the audio (the text, language, voice, model and pace), so tests and demos never call the network and a repeat build costs nothing; write the request beside the audio, never the key. Build a provider interface any text-to-speech service can implement, a silent-WAV stub that makes every test and demo work offline, and a real adapter, confirmed against the provider's current docs rather than assumed from memory or an old default. Drive highlighting from a native `<audio>` and a native `<track kind="captions">`, so captions work with no JavaScript at all and nothing autoplays; with JavaScript, mark the current word with `aria-current`, matching words in playback order so a repeated word still lines up, and reset that matching on a scrub so seeking never leaves a stale word marked. Fall back to the browser's own voice, or to the page's own text and captions, when no audio can be reached at all.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| never exceeds a provider's character limit and never breaks a word | phrase splitting | `splitPhrases(text, { maxChars })` breaks at sentence ends first, then clause punctuation, then word boundaries, joining pieces back up to just under the limit. |
| measure each phrase's real audio duration from its WAV header | honesty | `parseWav(bytes)` walks the RIFF chunks (fmt and data aren't always adjacent) and divides the data chunk's byte length by the frame size and sample rate — the true duration, not an estimate. |
| a script-aware weight … a proper akshara count | the akshara rules | `wordWeight(word)` in `weights.js`: for Devanagari and Kannada, a state machine walks the codepoints, counting a consonant unless the previous character was a virama (which joins it into a conjunct with the consonant before), and letting matras, anusvara and visarga attach without incrementing the count; an independent vowel always counts. |
| hold a pause after punctuation, longer at a sentence end than a comma | pacing | `timing.js`'s `PAUSE_AFTER` table gives each punctuation mark a pause in word-weight-units (the danda and double danda included), added to the total the phrase's duration is divided by. |
| a highlight driver can mark the current one … a caption renderer that doesn't understand the tags still shows plain words | WebVTT karaoke tags | `writeVtt` puts a `<HH:MM:SS.mmm>` tag before every word after a cue's first, exactly the form the WebVTT spec defines for this; `parseVtt` reads it back the same way. |
| cache every synthesised phrase on disk under a hash | the fixture cache | `fixtureKey({ text, lang, voice, model, pace })` hashes only the fields that change the audio; `cache.js` writes `audio.wav` and a `request.json` with no key in it, ever. |
| a provider interface … a real adapter, confirmed against the provider's current docs | ports and adapters | `providers/index.js` defines the shape; `providers/stub.js` and `providers/sarvam.js` both implement `synthesize(req)`; the Sarvam adapter's endpoint, fields and model strings were read from docs.sarvam.ai on the day it was built, recorded in the Wave 4 brief, not assumed. |
| drive highlighting from a native `<audio>` and a native `<track kind="captions">` | native first | `<sg-narration>` enhances the native elements; without JavaScript they already give a person captioned audio with a play button. |
| matching words in playback order so a repeated word still lines up | stateful matching | `#mark` walks forward from the last matched span's index rather than searching from the start each time, so two occurrences of "the" resolve to the right one as the story plays. |
| reset that matching on a scrub | correctness under seeking | the `seeked` event clears the match state, so the next tick searches fresh instead of getting stuck past the seek point. |
| fall back to the browser's own voice, or to the page's own text and captions | graceful degradation | `speakFallback(text, opts)` calls `speechSynthesis`, reporting which mode ran; when neither that nor real audio is reachable, the static text and native captions already on the page are the narration. |

## Accessibility

- Captions are always present; the highlight never carries information the captions don't already give.
- The play control is the consent (decision 0015); narration never autoplays and is never gated by the ambient sound switch.
- `aria-current="true"` is the only signal on a word span — no colour-only cue.
- Pronunciation, register and word choice for a real script are a native speaker's job; `story/spread.json`'s `owner_to_confirm` and `pronunciation_notes` are the pattern for flagging what needs that review before it ships.

## Credit

The word-timing method — measure real audio, then spread by a script-aware syllable weight — is a workaround for a real gap: no mainstream Indian-language text-to-speech API publishes word-level timestamps as of this writing. It is an estimate, tested to read naturally, not a claim of precision.
