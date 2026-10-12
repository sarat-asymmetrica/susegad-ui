# Type tier

Words that live in a scene, on a surface the scene draws (a chalkboard, a window's arch, a painted sign), and stay real text: selectable, translatable, read in order, and pressable where they act. Decision 0019; the request that asked for it is `docs/requests/2026-09-28-words-in-the-world.md`.

The tier is loaded lazily. A scene imports it with `import('../../type/index.js')` only when words are about to be placed (Tinto: `words="world"`, in warm or playful, with something slotted). Core, the engine, tokens and components never import it.

## What it does

- **Lay text into a shape.** A shape answers, for a band of the page, the room there: `shape(top, bottom) → { x, w }` in the scene's logical units, or `null`. `rect`, `arch` and `slant` are built in. `layIntoShape(blocks, shape, { top, bottom, scale })` sends each block (a heading, a paragraph) through the bands one line at a time, with Pretext choosing each line's break for that line's own width.
- **At the size it will be seen.** Blocks are prepared at their CSS size, and `scale` is CSS px per logical unit, so widths are compared where they are real. The lines come back in logical units, which is what a renderer's calm zones and a contrast check need.
- **Fit, or give the words back.** `fitSize(sizes, build, shape, opts)` returns the largest size that holds every line, or `null`. `null` means the surface can't hold the words legibly, and they go back to the flat reading (the scene's panel).
- **Cards.** `shrinkWrap` is the tightest width that keeps the lines; `balance` is the narrowest width that keeps their number, so a card has no lonely last word.
- **Into the DOM.** `project(lines, blocks, { W, H })` puts one span per line inside each block's element (a heading, a paragraph), placed in percentages of the drawing, so the layer scales with it.
- **A surface** (`surface.js`): the lazy edge a scene uses to hold the page's own slotted words on something it draws. The scene gives a shape and a key; the surface loads the tier, lays the heading and paragraphs (`setBlocks`, centred or `align: 'left'`), projects the lines and hides the panel while it holds them. Vad writes in its sky with it.
- **Junctions** (`junctions.js`): a label on a drawn plaque that is a real button and opens a detail card, or the same items as a plain list. Tinto's shops use it.
- `calmOf(lines)` turns line boxes into calm rects; `fontReady(font)` waits for a face before measuring it.

## Rules it keeps

- A line that would have to break inside a word is not a fit: on a drawn surface that means the size is wrong.
- Pretext measures with the browser's own canvas, so wait for the font (`fontReady`), and pass sizes in px.
- The words stay DOM text. A canvas may repeat them, never replace them.

## Three roles (decision 0029)

- **Oracle** (`measure.js`): Pretext, the measurement device. It answers how wide the segments are and where the breaks go, and it is the only file outside `vendor/` that imports Pretext. `createPretextOracle()` is the default; its shape is:

  ```
  oracle = {
    start,                                  // the cursor of the first line (opaque)
    prepare(text, font)           -> prepared   // opaque handle; expensive
    nextLine(prepared, cursor, w) -> { text, width, end, brokeWord } | null
    stats(prepared, w)            -> { lineCount, maxLineWidth }
  }
  ```

  `cursor` and `end` are the oracle's own positions; `brokeWord` says the line ended inside a word. The core never looks inside a prepared handle. Pretext finds its own canvas and cannot be handed one, so tests use `oracle.fake.js` (half the font size per grapheme, breaks at spaces) for geometry and a fake `OffscreenCanvas` for the real path (`pretext.test.js`).
- **Geometry** (`layout.core.js`): the shapes (`rect`, `arch`, `slant`), `calmOf`, and `createLayout(oracle)`, which returns `prepare`, `layIntoShape`, `fitSize`, `setBlocks`, `labelBox`, `shrinkWrap` and `balance`. It imports nothing and runs in Node. Each instance keeps its own prepared-text cache.
- **Painting** (`surface.js`, `junctions.js`, `project` in `index.js`): line boxes become DOM spans (canvas and stage3d painters come later).

