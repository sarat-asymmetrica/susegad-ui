# Doodle

`<sg-doodle>` is a single-line food drawing, as if done with a marker, in `currentColor`. It is inline SVG, so it takes the colour of the text around it and costs no requests. A motif is one or two unfilled strokes. A band is a seeded row of motifs laid edge to edge, for a section divider.

## Markup

```html
<link rel="stylesheet" href="susegad/components/doodle/doodle.css">
<script type="module" src="susegad/components/doodle/doodle.js"></script>

<sg-doodle motif="lemon"></sg-doodle>                                   <!-- decoration: aria-hidden -->
<sg-doodle motif="fork-twirl" label="A fork twirling spaghetti"></sg-doodle>  <!-- an image with a name -->
<sg-doodle band seed="kitchen"></sg-doodle>                             <!-- a divider, from every motif -->
<sg-doodle band seed="supper" motifs="lemon basil tomato"></sg-doodle>  <!-- from a few -->
```

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `motif` | `fork-twirl`, `ravioli`, `gnocchi`, `lemon`, `tomato`, `basil`, `whisk`, `rolling-pin`, `wheat`, `steam` | none |
| `band` | present: a row of motifs instead of one | absent |
| `seed` | any text or number: the same seed lays the same row | `doodle` |
| `motifs` | names to draw a band from | all ten |
| `label` | a name: makes the doodle `role="img"` | none (decoration) |
| `register` | `quiet`, `warm`, `playful` | inherited |

`--sg-doodle-size` is the doodle (a square) or the cell you would like in a band (default 4rem, 3.25rem for a band on a phone). A band fits whole cells to its width and takes their height. `--sg-doodle-weight` is the pen in drawing units (a motif is 100 wide). Colour is `currentColor`: set `color` on the doodle or an ancestor.

Event: `sg-doodle-drawn`, once, when a warm or playful doodle has finished drawing itself.

## Registers

| | |
|---|---|
| quiet | a still hairline drawing |
| warm | draws itself once as it scrolls into view (stroke reveal, one stroke after another), then boils a little: about five times a second the line takes the next frame of a slight wobble |
| playful | warm with a bolder pen, and a wiggle when the pointer passes over a doodle or a finger taps it |
| reduced motion | the finished drawing at once; nothing draws, boils or wiggles |

A doodle below the fold stays undrawn until it scrolls into view, and draws once. On paper it is always whole.

## The motifs

Each motif is one or two strokes of absolute `M`, `L`, `C` and `Q` path data in a 100 by 100 box (`doodle.motifs.js`). Several retrace themselves (a vein out and back, a steam line up and down) so one continuous line can draw them. A kitchen adds a motif by adding an entry: the tests hold it to one or two strokes, no fills, and inside the box.

## Content-Security-Policy

Nothing a doodle builds uses a `<style>` element or a `style` attribute. Attributes carry the drawing, the stylesheet carries the pen, and the band's cell count is set through the CSSOM. It runs under `style-src 'self'; script-src 'self'` (the check proves it, and proves the policy is enforced on the same page).

## Accessibility

- Decoration is `aria-hidden`; with a `label` the element is one image with that name and the SVG inside stays hidden, so it is read once.
- Nothing is in the tab order: there is nothing to operate.
- Reduced motion shows the finished drawing. The boil timer stops when the tab is hidden and while no doodle is on screen.
- High-contrast mode draws in `CanvasText`.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets with author's part | `packages/components/doodle/doodle.check.mjs`: "a doodle with no label is aria-hidden and has no role or name", "label: role=img with that name, not aria-hidden", and "the SVG inside is always aria-hidden, so the name is read once". A doodle with a `label` is an image with that name; whether to give it one is the author's call. |
| 1.3.1 Info and relationships | Meets | A decoration is hidden and a labelled doodle is `role="img"` with its name, nothing else (`doodle.check.mjs`, same checks, and `packages/components/doodle/doodle.js`, `#name`). A doodle has no structure to convey. |
| 1.4.1 Use of color | Not applicable | A doodle carries no meaning in colour. It is a one-colour line drawing in `currentColor` (`doodle.check.mjs`: "every stroke is unfilled and drawn in currentColor"). |
| 1.4.3 Contrast (minimum) | Not applicable | A doodle has no text. Its line contrast is answered under 1.4.11. `doodle.check.mjs`: "axe, light, all three registers: 0 violations", the same in dark and in the haldi palette. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: the demo with the root font size at 200 percent in three registers, no sideways scroll and nothing clipped (throwaway Playwright script). A doodle has no text, and its size is `--sg-doodle-size` in `rem`, so it scales with the root font size. |
| 1.4.10 Reflow | Meets | A band fits whole cells to its width, so it never passes the viewport (`doodle.check.mjs`: "band: whole square cells fill the width edge to edge" and "a narrower page has fewer cells"). Manual test at 320 CSS px, three registers, 2026-10-07: no sideways scroll. |
| 1.4.11 Non-text contrast | Meets with author's part | The line is `currentColor`, so its contrast is that of the page's text colour on its ground, which the tokens test at 4.5:1 or more (`packages/tokens/tokens.test.js`). A decorative doodle needs no contrast; one that carries a `label` is information, and the page must not set a colour with less than 3:1 against its ground. |
| 1.4.12 Text spacing | Not applicable | A doodle has no text. |
| 2.2.2 Pause, stop, hide | Meets with author's part | In warm and playful a doodle draws itself once and, in warm, then boils: a four-frame wobble every 220 ms. The boil stops under `prefers-reduced-motion`, in quiet, while the tab is hidden and while no doodle is on screen (`doodle.check.mjs`: "reduced motion, <register>: everything is drawn at once, no animations, no dash, no boil", "warm: while boiling, the doodles ask for no requestAnimationFrame of their own"). It runs for longer than five seconds with no on-page pause control, so a page that uses warm owns offering the quiet register or a motion switch. |
| 2.3.1 Three flashes or below threshold | Meets | The boil moves the line by at most 0.9 units of a 100-unit box and never changes its colour or brightness (`BOIL_AMOUNT` in `packages/components/doodle/skins/warm.js`; `packages/components/doodle/doodle.test.js`: "the boil keeps every drawn line inside the box too"), so nothing flashes. |
| 4.1.2 Name, role, value | Meets | A labelled doodle is `role="img"` with `aria-label`; a decoration is `aria-hidden`. `doodle.check.mjs`: "label changes follow, and removing it makes the doodle decoration again", and axe with 0 violations in light and dark and with JavaScript off. |

**The page author owns:**

- The `label` of a doodle that means something, in the language of the page, and no label on one that is only decoration.
- The text colour around the doodle, since the line takes it, and a motion switch or the quiet register for the warm boil (2.2.2).
- Where a band sits in the page, so it does not stand in for a heading or a rule that carries meaning.
