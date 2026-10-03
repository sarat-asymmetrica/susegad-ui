# Voice note

*A voice message the way it shows up on a phone: a guest's spoken review, a founder's thank-you, a tour guide's note from the fort.*

The words matter more than the sound, so the transcript is always on show. The sound plays only when someone presses play.

```html
<link rel="stylesheet" href="susegad/components/voice-note/voice-note.css">
<script type="module" src="susegad/components/voice-note/voice-note.js"></script>

<sg-voice-note peaks="0.12 0.64 0.9 0.41 …" label="from Maya">
  <audio controls preload="metadata" src="maya.m4a">
    <track kind="captions" src="maya.vtt" srclang="en" default>
  </audio>
  <p class="sg-voice-transcript">The children wore the new kurtas all weekend.</p>
</sg-voice-note>
```

## The prompt

Make a web component that turns a native `<audio controls>` into a voice message like a phone's: a round play button, a waveform, and the length. Keep the transcript beside it visible at all times; without JavaScript the browser's own controls and the transcript are the whole thing. Never play until the play button is pressed, and remove any autoplay. Use a real `<button>` whose name says Play or Pause, and lay a native range input, invisible, over the waveform so arrows and screen readers seek, with the time in words as its value text. Draw the waveform from loudness measured once at build time from the audio file (root mean square per slice, not the single loudest sample, which is flat for speech), passed in a `peaks` attribute; when there are no peaks, draw a seeded stand-in and mark the element so it's clear it's a drawing. Fill the bars as the audio plays, and only then. If the transcript's phrases carry start and end times, mark the phrase being spoken. Give it three registers. Quiet: a hairline row with thin square bars. Warm: pencil bars whose ends wander a little, an inked ring around the play button, the transcript as an italic note. Playful: a bright pill with round bars, and the button springs when pressed, never under reduced motion.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| turns a native audio into | progressive enhancement | The element removes `controls` and adds its own bar after the audio; `disconnected()` puts them back. |
| never play until pressed | consent (decision 0015) | Only the button's click calls `play()`. `autoplay` is removed with a warning. The check wraps `HTMLMediaElement.prototype.play` and counts zero calls before the press. |
| an invisible native range over the waveform | native first | `<input type="range" max="1000">` fills the wave's box at opacity 0, with `aria-valuetext` "0:12 of 0:42" from `timeText()`; the wave draws the focus ring with `:has(input:focus-visible)`. |
| loudness measured once at build time | a Node tool | `peaks.mjs` reads a WAV header with narration's `parseWav()` and prints RMS per slice, scaled to the loudest. `barsFrom()` fits them to the bars that fit the width, keeping each slice's loudest. |
| a seeded stand-in … marked | honesty | `standInPeaks(seed)` from seeded noise; the element sets `data-waveform="stand-in"` (or `"measured"`). |
| fill the bars as the audio plays | honest motion | The skin re-marks bars on `timeupdate` from `scrubberFraction()` (the player's). Nothing loops. |
| mark the phrase being spoken | cues | `transcriptHtml(vtt)` builds one span per cue with narration's `parseVtt()`; `activeCue()` (the player's) picks the current one. |
| the button springs | Web Animations | `press(motion)` returns a scale keyframe set at full motion only. |

## Accessibility

- A real button (40 px) with a name that says what it will do; a native range for seeking.
- The visible time is `aria-hidden` because the range's value text says the same.
- The transcript is plain text in the page, with and without JavaScript.
- Forced colours: the bars use GrayText and Highlight.