## The rule

Cores, the engine and components import `layout.core.js` only, never `measure.js` or `vendor/pretext.js`. `boundary.test.js` fails the build if one does. Scenes use `index.js`, which binds `createLayout(createPretextOracle())`. A component that needs words measured keeps its core to geometry and lays the words in a `*.live.js` file that it loads with a dynamic `import()` (see "Text zones" below).

## Files

- `layout.core.js`: the pure geometry (tested in Node through the fake oracle, `type.test.js`, with no canvas).
- `layout.operators.js`: the named operators (`operators.test.js` in Node; `operators.pretext.test.js` through the real oracle). `operators.js`: their lazy live door.
- `measure.js`: the oracle boundary. `oracle.fake.js`: the test oracle (does not ship).
- `index.js`: the lazy entry binding the two, plus `fontReady`, `readBlocks` and `project`.
- `surface.js`, `junctions.js`: DOM helpers with no static imports. `surface.js` loads `index.js` (and so Pretext) with a dynamic `import()` only when a scene turns words on; `junctions.js` imports nothing. A flat reading never loads Pretext.
- `boundary.test.js`: the guard. `pretext.test.js`: the real oracle's path against a fake canvas.
- `vendor/`: Pretext itself, with `PROVENANCE.md` and its `LICENSE`. A registry item of its own (`pretext`), so its bytes are counted apart from ours.

## The named operators (`layout.operators.js`)

Five solved problems that the Pretext community built as separate packages, as pure functions over a layout (decision 0029). All are deterministic and tested in Node against the fake oracle, with property tests (each is held to the invariant it exists for) and a mutant per operator that the tests catch. The live tier opens them through their own lazy door, `import('../../type/operators.js')` (not `index.js`, which stays lean): there `fit`, `clampLines` and `predictHeight` are bound to the default layout, so you call them without the `layout` argument, and `pack`, `place` and `distribute` are re-exported. No core imports that door (`boundary.test.js`).

### `fit(layout, text, shape, { family, weight?, leading?, minPx, maxPx, top, bottom, scale?, minWidth?, step?, align? })`

The largest whole-px size at which the words lay into the shape with no broken word. A binary search over the sizes: it prepares the text O(log n) times, not once per size. Returns `{ px, lines, bottom, lineHeight, font }`, or `null` below `minPx` (the words go back to the flat reading). A missing or non-finite `minPx`/`maxPx` throws a `TypeError`, not a quiet `null`. It builds on `fitSize`. *Limit:* it assumes a larger size never fits where a smaller one does not. That holds for a rect and nearly always for a gentle arch; on a wild shape it can miss a lucky larger size, but the size it returns always fits.

### `clampLines(layout, lines, n, { font, ellipsis?, scale?, align?, more? })`

`n` lines, computed (not CSS `-webkit-line-clamp`). If anything was cut, the last kept line is shortened so `text + ellipsis` fits that line's band (`line.room`, which `layIntoShape` now gives every line), measured through the layout and never a canvas. The cut is on a cluster boundary: `Intl.Segmenter` graphemes, with a virama joined to the consonant after it (and a trailing ZWJ), because the segmenter keeps a conjunct whole only in some scripts (Kannada, for one, splits `ಕ್|ಷ`). Conjuncts stay whole in the nine scripts that have a virama: Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada and Malayalam (each swept in `operators.test.js`); a ZWNJ is a legal break. The cut is at a word end when that holds at least half of what would fit. The prefixes are measured with `layout.measure` (a direct oracle call), so probing never evicts your cached text. Returns `{ lines, clamped, fullText, fits }`: keep `fullText` in the DOM for assistive technology and paint the clamped lines. `more: true` says the layout itself ran out of room (`fits` was false), so the last line gets an ellipsis even with `n` lines or fewer. *Limit:* one block's lines at a time, and the longest-prefix search assumes a prefix never gets narrower as it grows (true of whole clusters).

