# Tollem

*Konkani: a pond or tank; here, the pool at noon.*

Looking straight down into a Goan pool at noon. The sun throws a moving net of light over pale tiles, a frangipani leans over one corner, and now and then it lets go of a flower that lands with a ring and drifts until the current carries it away.

```html
<script type="module" src="susegad/scenes/tollem/index.js"></script>

<sg-scene name="tollem" register="warm">
  <h2>Swim before lunch</h2>
  <p>The pool is open from seven. Towels are by the steps.</p>
</sg-scene>

<!-- as state: one flower sits 40% of the way across, and "Booking progress: 40% done" is read out -->
<sg-scene name="tollem" progress="0.4" label="Booking progress"></sg-scene>

<!-- playful: touch the water, or use the arrow keys and Enter -->
<sg-scene name="tollem" register="playful" swell="0.7"></sg-scene>
```

| Attribute | Values | What it does |
|---|---|---|
| `swell` | 0 to 1, default 0.5 | How much the surface moves. 0.5 is the sketchbook plate; 0 is a still pool with only the net of light. |
| `flowers` | `true`, `false` | Whether the tree drops flowers. Warm drops one every 15 to 24 seconds, playful every 7 to 11, quiet none. |
| `palette` | `seed`, `aqua`, `sky`, `celadon` | Tile and flower colours. `seed` lets the seed choose. |
| `touch` | `true`, `false` | Ripples from the pointer and the keyboard, in the playful register. |
| `progress` | 0 to 1, or absent | Absent: time drops and drifts the flowers. Set: one flower sits that far along an arc across the pool, time never moves it, a small ring answers each change, and the percentage is read out as text. |
| `renderer` | `auto`, `webgl`, `2d` | `auto` uses the shader and paints in 2D when WebGL is missing, its context is lost, or frames stay very slow. `2d` always paints on the canvas. `webgl` keeps the shader even when frames are slow. |
| `seed` | any number or word | Same seed, same pool, same flowers. |

**Registers.** Quiet is a still of the tiles under a soft, slow net of light, with no flower and no loop. Warm has a slow swell and an occasional flower. Playful answers touch: a press drops a firm ring, a moving pointer trails soft ones, and the arrow keys move a small inked ring that Enter or Space drops into the water. With reduced motion every register shows the finished still: the first flower down, its ring a second old.

**Text on the water.** Slotted text reports its boxes. Near them the swell and the rings drop away, the net of light flattens into an even glow, and flowers steer round the words.

## The prompt

Look straight down into a Goan pool at noon, painted by a WebGL fragment shader with no image files. Lay a floor of pale blue-green tiles with white grout, and draw the grout as slightly wavering ink. Compute the bright net of caustics from an iterated sine pattern, warp it gently so it never repeats across the pool, sample it three times with small offsets so its edges split softly into colour, and quantise the light a little so it reads as painted rather than photographed. Let a gentle swell bend the tiles and the light, as if seen through a moving surface. Put the soft shadow of a frangipani in one corner and let it drop a champa flower now and then; it falls, lands with a ring and drifts until the current carries it out of view. When the viewer touches the water, or moves a ring with the arrow keys and presses Enter, keep the last ten touches as uniforms and add expanding, damped ripples to the surface slope, so the tiles and caustics bend around them and the flowers are nudged away when a ring reaches them. Where text sits over the water, flatten the swell and the light so the words rest on quiet water, and steer the flowers round them. Give it three registers. Quiet: a still of the tiles under a soft net of light, with no flower and no motion. Warm: a slow swell and a flower every 15 to 24 seconds. Playful: a livelier swell, a flower every 7 to 11 seconds, and water that answers touch and the keys. Add a progress attribute from 0 to 1: when it is set, one flower sits that far along an arc across the pool, time never moves it, a small ring answers each change, and the percentage is said in text for screen readers. With reduced motion, show the finished still: the first flower down, its ring a second old. Keep the pool itself pure: a function of time, seed and touches that returns plain numbers and runs in Node. Ink laterite coping along the top edge, lay paper grain over everything, and paint the whole pool on a canvas when WebGL is missing, its context is lost, or frames stay too slow.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| the bright net of caustics from an iterated sine pattern | shader | Every pixel runs the same small program on the graphics card. It folds its position through five rounds of sines and cosines, and where the folds bunch up the light gets bright. That is the net. |
| warp it gently so it never repeats | noise | The folding repeats every 390 units. Four slow sine waves at mismatched frequencies push each pixel’s lookup around by up to 70 units, so the repeat never lines up where the eye can catch it. |
| sample it three times with small offsets | colour | Red, green and blue each read the net from a slightly different spot, so the bright lines get soft warm and cool fringes, like sunlight split by real water. |
| keep the last ten touches as uniforms | interaction | Each touch stores where and when it happened. The shader turns that into a ring that travels outward at 150 units a second and fades with age, and uses the ring’s slope to shift where each pixel looks at the floor. |
| falls, lands with a ring and drifts | easing | The fall is closed-form: an eased drop from the tree with a sway and a spin. On landing the flower makes its own ring, then a slow noise current carries it. After a while, or when a third flower settles, the current takes the oldest off the nearest open edge. |
| flatten the swell and the light | calm | The page reports where its text sits. The shader measures each pixel’s distance to those boxes and, close to them, turns down the waves and rings and blends the net into an even glow. The flowers feel a gentle push away from the same boxes. |
| one flower sits that far along an arc across the pool | state | With progress set, the flower’s place comes from the number alone, and time never moves it. Each change sends out one small ring, so a real step is visible, and the same number is read out as text. |
| a function of time, seed and touches | model | The flowers step forward in fixed sixtieths of a second from the start, memoised so a playing scene only pays for new steps. The part of a step past the last boundary is extrapolated and never stored, so the same seed and the same touches always give the same pool, whatever order frames arrive in. |
| lay paper grain over everything | texture | The shader adds a fixed speckle and soft blotching per pixel, and the coping is inked on a canvas above, so the GPU picture sits on the same paper as the rest of the book. |
| paint the whole pool on a canvas | fallback | The floor, grout and shade are inked once and cached. The net is computed on the CPU at 120 by 80 pixels a dozen times a second and stretched over the water; rings are drawn as circles of light. When the context comes back, or the page asks for webgl, the shader returns on a fresh canvas. |
| frames stay too slow | governor | The element’s governor lowers the water’s resolution when frames run long, down to 30%. If frames still take over 90 ms at the floor, or over 180 ms at any level, for four seconds, the water switches to the 2D painting. |

## Accessibility

- The drawing is an image with the label "Looking down into a pool at noon: pale tiles under a moving net of light, a laterite edge, and a frangipani flower afloat.", or the `label` attribute.
- With `progress` set, a status region names the work and the amount: "Booking progress: 40% done" with `label="Booking progress"`, or "The pool at noon: 40% done" without one. It speaks only when the number changes, at most once a second.
- In playful the drawing takes focus. The arrow keys move a small ring over the water; Enter or Space drops a ripple there.
- In warm and playful a pause button sits in the corner whenever the water can move (WCAG 2.2.2). Reduced motion shows the finished still, and the same button plays it on request.

## Credit

Drawn from Goan pools with their laterite coping, and the frangipani (champa) that leans over so many of them.
