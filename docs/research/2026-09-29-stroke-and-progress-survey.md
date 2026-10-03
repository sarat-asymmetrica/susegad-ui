# Stroke (kolam-class) & Dynamical-Progress Survey — 2026-09-29

Read-only reconnaissance feeding two candidate primitives:
(a) a **constraint-continuous stroke engine** — interactive, non-self-intersecting strokes that
re-optimise under point constraints in real time, able to live on or project onto oriented surfaces;
(b) a **prana-apana dynamical progress/status primitive** — a continuous expansion-then-settling
cycle, with a normal numeric value and a polite live region underneath.

All cites are `file:line` against `c:/projects/susegad-ui`.

---

## 1. The kolam scene (packages/scenes/kolam/)

Files: `model.js` (pure, Node-safe), `render.js` (canvas, all side effects), `meta.js` (words +
technique map), plus `index.js`, `demo.html`, `kolam.prompt.md`, `kolam.test.js`, `registry.json`.

### How the continuous line is constructed today — the mirror-curve method

The line is **built, not solved**. `buildKolam(seed, grid)` (`model.js:22`) uses Paulus Gerdes's
mirror-curve method on *doubled coordinates*: dot `(i,j)` sits at `(2i+1, 2j+1)`, the ray visits edge
midpoints where `X+Y` is odd, and at a midpoint a "mirror" flips `dx` (X even) or `dy` (Y even)
(`model.js:14-21` doc block). The outer boundary is always a mirror, so **every trace closes into a
loop by construction** (`model.js:76`: `if (k === 1 || mirror[id(X,Y)]) { X%2===0 ? dx=-dx : dy=-dy }`).

The pipeline:

1. **Shape + cells.** Seed picks `diamond` (weighted ×3) or `square` (`model.js:25`); a square grid is
   `size×size` dots, a diamond is a Manhattan-radius disc (`model.js:28-37`). Optional `grid` rounds
   the dot count up to odd so the design keeps a centre (`model.js:23`).
2. **Site kinds.** Each edge midpoint is classified `0 none / 1 border / 2 inner` against the cells
   (`model.js:43-50`), and diagonal segments are resolved per cell (`segCell`, `model.js:52`).
3. **Trace.** `traceAll(mirror)` (`model.js:65-81`) walks every directed segment, labelling each
   half-edge once (`label[...] = n`, `model.js:72`) and collecting one `loops` array per closed trace
   (`model.js:78`).
4. **Search for a single loop.** Mirror choices are made **per symmetry orbit** — D4 first, then C4,
   then C2 (`groups`/`orbitsFor`, `model.js:86-100`) — because kolam are symmetric and single loops get
   easier to find as symmetry relaxes. For each symmetry it tries up to 700 random mirror sets
   (`model.js:107`), rejecting layouts that don't yield a single non-trivial loop (`model.js:114`), and
   prefers a mirror ratio of `want = r.range(0.25, 0.5)` (`model.js:103`, `:115`).
5. **Fallback.** If no symmetric layout gives one loop, it toggles a mirror where two different loops
   meet and re-traces, up to 400 times, to **merge loops** (`model.js:123-133`).
6. **Smooth + lay out.** `geometry(seed, grid, W, H)` (`model.js:154`) memoises the result
   (`model.js:146`, capped at 12 entries `:177`), converts dots to logical units, and smooths each loop
   with **Catmull-Rom** (`catmull(l.map(toXY), 12, true)`, `model.js:163`), then accumulates arc length
   per point (`model.js:164-167`). `FILL = 0.74` (`model.js:147`), line width `cell*0.085`
   (`model.js:175`).
7. **Time/state.** `pointAt(geo, d)` binary-searches the cumulative table for `[x,y,angle]` at arc
   distance `d` (`model.js:183-197`). `timeline()` maps register → pace (`PACE`, `model.js:202-212`);
   `handPace` adds a monotonic 9-cycle wave so the "hand" hurries on straights and slows into turns
   (`model.js:215`). `model({time,seed,register,params,W,H})` is the per-frame pure frame
   (`model.js:241-263`): with `params.progress` set it draws exactly that far and **ignores time**
   (`model.js:244,247`); quiet is always the finished still (`model.js:248`); playful grows ants once
   closed (`model.js:218-234`, `:260`).

