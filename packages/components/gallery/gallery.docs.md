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

## Without JavaScript

The author's markup renders as written: granted photographs show, pending slots show their caption (and your own count line if you write one). The grid falls back to three columns; write `--sg-gallery-cols` yourself if you want another.

## The consent line

The count line is the piece's heart, and it is worded kindly: "2 photos, coming soon". The idea behind every pending frame is: their permission hasn't come yet, so these stay as frames.
