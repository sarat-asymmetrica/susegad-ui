// Vel: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in vel.prompt.md (prompts.test.js checks).
import { W, H, STILL_TIME } from './model.js';

export const meta = {
  id: 'vel',
  title: 'Over the compound wall',
  word: 'Vel',
  gloss: 'Marathi and Konkani: a creeper, anything that climbs',
  alt: 'A magenta bougainvillea spilling over the lime-washed cap of a red laterite compound wall, its canes arching up from behind and hanging down the stone.',
  caption:
    'A bougainvillea grows from behind a laterite wall, one rule at a time: a stem either carries on, forks, or stops to flower. Gravity bends every stem as it lengthens, so the vine arches up and then spills down the lime-washed cap. This one is SVG rather than canvas: each stem is a path that draws itself, and each leaf and bract is a shape that springs open when the stem reaches it. In playful, hover a branch to stir it, and click to shake loose a bract.',
  keys: 'Arrow keys move a hand over the vine and stir the branch it reaches. Enter or Space shakes a bract loose there.',
  W, H, seed: 1, stillTime: STILL_TIME,
  tier: 'local',
  credit: 'Bougainvillea over a laterite compound wall is an everyday Goan sight: the red stone, the lime-washed cap and the magenta bracts of the monsoon-to-summer bloom.',
  techniques: ['pattern', 'svg', 'seed', 'easing', 'interaction', 'calm'],
  prompt:
    'Draw a magenta bougainvillea spilling over the top of a Goan laterite compound wall as an inline SVG in plain JavaScript, with no canvas, image files or libraries. Grow the vine with a stochastic L-system from a seed: an apex can carry on, fork to one side, fork to both, or stop and flower, and each generation’s stems are a little shorter. Interpret the grammar with a turtle that bends its heading toward the ground as it goes, more for thinner stems, so the canes arch up from behind the wall and droop down over its lime-washed cap. Make each stem a smoothed, slightly wobbly path that tapers toward the tips, and draw it on with a dash that slides along it, timed so growth flows outward from the root. Pop in small leaves and clusters of three papery bracts around a tiny white flower as the stem reaches them, with an ease-out-back overshoot. Build the wall from uneven laterite blocks with pitted texture and dark monsoon stains under the cap. Let a few bracts drift down to the ground now and then. Hovering a branch should make it sway like a spring, and a click should drop a bract. Create every animation paused and set its time from the scene’s own clock each frame, so pausing the scene stops every one of them. Give it three registers: quiet is the grown vine as a still, warm grows it and lets a light breeze move a few tips, and playful answers the hand and the arrow keys. Where the page lays its words over the wall, show that part already grown and keep the breeze and the falling bracts away from it.',
  map: [
    ['a stochastic L-system from a seed', 'pattern', 'The vine is a string of symbols rewritten seven times. Each apex picks one of a few rules by chance, the way a real shoot may fork, carry on or flower, and the seed makes those choices repeatable.'],
    ['bends its heading toward the ground as it goes, more for thinner stems', 'pattern', 'Every few units the turtle turns its heading a little toward straight down, in proportion to how sideways it is going. Young stems bend more, so the old canes stand and the new growth hangs.'],
    ['draw it on with a dash that slides along it', 'svg', 'Each stem is an SVG path with its length set to 1, drawn as one dash of length 1. Animating the dash offset from 1 to 0 draws the line.'],
    ['timed so growth flows outward from the root', 'seed', 'A branch starts when its parent’s tip passes the fork, so the delay of every stem, leaf and bract is just its distance from the root divided by one growing speed. The farthest tip arrives at about ten seconds.'],
    ['with an ease-out-back overshoot', 'easing', 'Leaves and bracts scale up from nothing with a curve that swells a little past full size and settles back, which reads as something opening.'],
    ['sway like a spring, and a click should drop a bract', 'interaction', 'Every branch is a group nested inside its parent, so rotating one moves everything it carries. The sway follows a decaying back-and-forth, and a click sends the nearest bract tumbling to the ground.'],
    ['Create every animation paused and set its time from the scene’s own clock each frame', 'svg', 'Only animations whose moment has come are touched each frame; once one has run its course it is cancelled and its end state stays. So after the growing, a frame updates only the breeze and the falling bracts, and a paused scene changes nothing at all.'],
    ['show that part already grown', 'calm', 'Growth that falls within 30 units of the page’s text boxes is finished at once, and the breeze and the bracts near them rest.'],
  ],
};
