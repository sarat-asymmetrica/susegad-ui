# Bloom

*A flower head that can say how many, and a different one for everybody.*

A marigold seen face-on, drawn as SVG, in which each floret sits a golden angle round from the one before. Because of that one rule, a count can be drawn as exactly that many florets, a head can grow one floret at a time with nothing jumping, and every name can have its own flower.

```html
<link rel="stylesheet" href="susegad/components/bloom/bloom.css">
<script type="module" src="susegad/components/bloom/bloom.js"></script>

<sg-bloom count="37" label="people registered"></sg-bloom>
<sg-bloom seed-from="Maria Fernandes" label="Maria's bloom" size="lg"></sg-bloom>
```

| Attribute | Values | What it does |
|---|---|---|
| `count` | 0 or more | The florets to draw (400 at most) and the number written beside the flower. Absent: a full head of 144, no number. |
| `seed`, `seed-from` | any text | Which flower. The same text always gives the same one. |
| `label` | text | What the bloom stands for: an image name, or the words after the number. |
| `size` | pixels, `sm`, `md`, `lg`, a CSS length | How big. |
| `kind` | `zendu` | The flower. More kinds later. |

## The prompt

Make a web component for a flower head that draws a number as that many florets and gives every name its own flower. Lay the florets out by Vogel's model: floret number i at angle i times the golden angle, 137.50776 degrees and not the rounded 137.5 that leaves faint spokes, and at radius the square root of i times a scale, so the head is evenly dense with no grid and no overlap, and adding one floret never moves the ones already placed. Draw the first kind, a marigold seen face-on, as SVG: a ruffled petal with a narrow claw opening into a fan with a row of rounded frills, one for each floret, turned to point outward, in rings darker and redder at the rim and lighter and yellower at the heart, each laid over a slightly larger dark copy so the head looks crumpled, with the first few petals leaning in to close the heart. Use two palettes, orange and saffron, and let the seed pick one, turn the whole head a little, nudge each floret by a few percent and tilt each petal. Paint the rim first and the heart last, so the heart is on top. Light the whole head from the upper left with one soft overlay that does not turn with the flower. Give it three registers. Quiet: florets as plain dots in the text colour, still. Warm: the marigold, still. Playful: the florets grow from the centre outward, each scaling up from its own base with a little overshoot, in CSS, with each floret's delay its rank from the heart times a step chosen so the last floret starts by 1.1 seconds for any count; use sibling-index() where the browser has it, and a custom property the element writes on each floret where it does not. A touch or click gives the outer ring a small shiver, a few degrees about each petal's base, under 300 ms; it is a flourish that does nothing else, so the bloom takes no focus and no role. When the count changes by one, add or remove only the outermost floret and animate only that one. Reduced motion and Save-Data show the finished head with no growth. Cap the head at 400 florets. Never leave the number only in the picture: when `count` is set, write the number (and the label) as text beside the flower and hide the picture from assistive technology; when there is a label and no count, give the picture the role img and that name; with neither, hide it as decoration. Put no inline style attributes in the markup, so it works under a strict Content-Security-Policy.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| each floret a golden angle round | `vogel(n, { scale, offset, jitter, seed })` in `engine/src/phyllotaxis.js` | Point i at `i * GOLDEN` and `scale * sqrt(i)`. `GOLDEN` is `PI * (3 - sqrt(5))`, exact. The tests pin it, the equal-area property (the count inside radius ρ grows as ρ²), stability (the first k points of `vogel(n)` are `vogel(k)`) and a floor on how near two points may be. |
| adding one never moves the others | stability | The count changes by adding or removing the outermost floret. One scale serves every head up to 144 florets, so a head of 37 is a smaller head, not a bigger floret. |
| the seed picks one, turns it, nudges each floret | `variation(seed)`, `rng`, `hashSeed` | A seeded turn of the whole head, a jitter within a cap (a fifth of a floret's spacing, so none overlap), and the palette. Never a different angle: an angle off golden gives spokes. |
| ruffled petal, narrow claw, fan, frills | `petalPath(frill, spread)` | toran's `petalShape` as an SVG path of unit length, scaled by each floret. Three to five frills and three spreads, so a head reuses nine paths. |
| darker and redder at the rim, lighter at the heart | `plan()`, gradients | Each petal takes its tone from its depth and a little chance, quantised to a few dozen buckets that share linear gradients, base to tip. |
| laid over a slightly larger dark copy | crevice path | A second path under each petal, swollen 8% and shifted, in the family's dark rim colour at 55%. |
| paint the rim first, the heart on top | painter's order | The DOM runs from the highest floret to the lowest. |
| lit from the upper left | the light overlay | One radial gradient circle, offset focus, that does not turn with the flower. |
| the florets grow from the centre outward | CSS | `animation-delay: calc(var(--sg-bloom-n) * var(--sg-bloom-step))`. `--sg-bloom-n` is `sibling-count() - sibling-index()` where supported, else the `--i` the element wrote. The element sets the step so the last floret starts by 1.1 s. |
| only the new floret grows | `data-new`, `data-solo` | A floret is marked new while it grows and unmarked when it ends, so changing the count never replays the rest. |
| a small shiver | `data-shiver`, `data-ring` | The outer 30% of florets rotate a few degrees about their bases, staggered by up to 25 ms, each for 280 ms. |
| never only in the picture | `describe()` | One pure function decides text, role and name from the count, the label and whether the author wrote words. |
| a strict Content-Security-Policy | presentation attributes | Colours and shapes are SVG attributes; the few custom properties go in through the CSSOM. |

## Do not

- Do not set the zendu beside deity imagery or frame it as a puja element. It is a flower.
- Do not draw a count above 400 as florets. Say the number.
- Do not round the golden angle. 137.5 degrees leaves faint spokes.
