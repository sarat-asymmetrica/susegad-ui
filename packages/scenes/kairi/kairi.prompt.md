# Kairi

*Hindi and Marathi: a raw mango, and the paisley named after it.*

Every closed line can be drawn by a chain of circles, each turning at its own whole-number speed, laid end to end. Here the chain grows one circle at a time until its sketch sharpens into a paisley, then a pen at the end of the chain inks it. An echo line follows inside, then colour and dots, like a painted border. Set progress from real work and the border is drawn exactly that far; in playful, bring the pointer near the machine to slow it down and see the circles.

```html
<script type="module" src="susegad/scenes/kairi/index.js"></script>

<!-- real progress: the border is drawn exactly as far as the work -->
<sg-scene name="kairi" progress="0.4" label="Order progress">
  <h2>Your order is being printed</h2>
  <p>Each paisley is one step.</p>
</sg-scene>

<!-- playful: bring the pointer near the machine to slow it; Enter goes on to the next paisley -->
<sg-scene name="kairi" register="playful"></sg-scene>
```

| Param | Values | Default | What it does |
|---|---|---|---|
| `progress` | 0 to 1 | absent | Absent, time draws the border. Set from real work, the border is drawn exactly that far (0 bare, 1 all five paisleys finished), time stands still, and the status says "40% done" after the label. |
| `seed` | number or string | 1 | Another border: the paisleys' plumpness, curl and tilt, their colours and how many circles draw each. |

## The prompt

Draw a hand-painted paisley border on cream paper in canvas JavaScript, with no image files, and let a machine of spinning circles draw it. Design each paisley from a few control points: a round belly, a tapering body and a tip that curls over, smoothed with closed Catmull-Rom curves, with small seeded differences between them. Resample each outline to 256 evenly spaced points and take its discrete Fourier transform in a pure function. Sort the terms by size and chain them as epicycles, each circle turning at its own speed on the rim of the one before. First add the circles one at a time and show a faint pencil sketch of the outline they make, so the drawing sharpens as circles are added, then let the pen at the end of the chain ink the paisley. Trace a smaller echo line inside, then fill it like a printed border with madder, indigo and turmeric washes, a row of dots and a small flower. Draw the circles delicately in pencil and add a handwritten note with the number of circles. Hovering near the machine should slow it and show the circles more strongly. Give it a progress attribute: when it is set, the border is drawn exactly that far and time stands still. Give it three registers: quiet is the finished border, warm draws it once and rests, and playful draws border after border and answers the pointer and the keys.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| take its discrete Fourier transform in a pure function | fields | The outline becomes 256 complex numbers, and the transform turns them into 256 circles, each with a size, a starting angle and a whole-number speed. A pure function does this, so it can be tested without a canvas. |
| chain them as epicycles | pattern | Each circle sits on the rim of the one before it and turns at its own speed. Add up every turning arm and the tip of the last one lands exactly on the outline. |
| so the drawing sharpens as circles are added | easing | The number of circles eases up from one to the full count (37 to 61, chosen by the seed), and the pencil sketch is redrawn each frame from only those circles: an oval first, then a pear shape, then a paisley with a curling tip. |
| small seeded differences between them | seed | The seed nudges every control point, the plumpness, the curl and the tilt, so no two paisleys in the border are quite alike. It also picks the colours for each one. |
| on cream paper | texture | The paper, the pencil guidelines and the striped edges are painted once into cached layers. Each finished paisley is painted into another layer so it is never drawn twice. On a dark page the same cloth is lit by a lamp. |
| Hovering near the machine should slow it | interaction | In playful the machine keeps the scene’s clock; near the pointer, or the keyboard hand, the clock runs at about a third of the speed and the pencil circles darken, so you can follow a single arm. Enter goes on to the next paisley. |
| the border is drawn exactly that far | state | Progress maps onto the machine’s clock, from the bare border at 0 to the fifth paisley finished at 1, so only the number moves it. The status says it in words, such as "40% done". |

## Accessibility

The drawing's name is its `alt`, or the page's `label`. With `progress` set, the status says the label and the number in words ("Order progress: 40% done"), at most once a second, so the drawing is never the only place the progress is. Under reduced motion every register shows the finished border as a still. In playful the drawing takes focus: the arrow keys move a hand, and near the machine the hand slows it down as the pointer does; Enter or Space goes on to the next paisley, and once the border is finished, starts a new one. The machine and its note hush under the page's words.

## Credit

The paisley (kairi, the raw mango shape; boteh) is shared across India and far beyond, printed, woven and embroidered. The madder, indigo and turmeric are the dyes of hand block printing. This border is our own, drawn from a few control points; it copies no particular textile.
