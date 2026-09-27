# packages/export

A scene (or any canvas) to PNG, WebM and animated GIF, for social posts and
for the sample video `packages/player`'s demo and checks use — the library
dogfoods itself; nothing here fetches anything from the web.

```js
import { canvasToPng, recordSceneToWebm, recordSceneToGif } from './index.js';
import kolam from '../scenes/kolam/index.js'; // the scene's own default export, from defineScene()

const png = await canvasToPng(myCanvas);
const webm = await recordSceneToWebm(kolam, { register: 'warm', seed: 7, durationSec: 3, fps: 24 });
const gif = await recordSceneToGif(kolam, { register: 'warm', seed: 7, durationSec: 3, fps: 10 });
```

## PNG (`png.js`)

`canvasToPng(canvas)` wraps `canvas.toBlob`. `svgToPng(svg, { width, height, scale, background })`
rasterises an inline `<svg>` (serialised, loaded as an `Image`, drawn to a
canvas) — for the SVG scenes and skins that have no canvas of their own.
`blobToDataUrl(blob)` inlines a PNG for a Folio document or a poster.

## WebM (`webm.js`)

`recordCanvasToWebm(canvas, { fps, durationSec, draw })` opens
`canvas.captureStream(0)` — a stream that takes **no** automatic frames —
and calls `draw(t, i, frames)` once per frame, requesting exactly that frame
from the track afterwards. The recording is therefore exactly the frames
asked for, at exactly the times asked for, never whatever the wall clock
managed while `MediaRecorder` was running: the same seed and frame count
give the same video, run to run, however loaded the machine is.

`recordSceneToWebm(def, { seed, register, params, fps, durationSec })` drives
a scene definition's own `model()` and `createRenderer()` directly at fixed,
evenly spaced times (never the scene's wall-clock loop), so a scene export
is reproducible the same way.

**Known limitation: the WebM this writes is not scrubbable in Chromium.**
`MediaRecorder` does not write a Cues (seek index) element, so Chromium
reports the file's `video.seekable` as `[0, 0]` however much is buffered —
confirmed directly against a sample clip (`packages/player/fixtures`,
`readyState === 4`, fully buffered, `seekable` still `[0, 0]`). The clip
plays straight through correctly and its duration reads correctly once
seeked once (the standard workaround), but a person cannot drag a scrubber
to an arbitrary point without an external remux (for example
`ffmpeg -c copy` to add Cues). See `packages/player/fixtures/README.md` for
how this shaped that package's own checks. Worth a follow-up if an exported
clip ever needs to be scrubbed outside this library.

## GIF (`gif.js`, `gif.core.js`)

`gif.core.js` is a small, dependency-free GIF89a encoder: median-cut palette
quantisation, nearest-colour indexing, and an LZW core matching GIF's own
variable-code-size variant, all pure and tested in Node against a
from-scratch reference decoder (not a claim that any particular GIF viewer
accepts the output, only that the bytes follow the format's own rules).
`gif.js` is the browser edge: paint a frame, read its pixels with
`getImageData`, repeat, encode. `recordSceneToGif` mirrors
`recordSceneToWebm`'s fixed-time driving of a scene.

## Budget

18 KB of behaviour source for the whole package; see `registry.json` for the
breakdown. `gif.core.js` alone is the biggest part (7.9 KB) and is the one
piece with real algorithmic weight (median cut, LZW), which is why it is
separated out and tested on its own, the way a component's `*.core.js` is
(decision 0010).
