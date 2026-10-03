# Kolam

*Tamil: the rice-flour line drawn at the doorstep every morning and gone by evening. The threshold drawings of Tamil Nadu and South India, with kin forms across India.*

First a grid of dots, then one line that loops around every dot without lifting. The line comes from a trick mathematicians use to study kolam: put tiny mirrors between some dots and bounce a ray diagonally through the grid. Rice flour feeds the ants, so the ants come.

```html
<script type="module" src="susegad/scenes/kolam/index.js"></script>

<sg-scene name="kolam" register="warm" seed="7">
  <h2>The door is open</h2>
  <p>Three rooms above the paddy, a short walk from the river.</p>
</sg-scene>

<!-- as state: an upload 40% done draws the kolam 40% of the way -->
<sg-scene name="kolam" progress="0.4" label="Upload progress"></sg-scene>
```

| Attribute | Values | What it does |
|---|---|---|
| `progress` | 0 to 1, or absent | Absent: time draws the kolam. Set: the line is drawn exactly that far, time stops moving it, and the percentage is read out as text. |
| `grid` | 3 to 9, or absent | Dots across. Rounded up to odd so the design keeps a centre. Absent: the seed picks. |
| `palette` | `auto`, `flour`, `rangoli` | `auto` is white flour in warm and coloured powder on the dots in playful. |
| `seed` | any number or word | Same seed, same kolam. |

## The prompt

Draw a South Indian kolam as a web component, entirely with canvas and no image files. Lay out a diamond or square grid of dots. Generate one unbroken line that loops around every dot using the mirror-curve method: imagine small mirrors between some neighbouring dots and trace a ray that moves diagonally and bounces off them. Choose the mirrors with four-way symmetry from a seed, and keep reshuffling until the whole design is a single closed loop. Smooth the path with Catmull-Rom curves. Render the line as rice flour: sprinkle tiny grains along it with a gaussian spread, and let the density waver like a pinch of flour running low. Give it three registers. Quiet: the finished kolam as a hairline ink drawing on paper, with no motion. Warm: flour on a polished red-oxide floor, drawn once at a human hand’s pace, then a slow wave of light through the dots. Playful: flour on laterite with coloured powder on the dots; moving the pointer pours faster, a click draws it again, and ants come for the flour. Add a progress attribute from 0 to 1: when it is set, draw exactly that far and let time stop moving the line, and say the percentage in text for screen readers. When text sits over the drawing, move the kolam aside so the words have clear floor. With reduced motion, show the finished kolam.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| mirror-curve method … bounces off them | emergence | One local rule (bounce or pass straight through) at every gap produces the whole design. Nobody draws the curve; the rule finds it. |
| keep reshuffling until … a single closed loop | seed | Random choices are cheap to test. The code tries symmetric mirror layouts until one yields a single loop, and a seed makes that search repeatable. |
| sprinkle tiny grains … gaussian spread | particles | The line is never stroked. It is tens of thousands of grains, bunched along the path and thinning at the edges like real flour, written straight into the pixels at device resolution and copied to the canvas as one rectangle. That is about six times faster than drawing each grain as a shape. |
| at a human hand’s pace | easing | Drawing speed follows a gentle wave instead of a constant rate, so the line hurries on straights and slows into turns. The wave is monotonic: the line never goes backwards. |
| polished red-oxide floor … laterite | texture | Each floor is painted once into an offscreen canvas (a gradient, cloudy noise stretched from a tiny image, grain, and for laterite irregular pores and mortar joints) and reused every frame. Once the line is closed, floor and flour are baked into one layer. |
| a slow wave of light through the dots | calm | One glow is drawn at each dot, brightening in a wave from the centre every seven seconds. Near the slotted text it fades to almost nothing. |
| let time stop moving the line | state | With progress set, the model ignores time and the element stops its loop. The drawing moves only when the work moves, and the same number is read out as text. |
| move the kolam aside | calm | The element reports the boxes of slotted text in the scene’s units. If they cover the kolam, it moves into the largest clear band beside them and shrinks only as much as it must. |

## Accessibility

- The drawing is an image with the label "A kolam: one unbroken line looping around a grid of dots", or the `label` attribute.
- With `progress` set, a status region names the work and the amount: "Upload progress: 40% done" with `label="Upload progress"`, or "The threshold at dawn: 40% done" without one. It speaks only when the number changes, at most once a second.
- In playful the drawing takes focus. The arrow keys move your hand and pour the flour faster; Enter or Space draws it again. A two-tone ring shows focus on any floor.
- In warm and playful a pause button sits in the corner whenever the kolam can move (WCAG 2.2.2). Reduced motion shows the finished kolam, and the same button plays it on request.

## Credit

Kolam is drawn every morning, mostly by women, across Tamil Nadu and much of South India, with kin traditions in rangoli, muggu, rangavalli and Goa's own threshold designs. The mirror-curve method is Paulus Gerdes's mathematical reading of these line drawings; the drawing practice is theirs. Tier: shared practice with local forms.
