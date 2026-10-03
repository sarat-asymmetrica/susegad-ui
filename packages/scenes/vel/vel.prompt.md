# Vel

*Marathi and Konkani: a creeper, anything that climbs.*

A bougainvillea grows from behind a laterite wall, one rule at a time: a stem either carries on, forks, or stops to flower. Gravity bends every stem as it lengthens, so the vine arches up and then spills down the lime-washed cap. This one is SVG rather than canvas: each stem is a path that draws itself, and each leaf and bract is a shape that springs open when the stem reaches it. In playful, hover a branch to stir it, and click to shake loose a bract.

```html
<script type="module" src="susegad/scenes/vel/index.js"></script>

<!-- a vine over the wall behind a heading: that part is shown grown, and the breeze keeps off it -->
<sg-scene name="vel" register="warm" seed="1" label="A bougainvillea over the compound wall">
  <h2>Come for the rain</h2>
  <p>Our lowest rate, June to September.</p>
</sg-scene>

<!-- playful: hover a branch to stir it, click to shake a bract loose; or arrows and Enter -->
<sg-scene name="vel" register="playful"></sg-scene>
```

The scene has no params of its own. `seed` picks the vine (the wall is built from the same seed); the growth takes about ten to twelve seconds.

## The prompt

Draw a magenta bougainvillea spilling over the top of a Goan laterite compound wall as an inline SVG in plain JavaScript, with no canvas, image files or libraries. Grow the vine with a stochastic L-system from a seed: an apex can carry on, fork to one side, fork to both, or stop and flower, and each generation’s stems are a little shorter. Interpret the grammar with a turtle that bends its heading toward the ground as it goes, more for thinner stems, so the canes arch up from behind the wall and droop down over its lime-washed cap. Make each stem a smoothed, slightly wobbly path that tapers toward the tips, and draw it on with a dash that slides along it, timed so growth flows outward from the root. Pop in small leaves and clusters of three papery bracts around a tiny white flower as the stem reaches them, with an ease-out-back overshoot. Build the wall from uneven laterite blocks with pitted texture and dark monsoon stains under the cap. Let a few bracts drift down to the ground now and then. Hovering a branch should make it sway like a spring, and a click should drop a bract. Create every animation paused and set its time from the scene’s own clock each frame, so pausing the scene stops every one of them. Give it three registers: quiet is the grown vine as a still, warm grows it and lets a light breeze move a few tips, and playful answers the hand and the arrow keys. Where the page lays its words over the wall, show that part already grown and keep the breeze and the falling bracts away from it.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a stochastic L-system from a seed | pattern | The vine is a string of symbols rewritten seven times. Each apex picks one of a few rules by chance, the way a real shoot may fork, carry on or flower, and the seed makes those choices repeatable. |
| bends its heading toward the ground as it goes, more for thinner stems | pattern | Every few units the turtle turns its heading a little toward straight down, in proportion to how sideways it is going. Young stems bend more, so the old canes stand and the new growth hangs. |
| draw it on with a dash that slides along it | svg | Each stem is an SVG path with its length set to 1, drawn as one dash of length 1. Animating the dash offset from 1 to 0 draws the line. |
| timed so growth flows outward from the root | seed | A branch starts when its parent’s tip passes the fork, so the delay of every stem, leaf and bract is just its distance from the root divided by one growing speed. The farthest tip arrives at about ten seconds. |
| with an ease-out-back overshoot | easing | Leaves and bracts scale up from nothing with a curve that swells a little past full size and settles back, which reads as something opening. |
| sway like a spring, and a click should drop a bract | interaction | Every branch is a group nested inside its parent, so rotating one moves everything it carries. The sway follows a decaying back-and-forth, and a click sends the nearest bract tumbling to the ground. |
| Create every animation paused and set its time from the scene’s own clock each frame | svg | Only animations whose moment has come are touched each frame; once one has run its course it is cancelled and its end state stays. So after the growing, a frame updates only the breeze and the falling bracts, and a paused scene changes nothing at all. |
| show that part already grown | calm | Growth that falls within 30 units of the page’s text boxes is finished at once, and the breeze and the bracts near them rest. |

## Accessibility

The drawing's name is its `alt`. The vine is decoration with no state to announce, so there is no status line. In playful the drawing takes focus: the arrow keys move a small ring over the vine and stir the branch it reaches, and Enter or Space shakes a bract loose there. Under reduced motion every register shows the grown vine as a still, and the pause button stops every animation, the SVG ones included.

## Credit

Bougainvillea over a laterite compound wall is an everyday Goan sight: the red stone, the lime-washed cap and the magenta bracts. The branching grammar is the classic stochastic L-system read by a turtle, a long-standing technique from the study of plant form.
