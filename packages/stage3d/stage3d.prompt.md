# Stage3d

*The three.js tier: loaded late, and only when a live 3D drawing is about to be seen.*

A small module every stage3d element uses to decide whether to draw live in 3D, draw in 2D, or show a still, and to load three.js only for the first. The maths it shares (reprojecting a photo with a depth map, fitting a camera window to any frame, a dolly path) is pure and tested in Node.

```js
import { loadThree, webglAvailable, liteDevice, watchVisible, chooseTier } from 'susegad/stage3d/stage3d.js';

const tier = chooseTier({ webgl: webglAvailable(), motion: 'ambient', lite: liteDevice() });
const THREE = tier === 'live' ? await loadThree() : null;   // null: draw the 2D still
```

## The prompt

Make a small ES module that is the only place three.js enters a front-end library whose core has no dependencies. Load three with a dynamic `import('three')`, once, cached, and resolve `null` instead of rejecting when it is blocked, missing or throws, with one console warning that says what happened. Let a page swap the loader for a vendored copy. Test for WebGL2 once and release the test context. Treat Save-Data and 1 GB of memory or less as a lite device. Watch an element's visibility and the tab's, so a stage pauses off screen. In a separate pure module, choose the tier from what the device can do and what the reader asked for: reduced motion and the quiet register always draw in 2D and never download three; no WebGL, no three or a lite device draw in 2D; otherwise live; an explicit renderer attribute wins. Put the camera maths there too: map depth to distance linearly in inverse distance, put each photo point on the rest camera's ray so the rest view reproduces the photo exactly, compute the frustum window that covers any viewport like `object-fit: cover` while keeping a chosen point in view, and move the camera along a dolly path with a clamped pointer lean.

Then give it words in z-space (decision 0029): the type tier lays the lines, this tier only paints them. Turn a 3D object's silhouette on the screen into a shape for the type tier (a function of a band of lines, and a polygon descriptor for the text gate), and with the same lines make a textured quad for each line in the object's own scene and camera, so the words stand beside it with real depth. Draw each line's texture with the font string the layout measured, at the screen's density, again only when its text changes; ask the engine where it puts a baseline rather than computing it. The words stay in the page as real text, and a canvas only repeats them, never replaces them: their ink goes transparent only while the quads are on screen, and comes back the moment they are not (forced colours, a lost context, a failed load). Never import the type tier from here.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| once, cached | a shared promise | `loadThree()` keeps one promise; `setThreeLoader(fn)` replaces the loader and resets it. |
| resolve `null` instead of rejecting | fail soft | The loader's rejection is caught; the element reads `null` and builds the 2D renderer. The `sg-tier` event carries the reason. |
| never download three | tier choice | `chooseTier({ motion: 'still' \| 'state' })` returns `'2d'` before anything else is considered. |
| on the rest camera's ray | reprojection | `reproject(u, v, d, tanX, tanY)` and `projectPoint()`; a test proves the round trip at rest. |
| like `object-fit: cover` | frustum window | `coverWindow(va, pa, tanY, { keep, overscan })` crops the long side and clamps the kept point so the window never leaves the photo. |
| a shape for the type tier | occlusion | `extentIn`, `flowShape(col, extent, pad)` (a function for `layIntoShape`), `silhouetteOf(screen)` (a polygon descriptor for `shapeOf` and the gate), `hugFloat(screen, col)` (a CSS float and `shape-outside` polygon for the still). Pure, `occlusion.core.js`; `projectMeshes` in `occlusion.live.js` reads a mesh's vertices through a camera. |
| words with depth | textured quads | `createTextQuads(THREE, { scene, camera })` in `text.live.js`: `set(plan, frame)` for each line from `quadPlan(lineBoxes(lines, col), …)`; one canvas texture per line, redrawn only when its key changes; `visible` for the caller to flip with the spans' ink. |
| one layout, two painters | line boxes | `lineBoxes(lines, col)` once; `spanStyle` for the DOM spans and `quadPlan` for the quads read the same boxes, so their texts and positions are the same by construction. |

## Budget

stage3d.js 4.4 KB and stage3d.core.js 5.6 KB, budgeted apart from the dependency-free layers (decision 0017). three itself is recorded per story, as bundled.