### Parameters that exist

`seed`, `grid` (3–9, rounded odd), `palette` (`auto|flour|rangoli`, `model.js:243`), `progress` (0..1),
`register` (`quiet|warm|playful`), `W`, `H`. Scene-level: `stillTime: 1e6` and `techniques` in
`meta.js:16-17`.

### Constraint solving / re-optimisation

**None.** The only "solving" is combinatorial rejection sampling over symmetric mirror layouts
(`model.js:107-120`) plus a local loop-merge repair (`model.js:123-133`). There is no continuous
optimiser, no energy/tension function, no point-constraint mechanism, no incremental re-optimisation
under edit, and nothing that reacts to live input beyond the discrete replay/search seeded by `seed`.
The result is a **static, deterministic, seed-derived closed curve**, not an interactive one.

### Self-intersection

Prevented **topologically, not geometrically.** Because the trace labels each directed half-edge once
and only ever continues along an existing diagonal segment (`model.js:66-77`), a trace cannot reuse an
edge, so each loop is a simple (non-self-crossing) closed walk at the lattice level; the whole design is
a **set of edge-disjoint closed loops** (`model.js:78`). "No self-intersection" is then a search
*objective* (single loop, `model.js:114`) rather than a crossing-detector. Important caveat: after the
Catmull-Rom smoothing (`model.js:163`) there is **no check that the smoothed curve stays non-crossing**,
so the guarantee is on the discrete path only. Nothing anywhere tests for crossing between *different*
loops either — separate loops are simply allowed to coexist (they may visually nest).

### The seed's role

`rng(\`kolam:${seed}\`)` (`model.js:24`) drives: shape (`:25`), size/radius (`:30,33`), the target mirror
ratio (`:103`), every attempt's mirror set and probability (`:108,110`), the merge-repair picks
(`:127,130`), and the playful ants (`model.js:219`, `rng(\`ants:${geo.seed}\`)`). Same seed ⇒ same
kolam, per the repo seeding rule.

### Surface / orientation

**Absent.** Rendering is 2D canvas. `render.js` draws a floor (`redOxide`/`laterite`, `render.js:66,86`),
sprinkles flour straight into an `ImageData` field (`makeField`/`field.stamp`/`flush`,
`render.js:242-266`), and the only geometry-aware placement is `fitAround(calm, W, H)` (`render.js:161-176`),
which is a **2D rectangular band-fitter** for slotted text (chooses the largest clear band, shrinks by
`Math.min(b.w,b.h)*0.9/side`, `render.js:172-174`). There is no 3D, no oriented surface, no projection
onto a plane/mesh anywhere in kolam.

---

## 2. Engine pencil-box techniques available for reuse (packages/engine/)

`index.js:3` states the split: **pure, Node-safe** = math, rng, noise, color, geom, fields, governor;
**canvas edge** = stage, loop(run), pointer, paper, ink, hatch, gl. `loop()` is DOM-free when
`matchMedia`/`raf` are injected (`index.js:5`). Tests live in `packages/engine/test/`
(`loop`, `governor`, `gl`, `geom`, `fields`, `exports`, `core` → `*.test.js`), so geom/fields/governor/core
(math,rng,noise,color) are **pure and tested**; gl/loop have tests but exercise canvas/browser paths.