### `pack(blocks, { columns, gap, width })` and `predictHeight(layout, text, font, width, lineHeight)`

Masonry from predicted heights. `predictHeight` is the line count at `width` times the line height, so a card's height is known before it is painted and nothing jumps when the words arrive. `pack` puts each `{ id, height }`, in order, into the shortest column so far (ties to the leftmost) and returns `{ items: [{ id, x, y, w, h, column }], height }`. *Limit:* greedy and in order, which is stable and good, not the tightest possible packing; it packs heights and knows nothing of card padding (put the padding in `height`).

### `place(labels, { bounds, obstacles?, nudges?, gap?, anchorRadius? })`

Collision-free labels around anchors. Labels are `{ id, anchor: {x,y}, w, h, priority? }`. In priority order (higher first, then input order) each takes the first candidate box that stays inside `bounds`, clear of `obstacles` and of the labels already placed: the four sides, then the four diagonals, at `gap` from the anchor, then again at `gap` plus each nudge (default 6, 12, 24). Returns `{ placed: [{ id, x, y, w, h, side }], dropped: [id] }`; touching edges are not overlap. *Limit:* greedy, not optimal. An early label can take the spot a later one needed, and a dropped label is simply dropped: no leader lines, no second pass. Every other label's anchor counts as a small obstacle (a dot of `anchorRadius`, default 3), so a label never sits on another's anchor. Mark any other markers as `obstacles`.

### `distribute(items, { axis, start, end, minGap })`

Even spacing for timeline and gantt labels whose sizes are known on frame 1. Items are `{ id, at, size }` (`at` is the ideal centre). They keep the order of `at`, stay at least `minGap` apart and inside `[start, end]`, and sit as near their `at` as that allows: the exact least-squares answer, by pool-adjacent-violators (the working is in the source). Returns `{ items: [{ id, at, center, shift, x, w }], overflow }` (`y` and `h` on the y axis). *Limit:* when even tight packing is longer than the room, `overflow` is true and the items are packed from `start` keeping `minGap`: order and gaps win over `end`. The caller decides whether to shrink the labels or scroll.

## Text zones (rung 3)

A pure core (a scene's model, a component's core) says where words go as **plain data**, and the text tier turns that into line boxes. The data is serialisable, so a Node gate can read it with no browser; the core never touches Pretext.

### The convention

A core may export:

```js
export function textZones(state) {
  return [{
    id: 'words',                                  // the key in the result
    shape: { kind: 'ellipse', cx: 160, cy: 95, rx: 140, ry: 80, pad: 8 },  // a descriptor, below
    slot: 'words',                                // the name of a text in `texts` (or `text: '…'` for the words themselves)
    registers: ['warm', 'playful'],               // laid only in these; omit to lay in every register (quiet lays nothing)
    minPx: 14, maxPx: 22,                         // CSS px: the legible floor, and the size the words want
    leading: 1.25, align: 'center', valign: 'middle',  // optional; defaults: leading 1.22, align start, valign middle
    minWidth: 56,                                 // optional; logical units; bands narrower are skipped (default 4 times minPx)
  }];
}
```

A **shape descriptor** is `{ kind, ...numbers, pad? }`: `rect` (x, y, w, h), `arch` (x, y, w, h, rise), `slant` (x, y, w, h, lean), `ellipse` (cx, cy, rx, ry), or `polygon` (points: [[x, y], …]). `shapeOf(descriptor)` returns the shape function that `layIntoShape` wants and throws on an unknown kind or a missing number; `boundsOf(descriptor)` returns `{ x, y, w, h }`. Both are in `layout.core.js`, which still imports nothing.

`pad` for `ellipse` and `polygon` is a margin in the box sense, on every side: a line box laid in the room, grown by `pad` all round, stands inside the true shape. (`rect`, `arch` and `slant` keep their older, simpler `pad`.) Each is tested geometrically against the shape's own equation: the room is inside the shape at the band's top and bottom edges, and as wide as it can be.

