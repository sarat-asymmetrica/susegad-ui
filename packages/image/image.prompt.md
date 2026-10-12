# Image

*A picture's size, known early, so text laid by script can wrap round a picture before its bytes arrive.*

For a picture in a box, use `aspect-ratio` and `object-fit`: the platform owns them. This tier is for the case CSS cannot do, text that a script lays line by line (the type tier) beside floated pictures, and a canvas that must place a picture itself.

## The prompt

Make a small image tier in three parts, with the same shape as the type tier. First, an oracle: the one module that goes to the network or the decoder for a picture's intrinsic size, and answers early, before the picture has loaded. It reads, in this order, a size the page already has (width and height attributes, a CMS field, recorded by URL); the header of the file, by a streamed fetch that asks for a byte range, parses as chunks arrive and cancels at the first answer; and last a warmed image element polled for its natural width, for what a fetch cannot read (a cross-origin picture with no CORS, an SVG). The header parser is pure and separate: PNG, GIF, JPEG (every frame marker, and EXIF orientation 5 to 8 swapping width and height), WebP (lossy, lossless and extended) and AVIF (the primary item's spatial extents, turned by its rotation property). The oracle caches by resolved URL, shares one request between concurrent callers, lets a caller's abort signal end its own wait and the request when nobody waits, cancels everything on dispose, never throws into a caller (an unknown size is null), and takes its fetch and Image constructor as options so Node can test the whole path.

Second, a pure geometry core that imports nothing: `fitRect` for contain, cover and none with alignment (object-position) and a focal point, returning the drawn rectangle and the crop in picture pixels; `reserve` for the box a picture needs at a width, with a ratio fallback that says it guessed; `flowColumn` for a column with left and right floats, giving the reserved boxes and a shape function `(top, bottom) -> { x, w } | null` for the type tier's `layIntoShape`, floats stacking down their side and going below one on the other side if they would meet it; and `flowAround`, which takes a type-tier layout as an argument and lays text beside those floats.

Third, a live surface loaded only by dynamic import in warm and playful, which reads each figure's size (attributes first, then the oracle), waits for the sizes at most 600 ms, lays the paragraphs beside boxes reserved from them, writes one span per line inside each paragraph so the words stay the paragraph's own text, and re-lays on resize and text zoom. Quiet, reduced motion and no JavaScript get plain CSS floats and `aspect-ratio` from width and height attributes, and never request the oracle, the type tier or Pretext. Nothing may import the oracle except the live surface.

Test the geometry against CSS `object-position` and against its own invariants, plant faults in it and in the parser and check each is caught, and check in a browser that delayed pictures change no line and no box when they arrive.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| the size, early | the oracle | `imageOracle.dims(src, { signal })` resolves `{ w, h, source }` (`'known'`, `'bytes'`, `'img'`) or `null`; `peek(src)` answers from the cache at once. |
| a size the page already has | record | `record(src, { w, h })` makes `dims` answer with `source: 'known'` and no request. |
| read the header, stop | streamed range fetch | `Range: bytes=0-262143`, the parser runs on each chunk, the transfer is cancelled at the first answer. |
| as the browser shows it | orientation | JPEG EXIF 5 to 8 and AVIF `irot` 90 and 270 swap width and height before the answer. |
| never throws | null for unknown | a 404, a missing `fetch`, a throwing `Image`, an abort and a timeout all resolve `null`. |
| stop when nobody waits | abort counting | each caller's signal ends its own wait; the request is aborted when the last waiter leaves. `dispose()` aborts all. |
| like `object-fit` | `fitRect` | `fitRect(dims, box, 'contain', 'cover' or 'none', { align, focus })` returns `{ x, y, w, h, scale, crop }`; without `focus` it is `object-position`. |
| keep this point in view | focal point | `focus: { x, y }` (0 to 1) is brought to the middle of the box, clamped so the picture still covers it. |
| the box before the bytes | `reserve` | `reserve(dims, width, ratio?)` gives `{ w, h, guessed }`; no size and no ratio gives `null`. |
| text beside a floated picture | `flowColumn` | `flowColumn(col, floats, { gap })` returns `{ boxes, shape, bottom }`; `shape` goes to `layIntoShape`. |
| laid before the picture arrives | `flowAround` | `flowAround(layout, blocks, col, floats, { gap, minWidth })` returns `{ lines, fits, bottom, boxes }`. |
| no word squeezed into a sliver | `minWidth` | bands narrower than `minWidth` are stepped over, so the text starts below the float. |
| the live tier only | `mountFlow` | `mountFlow(root)` in `flow.live.js`, imported dynamically, only when `registerState(root)` is not quiet and not reduced. |
| the plain reading | CSS | floats, `img { width: 100%; height: auto }` and width and height attributes: no oracle request. |

## Budget

About 33 KB of source with its comments across four files: the header parser 8.5 KB, the oracle 8.4 KB, the geometry 8.3 KB and the live surface 8.3 KB. Budgeted apart from the type tier while the foundations go in.
