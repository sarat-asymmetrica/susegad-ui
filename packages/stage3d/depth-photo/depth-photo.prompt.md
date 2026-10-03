# Depth photo

*A photograph with a depth map, seen through a camera: the rack focus of a film lens, a slow dolly, and water that moves inside its own mask.*

The picture stays an ordinary `<img>`, with its alt text, for everyone the canvas cannot reach. Over it, three.js draws the same picture as a surface pushed back to each pixel's depth, so moving the camera gives true parallax, and a lens model blurs every pixel by how far it sits from the focus. Where three cannot run, or should not (quiet, reduced motion, Save-Data), a 2D canvas draws the same frame at rest, and the focus still racks.

```html
<script type="importmap">{ "imports": { "three": "/vendor/three.module.js" } }</script>
<link rel="stylesheet" href="susegad/stage3d/depth-photo/depth-photo.css">
<script type="module" src="susegad/stage3d/depth-photo/depth-photo.js"></script>

<sg-depth-photo depth="depth.png" layers="layers.png" horizon="0.334" shore="0.478" keep="0.46 0.56" focus="0.21">
  <img src="photo.jpg" alt="A paper plate of sev puri on a laterite ledge, the bay behind it">
</sg-depth-photo>
```

| Attribute | Values | What it does |
|---|---|---|
| `focus` | 0 to 1 | The depth that is sharp: 0 is the horizon, 1 the nearest thing. |
| `aperture` | 0 to 2 | A gain on the register's blur. |
| `dolly`, `dolly-path` | 0 to 1; `"dx dy forward pitchDeg"` | How far the camera has moved along its path. |
| `parallax`, `sea`, `clarity` | 0 to 2, 0 to 2, 0 to 1 | Gains on the pointer lean, the water, and local contrast where in focus. |
| `keep` | `"u v"` | The photo point kept in view when the frame crops it. |
| `depth`, `layers`, `horizon`, `shore` | URLs; fractions | The depth map; the masks (R water, G sky, B subject); the water's band. |
| `treatment` | `photo`, `drawn` | Draw the photo, or a child `img` or `canvas` with `data-treatment="drawn"`. |
| `renderer` | `auto`, `live`, `2d`, `still` | Force a tier. |

## The prompt

Make a web component that shows a photograph with a depth map as a small 3D stage. Keep the photograph as a real `<img>` with alt text inside the element and lay a canvas over it, hidden from assistive tech, so the picture is there with no JavaScript, no WebGL, or before anything loads. Load three.js with a dynamic `import('three')`, and only when the element will actually move; if the import fails, say why once in the console and draw in 2D. Draw in two passes. First, a look pass in the photo's own coordinates: grade the photo so its blacks lift toward our ink colour and its whites ease toward paper, add a fixed grain, and inside the water mask flow the pixels toward the viewer with two phases crossfaded (a flow map), faster nearer the shore, with slow light bands rolling in; render it to a mipmapped target and only again when the water has moved. Second, a stage pass: a grid mesh whose vertices are pushed back to each pixel's distance, placed on the rays of a rest camera so the rest view reproduces the photo exactly and any camera move is true parallax. Take the nearest depth within one grid cell for the geometry, so the stretched triangles at a depth edge fall on the far, soft side instead of making teeth along the near edge. In its fragment shader, gather the look over each pixel's circle of confusion on a golden-angle spiral, counting a tap only if its own blur reaches that far, so a sharp plate never bleeds into the soft sea; use fewer taps for small circles and a mip level to pre-blur what they skip. Give it three registers: quiet draws the graded still with the 2D renderer and never downloads three; warm moves only the water; playful adds a pointer and tilt lean and livelier water. Under reduced motion, draw the still. Pause off screen, watch frame time with a quality governor, and halve the pixels when frames stay far too slow. Expose `duration`, `renderFrame(t)` and `canvasFor(width, height)` so an exporter can render exact frames.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| keep the photograph as a real `<img>` | native first | `static native = 'img'`. The canvas is `aria-hidden` and only fades in over the image after its first frame lands (an opaque WebGL canvas is black until then). |
| only when the element will actually move | lazy tier | `chooseTier()` (pure) returns `live`, `2d` or `still`. Only `live` calls `loadThree()`, which caches one `import('three')` and resolves `null` on failure. |
| a flow map | two-phase crossfade | `LOOK_FRAG` samples the photo at `uv - flow * (phase - 0.5)` for two phases half a cycle apart and mixes them by `abs(phase0 * 2 - 1)`, so each phase resets while it is invisible. `seaFlow()` in the core is the same curve, tested. |
| on the rays of a rest camera | reprojection | `STAGE_VERT` puts each vertex at `(ndc * tan * z, -z)` with `z` from the depth; `projectPoint()` in the core does the same maths, and a test proves the rest camera maps every point back to its own pixel. |
| the nearest depth within one grid cell | dilation | Nine depth taps per vertex, `max()`ed, before the vertex moves. |
| counting a tap only if its own blur reaches that far | scatter as gather | `w = smoothstep(r - 0.15 c, r + 0.05 c, coc(tap))`, the standard fix for a sharp subject's halo. |
| the circle of confusion | lens model | `coc()` in `story-shims.js` (story 1's `components/focus/focus.core.js`): proportional to `|depth - focus|` past an in-focus band. The same model drives `<sg-focus>` and the 2D renderer. |
| draw in 2D | three blur levels | `depth-photo.2d.js`: the graded photo at full, half and no blur, mixed per pixel by masks computed from the depth map for this focus. Painted once per change. |
| halve the pixels when frames stay far too slow | rescue | The engine governor ignores frames over 250 ms, so three frames over 120 ms in a row halve `max-pixels` here, down to an eighth. |
| exact frames | frame contract | `renderFrame(t)` draws time `t` with the pointer at rest and reads one pixel back before it resolves. `canvasFor(w, h)` builds its own renderer at exactly `w` x `h`. |

## Accessibility

- The picture's words are the `<img>` alt. The canvas, the drawing and the water are decoration.
- Nothing here takes focus or needs a key. The playful lean follows the pointer or the phone's tilt, and never asks for tilt permission.
- Reduced motion draws the still in every register, with no loop running.
- Forced colours hide the canvas and show the photograph.

## Credit

Grown from the Susegad scenes' WebGL helper (`engine/src/gl.js`) and Tollem's 2D fallback discipline. The depth map comes from Depth Anything V2 Small (Apache-2.0), run offline by story 1's `tools/depth`. The rack focus is a cinematographer's move; the owner's photograph of sev puri by the bay at Reis Magos is its first subject.