| Technique | Exported API (file:line) | Pure? |
|---|---|---|
| Seeded rng | `hashSeed(s)` `rng.js:6`; `rng(seed)` (mulberry32 + `range`/`int`/`pick`/`chance`/`sign`/`gauss`, README:20) `rng.js:21` | Pure, tested (`core.test.js`) |
| Noise / fBm | `makeNoise(seed)` seeded 3D Perlin with `.fbm` `noise.js:10`; shared `N` `noise.js:46` | Pure, tested |
| Math / easing | `TAU` `math.js:5`, `clamp` `:7`, `lerp` `:9`, `invLerp` `:11`, `smoothstep` `:13`, `dist` `:15`, `phase` `:19`, `ease.*` `:22`, `boil` `:43` | Pure, tested |
| Color | `hexToRgb` `color.js:5`, `rgba` `:11`, `mix` `:13` | Pure, tested |
| Geometry | `resample` `geom.js:9`, `catmull` `:27`, `chaikin` `:46`, `measure` (arc-length + `at(d)`) `:63`, `ellipse` `:80`, `blob` `:92`, `roughen` `:105`, `bbox` `:116` | Pure, tested (`geom.test.js`) |
| Fields | `flow` `fields.js:10`, `curl` `:18`, `domainWarp` `:24`, `sampleGrid` `:30`, `contours` (marching squares) `:43`, `poissonDisc` `:98`, `grayScott` `:131`, `gsSpot` `:137`, `gsStep` `:156` | Pure, tested (`fields.test.js`) |
| Quality governor | `createGovernor({...})` — frame times in, detail level 0.25–1 out; steps down fast, up slowly `governor.js:21` (README:43) | Pure, tested (`governor.test.js`) |
| Stage | `stage(el, {W,H,maxDpr})` — canvas, DPR, resize, cached layers (`px`, `blit`, `layer`, `memo`) `stage.js:24` | Canvas edge |
| Loop | `loop(render, {...})` `loop.js:20`; `run(el, {W,H,fps,still,autoplay,maxDpr,draw})` `loop.js:67` | Canvas edge / DOM-free if injected |
| Pointer | `pointer(st)` — logical-unit position, `down`, `inside`, `travel`, `keyboard` `pointer.js:9` | Canvas edge |
| Paper | `grainPattern(g,color,{lo,hi})` `paper.js:26`; `paper(g,W,H,{...})` `:39` | Canvas edge |
| Ink | `ink(g, pts, {...})` `ink.js:13`; `pencil(g, pts, {width,color,alpha,passes,seed,jitter,closed})` `ink.js:46` | Canvas edge |
| Hatch / wash | `toPath(pts,closed)` `hatch.js:7`; `hatch(g, shape, {...})` `:20`; `wash(g, shape, {color,alpha,bounds,grainy})` `:54` | Canvas edge |
| GL | `FULLSCREEN_VERT` `gl.js:9`, `shaderError` `:13`, `compileProgram` `:23`, `createGL(canvas,{frag,vert,attrs,label})` `:72`, `glSurface(canvas,{governor,maxPixels,onlost,onrestored})` `:125` | Canvas edge, tested (`gl.test.js`) |

**Not in the engine:**
- **emergence** and **easing** are *scene techniques* (`meta.js:17`), not modules — "emergence" is the
  mirror-curve rule itself, "easing" is `math.ease`/`handPace`.
- **particles**: there is **no reusable particle system**. The kolam's "particles" technique is a private
  flour-grain sprinkle in `render.js` (`grains` `:30`, `stream` `:17`, `makeField`/`stamp`/`flush`
  `:242-266`, `sprinkle` `:286`), reusing `rng`, `noise.N` and `hexToRgb`. A new stroke engine would get
  `catmull`/`roughen`/`measure`/`poissonDisc` but must write its own grain pass.

---

## 3. The progress component (packages/components/progress/)

`<sg-progress>` **enhances a native `<progress>` child** (`static native = 'progress'`, `progress.js:39`):
the native element keeps the value, the role and the accessible name; the drawing is decoration.

### Headless behaviour (pure core lives in the element file)

- `STRINGS` — per-register words: `working` `{quiet:'In progress', warm:'Working on it', playful:'On its way'}`,
  `done`, and `percent: n => \`${n}%\`` (`progress.js:12-17`).
- `progressState({value,max,determinate,label,register})` — **pure** (`progress.js:23-34`): clamps to
  `fraction` (0..1), floors to `percent` with a `+1e-9` guard (`:26`), `done = fraction === 1`, and picks
  `text` = the number, or the words when there is no number (`:32`).
- **Value semantics.** `get value` returns the native value or `null` when the element has no `value`
  attribute (`progress.js:76`); the setter writes/removes the native attribute (`progress.js:77-80`). A
  `MutationObserver` on `value`/`max` re-runs `state()/update()` (`progress.js:61-62`).
- **Aria / live region.** The visible label names the native element via `aria-labelledby`
  (`progress.js:93`, id minted `:55`); the visible number span is `aria-hidden="true"` because the native
  element already announces its value (`progress.js:57`). On completion it emits `sg-complete`
  (`progress.js:95`).
