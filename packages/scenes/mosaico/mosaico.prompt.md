# Mosaico

*Goan Portuguese: the cement tiles on the floors of the old houses.*

The floor is one tile design laid in two turns. Each tile carries two quarter-circle bands, and wherever tiles meet the bands join up, so the whole floor becomes a few long meandering ribbons. Now and then a tile turns and the ribbons re-route. An ant is walking the pale line down the middle of one ribbon, and it follows the new way when a tile turns under it. In playful, hover a tile to turn it and click to re-lay a patch; the arrow keys and Enter do the same.

```html
<script type="module" src="susegad/scenes/mosaico/index.js"></script>

<!-- a quiet floor under a heading: laid, the ant resting -->
<sg-scene name="mosaico" register="quiet" seed="3">
  <h2>The balcão</h2>
  <p>Where the house meets the road.</p>
</sg-scene>

<!-- warm: now and then a tile turns and the ant walks -->
<sg-scene name="mosaico" register="warm"></sg-scene>
```

The scene takes no params beyond `seed`: the seed decides every tile's turn and wear and where the ant starts.

## The prompt

Draw the cement-tile floor of an old Goan house, seen from above, in canvas JavaScript with no image files. Lay a Truchet pattern: every tile has the same design, two quarter-circle bands joining the midpoints of neighbouring edges, and is set down in one of two turns, so the bands join across tiles into continuous meandering ribbons. Use a muted cement-tile palette: chalk ground, oxide red bands edged with indigo, a pale line down the middle of each band and an ochre dot where four tiles meet. Make it worn: uneven pigment, chipped edges, a hairline crack here and there, dark grout lines and paper grain. Let late light fall across it in the shape of a window with bars. Every few seconds, lift one tile and turn it by a quarter with a small overshoot as it settles, so the ribbons re-route. Put a small ant on the floor that walks the pale line along one ribbon from tile to tile, and follows the new route when a tile turns. Hovering a tile turns it, and a click re-lays the tiles around it in a ripple. Start by laying the floor tile by tile. Keep the floor and the ant a pure function of the seed, the time and the turns asked for, stepped and remembered, so the same inputs always give the same floor. Give it three registers: quiet is the laid floor with the ant at rest, warm turns a tile now and then while the ant walks, and playful answers the pointer and the arrow keys. Where words sit on the floor, no tile turns under them, and the ant turns round at their edge.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| two quarter-circle bands joining the midpoints of neighbouring edges | pattern | This is a Truchet tile. Because every band ends at the middle of an edge, and the neighbour’s band starts at the same point, bands always meet up, and one tile design in two turns makes long winding ribbons with no planning at all. |
| walks the pale line along one ribbon from tile to tile | pattern | The ant only ever asks one question: which edge does this tile’s band lead to from the edge I came in by? The answer depends on whether the tile is turned, so when a tile turns, the ant’s route changes by itself. |
| lift one tile and turn it by a quarter with a small overshoot | easing | The turn uses an ease that runs slightly past ninety degrees and comes back, so the tile seems to drop into place. It also shrinks a touch and casts a shadow while it moves, as if lifted. A turn takes 1 s, and a tile turns every 3.6 to 7.7 s in warm, 2.6 to 5.5 s in playful. |
| Make it worn: uneven pigment, chipped edges, a hairline crack | texture | Each tile is painted once into its own small image with seeded wear: smooth noise fades the pigment, a few edge chips show grout, and some tiles get a crack. The wear turns with the tile, as it would. |
| Hovering a tile turns it, and a click re-lays the tiles around it in a ripple | interaction | The pointer is mapped to a tile. Entering a new tile turns it once; a click turns the tiles within 1.6 tiles by one to three quarters, each starting 0.09 s later per tile of distance. Enter turns the tile under the keyboard hand. |
| Start by laying the floor tile by tile | seed | The seed decides every tile’s turn and wear. The tiles are set down along a diagonal sweep, one every 25 ms, each dropping in with a small bounce; their images are painted a few milliseconds’ worth per frame in the same order. |
| a pure function of the seed, the time and the turns asked for | model | The floor steps forward in sixtieths of a second from zero and remembers where it got to, so a playing scene only pays for new steps. Turns asked for by a hand are a list with their moments, so the same seed and the same turns always give the same floor and the same ant. |
| no tile turns under them, and the ant turns round at their edge | calm | The page reports where its text sits. Any tile under those boxes is left out of every turn, and to the ant its edge is a wall, as the skirting board is. |

## Accessibility

The drawing is decorative: its name is its `alt`, and it shows no state. In warm a tile turns every few seconds and a small ant walks; the pause button stops both, and under reduced motion the floor is a finished still. In playful the drawing takes focus: the arrow keys move a hand from tile to tile (drawn as an outline round the tile), and Enter or Space turns that tile by a quarter, as hovering a tile does with a mouse; a click re-lays the tiles around it in a ripple. No tile under slotted words ever turns, and the ant turns round at their edge.

## Credit

The cement tiles (mosaicos) of Goa's old houses, on the balcão and the floors inside. The pattern is a Truchet tiling, named for Sébastien Truchet (1657 to 1729). The words mosaico and balcão are on the owner's confirm list.
