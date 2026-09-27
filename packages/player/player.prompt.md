# Player

*A window that has been painted over: the moving picture is still there, but you're watching it the way you'd watch rain through the glass.*

The Susegad player: a light-DOM element that enhances a native `<video>` or `<audio>` so the no-JavaScript page is a full, working player. With JavaScript it replaces the browser's chrome with a drawn scrubber, shows captions in our own type, opens on a poster that is a scene's still frame, and can pass the video through a shader treatment (ink, halftone, duotone or riso) with ink annotations timed to the moving frame.

```html
<link rel="stylesheet" href="susegad/player/player.css">
<script type="module" src="susegad/player/player.js"></script>

<sg-player poster-scene="kolam" treatment="ink">
  <video controls preload="metadata">
    <source src="spread.webm" type="video/webm">
    <track kind="captions" src="spread.vtt" srclang="en" default>
  </video>
</sg-player>
```

## The prompt

Build a video (or audio) player as a light-DOM custom element, `<sg-player>`, that enhances a native `<video controls>` or `<audio controls>` child, so a page with no JavaScript still plays, scrubs and mutes with the browser's own chrome. With JavaScript, hide the native controls and build your own bar: a play button, the time and duration in tabular numerals, a native `<input type="range">` for seeking (so keyboard and screen-reader support come for free), a mute button and a captions toggle, each labelled for a screen reader. Draw the scrubber in three registers over the (visually hidden, still functional) range input: quiet leaves it a plain hairline track; warm draws a warm hand-inked line under the played portion, over a faint pencil guide for the rest, using the engine's own `ink()`; playful adds a small ringed bead riding the playhead, the way a bead sits on a kolam's line. Read captions from a `<track kind="captions">`, set its mode to hidden so the browser draws nothing of its own, and render the active cue yourself in the library's type, always present and on by default, toggled with the C key. Take a `poster-scene` attribute naming a Susegad scene; render that scene's finished still to a canvas once, show it as a drawing poster over the video, and fade it out the moment playback starts. Support a `treatment` attribute (`ink`, `halftone`, `duotone`, `riso`): pass the playing video's frames through a WebGL shader that samples the video as a texture and redraws it in that look, using colours converted from the tokens' OKLCH into linear RGB; when WebGL is missing, show the plain video rather than a broken canvas. Accept a list of timed ink annotations, each a circle or an arrow at normalised coordinates between a start and an end time, fading in and out at each edge, and draw them on a transparent canvas registered over the moving frame. Handle Space to play or pause, the arrow keys to seek five seconds (fifteen with Shift), Home and End to jump to the ends, M to mute and C for captions. Content sound plays only on its own play press: never unmute or start audio without that gesture, and only offer muted autoplay when the author sets `autoplay` and the viewer hasn't asked for reduced motion.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| enhances a native `<video controls>` … child | progressive enhancement | The native element keeps its role, keyboard and no-JS behaviour; `connected()` only removes `controls` and builds the custom bar once JavaScript has actually run. |
| a native `<input type="range">` for seeking | native-first accessibility | The range input gets arrow-key, Home/End and screen-reader slider behaviour from the browser; `player.core.js`'s `scrubberFraction`/`timeFromFraction` are the only maths needed to keep it and the video in step. |
| draws a warm hand-inked line … using the engine's own `ink()` | reuse (A6) | `skins/warm.js` and `skins/playful.js` paint onto a small canvas beside the native range, with the engine's `ink()` — the same stroke every scene draws with, not a second implementation. |
| render that scene's finished still to a canvas once | reuse, one-shot | `poster.js` mounts a throwaway `<sg-scene>`, calls its own `still()`, copies the canvas it drew, and tears the scene down: a real Susegad drawing, not a video's first frame. |
| a WebGL shader that samples the video as a texture | GPU pass, honest fallback | `treatments.js` uploads each video frame with `texImage2D` and runs one of four fragment-shader looks; `ok: false` (no WebGL, a lost context) shows the plain video instead of a blank canvas. |
| colours converted from the tokens' OKLCH into linear RGB | the one conversion point | `treatments.core.js`'s `oklchToLinearSrgb`/`oklchToRgb` are the tested source of truth; the GLSL mirrors the same maths because a shader can't import JavaScript. |
| a list of timed ink annotations … fading in and out | pure timing, then ink | `annotations.core.js`'s `activeAnnotations` is a pure function of a time and a list, tested in Node; `annotations.js` turns what it returns into `ink()` strokes on a canvas over the frame. |
| Content sound plays only on its own play press | consent (decision 0015) | The element never calls `.play()` or unmutes on its own; `autoplay` is honoured only muted, and even then only when `prefers-reduced-motion` is off. |
