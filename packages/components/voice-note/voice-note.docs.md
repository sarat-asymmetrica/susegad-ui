# Voice note

`<sg-voice-note>` shows a voice message with a play button, a waveform, the length and the transcript. It enhances a native `<audio>`.

## Use

```html
<sg-voice-note peaks="…" label="from Maya">
  <audio controls preload="metadata" src="maya.m4a">
    <track kind="captions" src="maya.vtt" srclang="en" default>
  </audio>
  <p class="sg-voice-transcript">…</p>
</sg-voice-note>
```

Use `preload="metadata"` so the length shows before anyone presses play; `preload="none"` shows 0:00.

It can sit inside a `<sg-chat-thread>` message, in place of `.sg-chat-text`.

## At build time

```sh
ffmpeg -i maya.opus -ac 1 -ar 16000 maya.wav      # peaks.mjs reads 8- or 16-bit PCM WAV
node susegad/components/voice-note/peaks.mjs maya.wav 96
```

Paste the output into `peaks`. In an Astro page:

```js
import { readFileSync } from 'node:fs';
import { peaksFromWav } from '../susegad/components/voice-note/peaks.mjs';
import { transcriptHtml } from '../susegad/components/voice-note/voice-note.core.js';
const peaks = peaksFromWav(readFileSync('maya.wav')).join(' ');
const transcript = transcriptHtml(readFileSync('maya.vtt', 'utf8')); // spans with cue times
```

A hand-written transcript works too; it just can't mark the phrase being spoken.

## Attributes and events

| | |
|---|---|
| `peaks` | loudness per slice, 0 to 1, spaces or commas; at least four values. Without it the waveform is a seeded stand-in and `data-waveform="stand-in"`. |
| `label` | added to the button's name: "Play voice message, from Maya" |
| `register` | `quiet`, `warm`, `playful` |
| `sg-voice-play`, `sg-voice-pause` | from the audio's own events |
| `sg-voice-press` | the button was pressed; `detail.playing` |

## Registers

| | Look | Motion |
|---|---|---|
| quiet | hairline row, thin square bars | the bars fill as it plays |
| warm | pencil bars, inked play ring, italic transcript | the same |
| playful | bright pill, round bars, accent play button | the same, and the button springs when pressed |

## Reused

- `packages/player/player.core.js`: `formatTime`, `scrubberFraction`, `timeFromFraction`, `activeCue`.
- `packages/narration/vtt.js`: `parseVtt`, for `transcriptHtml()`.
- `packages/narration/wav.js`: `parseWav`, for `peaks.mjs`.

## Accessibility

- Plays only on its own press; `autoplay` is removed.
- Keyboard: Tab to the button (Space or Enter plays and pauses), Tab to the waveform (arrows, Home and End seek).
- The transcript is always shown. For a note without one, the element warns in the console.

## Notes

The dev server (`tools/serve.mjs`) now answers byte-range requests. Without them a browser can't seek audio and puts it back to 0:00; the keyboard check found this.