- **Indeterminate.** No `value` attribute ⇒ `determinate:false` (`progress.js:85`), `fraction = null`
  (`progress.js:25`), words say what's happening, no amount drawn (`:32`). CSS shows a **still dotted
  pencil line** for `:indeterminate` (`progress.css:44-48`) — explicitly *no fake motion*.

### How the three registers differ

- **quiet** — a no-op skin (`skins/quiet.js:4`: `mount()` returns empty `update/destroy`); the native bar
  is styled as a 3 px pencil hairline on a rule track (`progress.css:31-43`). Also the no-JS fallback.
- **warm** — a small kolam **reusing the scene's pure `geometry()`** (`skins/warm.js:6,12-16`), drawn to
  the value with `pathLength="100"` + `strokeDashoffset` (`skins/warm.js:36,62-68`), roughened by
  `feTurbulence`+`feDisplacementMap` (`:29-31`); dots turn `--sg-accent` at 100 % (`:69-70`); indeterminate
  ⇒ dots breathe slowly, no line (`:45-58`).
- **playful** — a cutting-chai glass (`GLASS`/`halfWidth`/`levelY`, `skins/playful.js:9-12`); tea level =
  value; `sloshFrames` is a pure dip-and-settle that **never shows more than the value**
  (`skins/playful.js:17-22`); steam wisps (`wisp`, `:24-32`) and a pouring stream when indeterminate.

### Budget declaration

`packages/components/progress/registry.json:31-35`: `budget:{ jsBytes: 15360, frameMs: 16.7, reason:"…behaviour
(progress.js) ~4.4 KB, skins ~0.2/3.6/6.3 KB…" }`. Files list + `dependencies` (`core-component, core,
scene-kolam, engine, tokens`) at `:8-23`. The contract's default is 12 KB behaviour + 8 KB/skin (decision
0009); progress declares the sum used.

### What a prana-apana variant must preserve (the existing contract)

From `progress.js` + `progress.docs.md:43-53` + `progress.prompt.md`:

1. Enhance a real native `<progress>`; **the native element stays the progressbar and the accessible
   name**, art is `aria-hidden` (`docs:45-46`).
2. Number always in words beside the label; visible number `aria-hidden`, label drives `aria-labelledby`.
3. **Determinate moves only when the value changes** — no timer, no estimate (`docs:53`,
   `progress.prompt.md:34`); the peak never goes above the value (slosh rule, `skins/playful.js:17`).
4. **Indeterminate**: say what is happening in words, draw no amount, no fake progress. This is where a
   continuous expansion-then-settling *cycle* may live (warm already breathes, playful already pours/steams).
5. Keep `sg-complete`, the `value`/`null` property semantics, and `max` default 1.
6. Reduced motion ⇒ current value drawn with **no animation**; all animation **paused off-screen** via a
   shared IntersectionObserver (`progress.prompt.md:36`).
7. Three registers stay distinct in *drawing*, not in *behaviour*.

A dynamical prana-apana primitive adds a **polite live region** (the kolam progress convention speaks at
most once a second, `kolam.prompt.md:46`) — progress currently has **no** live region, only the native
value, so a new polite status region is additive and must not double-announce.

### Stepper (brief)

`<sg-stepper>` (`packages/components/stepper/stepper.js:27`) walks a form one `<fieldset>` at a time;
no-JS = all steps visible and one submit (`stepper.js:12`); with JS it shows Back/Next, validates only the
current step, moves focus to the step legend and writes "Step 2 of 3" into a `p.sg-stepper-progress`
(`stepper.js:42-45`). Pure core `stepper.core.js` (`STRINGS`, `clampStep`, `stepper.js:19-21`); three skins.
It has a step counter but no `aria-live` region of its own and no value model beyond `index`.

---

## 4. Physics / geometry primitives already present in packages/

Grepped for `spring|damping|verlet|integrate|torque|quaternion|slerp|\bsim\b|\bmass\b|\bconstraint\b|\bODE\b|settle|relax`.

**What does NOT exist:** no rigid-body/physics engine, no integrator (Euler/RK/Verlet), no mass/spring
system, no constraint solver (distance/point/pin), no collision or intersection tests, no quaternion or
slerp, no particle system, no ODE. None of the dependency-free packages provides one.

