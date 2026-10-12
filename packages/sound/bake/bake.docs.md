# Sound bake

Bake and reflow for sound: read the spectrum once, then every frame is arithmetic.

A scene that moves with the sound does not need an FFT every frame. It needs "how loud is this moment, from 0 to 1?". `bakeFrames()` and `bakeBuffer()` take the spectrum once and keep it as a small table (plain JSON, 16 bands by time). `drive()` is the per-frame half: it reads the table at a time and gives back a number.

```js
import { bakeBuffer, drive, follow } from './bake.core.js';

// once, per chapter: a buffer the page already holds (nothing plays)
const chapter = bakeBuffer(audioBuffer, { hopMs: 50, label: 'the market' });

// every frame: the intensity at the chapter's own clock
let glow = 0;
function frame(ms, dt) {
  glow = follow(glow, drive(chapter, ms, { bands: [4, 9], reducedMotion }), dt);
  scene.style.setProperty('--glow', glow);
}
```

Under reduced motion `drive` returns `still(cache)`, one steady value for the whole chapter, so nothing pulses. It is the median moment, a typical one: `still(cache, { of: 'mean' })` gives the average level instead, which on a spiky chapter sits well above what the scene shows most of the time.

## Consent

This does not change who may make a sound (decision 0015). Baking reads numbers: no AudioContext is created, resumed or started, and the sound switch is never read. A buffer or an analyser is something the page already has under its own consent. Attach `capture` to what the page plays, never to a microphone: a microphone's spectrum is not output sound and decision 0015's consent does not cover it. When the sound switch is off the visitor is not hearing the track, so a scene should not move with it: paint the `still`, or stay quiet. `capture(analyser)` reads an analyser while a segment that already has consent is playing, and returns `null` if the analyser's context is not running; it will not resume one.

```js
import { capture } from './capture.js';
const chapter = await capture(analyser, { frames: 40, hopMs: 50 }); // null if nothing is playing
```

## Reading a table

- `drive(cache, atMs, { band, bands, floor, ceil, reducedMotion })`: 0..1. A time that is not a number counts as the start; a `bands` range may be given in either order. `band` is one band (0 is the lowest), `bands: [lo, hi]` a range, neither means all. `floor` and `ceil` are the energies that read as 0 and 1.
- `still(cache, opts)`: the segment's median frame as one steady value (`of: 'mean'` for the average).
- `follow(prev, target, dtMs, { attackMs, releaseMs })`: one step of an envelope that rises fast and falls slowly. You keep `prev`.
- `segment(cache, startMs, endMs)`: bake a whole track once, take its chapters by arithmetic.
- Bands are log-spaced from 60 Hz to 16 kHz, valued on the analyser's own decibel window (-100 to -30 dB read as 0 to 1), so a table from a buffer and one from an analyser read alike.

## Files

- `bake.core.js`: pure, runs in Node. `bakeFrames`, `bakeBuffer`, `drive`, `still`, `follow`, `segment`, `bandEdges`.
- `capture.js`: the analyser reader. Its only side effects are reads and a timer between them.
