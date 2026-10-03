# Chiro

*Konkani: laterite, the red stone Goa is built from.*

A compound wall of cut laterite blocks, close enough to touch. The pits in each stone grow in front of you, a little differently in every block. Then the monsoon arrives: the wall darkens from the top, moss creeps out of the joints and up from the ground, and the sun slowly bleaches it all back to red. In playful, press a hand to the wall and it leaves a damp print; brush it and a little red dust falls.

```html
<script type="module" src="susegad/scenes/chiro/index.js"></script>

<!-- warm: the pits grow, then an easier year of weather -->
<sg-scene name="chiro" register="warm">
  <h2>Built from the ground it stands on</h2>
  <p>Every wall on the property is local laterite.</p>
</sg-scene>

<!-- playful: press a hand to the wall, or use the arrow keys and Enter -->
<sg-scene name="chiro" register="playful" seed="4"></sg-scene>
```

No params: the register, the seed and the theme decide everything. A seed is a different wall.

## The prompt

Draw a Goan laterite compound wall up close in canvas JavaScript, with no image files. Lay cut blocks in courses with a running bond and slightly recessed lime-grey mortar joints, and give each block a worn, chipped outline inked by hand and faint saw marks across its face. Grow the pitted surface of the stone with a Gray–Scott reaction–diffusion simulation on a low-resolution grid, masked to each block, with feed, kill and diffusion varied by low-frequency noise inside every block, so hollows of different sizes gather in clusters and leave flat cut faces between them. Threshold the pits with a wandering, dithered edge so they come out ragged, and colour them in rusty reds, ochres and purple-brown, with a paler iron crust around each hollow and some filled with ochre clay. Then loop the seasons calmly: the monsoon darkens the wall from the top down in streaks, moss creeps out of the joints, the pits and the damp base as a stippled growth front in three greens that thins into scattered specks, grass sprouts at the foot of the wall, and then the sun comes back, the stone dries, the moss browns and the red bleaches pale. Let a palm frond’s shadow sway across the wall in the dry months. If someone presses on the wall, leave a damp handprint that fades; if they brush across it in the dry season, let a little red dust fall. Give it three registers: quiet is the wall in the green of the monsoon as a finished still, warm lives through an easier year, and playful takes the hand, from the pointer or the arrow keys and Enter. Keep the rain and the dust off any words laid over the wall.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| Gray–Scott reaction–diffusion simulation on a low-resolution grid | emergence | Two imaginary chemicals spread and react on a grid of 300 by 200 cells. Nobody draws a pit: the hollows appear on their own out of scattered seed spots, 190 steps a second within a 3.5 ms budget each frame, until 1,500 steps. |
| feed, kill and diffusion varied by low-frequency noise inside every block | seed | Where the noise is low the reaction starves and the cut face stays flat; where it is high, hollows form, and the diffusion rate sets how big they grow. The seed picks each block’s mix, so no two stones look alike. |
| a wandering, dithered edge | noise | Each cell compares the chemical against a threshold that drifts with noise, plus a little per-cell jitter. Smooth tubes break into ragged hollows of uneven size. |
| moss creeps out of the joints, the pits and the damp base | fields | A distance field records how far each cell is from a joint. Together with height and the pits it gives every cell a moment when moss arrives, and each arriving cell becomes a speck or not, so the front frays into dots. |
| loop the seasons calmly | loop | One timeline of 52 seconds drives rain, wetness, moss, grass, sun and bleaching (70 seconds in warm). Each cell has its own moment to get wet and to dry, so the fronts move down the wall in streaks rather than all at once. |
| rusty reds, ochres and purple-brown | colour | Every block starts from its own red and is mottled toward maroon and ochre by noise. Wet stone loses more green and blue than red, which is why it deepens instead of just going grey. |
| leave a damp handprint that fades | interaction | A press stamps a palm and five fingers into a dampness grid that the colouring pass reads as wet, then lets evaporate over a few seconds. Enter or Space presses where the keyboard hand is. |
| Keep the rain and the dust off any words laid over the wall | calm | The page reports where its text sits. A raindrop, a splash or a speck of dust inside those boxes, or within 30 units of them, is not drawn. |

## Accessibility

The drawing is decorative: its name is its `alt`, and it shows no state. The pits take about eight seconds to grow; after that the seasons turn slowly, and the pause button stops them. In playful the drawing takes focus: the arrow keys move a hand (drawn as a small ring) and Enter or Space presses it to the wall. Rain and dust are kept off any words laid over the wall.

## Credit

Laterite, cut in blocks from the plateaus, is the stone of Goan houses, walls and churches; lime plaster and lime wash protect it from the monsoon. "Chiro" (laterite, in Konkani) is on the owner's confirm list for a Konkani reader.
