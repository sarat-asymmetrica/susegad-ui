# Image tier

A picture's size, known before its bytes arrive, so text laid by script can wrap round a picture without moving when the picture lands (decisions 0029 and 0030). The second oracle of the bake-and-reflow core, built like the type tier it works with.

**Use CSS first.** For a picture in a box, give the `<img>` its `width` and `height` and use `aspect-ratio` and `object-fit`. This tier is for text a script lays line by line beside floated pictures, and for a canvas that places a picture itself.

## Install

```sh
node <path-to-susegad-ui>/packages/cli/bin/susegad.mjs add image    # brings the type tier and Pretext with it
```

## In a page

```html
<div class="flow" id="flow">
  <figure data-side="right" data-share="0.42"><img src="a.jpg" width="1200" height="800" alt="…"></figure>
  <figure data-side="left" data-share="0.34" data-y="236"><img src="b.png" alt="…"></figure>
  <p>…</p>
</div>
<script type="module">
  import { registerState } from 'susegad/core/register.js';
  const root = document.getElementById('flow'), s = registerState(root);
  if (s.register !== 'quiet' && !s.reducedMotion) {
    const { mountFlow } = await import('susegad/image/flow.live.js');
    mountFlow(root, { gap: 16, minWidth: 112 });
  }
</script>
```

Float the figures in CSS for the plain reading. `mountFlow` reads each picture's size from its `width` and `height`, or from its file header when it has none; waits for the sizes (600 ms at most); and lays the paragraphs beside boxes reserved from them. One span per line goes inside each `<p>`, so the words stay real text, in order. `destroy()` gives the plain reading back.

## API

| Export | What it does |
|---|---|
| `imageOracle` (`measure.js`) | The shared oracle. `dims(src, { signal })`, `peek(src)`, `record(src, { w, h })`, `dimsOfBytes(bytes)`, `dimsOfBlob(blob)`, `forget(src?)`, `dispose()`. |
| `createImageOracle({ fetch, Image, base, maxBytes, timeoutMs })` | A separate oracle with its own cache; the fetch and `Image` can be replaced. |
| `readHeader(bytes)` (`header.core.js`) | `{ kind, w, h, orientation }`, `{ more: true }` or `null`. Pure. |
| `fitRect(dims, box, mode, { align, focus })` | Where a picture lands in a box (contain, cover, none), with the crop in picture pixels. |
| `reserve(dims, width, ratio?)` | The box a picture needs at a width. |
| `flowColumn(col, floats, { gap })` | The reserved boxes and the column's room as a shape for `layIntoShape`. |
| `flowAround(layout, blocks, col, floats, opts)` | Text laid beside floats, from a type-tier layout. |
| `mountFlow(root, opts)` (`flow.live.js`) | The live surface. `ready`, `relayout()`, `destroy()`. Fires `sg-flow` on the root after each layout. |

Cores and components import `layout.core.js` and `header.core.js`, never `measure.js`; `packages/type/boundary.test.js` enforces it.

## Limits

A very large EXIF block can push the frame header past 256 KB; the `<img>` fallback answers then. WebP's EXIF orientation is not read. SVG has no header. The first layout waits at most 600 ms for sizes, and a picture whose size is still unknown then gets a guessed box and one re-layout when its size lands.