- **`ellipse(cx, cy, rx, ry, pad)`**: the room of a band is the width at its narrower edge (an ellipse is widest in the middle).
- **`polygon(points, pad)`**: the room of a band is the stretch of the interior common to every row of the band (its two edges and every vertex between them, which is exact because the sides are straight). A non-convex polygon can cut a row into several stretches: the band starts from the one holding the polygon's centroid x (or, when the centroid is in a notch, the widest), then follows whichever stretch of each next row overlaps it most. No common stretch means no room, and the band is skipped.

### Laying the zones

```js
const ops = await import('../../type/operators.js');      // the live door; never from a core
const laid = ops.layZones(textZones(state), { words: 'The fish was this big.' }, { family: 'Kalam', weight: 400, scale: 1, register: 'warm' });
// laid.words = { px, lines, fits, lineHeight, font }   lines are { block, text, x, y, w, h, room } in the shape's logical units
```

`layZones(layout, zones, texts, opts)` is in `layout.zones.js` (it imports only the geometry and the operators, so a core's tests can call it with `createLayout(createFakeOracle())`). For each zone it finds the largest whole-px size with `fit`, then centres the block down the room that is left (the top-anchored size is a floor: a block centred where a shape is widest often takes a px more). A zone with no room at `minPx` comes back `{ px: null, lines: [], fits: false }`: the words belong in the flat reading, never clipped and never shrunk below the floor. `scale` is CSS px per logical unit; a zone with no text throws.

A core that wants to be tested in Node takes the laying as an argument (`lay(zones, texts) => layZones(layout, …)`), as `components/bubble/bubble.core.js` does in `sizeBubble`.

### Two rules for text zones

- **Words stay real text.** Project lines as one span per line inside the page's own paragraph (decision 0019), or let CSS lay them (`shape-outside`, below). Never repeat them in a canvas without the text.
- **Pretext starts only in the live tier.** Quiet and no JavaScript never load it, and under reduced motion a component sets its words with CSS. (A still board that lays its words once is the one exception; see decision 0029.) A component that lays text declares a live surface, a file named `*.live.js` (`components/bubble/skins/bubble.live.js`), which may import the type door (`operators.js`) statically; the component's drawing skin reaches it only by a dynamic `import()`, at the registers and motion that lay text. `boundary.test.js` enforces it: a dynamic edge into a `*.live.js` ends the walk as allowed, a static import of one fails with its chain, a dynamic import of anything else that reaches the oracle still fails, and `*.live.js` files are not themselves guarded (decision 0029, rung 3 ruling). The runtime half is the component's browser check, which reads the page's resource list in quiet, reduced motion and without JavaScript.

### The still: shape-outside

Where no script may lay the lines (reduced motion, markup in the paragraph), `components/bubble/skins/body.js` gives the paragraph two floats, each half the width and the full height, whose `shape-outside` is a polygon built from the same zone (`hugShapes` in `bubble.core.js`): the left float is everything left of the room at each row, the right float everything right of it. CSS then sets the text between them, and the lines hug the shape in Chromium. It is the same zone as the live layout, so a bubble looks alike with or without Pretext; the difference is that CSS, not the type tier, breaks the lines.

## Words in z-space (rung 5)

The same line boxes can be painted as DOM spans or as textured quads in a three.js scene. The quads only repeat the words; the text stays in the page, real, selectable and read in order, and a canvas never replaces it (`packages/stage3d/`, decision 0029). The stage3d tier turns an object's projected silhouette into a shape (`occlusion.core.js`: `flowShape` for `layIntoShape`, `silhouetteOf` as a polygon descriptor) and paints the lines it is given (`text.live.js`); it never breaks a line. The scene calls `layIntoShape` once and gives the one `lines` result to both painters, the spans (the real words, in the page) and the quads (depth beside the object); while the quads are on screen the spans' ink is transparent, and it comes back when they are not. In quiet, under reduced motion and without JavaScript nothing is measured: the still is plain text flowing round a CSS `shape-outside` hug (`hugFloat`), and `scenes/veranda/quads.check.mjs` reads the request log to prove the type tier and Pretext are never requested there.

## The text gate

`node tools/text-gate.mjs` (also run by `npm run check`, and by `npm run gates` through `tools/lib/text-gate.test.mjs`) asks, with no browser, whether the library's words fit the shapes they are laid into, in English, Konkani (Devanagari and Romi) and Kannada. It takes about a second.

- **What it lays.** The copy in `fixtures/gate-copy.js`, into the real shapes: Tinto's board (`slateOf()` and `arch`), Tinto's plaques (`labelBox` against each plaque's room), Vad's sky (`skyShape` on the settled banyan, three seeds) and the Veranda's paragraph round the pot (`matka.core.js`'s own projection, 16 poses, three pot sizes). Each runs the real `setBlocks` / `layIntoShape` / `labelBox` on the real vendored Pretext. The list of uses, and what each must do at each viewport (phone 390, desktop 1100 and 1280, text at 200%), is `tools/lib/text-gate.manifest.js`.
- **How it measures.** `tools/lib/hb-canvas.mjs` puts a stand-in `OffscreenCanvas` on the global before Pretext is first imported. Its `measureText` takes the face for each character from the real `fonts.css` (family, weight, `unicode-range`), widens a bare `Kalam` or `Mukta` to the token stack in `tokens.css` (so Kannada falls to Noto Sans Kannada, as the stack intends), and shapes each run with HarfBuzz (`harfbuzzjs`, `wawoff2`; devDependencies). A browser shapes with HarfBuzz too, so Indic conjuncts come out as they do on screen. Tool only: it never ships.
- **How far to trust it.** `tools/text-gate.calibrate.mjs` measures the same strings in headless Chromium and writes `fixtures/calibration.json`: in Chromium 153 the stand-in is within 0.002 px of the browser's canvas on whole strings and 0 on words, in all three scripts. The gate's slack is ten times the worst of that, never under 0.05 px. Changing a font file or a dependency makes `hb-canvas.test.mjs` say to run the calibration again.
- **What it says.** Per use, language and viewport: `fits`; `falls-back` (the flat reading, a designed outcome, a failure only where the manifest says the surface must `holds`); `escapes` (a line wider than its band once the shaper re-measures it whole, a lost word, a surface that shows what does not fit; always a failure); `not-gated` (a browser fact, with the reason). The same pass checks that no size is under the surface's legible minimum (or 14 px at phone width), that line height is at least 1.15 times the size, and that every line has a calm box.
- **The rule for expectations.** No language may do worse than English: where English holds the words on the surface, every language must. A known shortfall is written in the manifest as a waiver with its cause; the gate fails if the cell fails for any other cause, and fails again once the cell holds, so a waiver cannot outlive its finding.
- **When it fails.** The row names the use, the language and the viewport, and the line under it says why. To see one cell, run `node tools/text-gate.mjs --use <id> --lang <tag>`. An `escapes` means the words are too long for the shape: shorten the copy, make the shape bigger, or let the surface give the words back to the flat reading. A `falls-back` that fails means a surface that must hold its words could not. If the shortfall is known and cannot be fixed yet, write a waiver with its cause in the manifest.
- **Proof it bites.** `tools/lib/text-gate.test.mjs` swaps in the `OVERFLOW` Kannada board (red), shrinks the board's arch (red), halves every width (results change) and lies only to the layout (caught as escapes).

What it cannot see: a face a browser takes from the visitor's machine. So scenes pass the whole token stack (`stackOf(host, 'hand')` from `stacks.js`), never one family, and every script in the copy is covered by a face the repo ships. If a character in the copy has no shipped face, the gate fails and names it: add a face to the stack in `tokens.css` and `fonts.css`, or change the copy.
