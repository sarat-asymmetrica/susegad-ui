# The first rain (storybook spread)

One spread of a Goan children's storybook, "Paus" — a Goan child, home, the first afternoon the monsoon actually arrives — bilingual (English and Marathi), narrated, with word-by-word highlighting and captions. Built as Wave 7's opening proof of concept; the whole book comes later. The Marathi text and the speaker choice are drafts, not yet reviewed by a native speaker: see `story/spread.md`.

It composes:

| Piece | Used for |
|---|---|
| `<sg-scene name="paus">` | the window, rain intensity driven by the narration's beats, not the clock |
| `<sg-narration>` (`packages/narration/`) | drives word-by-word highlighting on the story paragraph, from the same `<track>` |
| `<sg-player>` (`packages/player/`) | the play bar: play, time, a scrubber, mute, and its own CC button (see "Captions" below for what it toggles here) |
| `wrapWords()` (`recipe.js`) | wraps a paragraph's words in `[data-word]` spans for the highlight driver, at mount time, so the static markup stays plain text |

## Files

| File | What it is |
|---|---|
| `index.html` | The page: a language switch, the scene, and one region per language, each with its own `<sg-player>` wrapping an `<audio>`, `<track kind="captions">` and story text. |
| `recipe.js` | `wrapWords(el)` and `mountStorybookSpread(root, { cues, defaultLang })`. Importing it registers `<sg-scene>`, `<sg-narration>` and `<sg-player>`; it wires nothing else until you call `mountStorybookSpread`. |
| `demo.js` | The demo page's wiring: fetches `story/spread.json` for its scene cues and calls `mountStorybookSpread`. Your own page passes its own cues (see below) instead of fetching `story/` directly, since a builder's project won't have that folder. |
| `recipe.css` | Layout: the toolbar, the scene, the two language regions. |
| `spread.en.wav`, `spread.en.vtt`, `spread.mr.wav`, `spread.mr.vtt` | The built narration: one audio track and one WebVTT file per language, built by `build.mjs` from `story/spread.json` through `packages/narration`'s fixture cache. |
| `build.mjs` | Builds the four files above. `node packages/recipes/storybook-spread/build.mjs [--provider stub\|sarvam]`. Every call goes through the cache; with no `SARVAM_API_KEY` it falls back to the stub and says so. |
| `story/` | Kathakar's: the readable spread (`spread.md`, with the native-reviewer and owner questions) and the machine-readable script (`spread.json`: phrases, pace, pauses, the speaker choice, scene cues, interface copy). Read here, never edited here. |

## How the scene is driven

`story/spread.json`'s `scene_cues.cues` is one array of `{ beat, params }`, shared by both languages because their phrase arrays have the same beat order. `<sg-narration>` fires `sg-phrase` (`{ index, start, end }`) once per phrase as the audio plays; `mountStorybookSpread` looks up `cues[index]` and calls `scene.set(cue.params)`. This means the window's rain intensity always matches what the words just said, in either language, and pausing or replaying the narration never desyncs it — it is driven by the beat, not by wall-clock time or percent-through-the-audio.

`params.progress` is a different idea (it clears the fog from the sill up to show a task's completion, never moved by time) and is not used here; only `params.intensity`.

## Captions: one source of truth

Both `<sg-player>` and `<sg-narration>` can read the same `<track kind="captions">`: the player draws its own caption line (the current phrase, meant to sit over a video's frame), and the narration driver highlights the current word in the story paragraph beside it. Showing both at once says the same sentence twice, with nothing to look at between them — and `<sg-player>`'s caption box is built for a video's frame, which an audio player doesn't have, so it would float with no picture behind it regardless.

The story paragraph is the one source of truth here: it's the page's actual content (not `aria-hidden`), it's always visible (not an optional overlay), and its word-by-word highlight already satisfies "captions always present." `recipe.css` hides `.sg-player__captions` for this page only (not in `packages/player/`, where the default is right for video). The `<track>` element and `<sg-player>`'s CC button both keep working underneath; the toolbar's old separate captions toggle was removed as redundant, since there's nothing honest for an on/off switch to do when the real captions can't be turned off.

## Building the narration

```sh
node packages/recipes/storybook-spread/build.mjs                    # from the cache, stub on any miss
node packages/recipes/storybook-spread/build.mjs --provider sarvam  # sarvam on a miss, if SARVAM_API_KEY is set
```

The fixture cache (`packages/narration/fixtures/`) means a repeat build costs nothing; only a genuinely new phrase, voice, model or pace triggers a network call. The Wave 4 build synthesised both languages once, real Sarvam audio, `bulbul:v3`, speaker `shubh` (per `spread.json`'s `speakers`), 37.9s English and 48.3s Marathi — see `docs/briefs/progress/karigar-narration.md` for the full call log and the small model-name test that preceded it.

## Without JavaScript

Both languages' story text is always visible as plain paragraphs. Each `<audio controls preload="metadata">` with its `<track kind="captions">` plays and captions with no JavaScript at all — the browser's own controls, the browser's own caption rendering. `preload="metadata"` loads only the header (so the control shows the real duration instead of "0:00 / 0:00"), never the audio itself; nothing plays before the control is pressed. Only the scene, the word-by-word highlight, and the language/captions toggles are JavaScript-enhanced; a `<noscript>` note says so in both languages.

## Use it on your own page

```js
import { mountStorybookSpread } from './recipe.js';
import spread from './story/spread.json' with { type: 'json' }; // or your own copy of the cues

mountStorybookSpread(document.getElementById('spread'), {
  cues: spread.scene_cues.cues,
  defaultLang: 'en',
});
```
