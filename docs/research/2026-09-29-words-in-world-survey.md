# Words in the World: Technical Survey of the Susegad UI Text Stack

Read-only reconnaissance for a new primitive: text panels whose supporting
plane orientation is driven by quaternions + slerp, soft-constraining toward
readable orientations, Pretext owning text metrics, working with or without
the three.js depth tier.

Date: 2026-09-29

Paths are relative to `c:/projects/susegad-ui/`.

## 1. How words-on-glass work today in the veranda scene

`<sg-veranda-stage>` (`packages/scenes/veranda/stage-element.js`) is the
reference implementation of words living inside a drawn 3D space. Its header
block (stage-element.js:1-31) declares the contract: children are the words,
they stay real text in the page and the accessibility tree, in every tier; a
frosted pane sits at a depth `d`; things in front hide it; at rest no line is
more than 15% hidden.

**Depth-mask that lets DOM text pass behind pillars.** The pane is DOM
(`.panel`), not canvas. Occlusion is a CSS `mask-image` built from the scene's
own depth map:

- `#others()` (stage-element.js:611) lists the other word surfaces (notes and
  the pot's paragraph) the pane must keep clear of.
- `#corners()` (stage-element.js:540-545) memoises, per camera, where each
  depth byte 0..255 lands on the stage: `dp.place(0,0,b/255)` and
  `dp.place(1,1,b/255)`.
- `#hiddenAt(d)` (stage-element.js:550-560) builds a coarse hidden grid
  (stage/3 cells) via `hiddenGrid(...)` from `pane.core.js`, memoised per
  depth+camera, capped at 70 entries.
- `#buildMask()` (stage-element.js:573-588) turns the shown cells into SVG path
  data (`shownPath`), makes a Blob URL, assigns it to `panel.style.maskImage` /
  `webkitMaskImage`; `#positionMask()` (stage-element.js:590-597) pins the mask
  in stage space so it stays still while the pane moves under it.
- `#scheduleMask()` (stage-element.js:567-572) remakes the mask only when the
  camera is still — swapping a decoded image under a `backdrop-filter` stalled
  the integrated GPU for a second (comments at stage-element.js:41 and
  561-565). The mask is skipped in quiet and when stacked (stage-element.js:576).

**settle() / readability logic.** `#settle({quiet})` (stage-element.js:635-659)
runs up to 3 passes. Each pass reads the real line boxes with `#lineRects()`
(stage-element.js:600-608, `Range.getClientRects()` over the panel's real
text) plus the panel box, then calls `settleSpot(...)` from `pane.core.js`
(stage-element.js:641). `settleSpot` (pane.core.js:230-289):

- returns `{dx, dy, d, worst, moved, free}`;
- staying is free if the pane is clear of obstacles and no line exceeds
  `limit` (pane.core.js:260);
- otherwise it searches a `grid` (16 px) lattice (finer 6 px fallback) for the
  least-cost place; cost = distance + coming forward + clipped letters
  (pane.core.js:258);
- it comes forward in depth when a sideways move is not enough (`need()` /
  `worstAt`, pane.core.js:247-255);
- per-line coverage via `lineShares` / `worstShare` (pane.core.js:211-215) —
  the rule holds per line, so a short heading can't lose its first letters.

The limit is 15% (`limit: quiet ? 0.06 : 0.15`, stage-element.js:641; the words
a person placed keep the full 15%, self-arranging words clip no letter). On a
successful move the pane updates `words-at` (stage-element.js:644-648), depth
(stage-element.js:649) and fires `sg-pane-depth` with `{d, settled, moved,
said, free}` (stage-element.js:658).

**What re-triggers settle:** camera move (`#camTick` compares `#camKey()`,
stage-element.js:361-366; `#camKey` at 340-343 snaps the picture's corners at
the near/far ends of the depth range to half a pixel), lens change (`#setLens`
-> `#arrangeSoon()`, stage-element.js:479), another text surface (`sg-flow`
from the pot, stage-element.js:213), notes changes (`#renderNotes` ->
`#arrangeSoon`, stage-element.js:334), register change (`#onRegister`,
stage-element.js:237-241), resize (`#layout`, 242-251). `#arrangeSoon`
(120 ms, stage-element.js:625-628) and `#settleSoon` (350 ms, 629) throttle it.
A hand on the grip is never argued with (`panel.classList.contains('moving')`
guard, stage-element.js:637).

**keepClear(id, rect) and calm/keep-away API.** On `<sg-scene>`
(`packages/core/scene-element.js`):

- `keepClear(id, rect)` (scene-element.js:84-87): a rect in the scene's logical
  units joins the keep-away list; same id replaces; non-finite refused; it
  redraws, also when held still.
- `get calm()` (scene-element.js:82): the merged list (slotted words' rects
  then keep-clear rects), a copy, also delivered to renderers as `frame.calm`
  (`#merge` at 294, passed in `#draw` at 239).
- `holdReading(on)` (scene-element.js:89): a renderer that sets the words on its
  own surface hides the panel.

On `<sg-veranda-stage>` the same API exists with an `sg-calm` event:
`get calm()` (stage-element.js:121), `keepClear(id, rect)`
(stage-element.js:122-127). `movable.js` calls `host.keepClear('glass', ...)`
with the whole panel box on every measure (movable.js:79-84) — the pane, not
just its line boxes, is a keep-away rect (decision 0021, point 3).

**Movable words.**

- The `movable` attribute on `<sg-scene>`: loaded lazily and only then.
  `#movable()` (scene-element.js:146-156) dynamically imports `./movable.js`
  and calls `attach(this, {root: this.shadowRoot, els: this.#els, register,
  measure})`. `#onAttributes` routes the attribute (scene-element.js:201).
  `get wordsAt` at scene-element.js:80.
- `words-at` attribute: consumed by `movable.attr(v)` (`parseWordsAt`,
  movable.js:134-135; scene-element.js:202). Format `"x y"` or `"x,y"`, two
  fractions in [0,1] (movable.core.js:85-88); the inverse is `formatWordsAt`
  (movable.core.js:90).
- The `sg-words-moved` event: fired on drop and on key moves with
  `detail: {x, y, home}` (movable.js:70-73), fractions of the stage's free room
  so a link lands the words in the same place at another width
  (movable.core.js:5-11).
- `packages/core/movable.js` (DOM edge, 148 lines): a real `<button>` grip
  named "Move the words" (movable.js:42-47); Pointer Events with capture on the
  grip only, so text selection and phone scrolling still work (103-119); arrow
  keys move by 3% of stage width, 9% with Shift, Home resets
  (movable.js:122-132); the panel is moved by a CSS `transform` (67); the pause
  button is kept reachable via `avoid(...)` (62-66). Frosted glass in warm and
  playful, off in quiet (CSS movable.js:23-29; `sync` gates on `reg !== 'quiet'
  && !stacked && !panel.hidden && canMove(r)`, 87-94).
- `packages/core/movable.core.js` (pure core, 90 lines, Node-tested): geometry
  only — `room` (25-29), `avoid` (36-45), `canMove` (48), `clampTo` (51),
  `placeOf`/`offsetOf` (55-57), `nudge` (64-69), `nameOf`/`movedSaid`/
  `homeSaid`/`limitSaid` (72-82), `parseWordsAt`/`formatWordsAt` (85-90).
  Constants `MARGIN=14`, `MIN_ROOM=48`, `STEP=0.03`, `BIG_STEP=0.09` (13-16).

## 2. The type tier (packages/type/)

Four files — `index.js` (side-effect edge), `layout.js` (pure half),
`surface.js` (element-side surface), `junctions.js` (anchored plaques) — plus
vendored `vendor/pretext.js` (decision 0019). The tier is never imported
statically by a scene; `index.js` says load it with a dynamic import from a
scene folder as `../../type/index.js` (index.js:3-9).

**`index.js` — public API.**

- `readBlocks(el) -> [{tag, text}] | null` (index.js:23-31): headings and
  paragraphs of plain text only (regex `^(H[1-6]|P)$`, line 16). Returns null if
  any child holds something to press or see (`a,button,input,select,textarea,
  img,svg,video,audio,iframe,[tabindex]`, line 17) — those stay in the panel.
- `async fontReady(font)` (index.js:34-36): `await document.fonts.load(font)`;
  comment — "Pretext measures whatever the canvas has now".
- `project(lines, blocks, {W, H})` (index.js:46-63): one absolutely placed
  `<span data-line>` per line inside the block's element, positions as
  **percentages** of the scene's logical size (`left: (l.x/W)*100%`, line 58)
  so the layer scales with the drawing; spans reused between layouts; the block
  element carries the meaning, so assistive tech reads it in order.
- `export * from './layout.js'` (index.js:14).

**`layout.js` — the pure half (Pretext in, line boxes out, no DOM).**

Imports from `./vendor/pretext.js`: `prepareWithSegments`, `layoutNextLineRange`,
`materializeLineRange`, `measureLineStats` (layout.js:13-15). Exports:

- `START` frozen `{segmentIndex:0, graphemeIndex:0}` (line 17).
- `prepare(text, font)` (21-29): caches Pretext's prepared text, LRU-capped at
  256; "the only thing Pretext touches is a canvas to measure with" (9-11).
- Shape builders, each `(top, bottom) -> {x, w} | null`: `rect` (34),
  `arch` (43-52), `slant` (55-62).
- `layIntoShape(blocks, shape, {top, bottom, scale, minWidth})` (80-105):
  returns `{lines:[{block,text,x,y,w,h}], fits, bottom}`; one width per line
  band; a too-narrow band is skipped (step down, line 91); a line broken inside
  a word sets `fits=false` (94; `brokeInsideWord` 108-113).
- `fitSize(sizes, build, shape, opts)` (121-129): binary-search by halves for
  the largest fitting size.
- `setBlocks(specs, shape, {...})` (138-156): largest base size, per-block
  ratio, centre/valign; returns `{size, lines, blocks:[{tag,px,lineHeight}]}`.
- `labelBox(text, font, px, {...})` (159-162): a label's CSS-px box, never under
  the 24 px target.
- `shrinkWrap(prepared, maxWidth)` (167-170), `balance(prepared, maxWidth)`
  (176-184).
- `calmOf(lines, pad=2)` (187): line boxes as calm rects for a renderer.

**`surface.js` — `createSurface({host, scene, W, H, invalidate, family,
color})`** (surface.js:22). Loads the tier lazily on first update (line 46),
reads slotted words with `type.readBlocks(scene)`, lays them via the caller's
`lay(type, blocks, scale, rootPx)` (returning `type.setBlocks(...)` or null),
then `type.project(...)`. It inserts its layer beside the host (`host.after
(layer)`, line 30), sets `aspect-ratio: W/H` (26), hides the element's panel
while holding the words by calling `scene.holdReading(!!laid)` (59), and marks
`host.dataset.words = 'surface' | 'panel'` (60). Returns `{lines, calm}` while
holding, else null. A `ResizeObserver` on a hidden 1rem probe catches text zoom;
a `MutationObserver` on the scene catches slot changes (33-36). Layer CSS at
11-14: `.surface` is `pointer-events:none` but `.surface [data-line]` is
`pointer-events:auto; cursor:text` — the real text lines stay live.

**`junctions.js` — `createJunctions({layer, flatParent, items, label, family,
ink, W, H, onChange})`** (junctions.js:29). Each item is a **real `<button>`**
plaque (`.jn-plaque`, line 40) with `aria-expanded`/`aria-controls`, plus a
card; the flat fallback is a `<ul>` of native `<details>` (34). API: `use(type)`
(73), `measure(anchors, px, scale, {target, maxH})` (78-87, uses `t.labelBox`),
`place(next, list=true)` (89-97), `get open` (100, the open card's logical box
for the scene to avoid). Escape closes and returns focus (47). It imports
nothing, so it costs no Pretext until `use(type)`.

**How DOM text is measured and arranged today.** Not by the DOM at all: a scene
describes a **shape** — for a band from `top` to `bottom` it answers the room
`{x, w}` in logical units — and Pretext flows one line at a time through those
bands, at the size the words will really be seen (`scale` = CSS px per logical
unit, layout.js:66-80). The real DOM text then gets one span per line,
absolutely placed at percentage coordinates.

**What "Pretext owns metrics" concretely means for a new primitive.** The
primitive must not call `getBoundingClientRect`, `Range.getClientRects`,
`measureText` or any DOM measurement of text. It hands Pretext the text and the
font (`prepare`/`setBlocks`) and receives line boxes in logical units
(`{x,y,w,h,text}`): `prepare()` is the only Pretext entry point for width
(layout.js:21-29), `measureLineStats` for shrink-wrap/balance (167-184). Font
readiness is awaited once with `fontReady` (index.js:34-36) because "Pretext
measures whatever the canvas has now". The veranda's `matka-view.js` is the
existing precedent: it lays a real paragraph round the pot's silhouette with
`layIntoShape` and a `flowShape`, never DOM-measuring the text
(matka-view.js:114-115).

## 3. The stage3d tier

**`packages/stage3d/stage3d.core.js`** — pure maths, no DOM, no three, Node.

- `chooseTier({webgl, three, motion, lite, software, forced})` (stage3d.core.js:
  25-30): `forced` wins; `motion === 'still' | 'state'` -> `'2d'`;
  `!webgl || !three || lite || software` -> `'2d'`; else `'live'`. `lite` =
  Save-Data or <=1 GB memory (`liteDevice()`, stage3d.js:60-61); `software` = a
  CPU rasteriser (SwiftShader/llvmpipe; `isSoftwareRenderer`, stage3d.core.js:37,
  detected in `webglInfo()`, stage3d.js:42-55).
- `Z_NEAR = 1`, `Z_FAR = 10` (40-41). The veranda repeats these and a test fails
  if they differ (world.js:31).
- `depthToZ(d, near, far)` (47), `reproject(u, v, d, tanX, tanY)` (54-57).
- `coverWindow(va, pa, tanY, {keep, overscan})` (66-74): the frustum window that
  covers a viewport with the photo, keeping `keep` near centre.
- `projectPoint(u, v, d, win, cam, tanY, pa)` (82-90): where a photo point lands
  in the viewport — "the same maths the vertex shader does"; used to place DOM
  overlays.
- `cameraAt(t, path, p, strength)` (97-105): the camera `{x, y, z, pitch}` along
  a dolly path `[dx, dy, forward, pitchDeg]` plus pointer/tilt parallax.
- `follow(a, b, dt, tau)` (115): frame-rate-independent exponential follow.
- `parseVec` (108-112).

**`packages/stage3d/stage3d.js`** — the lazy three.js edge. `loadThree()` (27-33)
loads once and resolves null (never rejects) on failure; the bare specifier
`import('three')` is resolvable by a bundler or an import map; `setThreeLoader
(fn)` (20); `webglInfo()`/`webglAvailable()` (42-57); `liteDevice()` (60);
`watchVisible(el, cb)` (64-73); `decoded(src)` (81-89). It re-exports everything
from `stage3d.core.js` (13). The veranda stage calls `setThreeLoader(() =>
import('../../stage3d/vendor/three.named.js'))` (stage-element.js:187) — the
vendored named-three build (`packages/stage3d/vendor/`, decision 0017).

**`packages/stage3d/depth-photo/`** (`depth-photo.js`, `depth-photo.core.js`,
`depth-photo.gl.js`, `depth-photo.2d.js`, `skins/*`). The live path is
`depth-photo.gl.js`:

- `createGLRenderer(THREE, canvas, src)` (181): a `WebGLRenderer` (182), two
  `ShaderMaterial`s sharing a grid mesh (`look` pass 211-224; `stage` pass via
  `STAGE_VERT`/`STAGE_FRAG` 67-173), `COLS = 192`, `ROWS = COLS/pa` (238).
- The camera is created at **depth-photo.gl.js:246**:
  `new THREE.PerspectiveCamera(50, 1, 0.2, 40)`.
- It is driven per frame in `draw(s)` (278-312): `cam.position.set(s.cam.x,
  s.cam.y, s.cam.z)`, `cam.rotation.set(s.cam.pitch, 0, 0)`,
  `cam.updateMatrixWorld()`, then a hand-built asymmetric frustum
  `cam.projectionMatrix.makePerspective(left*near, right*near, top*near,
  bottom*near, near, cam.far)` (299-303). **Rotation is pitch-only** — the stage
  camera never yaws or rolls, so there is no orientation/quaternion machinery in
  the live tier.
- `resize`, `setSource`, `setGrade`, `setMaxLook`, `debug`, `dispose`.

**Where the three.js camera is created and driven for the veranda.**

- `packages/scenes/veranda/stage-element.js`: creates `<sg-depth-photo>` in
  `#init()` (194-199), sets `focus`, `dolly-path`, `keep` attributes, listens
  for `sg-tier` and writes `this.dataset.tier` (199); wraps `dp.set` (215) so
  every camera change counts as a move; `#camTick`/`#camKey` (361-366, 340-343)
  read `dp.place(u, v, d)`.
- `packages/scenes/veranda/world.js`: the **pure camera** the depth map and the
  drawing share — `FOV_Y = 50` (13), `TAN_Y`/`TAN_X` (14-15), `rayAt` (22),
  `project` (24), `projectM` (26), `zToDepth` (33), `S = 0.4`, `EYE = 1.15`
  (17), `GW/GH` G-buffer size (18).
- `packages/scenes/veranda/paint.js`: the painter. Normals are used
  (`skyLight(n)`, paint.js:130; `pigment(s, p, n, mood)`, 58), and `roundEdges`
  builds an ellipsoid's outline ring perpendicular to the view direction using
  `cross`/`norm` (paint.js:216-226) — **3D vector algebra but not orientation/
  quaternion**.
- `packages/scenes/veranda/matka-view.js`: the pot's paragraph pane, the one
  place a three.js camera is aimed: `camera.lookAt(0, midY, 0)`
  (**matka-view.js:92**), with `new THREE.PerspectiveCamera(10, 1, 1, 100)` (52).
  The paragraph is re-laid round the pot's projected silhouette via `project3`
  (98-102).

## 4. Orientation/camera code that already exists

A repo-wide grep for `quaternion`, `slerp`, `Quaternion`, `lookAt`,
`setFromUnitVectors` across `packages/` (excluding vendored three) returns
**exactly one match**: `camera.lookAt(0, midY, 0)` at
`packages/scenes/veranda/matka-view.js:92`.

Plainly: **no quaternion, no slerp, and no general orientation/rotation code
exists anywhere in the library.** The relevant existing maths is:

- **Pitch-only camera, Euler + matrix, no quaternion.** The live tier sets
  `cam.rotation.set(pitch, 0, 0)` and an explicit `projectionMatrix`
  (depth-photo.gl.js:299-303). `cameraAt` returns a scalar `pitch`
  (stage3d.core.js:97-105).
- **Screen-space reproject / project.** `projectPoint` (stage3d.core.js:82) and
  `world.js`'s `project`/`projectM`/`rayAt` (world.js:22-26) map 3D points to
  the picture; the inverse, `reproject`, is stage3d.core.js:54.
- **Planes with explicit normals.** `world.js` solids carry a normal `n`
  (`plane` at world.js:41; `hit()` fills `n`, world.js:167, 177, 185, 188-195);
  `paint.js` uses normals for lighting and builds a view-perpendicular ring
  (`cross`/`norm`, paint.js:225-226). Normals and cross products, not
  orientation frames.
- **2D-only geometry helpers.** `packages/engine/src/geom.js` is entirely 2D
  (`resample`, `catmull`, `chaikin`, `measure`, `ellipse`, `blob`, `roughen`,
  `bbox`) — points are `[x, y]`.

So a plane-orientation core (quaternion + slerp) would be genuinely new; it can
reuse `world.js`'s projection conventions as its "world" and should mirror
`stage3d.core.js`'s pure, DOM-free style.

## 5. Extension points

**Where a pure plane-orientation core sits beside the existing pure cores.**
The library's convention is a `*.core.js` pure module (no DOM, Node-testable)
beside the side-effecting element file, counted as its own budget. Examples:
`packages/core/movable.core.js` (+ `movable.js`),
`packages/scenes/veranda/pane.core.js` (+ `stage-element.js`),
`packages/stage3d/stage3d.core.js` (+ `stage3d.js`),
`packages/scenes/veranda/matka.core.js` (+ `matka-view.js`),
`packages/scenes/veranda/world.js` (shared pure camera/geometry). A new
plane-orientation core (quaternion + slerp, soft-constrain to readable) belongs
in the same style: a pure module that takes a target normal/up-vector and a
current orientation and returns a slerped, constrained quaternion — importing
nothing but maths, mirroring `stage3d.core.js:1` ("No DOM, no three; runs in
Node"). If it is meant to be shared by scenes it could be a new
`packages/stage3d/orient.core.js` beside `stage3d.core.js`; if it is
veranda-specific, beside `pane.core.js`. Either way it must be exercised by a
`*.test.js` in Node like `movable.core.test.js`.

**Where the DOM text layer sits relative to the canvas/shadowRoot.** Two
existing patterns:

1. `<sg-scene>` (`scene-element.js:45-51`) uses an **open shadow root** with
   `<div class="stage">` and `<div class="reading"><div class="panel"
   part="panel"><slot></slot></div></div>`; the DOM words are *slotted light
   DOM*, living in the reading layer above the stage (`grid-area:1/1`, z-index
   1, CSS `scene-element.js:15-20`).
2. `<sg-veranda-stage>` (`stage-element.js:137-155`) creates real light-DOM
   children (`frame`, `stage`, `reading`, `panel`) and puts the words in
   `.panel` inside `.reading`; the canvas lives under `.stage`
   (`sg-depth-photo`, CSS `stage-element.js:53`). The type tier's `surface.js`
   then inserts its own layer **beside the host element**, outside the element
   (`host.after(layer)`, surface.js:30) — so the text layer is a sibling the
   scene can position, with `[data-line]` spans keeping pointer events
   (surface.js:12).

For a new primitive the words layer should follow pattern 2: a positioned layer
over the canvas/stage, real `<h*>`/`<p>` block elements each holding absolutely
placed `<span>` lines (type/index.js `project`), never canvas text.

**How a new attribute or element wires in (the observed-attribute pattern).**
Cited examples:

- `SgVerandaStage` declares `static observedAttributes = ['pane-depth',
  'words-at', 'lens', 'walk']` (stage-element.js:106) and routes them in
  `attributeChangedCallback` (stage-element.js:174-180), guarding on `#built`
  and calling the same setters the JS API uses.
- `<sg-scene>` (`scene-element.js`) does **not** use `observedAttributes` for
  the opt-in extras; it uses a MutationObserver: `#onAttributes(list)`
  (scene-element.js:197-209) switches on `movable`, `words-at`, `interactive`,
  `seed`, `paused`, plus params via `toCamel(n)` and `this.#def.params`
  (scene-element.js:206-208). It only declares `static observedAttributes =
  ['name']` (scene-element.js:94).
- The lazy-loader pattern for an attribute is `#movable()`
  (scene-element.js:146-156): dynamic `import()`, attach once, destroy when the
  attribute is removed.

So a new `sg-textpanel` element should declare its reflected attributes in
`observedAttributes`, create its DOM in `connectedCallback` (guarded by a
`#built` flag like stage-element.js:133-165), and inject CSS once via a shared
`styled` flag (stage-element.js:98, 136). A new `sg-scene`-level behavior
(opt-in) should follow `movable`: its own module, a dynamic import, an
attribute switch in `#onAttributes`.

## 6. Invariants any new primitive must respect

**Real DOM text stays selectable and screen-reader readable.** "The children
are the words: they stay real text in the page, in the accessibility tree,
selectable, at every depth and in every tier" (stage-element.js:8-9).
`surface.js` keeps the lines live: `.surface [data-line]{pointer-events:auto;
cursor:text}` (surface.js:12). Decision 0019 point 5: "The words stay real
text. Pretext decides where a line goes; the line is still DOM text (focusable
when it acts, selectable, translatable, read in a sensible order). Canvas-
painted text may only repeat words that also exist as DOM text"
(docs/decisions/0019-pretext-as-the-type-tier.md:20). `junctions.js` plaques
are real `<button>`s with a flat native-`<details>` fallback
(junctions.js:40, 34).

**keepClear / calm zones.** `keepClear(id, rect|null)` merges into the scene's
`calm` list; non-finite rects refused; renderers get it as `frame.calm`
(scene-element.js:82-87, 239, 294; decision 0021 point 1). `movable.js` keeps
*the whole pane box* clear, not just its line boxes (movable.js:79-84; decision
0021 point 3: "The pane is a keep-clear rect, not only its words"). The pot's
pane uses `GLASS_APART = 48` so two glass surfaces never sit within each other's
blur, which stalled the GPU (stage-element.js:39-41, `#others` at 611).

**Reduced-motion finished still.** "Reduced motion (`prefers-reduced-motion`)
always wins over the register: every register has a finished still. Save-Data
and low-power devices step down one register automatically" (docs/CHARTER.md:56).
`resolveMotion` returns `'still'` under reduced motion (register.js:30-34);
`chooseTier` returns `'2d'` for `motion === 'still' | 'state'`
(stage3d.core.js:27). The veranda's pot paragraph is a still under reduced
motion (matka-view.js:8, 151; `#flowOn` sets `live = dp.tier === 'live' &&
reg !== 'quiet' && !reduced()`, stage-element.js:267).

**Quiet register draws 2D and never downloads three.**
`docs/CHARTER.md` reduces quiet scenes to `'still'` (register.js:32). A scene
in quiet/motion-still routes through `chooseTier` to `'2d'`
(stage3d.core.js:25-30), and three.js is only ever fetched by `loadThree()`
when the tier is `'live'` (stage3d.js:1-4, 27-33). The veranda skips the mask
and bakes panes to stills in quiet (stage-element.js:576, 637; `#lensOk` won't
enable the lens in quiet, stage-element.js:457-460).

**Seeded determinism.** Scenes take a `seed` attribute and reseed
(`scene-element.js:69-72, 204`); the painter's randomness is seeded by string
(`rng('veranda:sky'|'veranda:trees'|'veranda:hatch'|'veranda:leaf'|
'veranda:rain')`, paint.js:279, 295, 368, 391, 442); the pot's turn is
quantised to `STEPS = 16` a turn so a line that has not changed is not touched
(matka-view.js:15, 141-144).

**Declared JS budgets.** "it holds its budget: JS size, and milliseconds per
frame when animated" (docs/CHARTER.md:95). Each piece declares a raw-byte
budget and is counted apart: engine budget 52 KB (decision 0002), core moved
to 31,744 raw bytes and `core-movable` at 16,384 raw bytes (decision 0021 point
4; docs/decisions/0021:30). Pretext's bytes are recorded per item with the tier
code on its own budget (decision 0019 point 7). A new primitive must declare
its own budget and keep three and Pretext behind lazy imports.

## 7. Unknowns and blockers

- **[unverified]** The exact per-item JS budget a new primitive must declare
  (single number and whether DOM edge + pure core are counted together) — I
  read the decision text (0019:22, 0021:30) but did not open the registry
  manifest / budget table that fixes the number for a new item.
- **[unverified]** Where the live/2d/still choice is *invoked* (the `chooseTier`
  caller inside `packages/stage3d/depth-photo/depth-photo.js`) — I read the pure
  `chooseTier` and the veranda's consumption of `dp.tier` and the `sg-tier`
  event, but not `depth-photo.js` itself, so the exact inputs (`motion`,
  `software`, `forced`) and the `sg-tier` emit site are inferred, not cited.
- **[unverified]** Whether `projectPoint`/`coverWindow` outputs are reused
  anywhere other than the "garnish" mentioned in stage3d.core.js:80; I did not
  enumerate all callers of `projectPoint`.
- **[unverified]** How `assets.js` (`verandaAssets`) builds the depth/layers
  maps and exposes `depthBytes/width/height`; the veranda reads them
  (stage-element.js:556, 415) but I did not open `assets.js`.
- **[unverified]** No existing test or check exercises an *oriented* (non
  axis-aligned) text plane; the plane-orientation primitive would be the first,
  so it has no precedent test to copy — only the `*.core.test.js` Node pattern.
- **Blocker for the design, stated plainly:** there is **no quaternion, slerp,
  lookAt or up-vector code** to build on (Section 4); the live camera is
  pitch-only (depth-photo.gl.js:299-303). A plane-orientation core is new maths,
  and, on the live tier, orienting the *text* plane would go beyond what the
  current stage camera does — the current design deliberately keeps the DOM
  words layer 2D over the canvas ("It is a 2D overlay in both tiers, so on the
  live tier it does not lean with the camera the way the picture does",
  stage-element.js:20-21). A new primitive that leans text in 3D would be the
  first to do so and would have to justify departing from that note.
- **Blocker:** settled text must remain readable, so any orientation must be
  soft-constrained toward a facing-the-camera / upright orientation; the
  existing readability machinery (`settleSpot`, per-line 15% limit,
  pane.core.js:211-289) is coverage-based only and has **no notion of
  orientation or foreshortening** — it would need extending or a parallel check.
- **[unverified]** Whether `<sg-scene>` allows non-axis-aligned placement of a
  text surface at all today: `#measure` computes calm rects as
  `getBoundingClientRect` boxes in logical units (scene-element.js:288-291),
  i.e. axis-aligned rectangles; an oriented plane's rect is not axis-aligned.