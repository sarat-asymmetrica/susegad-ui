# Gallery

`<sg-gallery>` is photographs with consent first: every place a photograph goes is designed for the consent that hasn't arrived yet. It enhances figures the author writes; it never invents a photograph.

## Markup

Each slot is a `figure.sg-gallery-slot` inside the gallery. Its `consent` attribute decides what shows:

| Slot | What shows |
|---|---|
| `consent="granted"` | the image, and a button that opens it larger in a dialog |
| no `consent` attribute | the image: a missing attribute is the author's decision, the element never guesses |
| `consent="pending"` | a drawn frame with photo corners, the caption, and the count line. Never the image: an `<img>` in the slot is stripped of its src and hidden, and consent arriving later restores it. The slot is not a control: nothing in it takes focus or opens anything. |
| any other value | the image, as if the attribute were absent |

| Element | What it is |
|---|---|
| `img` | the photograph, the author's own `<img>` with alt, width and height |
| `figcaption` | the caption; the screen reader reads it on the pending frame and the dialog reuses it |
| `p.sg-gallery-count` | the count line, written by the element ("2 photos, coming soon"), one per pending slot; write your own for the no-JS case and the element keeps it in step |

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `register` | `quiet`, `warm`, `playful` | inherited |
| `seed` | any string; seeds the hand-drawn corners and the playful tilt | `gallery` |

The count line is computed from how many pending slots the gallery holds, so it can never disagree with the slots. Flip `consent` in the DOM and the slot moves between frame and photograph on its own.

## The dialog

A shown photograph opens in the browser's native `<dialog>`: `showModal()`, the photograph large, its caption as the dialog's name, and a Close button. Escape closes it, the Close button closes it, and focus returns to the opener. One dialog per gallery, built on first open.

## Registers

| | Look |
|---|---|
| quiet | hairline frames with small ruled photo corners, no ornament |
| warm | hand-drawn photo corners: two strokes and a soft elbow per corner, wobbled by the seed so no two frames are stamped the same |
| playful | the same corners, and each slot leans its own seeded half-degree, like photographs laid on a table |

Reduced motion keeps every register still: the lean and the hover lift live behind `prefers-reduced-motion`.

## Accessibility

