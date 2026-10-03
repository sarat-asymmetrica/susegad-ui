# Tile band

*A hand-painted border or section divider: for a restaurant's menu, a homestay's page, a shop's footer, an event page that wants to feel like Goa and not like a template.*

Goan azulejo (the blue-and-white painted tiles of the Portuguese-era houses and churches) with its majolica cousin (cobalt, lemon yellow and leaf green). Geometric and floral only.

```html
<link rel="stylesheet" href="susegad/components/tile-band/tile-band.css">
<script type="module" src="susegad/components/tile-band/tile-band.js"></script>

<sg-tile-band></sg-tile-band>                              <!-- decoration -->
<sg-tile-band tones="majolica" seed="church"><hr></sg-tile-band>  <!-- a divider: the hr is the separator -->
<sg-tile-band orientation="vertical" style="height: 20rem"></sg-tile-band>
```

## The prompt

Make a band of hand-painted tiles as a web component, for a border or a divider, in the tradition of Goan azulejo. Lay square tiles along the band, as many as fit whole (a wanted tile size from a CSS custom property, stretched a little so none is cut), either across the page or down it, and make the band as thick as one tile. Make a small family of tile motifs, geometric and floral only and never a figure or a religious symbol: a rosette of petals with quarter-circle fans in the corners, a quatrefoil of four lobes with a diamond in the middle, quarter-circle corners in concentric rings, and a vine that runs from the middle of one edge to the middle of the opposite edge so neighbouring vines join. Lay them from a seed: two motifs alternate, an accent tile of another turns up every six to nine, no two neighbours alike, and each tile is a little off, as a hand makes it. Offer two sets of pigments: blue and white, and majolica with lemon yellow and leaf green. Paint once on a canvas at the device pixel ratio and keep it; never run a frame loop. Give it three registers. Quiet: a cobalt hairline on the page, flat, line art only, no fills, following the theme. Warm: a hand-painted glaze that keeps its own colours by day and night: white glazed tiles, cobalt brushwork with a bleed of pigment under each stroke, glaze pooled at the edges, a sheen, a bevel and a fine crackle. Playful: the same, and when a pointer passes over a tile or a finger taps it, that tile turns a quarter-turn, swings a little past and settles, over about half a second, with a frame loop only for that half second. Under reduced motion nothing turns. With an hr inside it is a divider and says so; without one it is hidden from assistive technology.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| as many as fit whole, square | `fitTiles(length, wanted)` | `count = round(length / wanted)`, `size = length / count`; the element sets `--sg-tile-fit` so the band's thickness is exactly one tile. |
| a small family of motifs | pure core | `motif(name)` returns layers: path strings in a 100 by 100 tile, each a fill or a stroke with a pigment role (ink, blue, wash, lemon, leaf, ground). The four names are the whole family. |
| a vine that joins its neighbours | geometry | The stem runs from (0, 50) to (100, 50); a vine only turns by half-turns. |
| lay them from a seed | `layBand(seed, count)` | Two motifs alternate; an accent every 6 to 9; no neighbours alike; a longer band keeps the start of a shorter one. |
| a little off, as a hand makes it | per-tile numbers | Misregistration of up to 1.2 units and 1.1 degrees, a brush weight 0.88 to 1.14, a pooling and a tint, each tile's own crackle seed. |
| blue and white, and majolica | `pigmentOf(role, tones)` | A blue-and-white tile paints lemon as the pale wash and leaf as cobalt; majolica keeps them. |
| a bleed of pigment under each stroke | painter | Each path is stroked wide at 16 to 18 percent before it is filled and outlined. |
| crackle | `crackle(seed)` | A few fine wandering cracks from the edges that sometimes fork, drawn dark with a pale line beside. |
| paint once and keep it | one paint | A ResizeObserver repaints only when the length, wanted size, pixel ratio, look, tones, seed or direction changes; there is no loop. |
| down the page | orientation | Every motif is turned one more quarter, so vines climb. |
| a tile turns a quarter and settles | `turnAngle(p)` | An ease-out-back: it swings about 12 percent past 90 degrees and lands on exactly 90, while the art shrinks a little (`lift`) so its corners stay in the cell. |

## Accessibility

- Decoration is `aria-hidden`. With an `<hr>` inside it is the separator, and without JavaScript it is a cobalt hairline.
- Nothing carries meaning; turning a tile is a flourish for pointer and touch only, not offered to the keyboard because there is nothing to operate.
- Reduced motion: no tile turns. High-contrast mode shows the `<hr>` as a plain line instead of the canvas.
