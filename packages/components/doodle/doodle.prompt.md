# Doodle

*Spot art and section dividers for anything with a kitchen in it: a pasta maker, a bakery, a café, a kids' cooking class, a recipe page.*

```html
<link rel="stylesheet" href="susegad/components/doodle/doodle.css">
<script type="module" src="susegad/components/doodle/doodle.js"></script>

<sg-doodle motif="lemon"></sg-doodle>
<sg-doodle band seed="kitchen"></sg-doodle>
```

## The prompt

Make single-line food drawings as a web component, as if done with a marker, in currentColor, as inline SVG. Draw ten motifs, each one or two strokes of path data in a 100 by 100 box and never filled: a fork lifting a twirl of spaghetti, a ravioli with a crimped edge, a ridged gnocchi, a lemon with its leaf, a tomato with its calyx, a sprig of basil with veins, a balloon whisk, a rolling pin, an ear of wheat and a hot bowl with steam rising. Draw them loosely, like a cheerful hand-drawn flyer, with curves through a few points, ridges that meet the outline, and a line that leaves and comes back along itself, so one continuous line draws a leaf with its veins. A band attribute lays a seeded row of motifs edge to edge, whole square cells fitted to the width, no motif twice in a row, each cell turned a few degrees and nudged. Decoration is aria-hidden; a label makes it an image with that name. Three registers. Quiet: a still hairline. Warm: it draws itself once as it scrolls into view (stroke-dashoffset reveal, strokes in sequence, bands staggered left to right), then boils a little, the whole line wobbling together at about five frames a second from one shared timer that runs only while one is on screen. Playful: the same with a bolder pen, and a small turn-and-squash wiggle on hover or tap. Under reduced motion, the finished drawing at once. It must work under style-src 'self' and script-src 'self': build the SVG with createElementNS and attributes, style it from a linked stylesheet, set variables through element.style.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| one or two strokes, no fills | `MOTIF_DATA` | Each motif is `strokes: [d, d]`, absolute M, L, C, Q only; the test counts the pen-downs and the paint. |
| loose, like a marker | spline through points | The drawings are authored as curves through a few points, then written out as cubic Béziers. |
| a line that comes back along itself | retrace | A vein goes out and returns along the same curve reversed; it shows as one line. |
| draws itself | `pathLength="1"`, `DASH`, `HIDDEN` | One dash pattern makes `stroke-dashoffset` a reveal at any size; `revealPlan` times each stroke by its length. |
| a gentle boil | `boilPath(d, frame)` | Every number in the path moves by a smooth sine field, a new phase each frame; frame 0 is the drawing. |
| one timer | shared ticker | One 220 ms timeout loop drives every boiling doodle, and stops when none is visible or the tab is hidden. |
| a row edge to edge | `fitCells`, `layBand(seed, count, only)` | Whole cells, seeded, no repeats within three (while the set has four or more); a longer band keeps the start of a shorter one. |
| a wiggle when touched | `wiggleFrames` | A Web Animation on the cell's own group, cancelled when done. |
| strict CSP | attributes and CSSOM | No style element or style attribute in what it builds. |

## Accessibility

- Decoration is `aria-hidden`; a `label` makes one named image, and the SVG inside stays hidden.
- Reduced motion: the finished drawing at once, no boil, no wiggle.
- Print shows the whole drawing even if it never scrolled into view.
