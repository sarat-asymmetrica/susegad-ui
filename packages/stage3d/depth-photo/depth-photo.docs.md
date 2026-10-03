# Depth photo

`<sg-depth-photo>` shows a photograph (or a drawing) with a depth map as a small 3D stage: the focus racks by depth, the camera can dolly in with true parallax, and water moves inside a mask. It enhances the `<img>` inside it, which stays the picture for everyone the canvas cannot reach.

Everyday uses: a homestay or hotel hero that pulls focus from the view to the room, a product shot that comes forward as you scroll, a case study that moves attention across one photograph.

## Use

```html
<!-- three is needed only for the live tier; map it, or let your bundler resolve it -->
<script type="importmap">{ "imports": { "three": "/vendor/three.module.js" } }</script>
<link rel="stylesheet" href="susegad/stage3d/depth-photo/depth-photo.css">
<script type="module" src="susegad/stage3d/depth-photo/depth-photo.js"></script>

<sg-depth-photo depth="balcao-depth.png" layers="balcao-layers.png" horizon="0.3" shore="0.5" keep="0.5 0.6" focus="0.2">
  <img src="balcao.jpg" alt="The balcão at dusk, the paddy fields beyond it">
</sg-depth-photo>
```

For a drawing, write the depth map from the drawing's own geometry: `packages/scenes/veranda` does this, exactly, for a drawn veranda. For a photograph, run a depth model once, offline (Depth Anything V2 Small is what story 1 uses), and scale its output to 0 far, 1 near. Pack the masks into `layers.png` (R water, G sky, B the subject).

Drive it from script:

```js
const dp = document.querySelector('sg-depth-photo');
dp.set({ focus: 0.87, dolly: 0.6 });   // numbers are clamped; unreadable ones are ignored
dp.place(0.46, 0.6, 0.87);             // where a photo point sits in the element now, in CSS px
dp.blurAt(0.2);                        // the blur radius, in CSS px, of a point at that depth
```

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `focus` | 0 to 1 (0 the horizon, 1 the nearest thing) | 0.2 |
| `aperture` | 0 to 2, a gain on the register's blur | 1 |
| `dolly` | 0 to 1 | 0 |
| `dolly-path` | `"dx dy forward pitchDeg"` in scene units | `"0 -0.06 0.28 -3"` |
| `parallax` | 0 to 2, a gain on playful's lean | 1 |
| `sea` | 0 to 2, a gain on the register's water | 1 |
| `clarity` | 0 to 1, local contrast where in focus | 0 |
| `keep` | `"u v"`, the photo point kept in view | `"0.5 0.5"` |
| `depth` | URL of the depth map (white near) | required |
| `layers` | URL of the masks (R water, G sky, B subject) | none |
| `horizon`, `shore` | the water's band, fractions of the height | 0.33, 0.48 |
| `treatment` | `photo`, `drawn` | `photo` |
| `renderer` | `auto`, `live`, `2d`, `still` | `auto` |
| `max-pixels` | the live tier's pixel budget | 1000000 |
| `duration` | seconds, for export | 12 |
| `register` | `quiet`, `warm`, `playful` | inherited |

## Properties, methods and events