**What does exist (all small, and none of it is a stroke solver):**

- `packages/tokens/tokens.js:320` `springEasing(damping, points)` — a **damped spring sampled into a CSS
  `linear()` easing** (`x(t) = 1 - e^{-ζωt}(cos ω_d t + …)`), pure and **tested** (`tokens.test.js:281,290`),
  plus `springOvershoot` (`tokens.js:330`); emitted as `--sg-ease-spring` with a `cubic-bezier` fallback.
  This is animation-timing sugar, not a simulation.
- `packages/stage3d/stage3d.core.js:114` — an explicitly **"spring-free" exponential follow** (frame-rate
  independent move-toward-`b` with time constant `tau`). Pure; the closest existing thing to a relaxation step.
- `packages/type/layout.js:44,146` — `spring` is a **layout variable** (arc/spring line of a shape) and
  "settle" is text re-wrap, not physics.
- `packages/core/scene-element.js:39,240` and many `*.check.mjs` — `settle`/`#settle` are **lifecycle
  stillness flags** for the render loop, not simulation.
- `packages/stage3d/vendor/three.named.js` — the vendored three.js bundle does contain quaternion/`Object3D`
  math, but it is a **lazy tier loaded only for live 3D** (decision 0017) and is unavailable to the
  dependency-free packages.

**Consequence:** both candidate primitives need new mathematics. The stroke engine's point-constraint
"re-optimise in real time" needs a solver written from scratch (e.g. a position-based constraint /
Laplacian-relaxation core), and the prana-apana cycle needs its own expansion-settle oscillator (the
`tokens` spring is a *curve generator*, not stateful, so it can shape a cycle but cannot integrate one).

---

## 5. The material-card convention (`*.prompt.md`)

A material card is a `*.prompt.md` file: the **generative prompt plus its words→code translation**, sitting
beside a separate `*.docs.md` usage doc. Both are named in `registry.json` (`prompt` / `docs`).

### Exact structure (headings, in order)

```
# <Title>
*<one-line gloss in italics>*
<1–3 sentence intro>
<code block: html/js usage>
## The prompt          ← one long paragraph, the generative instruction
## Words to code       ← the translation table
| When you say | Technique | What happens |
|---|---|---|
| … | … | … |
## Budget             ← present on some cards (e.g. stage3d); otherwise only in registry.json
## Accessibility      ← present on scene cards (kolam)
## Credit             ← provenance / practice / tier
```

### Two concrete examples

**Example A — `packages/scenes/kolam/kolam.prompt.md`** headings: `# Kolam`, italic gloss, intro, HTML
block, `## The prompt` (`:26`), `## Words to code` (`:30`), `## Accessibility` (`:43`), `## Credit` (`:50`).
Words-to-code rows (quoted, `:34-36`):

```
| When you say | Technique | What happens |
|---|---|---|
| mirror-curve method … bounces off them | emergence | One local rule (bounce or pass straight through) at every gap produces the whole design. Nobody draws the curve; the rule finds it. |
| keep reshuffling until … a single closed loop | seed | Random choices are cheap to test. The code tries symmetric mirror layouts until one yields a single loop, and a seed makes that search repeatable. |
| sprinkle tiny grains … gaussian spread | particles | The line is never stroked. It is tens of thousands of grains … written straight into the pixels at device resolution … about six times faster than drawing each grain as a shape. |
```

**Example B — `packages/components/progress/progress.prompt.md`** headings: `# Progress`, gloss, intro,
HTML block, `## The prompt` (`:20`), `## Words to code` (`:24`). Rows (quoted, `:28,30,31`):

```
| When you say | Technique | What happens |
|---|---|---|
| enhances a native `<progress>` child | progressive enhancement | The browser's own element carries the value and the role. Without JavaScript, and in quiet, it is simply styled; the skins hide it visually but leave it for screen readers. |
| draw the line exactly as far as the value with a dash offset | stroke dashing | The kolam path has `pathLength="100"`, so a dash offset of 60 leaves 40% drawn, whatever the path's real length. |
| taken from the Kolam scene's mirror-curve geometry | reuse | The warm skin calls the scene's pure `geometry()` for a thirteen-dot diamond instead of carrying its own drawing. |
```

### Budget line — shape and location

