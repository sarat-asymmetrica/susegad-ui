# Gallery

*A grid of photographs for a homestay, a workshop, a studio: consent first. Written for the POAI brief's rule that every place a photograph goes is designed for the consent that hasn't arrived yet.*

The author writes the slots; the element never invents a photograph. A slot whose person has said yes shows the image and opens it larger in the browser's own dialog. A slot whose person has not said yes is a drawn frame with photo corners, its caption, and the count, and no image is ever fetched or shown for it.

```html
<link rel="stylesheet" href="susegad/components/gallery/gallery.css">
<script type="module" src="susegad/components/gallery/gallery.js"></script>

<sg-gallery register="warm" seed="sannas">
  <figure class="sg-gallery-slot" consent="granted">
    <img src="/posters/scene-chai.warm.light.jpg" alt="Rain clouds over the courtyard" width="760" height="475" loading="lazy">
    <figcaption>Rain clouds over the courtyard, October</figcaption>
  </figure>
  <figure class="sg-gallery-slot" consent="pending">
    <figcaption>Guests at the long table, faces turned to the sea</figcaption>
  </figure>
</sg-gallery>
```

## The prompt

Make a photograph gallery web component around figures the author writes: each slot is a `figure.sg-gallery-slot` carrying a `consent` attribute that says what may show. `consent="pending"` shows a drawn frame with photo corners (an SVG, aria-hidden, the corners drawn in code with a seeded hand so no two frames are stamped the same), the slot's caption, and the count line "2 photos, coming soon" (one photo, one photo's form), computed from how many pending slots the gallery holds; the image never shows, even if the author left an `<img>` in the slot, and the pending slot is not a control: nothing in it takes focus or opens anything. `consent="granted"` or no consent attribute at all shows the image, because the element never guesses and a missing attribute is the author's decision; a shown photograph becomes a real button that opens the native `<dialog>` with `showModal()`, the photograph large, its caption, and a Close button; Escape closes it and focus returns to the opener. Lay the slots in a grid whose column count comes from the gallery's own width and slot count (1 column at phone width, up to 4 at desk). Give it three registers. Quiet: hairline frames, small ruled photo corners, no ornament. Warm: hand-drawn photo corners, two strokes with a soft elbow, wobbled by the seed so each frame is a little different. Playful: the same corners, and each slot leans its own seeded half-degree like a photograph laid on a table. Under reduced motion nothing moves or leans. Without JavaScript the author's markup reads fine: photographs show, pending slots show whatever was written beside their frame.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| consent first | `consentOf(raw)` | Only the written word "pending" hides a photograph, any lettering, with or without spaces. "granted" and a missing attribute are the author's decision and show the image. Any other value ("yes", "later", "asked") also shows the image: the element never guesses. |
| the count line | `pendingLine(n)` | "1 photo, coming soon", "2 photos, coming soon"; one per pending slot, computed from the gallery's pending slots; the element rewrites it so it can never disagree with the markup. |
| drawn frame with photo corners | `photoCorner({ w, h, corner, seed })` | Two strokes out of each corner with a soft elbow between them, wobbled a little by a seeded hash (`hash(seed)`), drawn into an `aria-hidden` SVG the element places in each pending slot. The screen reader reads the caption and the count, not the drawing. |
| the element never guesses | `#frame(slot)` | A pending slot's `<img>` is removed (never fetched after the element runs) and its dialog button never exists; the slot is not focusable. |
| the native dialog | `<dialog>` | One dialog per gallery, built on first open: `showModal()`, the photograph, its caption as the dialog's name, a Close button. Escape and the Close button both close it; the platform returns focus to the opener. |
| 1 column at phone width, up to 4 at desk | `columnsFor(width, count)` | The gallery's own width picks the width's column count, then the slot count caps it, so two photographs never sit under four empty columns. Told to the CSS as `--sg-gallery-cols` from a ResizeObserver. |
| each frame a little different | seeds | `hash(seed)` is deterministic, so the warm corners and the playful tilt are reproducible: the same seed draws the same gallery every time. |
| a seeded half-degree | `tilt(seed)` | 0.2 to 0.55 degrees, signed, per slot, set once as `--sg-gallery-tilt` by the playful skin. |
| under reduced motion nothing moves | motion | The tilt and the hover lift live behind `prefers-reduced-motion: no-preference` and the element's own motion state; reduced motion keeps every register still. |
| without JavaScript the markup reads fine | honesty | No script, no dialog, no count line the element wrote: what the author wrote is what shows, photographs and all. |

## Registers

| | Look |
|---|---|
| quiet | hairline frames with small ruled photo corners; nothing else |
| warm | hand-drawn photo corners, two strokes and a soft elbow, wobbled by the seed |
| playful | the same corners, and each slot leans its own seeded half-degree, like photos on a table |

Reduced motion keeps every register still.

## Degradation

No JavaScript: the author's slots render as written; granted photographs show, pending slots show their written caption (write the count in yourself if you want it without JS). No photographs at all: an all-pending gallery is frames, captions and counts, which is the point.

## Invariants

- Only `consent="pending"` hides a photograph. The element never guesses.
- A pending slot never shows an image, never takes focus, never opens anything.
- The frame is an aria-hidden drawing; the caption and the count are real text.
- The dialog is the native `<dialog>`; Escape closes; focus returns.
- No em dashes in anything a person reads.

## Budget

12 KB behaviour plus 8 KB per skin (decision 0005); the pure core is budgeted apart (decision 0010).