- `tier` (read only): `live`, `2d` or `still`. `params`, `canvas`, `duration`.
- `set(params)`, `place(u, v, d)`, `blurAt(d)`, `still()`.
- The frame contract (story 1's `packages/story/frame.js`; its two helpers live in `story-shims.js` until then): `renderFrame(t)` draws exactly time `t` on the element's own canvas, with the pointer at rest; `canvasFor(width, height, { register, keep })` returns an off-screen target at exactly that size (`keep` reframes it, for a share card), with `set()`, `place()`, `renderFrame(t)` and `release()`.
- `sg-ready` after the first drawn frame (`detail: { tier, ms }`). `sg-tier` when the tier is chosen (`detail: { tier, reason }`, for example `"three.js did not load"`).

## Registers

| | Tier | Moves |
|---|---|---|
| quiet | 2D, never downloads three | nothing; the focus changes as state |
| warm | live | the water only; the rack focus as a transition |
| playful | live | livelier water, and the camera leans with the pointer or the phone's tilt |

Reduced motion, Save-Data and devices with 1 GB of memory or less draw in 2D. Without WebGL, or when three fails to load, it draws in 2D and says why. After a real WebGL context loss it carries on in 2D.

## Accessibility

- The `<img>` inside is the picture: write its alt as you would for the photograph alone. The canvas is `aria-hidden`.
- Nothing takes focus. The lean is decoration and never asks for motion-sensor permission.
- Forced colours show the photograph without the canvas.

## Depth edges

The live tier draws the surface twice. The near layer takes the nearest depth within one grid cell and drops any pixel farther than itself; the far layer, drawn behind it, keeps the map's own depth (and, around the subject in the layers map's blue channel, the farthest depth, with a small inpaint along the depth gradient). So a triangle stretched across a depth edge is never shown: on the story's share card the plate's left rim had a stretched band up to 30 px wide (mean 9.4 px over 188 rows), now drawn by the far layer. Give the element depth maps whose edges are clean steps where it matters (story 1's `build/layers.py` makes `depth-stage.png` that way).

## Performance

- On this build machine's Intel UHD GPU, a 390 x 844 phone stage at 3x (capped at 1.0 MP) averaged 18.3 ms a frame with the water moving, and a 540 x 720 desktop stage 16.6 ms. The water redraws at 30 Hz. The governor steps detail down on slower devices.
- The look pass only redraws when the water moves; the 2D tier draws once per change.
- Headless Chromium draws WebGL on the CPU (SwiftShader). There the rescue halves the pixels until frames are bearable, so its numbers say little about a real GPU.

## Known limits

- **Pixelation when the camera moves in close (a residual, not fixed).** The look pass samples the photo at up to 1280 px tall on screen (the photo's own height for an export). On the story's old phone stage (679 x 1471 device px) at the plate beat, the dolly shows about 63% of the photo's height, so it would need about 2,320 look px to be 1:1: at 1280 each look pixel spans 1.8 device px, and even the 2048 px web copy of the photo would span 1.13. Before `22b2366` the look was 768 px tall, 3.0 device px per look pixel. The mesh is 192 columns, about 5.6 device px a cell at that beat. Numbers computed from the code's sizing, not measured. The fix is a larger source (the 3000 x 4000 original) and a look target sized past 1280 when the dolly is close, at a memory and frame-time cost.

- **A jagged seam where the two layers meet (a residual, not fixed).** Where the near layer drops a stretched pixel, the far layer draws it, and the boundary between them follows the grid, not the object. Measured on the sev puri photo at the share card's moment (dolly 1, focus on the plate), at the plate's left rim, rendered at 2x (2400 x 1260): the band the far layer fills is **24.6 px wide on average, 60 px at most, over 284 rows**, and its outer edge steps **1.78 px RMS from row to row** (at 1x: 12.4, 30 and 1.43). At 2x that reads as a cut-out halo along the foil. Likely fixes: a finer grid near depth edges, or feathering the far layer into the near across the band. Measured with a `.shots` probe `rim.mjs` (debug: true paints the dropped band magenta).

## Budget

| File | Bytes |
|---|---|
| `depth-photo.js` (element) | 14.9 KB of 16 KB (decision 0009) |
| `depth-photo.core.js` (pure) | 3.8 KB (decision 0010) |
| `depth-photo.gl.js` (live renderer) | 15.4 KB (two stage layers since the share-card review; the 46,080 total was accepted on 26 Sep 2026) |
| `depth-photo.2d.js` (2D renderer) | 6.5 KB |
| `skins/*` | 2.3 KB |

three.js itself (npm `three` 0.186.1) is loaded only by the live tier.
