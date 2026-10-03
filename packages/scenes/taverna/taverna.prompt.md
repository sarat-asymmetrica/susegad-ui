# Taverna

*Konkani and Portuguese: a village tavern and meeting spot.*

Looking out from inside a village taverna on a rainy monsoon night. Dark green glass bottles, a ceramic jug and a slate blackboard rest on the wooden sill. Through the barred window, rain sweeps down a cobblestone alley under a glowing streetlamp, while water droplets trickle down the steamy pane. In playful, click the bottles to chime and wipe the misted glass.

```html
<script type="module" src="susegad/scenes/taverna/index.js"></script>

<sg-scene name="taverna" register="warm">
  <h2>Rain on Bottle Glass</h2>
  <p>Monsoon evening in a village tavern.</p>
</sg-scene>
```

## The prompt

Draw a village taverna window on a rainy monsoon night, in ink and wash on paper, using canvas and no image files. Behind dark wooden window bars, look out into a rain-swept cobblestone alley where an old streetlamp casts a warm halo through the deluge. Seed the puddle reflections and droplet paths so each seed gives a distinct rainy alley. In the foreground on the wide wooden sill, place dark green glass wine bottles with caustic light reflections, an earthen glazed ceramic jug, and a hanging slate blackboard framed in wood. Outside, diagonal rain streaks fall through the lamplight. On the window glass, warm indoor air condenses into a soft mist, and meandering water droplets gather weight and trickle down in delicate rivulets. A warm filament bulb hangs above, casting an amber glow across the bottles and sill. Paint the architecture, background alley, and still life into cached layers once. Make the rain streaks, droplet trickles, and filament flicker pure functions of time and parameters. In quiet, draw a crisp hairline ink elevation of the window, bottles, jug, and blackboard at rest. In warm, let the rain fall and rivulets meander before settling gracefully into a quiet monsoon night. In playful, clicking the bottles rings an acoustic ripple across the glass, and dragging wipes the misty condensation clean. Let somebody go past under a covered lantern every twenty two seconds, walking left to right and fading in and out at the edges of the frame, with the lantern swinging as they walk and hanging still when they stop. Let their light come through the bars and lay them across the sill and up the bottles: light the panes first, then the shadow over it, opening away from the lamp and closing again behind it.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| meandering water droplets gather weight and trickle down in delicate rivulets | physics | Droplets track downward under gravity with meandering horizontal wandering and surface tension slip-stick motion. |
| diagonal rain streaks fall through the lamplight | particles | Outside rain particles stream diagonally across the alley, catching highlights as they cross the streetlamp's cone of light. |
| settling gracefully into a quiet monsoon night | easing | Droplet velocity and rain ripples ease to a halt as time approaches rest, settling the canvas without abrupt jumps. |
| Make the rain streaks, droplet trickles, and filament flicker pure functions of time and parameters | model | model() computes droplet positions, rain streaks, and lamp luminescence purely from time, seed, register, and parameters. |
| Paint the architecture, background alley, and still life into cached layers once | texture | The cobblestones, streetlamp, window frame, bottles, and ceramic jug are rendered onto offscreen canvases and composited per frame. |
| Seed the puddle reflections and droplet paths so each seed gives a distinct rainy alley | seed | weather(seed) derives the cobblestone pavement, puddle positions, and droplet tracks deterministically from one seed. |
| clicking the bottles rings an acoustic ripple across the glass, and dragging wipes the misty condensation clean | interaction | Clicking a bottle triggers an acoustic shockwave ring from its contact point, while dragging creates a clear stroke through the condensation layer. |
| crisp hairline ink elevation of the window, bottles, jug, and blackboard at rest | hatch | Surfaces in quiet mode are rendered with delicate parallel hatch strokes and fine ink contours without colour wash. |
| somebody go past under a covered lantern | easing | One crossing every twenty two seconds with a soft entry and exit, so nobody fades in at the edge of the picture, and a lantern that swings on the walk and hangs still between crossings. |
| lay them across the sill and up the bottles | loop | A dark room cannot be made darker by multiplying, so the contrast is built the other way round: a warm spill lights the panes and the sill, then the bar shadows are laid over it. The bars open away from the lamp and close again behind it. |

## Try asking for

- A quiet rainy window with condensation and dark glass bottles in warm ink
- Heavy monsoon rain outside an old Goan taverna with a glowing streetlamp
- Interactive tavern glass: click bottles to chime and wipe the steamy window

## Accessibility

The drawing says nothing a person needs; the page text carries the message. Warm plays and settles gracefully, so motion does not continue indefinitely. In playful, the drawing takes focus: Enter or Space chimes the nearest bottle, and arrow keys move across the sill or wipe condensation. Quiet and reduced motion show the crisp ink elevation at rest.

## Credit

Inspired by the village tavernas of Goa, where bottles of feni and wine sit on deep window sills against the monsoon rain outside.