- On **most** cards the budget is **only** in `registry.json`, not in the card. progress has no `## Budget`
  heading; its budget is `registry.json:31-35`:
  `"budget": { "jsBytes": 15360, "frameMs": 16.7, "reason": "…" }`.
- On some cards it is restated as a `## Budget` section, e.g. `packages/stage3d/stage3d.prompt.md:28-30`:
  > `## Budget`
  > `stage3d.js 4.4 KB and stage3d.core.js 5.6 KB, budgeted apart from the dependency-free layers (decision 0017). three itself is recorded per story, as bundled.`

### `*.docs.md` vs `*.prompt.md` split

- `*.prompt.md` = the **material card**: gloss, usage snippet, `## The prompt`, `## Words to code`,
  optionally Budget / Accessibility / Credit.
- `*.docs.md` = **human-facing docs**: Usage, an attributes/properties/events table, Registers, Accessibility,
  "What moves, and why", Credit (see `progress.docs.md:5,26,37,43,51,55`). Engine uses `README.md` as its `docs`
  instead (`engine/registry.json:28`).
- Where registry budgets live: `registry.json → budget.jsBytes` (and `frameMs`, `reason`). Scene example
  `kolam/registry.json:13` (`40960`); engine `engine/registry.json:27` (`53248`); component example
  `progress/registry.json:31-35`.

---

## 6. Budget and registry conventions

### Budget decisions that exist

- **0003 `docs/decisions/0003-declared-scene-budgets.md`** — each scene declares `budget.jsBytes` in its
  `registry.json`; default 40 KB, up to 64 KB with a one-line `budget.reason`; gated by `registry/build.mjs`.
- **0009 `docs/decisions/0009-component-budgets-declared.md`** — as with scenes, a component declares its
  behaviour budget in `registry.json`; default **12 KB per element**, up to 16 KB with `budget.reason`;
  **skins 8 KB each**.
- **0010 `docs/decisions/0010-pure-cores-budgeted-apart.md`** — a component's **`*.core.js`** (pure, no DOM,
  Node-tested) gets its **own 12 KB** allowance; the element keeps 12/16 KB; `budget.jsBytes` in the manifest
  stays the declared *total* and `budget.reason` lists the parts.
- Also relevant: `0007` (multi-element budgets), `0014`/`0020` (diagram/scapes budgets), `0017` (three as a
  tier, budgeted apart).

### How a new package's JS budget is declared

Add `budget: { jsBytes: <n>, [frameMs: <n>], [reason: "…"] }` to the package's `registry.json`. Declare the
**sum used**; if over the default for the type, include the one-line `reason`. A pure `*.core.js` is counted
separately (0010). Scenes default 40 KB (0003); components default 12 KB/element (0009).

### registry.json entry shape

Per `registry/schema.json:1-6` and the live manifests:

```json
{
  "name": "scene-kolam",          // lowercase kebab-case; scenes are scene-<name>
  "type": "scene",                // package|scene|component|recipe|adapter
  "stability": "experimental",    // experimental|beta|stable
  "useFor": ["loader","hero"],    // optional honest tags
  "title": "Kolam",
  "description": "…",
  "version": "0.1.0",
  "files": ["index.js","model.js","render.js","meta.js","kolam.prompt.md"],
  "dependencies": ["core","engine","tokens"],
  "registers": ["quiet","warm","playful"],
  "prompt": "kolam.prompt.md",
  "docs": "progress.docs.md",     // components; engine uses README.md
  "budget": { "jsBytes": 40960 }
}
```

(Shape from `kolam/registry.json:1-14`, `progress/registry.json:1-36`, `engine/registry.json:1-28`,
`schema.json`.) One `registry.json` per package/scene/component/recipe/adapter folder; a folder holding a
second item names it `<name>.registry.json` (`schema.json:5`). Paths in `files`/`prompt`/`docs` are relative
to the manifest; repo-rooted `packages/…` paths are accepted with a build note (`schema.json:5`).

### What a new package must add to be picked up

1. A folder under `packages/` with its source files and a **`registry.json`** (validated against
   `registry/schema.json`).
