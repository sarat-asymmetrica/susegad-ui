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
| warm | graphite bars, inked play ring, italic transcript | the same |
| playful | bright pill, round bars, accent play button | the same, and the button springs when pressed |

## Reused

- `packages/player/player.core.js`: `formatTime`, `scrubberFraction`, `timeFromFraction`, `activeCue`.
- `packages/narration/vtt.js`: `parseVtt`, for `transcriptHtml()`.
- `packages/narration/wav.js`: `parseWav`, for `peaks.mjs`.

## Accessibility

- Plays only on its own press; `autoplay` is removed.
- Keyboard: Tab to the button (Space or Enter plays and pauses), Tab to the waveform (arrows, Home and End seek).
- The transcript is always shown. For a note without one, the element warns in the console.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The waveform drawing and the time text are hidden from assistive technology (the time is `aria-hidden`; the seek control's own value text says the same), and the audio's alternative is the transcript beside it. `packages/components/voice-note/voice-note.check.mjs`: "three measured waveforms and one marked stand-in, each drawn with bars" and "without JavaScript: the browser's controls and the transcript show for every note". |
| 1.2.1 Audio-only and video-only (prerecorded) | Meets with author's part | The transcript is always shown, never behind a control (`packages/components/voice-note/voice-note.docs.md`), and the element warns in the console when a note has none (`voice-note.js`, `STRINGS.noTranscript`). `voice-note.check.mjs` checks that the transcript shows for every note with JavaScript off. The transcript text itself is the author's. |
| 1.3.1 Info and relationships | Meets | A native `<audio controls>` is the base, and the element adds a real `<button>` and an `<input type="range">` with `aria-valuetext` ("0:03 of 0:37"): `voice-note.check.mjs`, "keyboard: Space plays and pauses; Tab reaches the waveform; arrows seek and it says where". The transcript is plain text in reading order. |
| 1.4.1 Use of color | Meets | The play state is carried by the button's name and its glyph (play or pause: "while playing: the button says Pause", `voice-note.check.mjs`), and where you are is in words ("0:03 of 0:37", the time text) as well as the filled bars. The spoken phrase is marked in the transcript by `data-current`. |
| 1.4.2 Audio control | Meets | Added because the component plays audio. A note plays only on its own press, and the same button pauses it: `voice-note.check.mjs`, "no sound before a press: play() never called, nothing playing", "one press, one play(): the audio moves, and only that note plays", "a second press pauses it" and "an autoplay attribute is removed and the note stays silent". The consent probe also runs on a page that plays on load to show it can fail ("control: a page that plays on load is caught by the same probe"). |
| 1.4.3 Contrast (minimum) | Meets | The transcript and the time text are `--sg-text` and `--sg-text-soft`, text roles: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: every text role on every surface is 4.5:1 or more"). axe, 0 violations: `voice-note.check.mjs`, "axe, <theme>, all three registers" for light and dark, and "axe without JavaScript". |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent at 1280 px, three registers, nothing wider than the screen (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | `voice-note.check.mjs`: "at 390 px: no sideways scroll, and play buttons are at least 24 px". Manual test, 2026-10-07: demo at 320 CSS px, three registers, page width 320 (throwaway Playwright script). |
| 1.4.11 Non-text contrast | Meets | The unplayed bars are the seek control's visible track, and in every register they are 3:1 or more against what they sit on: quiet `--sg-rule-strong`, warm `--sg-rule-strong` (it was `--sg-pencil`, 1.81:1 to 3.27:1), playful `--sg-text-soft` (`packages/components/voice-note/voice-note.css`). `packages/components/voice-note/voice-note.check.mjs`: "the unplayed bars are 3:1 against their ground in 4 palettes x light and dark x 3 registers" reads the painted stroke and ground in 24 cells; before the fix it failed in 5 or more warm cells (lowest 2.14), and now the lowest is 3.10. The played bars (`--sg-accent-text`) and the position in words ("0:03 of 0:37") were never affected. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, page width 320 with no sideways scroll (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `voice-note.check.mjs`, "keyboard: Space plays and pauses; Tab reaches the waveform; arrows seek and it says where": Space on the button, then Tab to the waveform and the arrow keys. Home and End seek too (`packages/components/voice-note/voice-note.docs.md`). |
| 2.1.2 No keyboard trap | Meets | Manual test: `packages/components/voice-note/voice-note.js` adds a button and a native range and sets no `tabindex` and no `keydown` trap; the same check presses Tab from the button to the waveform and onward. |
| 2.2.2 Pause, stop, hide | Meets | Nothing moves until the person plays the note, the same button pauses it, and the fill of the bars and the marked phrase follow the audio, not a timer: `voice-note.check.mjs`, "while playing: the button says Pause, the bars fill, the spoken phrase is marked" and "a second press pauses it". |
| 2.3.1 Three flashes or below threshold | Meets | The bars fill left to right and the transcript marks one phrase at a time (`voice-note.check.mjs`, same check); nothing blinks or changes brightness faster than the speech. The press spring is a transform only (`packages/components/voice-note/voice-note.test.js`, "the press springs only at full motion, transform only"). |
| 2.4.3 Focus order | Meets | The play button, then the waveform, then the transcript in the document: `voice-note.check.mjs`, "Tab reaches the waveform". |
| 2.4.7 Focus visible | Meets | `packages/components/voice-note/voice-note.css` sets a `:focus-visible` outline on the button and the waveform; `voice-note.check.mjs` finds a solid ring on the waveform (`ring === 'solid'`), and `tools/touch.check.mjs` Tabs onto the first focusable control in the component, in the quiet register, and requires an outline, ring or style change. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/voice-note/voice-note.css` uses no `position: fixed` or `sticky` and no overlay. A sticky header or banner the page adds can cover the note when it takes focus. |
| 2.5.3 Label in name | Not applicable | The play button shows a glyph, not a text label, and takes its name from `aria-label` ("Play voice message", with the note's `label` after it): `packages/components/voice-note/voice-note.js`. The visible time text is `aria-hidden` and is not a label for a control. |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07: the play button is 40 by 40 px and the waveform 156 by 36 px at 1280 px, in all three registers (throwaway Playwright script on the demo). `voice-note.check.mjs` requires 24 px or more at 390 px. |
| 4.1.2 Name, role, value | Meets | A named button whose name changes with the state ("Play voice message", "Pause voice message") and a range named "Position in the voice message" with `aria-valuetext`: `voice-note.check.mjs`, "while playing: the button says Pause" and the keyboard check. axe: 0 violations in all registers, light and dark, and with JavaScript off (the same file). |

**The page author owns:**

- The transcript: a `.sg-voice-transcript` element with the words that are said, in the language of the audio, and `lang` on it when that differs from the page (1.2.1, 3.1.2).
- The note's `label`, so the button says which note it plays ("Play voice message, from Maya").
- The built-in words ("Play voice message", "Pause voice message", "Position in the voice message", "of") are fixed English in `voice-note.core.js`; on a page in another language they are a passage in English: mark it with `lang` (3.1.2) or ask for them to be made replaceable.
- Sticky headers and banners that could cover the note when it takes focus (2.4.11).

## Notes

The dev server (`tools/serve.mjs`) now answers byte-range requests. Without them a browser can't seek audio and puts it back to 0:00; the keyboard check found this.
