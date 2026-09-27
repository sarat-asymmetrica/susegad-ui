# `<sg-player>`

Wraps a native `<video>` or `<audio>`. Without JavaScript the browser's own `controls` play, scrub and mute the media in full. With JavaScript, `<sg-player>` removes `controls` and builds its own bar: a play button, the time, a seek range, a captions toggle and a mute button.

```html
<sg-player poster-scene="kolam" treatment="ink" label="The story of the first rains">
  <video controls preload="metadata">
    <source src="spread.webm" type="video/webm">
    <track kind="captions" src="spread.vtt" srclang="en" default>
  </video>
</sg-player>
```

## Attributes

| Attribute | What it does |
|---|---|
| `register` | `quiet`, `warm` or `playful`, inherited from an ancestor by default. Sets how the scrubber is drawn. |
| `label` | The video or audio's accessible name (`aria-label`). |
| `poster-scene` | A scene name (`kolam`, `paus`, `tollem`, …). Its finished still is rendered once and shown as the poster, fading out the moment playback starts. |
| `treatment` | `ink`, `halftone`, `duotone` or `riso`. A WebGL shader pass over the video in that look. Video only; falls back to the plain video with no WebGL. |
| `annotations-src` | A URL to a WebVTT metadata track of timed ink annotations (see below). |
| `autoplay` (on the native `<video>`) | Honoured only muted, and only when the viewer hasn't asked for reduced motion. Content sound still plays only on the person's own play press. |

## Captions

Add a `<track kind="captions" src="…vtt" default>` inside the video or audio. `<sg-player>` sets its `mode` to `hidden` (the browser draws nothing of its own) and renders the active cue in the library's own type, over the bottom of the frame, on by default. Press **C**, or the CC button, to hide or show them; they stay in the DOM and in the accessibility tree either way. `<track>` timestamp tags inside a cue's text (word-level highlighting, as `packages/narration` writes) are stripped for display.

## Ink annotations

```js
document.querySelector('sg-player').annotations = [
  { type: 'circle', start: 4.2, end: 7.5, x: 0.62, y: 0.4, r: 0.08, label: 'the leak' },
  { type: 'arrow', start: 8, end: 11, x: 0.2, y: 0.8, x2: 0.55, y2: 0.35 },
];
```

`x`, `y` (and `x2`, `y2` for an arrow) are normalised 0 to 1, independent of the video's pixel size, so an annotation stays in place as the player is resized. Each fades in and out over about a quarter of a second at its own edges. `annotations-src` loads the same shape from a WebVTT metadata track instead, one JSON object per cue:

```vtt
WEBVTT

00:00:04.200 --> 00:00:07.500
{"type":"circle","x":0.62,"y":0.4,"r":0.08,"label":"the leak"}
```

## Video treatments

`treatment="ink"` (a two-tone wash), `"halftone"` (a rotated dot grid), `"duotone"` (two token colours mixed by luminance) or `"riso"` (three inks, each sampled with its own small offset, the way overprinted risograph plates misregister). Colours come from `--sg-pencil`, `--sg-surface` and `--sg-accent`, resolved for the page's palette and theme. With no WebGL, or a lost context, the plain video shows: never a blank or broken canvas.

## Keyboard

Space or **K** play or pause; **←**/**→** seek 5 seconds (15 with Shift); Home and End jump to the start and end; **M** mutes; **C** toggles captions. The seek range also takes its own Left/Right/Home/End as any native slider does.

## Events and properties

`<sg-player>` fires nothing of its own; listen to the native `<video>`/`<audio>` events (`play`, `pause`, `timeupdate`, `ended`, …) directly — the element never hides them. `annotations` (get/set) is the current list, normalised. The wrapped media element is `player.querySelector('video, audio')`.

## Accessibility

The play, mute and captions buttons are labelled and reflect their state (`aria-label`, `data-state`). The seek range has `aria-valuetext` naming the position in words ("1:02 of 4:15"). Captions are always in the accessibility tree. The scrubber's drawn ink is `aria-hidden`; the range input underneath is the real control.

## Registers

Quiet leaves the native range a plain hairline. Warm draws a warm ink line under the played portion over a faint pencil guide. Playful adds a small ringed bead at the playhead. None of this changes behaviour, only how the same scrubber looks.
