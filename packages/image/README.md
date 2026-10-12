# Image tier

A picture's size, known early, so that text laid by script can wrap around it before the picture has arrived. The second oracle of the bake-and-reflow core (decisions 0029 and 0030), and the peer of the type tier: text's expensive fact is how wide the words are, an image's is how big the picture is.

## What it is for, and what it is not

The platform already owns `aspect-ratio` and `object-fit`. For a picture in a box, **use them**: give the `<img>` its `width` and `height` attributes, let CSS reserve the box and crop it. Nothing here replaces that, and quiet, reduced motion and no JavaScript get exactly that plain reading.

This tier fills the one gap CSS leaves: **JS-owned layout**. When a script lays text line by line round a picture (the type tier's `layIntoShape`), the script must know the picture's box before the browser has loaded it; and when a canvas draws a picture itself, it must place it as `object-fit` would. Both are arithmetic over the picture's intrinsic size, and getting that size early is the one job that needs an oracle.

## Three parts, three roles

- **Oracle** (`measure.js`, with its parser `header.core.js`): the only file that goes to the network or the decoder for a picture's size. `imageOracle.dims(src)` resolves `{ w, h, source }` or `null`, never throws.
  1. *known*: a size the page already has (`width`/`height` attributes, a CMS field): `record(src, { w, h })`.
  2. *bytes*: a streamed `fetch` that sends `Range: bytes=0-262143`, parses the header as chunks arrive and cancels the transfer at the first answer (usually the first kilobyte or two).
  3. *img*: a warmed `<img>` polled for `naturalWidth`, for what a fetch cannot read (a cross-origin picture with no CORS, an SVG, a format the parser does not know). It is released as soon as the size is read.
  Cached by resolved URL; concurrent asks share one request; a caller's `AbortSignal` ends its own wait, and the request when nobody is left waiting; `dispose()` cancels everything and empties the cache (the oracle stays usable). `dimsOfBytes(bytes)` and `dimsOfBlob(blob)` read bytes already in hand. The fetch and `Image` are injectable, which is how Node tests the whole path.
- **Geometry** (`layout.core.js`): pure, imports nothing, runs in Node.
  - `fitRect(dims, box, mode, { align, focus })`: where a picture lands in a box, for `contain`, `cover` or `none`. `align` is `object-position`; `focus` is the point in the picture to keep in view (brought to the middle of the box as far as the box stays covered). Returns `{ x, y, w, h, scale, crop }`; `crop` is the part inside the box in picture pixels, the source rectangle for canvas `drawImage`.
  - `reserve(dims, width, ratio?)`: the box a picture needs at a width. With no size yet, `ratio` stands in and the box says `guessed: true`.
  - `flowColumn(col, floats, { gap })`: a column with floated pictures. Returns `boxes` (the reserved boxes: size the pictures to these), `shape` (`(top, bottom) -> { x, w } | null`, the type tier's shape for `layIntoShape`) and `bottom`. Floats hug their side, stack downward on a side, and go below one on the other side when they would meet it, as in CSS.
  - `flowAround(layout, blocks, col, floats, opts)`: the two together. `layout` is a type-tier layout (`createLayout(oracle)`), passed in, so this file imports nothing.
- **Painting** (`flow.live.js`): the live surface. `mountFlow(root)` reads the figures' sizes (attributes first, then the oracle), waits for them (at most 600 ms), lays the paragraphs with the type tier beside boxes reserved from those sizes, and paints one span per line inside each `<p>`, the words staying the paragraph's own text in reading order. It re-lays on resize and text zoom, and `destroy()` gives the plain reading back.

## The rule

Cores, the engine and components import `layout.core.js` (and `header.core.js`), never `measure.js`. `packages/type/boundary.test.js` fails the build if one does, directly or through any chain of imports, and it knows both oracles (the type tier's `measure.js`, with Pretext, and this one). A component that needs a size loads a `*.live.js` file with a dynamic `import()`, as the type tier says; `flow.live.js` is that file for this tier.

## Using it

```html
<div class="flow" id="flow">
  <figure data-side="right" data-share="0.42"><img src="a.jpg" width="1200" height="800" alt="…"></figure>
  <figure data-side="left" data-share="0.34" data-y="236"><img src="b.png" alt="…"></figure>   <!-- no size written down -->
  <p>…</p>
</div>
<script type="module">
  import { registerState } from '../core/register.js';
  const s = registerState(document.getElementById('flow'));
  if (s.register !== 'quiet' && !s.reducedMotion) {          // the live tier only: quiet and reduced motion keep the CSS floats
    const { mountFlow } = await import('./flow.live.js');
    mountFlow(document.getElementById('flow'), { gap: 16, minWidth: 112 });
  }
</script>
```

Style the plain reading in CSS (float the figures, `img { width: 100%; height: auto }`); `mountFlow` takes over only where it runs. `packages/image/demo.html` is the whole thing, with its CSS.

In Node (a gate, a build step) the same geometry runs with no browser:

```js
import { createLayout } from 'susegad/type/layout.core.js';
import { flowAround, fitRect } from 'susegad/image/layout.core.js';
const laid = flowAround(layout, blocks, { x: 0, y: 0, w: 640 }, [{ side: 'right', width: 240, dims: { w: 1200, h: 800 } }], { gap: 16, minWidth: 112 });
// laid.lines are line boxes, laid.boxes the reserved pictures, laid.bottom the column's height
```

## Rules it keeps

- **Reserve from the header, never guess when you can know.** A box reserved from the real size never changes. A guessed box (no size within the wait) is marked `guessed` and the layout is redone once when the size lands; that one move is the cost of not knowing.
- **Plain CSS first.** Quiet, reduced motion and no JavaScript never request the oracle, the type tier or Pretext; `image.check.mjs` reads the request log to prove it.
- **The words stay real text**, in their own paragraph, in order. The pictures keep their `alt`. Nothing here draws.
- **Never throws into a caller.** An unknown size is `null`; a missing `fetch` or `Image`, a 404, a junk URL, an abort and a timeout are all `null`.

## Limits

- The header is the first bytes of the file. A JPEG with a huge EXIF or ICC block before its frame header can need more than `maxBytes` (256 KB by default); then the `<img>` fallback answers.
- WebP's EXIF orientation (a chunk after the image) is not read: a rotated WebP reports its stored size. JPEG's EXIF orientation and AVIF's `irot` are, so the size is the one a browser displays.
- SVG has no header to read; the `<img>` fallback answers when the SVG declares an intrinsic size and `null` when it does not.
- The probe cancels after the header and the real `<img>` then loads the file itself; a server that ignores `Range` and a browser that does not cache a cancelled body mean the first kilobytes can travel twice.
- `flowColumn` is a column of floats, not a general CSS float engine: no clearing, no shape-outside curves, no inline images. `layIntoShape` steps down a quarter line at a time when a band has no room (at most 400 steps per block).
- The first layout waits for sizes at most 600 ms. In that wait the plain reading is on screen (the demo hides it for that short time to avoid a visible jump; a page that does not should accept one move when the words go in).
- The `<img>` fallback needs a real browser; it is exercised in Node only through a fake `Image`.

## Tests, and the teeth

- `header.test.js`: every format built to its specification (the corners: JPEG markers and EXIF byte order, AVIF primary item and `irot`, WebP's three chunk kinds, truncation at every length) and, when `sharp` is installed, written by real encoders (PNG, JPEG baseline and progressive, JPEG at all eight orientations, WebP lossy, lossless and alpha, GIF, AVIF).
- `layout.test.js`: `fitRect` against exact cases and against CSS `object-position` over seeded random boxes; `flowColumn` against its own geometry (the room never touches a float's margin box and is as wide as it can be); `flowAround` in the type tier's fake oracle.
- `measure.test.js`: the oracle through a fake `fetch` and `Image`: early cancel, cache, sharing, fallback, abort, dispose, timeout, byte cap, and that no other file here touches the network or the decoder.
- `mutants.test.js`: 27 faults planted in `layout.core.js` and 19 in `header.core.js`, one at a time, in a copy; each must make a check fail, and the test fails loudly if a mutant survives or its text no longer matches the file. `node --test packages/image/mutants.test.js` prints which check killed each.
- `image.check.mjs` (browser): pictures delayed 1.2 s by a route, the oracle's header read answered at once. It compares every line and box before and after the pictures arrive, reads the browser's layout-shift entries, and proves quiet, reduced motion and no-JS ask for none of it. `--break` refuses the oracle's reads and the checks that depend on them go red.
- `boundary.test.js` (in `packages/type/`): the guard, with planted imports of `image/measure.js` (direct, through another module, through a static import of the live surface) that fail with their chain.

## Files

- `header.core.js`, `layout.core.js`: pure (Node). `measure.js`: the oracle. `flow.live.js`: the live surface (dynamic `import()` only).
- `dims.fake.js`: a fake dimension source for Node (same shape as the oracle: `dims`, `peek`, `record`); does not ship. `header.props.js` and `layout.props.js`: the checks, as functions of a module, shared by the tests and the mutants; do not ship.
- `demo.html`, `fixtures/` (two made-up pictures and `make.mjs`, which paints them), `image.check.mjs`.