- A pending slot is drawn (`aria-hidden` SVG) and its words are real text: the caption and the count. The drawing is never the meaning.
- A shown photograph is a real `<button>` with the image (and its alt) inside: it takes Tab, shows a focus ring, opens with Enter or Space.
- The dialog is native: focus is trapped while open, Escape closes, focus returns to the opener.
- The count line reads "2 photos, coming soon", never a bare number.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets with author's part | A pending slot's frame is an `aria-hidden` drawing and its caption and count are real text: `packages/components/gallery/gallery.check.mjs`, "<register>: every pending slot shows its frame and its count, and never an image or a control", "the frames are drawn in code ... aria-hidden", "pending slots keep their captions as real text". A shown photograph is a button holding the author's image, so its `alt` is the author's. |
| 1.3.1 Info and relationships | Meets | Each slot is a `<figure>` with a `<figcaption>`; a shown photograph is a native `<button>` around its image, and the viewer is a native `<dialog>` named by the caption. `gallery.check.mjs`: "<register>: Enter opens the native <dialog> with the photograph and its caption", and the page without JavaScript shows each photograph from its own `src` and each pending slot with its written caption. |
| 1.4.1 Use of color | Meets | A slot whose permission has not come is told by its words ("2 photos, coming soon") and has no button, never by colour alone: `gallery.check.mjs`, "the count line reads \"n photos, coming soon\"", "a consent-pending slot never opens: it holds no button and nothing focusable". |
| 1.4.3 Contrast (minimum) | Meets | `gallery.check.mjs`: "axe, <theme>, all three registers: 0 violations" in light and dark, "axe, dark, <register> on its own ... 0 violations", and "axe without JavaScript: 0 violations". With the viewer open, axe finds 0 violations in all three registers, light and dark (axe-core 4.13.0 run on that state, 2026-10-07); it leaves the caption's and the Close button's colour contrast for hand review (the dialog overlaps the page), and they read 7.1:1 and 13.6:1 in light, 8.0:1 and 12.7:1 in dark (painted colours). The words are `--sg-text` roles, 4.5:1 or more in every palette and theme (`packages/tokens/tokens.test.js`). |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and nothing clipped (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | `gallery.check.mjs`: "at 390 px the demo does not scroll sideways" and "at 390 px the grid is a single column". Manual test, 2026-10-07: demo at 320 CSS px, three registers, no sideways scroll (document width 320), and with the viewer open the dialog is 320 px wide and the page still 320. |
| 1.4.11 Non-text contrast | Meets | The corner marks of a pending frame are decoration beside its words. The focus ring is tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`, and `gallery.check.mjs` requires a ring on a focused photograph. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 1.4.13 Content on hover or focus | Not applicable | Nothing appears on hover or focus. The viewer opens on a press (Enter, Space or a click) and closes with Escape or its Close button. |
| 2.1.1 Keyboard | Meets | `gallery.check.mjs`: "<register>: Tab reaches a photograph ... and it shows a focus ring", "Enter opens the native <dialog>"; the thumbnails and Close are native buttons. |
| 2.1.2 No keyboard trap | Meets | The viewer is a modal `<dialog>`: focus stays inside it as the platform does, and Escape or Close leaves it. `gallery.check.mjs`: "Escape closes the dialog and focus returns to the opener". |
| 2.4.3 Focus order | Meets | The thumbnails follow the page's order; on opening, focus goes to Close (manual test, 2026-10-07: `document.activeElement` is `button.sg-gallery-close` after the click at 390 and 320 px, three registers) and returns to the opener on close (`gallery.check.mjs`, "Escape closes the dialog and focus returns to the opener"). |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the photographs in each register and requires a focus style; `gallery.check.mjs`: "Tab reaches a photograph ... and it shows a focus ring". |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test, 2026-10-07: `packages/components/gallery/gallery.css` uses no `position: fixed` or `sticky`, and the open viewer is a top-layer modal dialog, so nothing of the page's is above it. A sticky header or banner the page adds can cover a thumbnail that is scrolled to. |
| 2.5.3 Label in name | Meets | A shown photograph's name is "<alt>, open larger" (`packages/components/gallery/gallery.js`), which contains the image's `alt`, its only visible content; Close is named by its visible word. |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07, 390 px touch: each photograph button is 342.0 by 214.5 px (343.7 by 217.3 px in playful) and the viewer's Close button is 70.0 by 40.0 px, in all three registers. No check in the repository asserts target size for the gallery yet. |
| 4.1.2 Name, role, value | Meets | A photograph is a `<button>` with `aria-haspopup="dialog"` and a name; the viewer is a `<dialog>` named "<caption>, a photograph". `gallery.check.mjs`: axe in each register and theme, 0 violations. |

**The page author owns:**

- The `alt` of every shown photograph, the captions, and the count line, in the language of the page, and `lang` on text in another language (3.1.2).
- Permission to show each photograph: a slot stays a frame until the author marks it granted.
- The component's own words come from the shared strings table (`packages/core/strings.table.js`, decision 0025) in the page's `lang`: `close`, `openLarger` ("<alt>, open larger") and `aPhotograph` ("<caption>, a photograph"). `close` is in Konkani already; the other two are English until a Konkani entry is written and read by a native speaker, and the Close button says so with `lang="en"` when it falls back. The two names also hold your own words, so they carry no `lang` (3.1.2).
- Sticky headers and banners that could cover a thumbnail when it takes focus (2.4.11).
- The colours the page sets behind the gallery, if it overrides the tokens.

## Without JavaScript

The author's markup renders as written: granted photographs show, pending slots show their caption (and your own count line if you write one). The grid falls back to three columns; write `--sg-gallery-cols` yourself if you want another.

## The consent line

The count line is the piece's heart, and it is worded kindly: "2 photos, coming soon". The idea behind every pending frame is: their permission hasn't come yet, so these stay as frames.

## Arriving and pressing

- Photographs and frames arrive once, on the tala: each one lands on its own beat of the sixteen-beat teental cycle (130 ms a beat, nothing on the three silent beats). Only the first five wait for a beat; the rest take the fifth's beat, so the list cascades top to bottom and the longest wait is 520 ms however long it is, and the cards are in the accessibility tree from the start (the fade is visual only). The stagger is CSS, with `sibling-index()`; where a browser lacks it, `core/arrive.js` hands each one the same delay. Warm eases in; playful settles on the spring. Quiet gets no stagger, and nothing moves under reduced motion.
- Only arrivals play. A new one that is added later starts again from the first beat, and a sort or a move the reader asked for never replays anything (`data-seen` marks what has arrived).
- A press answers within a frame: no transition on the way in, and it eases back in under 150 ms. Quiet settles 1 px, warm shades the colour toward the ink, playful gives a little (scale 0.97) and lets go on the spring. Reduced motion keeps the colour and drops the movement; a held key does not move anything. A thumbnail dims under the press instead of shading.
