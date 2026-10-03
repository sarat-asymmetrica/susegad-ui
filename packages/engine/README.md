# Engine

The pencil box every Susegad scene draws with. Grown from the Susegad sketchbook's `lib/sketch.js`, plus the fields, governor and WebGL helper the plates had each written for themselves.

Import everything from `index.js`:

```js
import { run, ink, paper, makeNoise, createGovernor } from '../../engine/index.js';
```

Pieces draw in fixed logical units (say 1200 × 800). The stage scales that to the element and the screen's pixel density, so a piece never thinks about `devicePixelRatio` or resizing.

## Modules

Pure modules touch no DOM and are tested in Node.

| Module | What is in it |
|---|---|
| `src/math.js` | `TAU`, `clamp`, `lerp`, `invLerp`, `smoothstep`, `dist`, `phase` (progress through a time window), `ease.*`, `boil` (the hand-drawn "on twos" clock) |
| `src/rng.js` | `hashSeed` (number or string), `rng` (mulberry32 with `range`, `int`, `pick`, `chance`, `sign`, `gauss`) |
| `src/noise.js` | `makeNoise(seed)`, seeded 3D Perlin with `.fbm`; `N`, the shared field strokes use |
| `src/color.js` | `hexToRgb`, `rgba`, `mix` |
| `src/geom.js` | `resample`, `catmull`, `chaikin`, `measure` (arc length and `at(d)`), `ellipse`, `blob`, `roughen`, `bbox` |
| `src/fields.js` | `flow` (noise flow field), `curl`, `domainWarp`, `sampleGrid`, `contours` (marching squares), `poissonDisc`, `grayScott` / `gsSpot` / `gsStep` |
| `src/governor.js` | `createGovernor`: frame times in, a detail level (0.25 to 1) out |
| `src/light.js` | `sunAt` (where the sun is over a day), `shadowLength` (`h / tan(e)`, the one number checkable against a sundial), `shadowDir`, `daylight` |
| `src/motion.js` | `follow` / `followAll` (exponential, frame-rate independent), `spring` / `makeSpring` (damped oscillator, damping as a ratio), `lagged`, `lagAndTension`, `pendulum`, `cycle`, `visit` |
| `src/wave.js` | `front` / `radialFront` / `linearFront` / `weightedFront` (a wavefront over real distance), `arrivalTime`, `phaseShifted`, `spread` (discrete cellular) |

Canvas edge modules need a browser.

| Module | What is in it |
|---|---|
| `src/stage.js` | `stage`: the canvas, DPR, resize, cached layers |
| `src/loop.js` | `loop` (the heartbeat; DOM-free when `matchMedia` and `raf` are injected) and `run` (stage + loop + reduced motion) |
| `src/pointer.js` | `pointer`: position in logical units, down and inside flags |
| `src/paper.js` | `grainPattern`, `paper` |
| `src/ink.js` | `ink`, `pencil` |
| `src/hatch.js` | `toPath`, `hatch`, `wash` |
| `src/gl.js` | `createGL`, `glSurface`, `compileProgram`, `shaderError`, `FULLSCREEN_VERT` |

## Things worth knowing

- **Declare the controller with `let`.** Under reduced motion, `run()` draws its still before it returns. If `draw` reads the controller, `const ctl = run(…)` is in its temporal dead zone at that moment. Write `let ctl = null; ctl = run(…)`.
- **Seeds make it testable.** Same seed, same drawing. Numbers hash to three decimals, so `1` and `1.0001` share a seed.
- **The governor steps down fast and up slowly.** Slow for a whole window, it drops a notch; calm for several windows, it climbs one. If a climb proves too hopeful it waits twice as long next time. Tie resolution, particle counts or refresh rates to `level`, and pass `target: 1000 / 30` on a display locked at 30 Hz.
- **WebGL always has a 2D fallback.** `glSurface(canvas, { frag, governor })` gives you `ok`; when it is false, draw in 2D. It caps the pixel count, follows the governor's level, handles `webglcontextlost` and `webglcontextrestored`, and `release()` deletes its GL objects and loses the context. Set size-dependent uniforms inside `draw((w, h) => …)` so they see the current backing-store size.
- **Headless Chromium draws WebGL on the CPU.** Its frame times say little about a real GPU.

## Tests

`node --test "packages/engine/**/*.test.js"`, or `npm test` from the repo root.
