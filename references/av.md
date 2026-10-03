# Sound, narration and video

*Reference file for [`SKILL.md`](../SKILL.md), split out in rung 7 of docs/requests/2026-09-28-open-the-door.md so the top file stays short. Content moved verbatim; nothing here is new.*

## 9. Add sound, narration and video

Sound is the last thing a page gets and the first thing a person can refuse. Decision 0015 sets the rules, and every piece here follows them.

**Two kinds of consent.**
- **Interface and ambient sound** (the vocabulary, soundscapes, haptics) plays only when the global switch is on. The switch is off by default and remembered per viewer. Nothing plays before a gesture on the page, even when the remembered switch is on.
- **Content sound** (narration, video) plays when the person presses its own play control. That press is the consent. It doesn't need the switch and doesn't turn it on. Nothing autoplays with sound.

The register sets the vocabulary: quiet plays confirmations only, warm plays everything softly, playful plays the full vocabulary. Reduced motion doesn't silence sound.

### The switch and the vocabulary (`sound`)

```js
import { soundOn, setSoundOn, onSoundChange, play, haptic } from './src/lib/susegad/sound/index.js';
play('confirm', { register: 'warm' });   // a no-op unless the switch is on and a gesture has happened
haptic('confirm');                        // the paired vibration, same rules
```

The four words are `tick`, `confirm`, `complete` and `error` (a gentle error, never an alarm). Toast, stamp, form and date range already call `play()`; a new component does it the same way, in one line. Offer the setting with `<sg-sound-switch>`, and put it anywhere: several on one page stay in sync. Without JavaScript it says plainly that sound needs JavaScript.

### Soundscapes

`attachPausRain(sceneEl)` makes each new raindrop in `<sg-scene name="paus">` a panned tick (four voices at most). `attachRamponKoel(sceneEl)` gives `<sg-scene name="rampon">` a koel in bouts that speed up, in playful only. Both are opt-in (the page calls them), and both stop when the scene leaves the viewport, the tab is hidden or the switch goes off.

### Narration (`narration`)

Narration is synthesised phrase by phrase (Sarvam `bulbul:v3` by default, or the silent stub offline). Word timings are estimated from each phrase's measured length and its syllables (aksharas for Devanagari and Kannada), because no provider publishes word timestamps, and they're written as WebVTT.

- `node packages/narration/synth.mjs` fills the cache and calls the network only for misses. The key is read from `SARVAM_API_KEY` at run time and never written anywhere.
- `<sg-narration>` wraps the audio and the text: it marks the current word with `aria-current` and fires `sg-phrase` at each phrase, which is how the storybook spread moves its scene with the story.
- Without the network it falls back to the browser's speech with its word boundaries, or to captions only, and says which.
- Commit the built audio and VTT a recipe uses. The phrase cache is disposable.

### The player (`player`) and export (`export`)

```html
<sg-player poster-scene="kolam" treatment="ink">
  <video controls preload="metadata">
    <source src="clip.webm" type="video/webm">
    <track kind="captions" src="clip.vtt" srclang="en" default>
  </video>
</sg-player>
```

- Without JavaScript, the browser's own controls play it in full.
- With JavaScript: a drawn scrubber (a hairline in quiet, an ink line in warm, a kolam bead in playful), captions in our type (on by default, C toggles them), and a scene's still as the poster.
- `treatment` is `ink`, `halftone`, `duotone` or `riso`. It's a WebGL pass that stays hidden until it has drawn, and it falls back to the plain video when there's no WebGL.
- `player.annotations = [{ type: 'circle' | 'arrow', start, end, x, y }]` draws timed ink marks on the moving frame.
- Keys: space or K to play and pause, arrows to seek 5 s (15 s with Shift), M to mute.
- For narrated text, wrap the `<audio>` in `<sg-player>` inside `<sg-narration>`, and let the highlighted text be the captions, as the storybook spread does.

`packages/export` turns any scene into a PNG (`canvasToPng`), a WebM (`recordSceneToWebm`, timed by the scene, not the wall clock) or an animated GIF (`recordSceneToGif`, no dependencies). A WebM from `MediaRecorder` has no seek index, so it plays straight through but can't be scrubbed outside the player.
