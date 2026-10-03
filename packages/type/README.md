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

## Files

- `layout.js`: the pure half (tested in Node, `type.test.js`, with a fake canvas as Pretext's own suite does).
- `index.js`: the lazy entry, `fontReady`, `readBlocks` and `project`.
- `surface.js`, `junctions.js`: DOM helpers that import nothing, so a flat reading never loads Pretext.
- `vendor/`: Pretext itself, with `PROVENANCE.md` and its `LICENSE`. A registry item of its own (`pretext`), so its bytes are counted apart from ours.