2. **`registry/build.mjs`** scans `packages/*` and writes the index **`registry/registry.json`**, and (per
   decision 0003) is the gate that checks a package's JS stays "within its declared budget". Fixtures at
   `registry/fixtures/good|broken/**` show accepted/rejected manifests (bad-name, no-file, needs-ghost, loop-a/b).
   *(The internals of `build.mjs` were not opened — the indexing + budget-gate role is from the decision text and
   the fixture layout, so the finer mechanics are `[unverified]`.)*
3. **`custom-elements.json`** at repo root (`c:/projects/susegad-ui/custom-elements.json`) — the custom-elements
   manifest; a new component element must appear there. *(Whether it is hand-edited or generated by a build step
   is `[unverified]`.)*
4. For components/scenes: the three **skins/registers** (`skins/quiet|warm|playful.js`), a `*.prompt.md` card,
   a `*.docs.md`, and — where a browser check exists — a `*.check.mjs` + `demo.html`.
5. **Gallery:** no file or folder named `gallery` exists under the repo. The showcase must live under
   `apps/docs` (`apps/docs/build.mjs` exists) — `[unverified]`: the gallery is likely a route/section in the docs
   app rather than a per-package artifact. A new package that should appear in the gallery must be added to that
   app's index/build (mechanism not confirmed here).

---

## 7. Invariants + unknowns/blockers

### Invariants the two new primitives must respect

- **Pure core vs side-effecting edge.** Every scene/component separates pure model/core from DOM/canvas
  (`model.js:1`, `progress.js:1`, decisions 0005/0010). The stroke engine's constraint solver and the
  prana-apana cycle function must be **pure and Node-tested** (`*.core.js`); only drawing touches DOM/canvas.
- **Seeded determinism.** Same seed ⇒ same result. The stroke engine must derive randomness from `rng`/`hashSeed`
  (`rng.js:6,21`), not `Math.random`, so it stays reproducible and testable.
- **Native-first accessibility.** Enhance a native element; art `aria-hidden`; visible label names it; a live
  region must be polite, throttled (kolam speaks at most once a second, `kolam.prompt.md:46`), and must not
  double-announce a native value.
- **Transport that follows the work, not a timer** (`progress.docs.md:53`) — but indeterminate may carry a
  continuous cycle; keep the determinate branch timer-free.
- **Reduced motion ⇒ still; pause off-screen** (IntersectionObserver) — required for both primitives.
- **Budget discipline.** Declare `budget.jsBytes` (+ `reason` when over the default) in `registry.json`
  (0003/0009/0010); stay within it.
- **Three registers: distinct drawings, shared behaviour.**
- **No dependencies in the core layers.** three.js is the *only* lazy tier and lives in `packages/stage3d`
  (decision 0017); the stroke engine and prana-apana core must remain dependency-free.

### Gaps / blockers for the two candidates

- **No continuous solver, no re-optimisation, no point constraints** exist anywhere (§1, §4). The
  constraint-continuous stroke engine is **entirely new mathematics** — nothing to reuse but
  `catmull`/`roughen`/`measure`/`chaikin` (`geom.js:27,105,63,46`) and `poissonDisc` (`fields.js:98`).
- **Kolam's non-self-intersection is lattice-topological**, not a geometric invariant of a smooth curve, and is
  not checked after Catmull smoothing (`model.js:163`). A general interactive engine needs an actual non-crossing
  guarantee (reparameterisation + crossing test), which does not exist here.
- **No oriented-surface / projection capability** in the dependency-free packages (kolam is 2D; `fitAround` is a
  2-D band fit, `render.js:161`). Projecting a stroke onto an oriented surface needs a new pure geometry module
  (or the lazy three tier, decision 0017).
- **No stateful dynamical system / oscillator** for the prana-apana expand-then-settle cycle. The only spring-ish
  code is a *curve generator* (`tokens.js:320`) and a stateless exponential follow (`stage3d.core.js:114`) —
  neither integrates state over time.
- **`custom-elements.json` update path and the gallery insertion mechanism are `[unverified]`** (§6.3, §6.5).
- **Exact `registry/build.mjs` budget-gate arithmetic** (declared vs actual, per-file vs summed) is
  `[unverified]` — from decision text only.
- Everything in this survey is from static reading; **no test, build, or browser run was performed** (per task
  rules), so runtime behaviour of these stacks is not independently confirmed here.