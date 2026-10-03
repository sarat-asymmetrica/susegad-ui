# Pahat

*Marathi: the first light before sunrise (a working title).*

Half past four at a desk by a barred Goan window, its shutters folded back and a cat asleep on the sill. Outside, the sky goes from indigo to first light: the stars fade, the morning star holds on longest, the palms and a neighbour’s roof come out of the dark, and a few birds cross. On the desk, a notebook, a laptop turned half away, and a steel tumbler with a wisp of steam. Then it rests.

```html
<script type="module" src="susegad/scenes/pahat/index.js"></script>

<sg-scene name="pahat" register="warm">
  <h2>Right now</h2>
  <p>Up early, building the lean version.</p>
</sg-scene>
```

## The prompt

Draw a desk by a window at half past four in the morning, in ink and wash on paper, on a canvas with no image files. Make the window the subject: a teak frame with iron bars and a deep sill, louvred shutters folded back against a lime-washed wall, a cat asleep on the sill, and outside three palms with inked fronds and hanging leaflets, a hatched hill and a neighbour’s tiled roof. On the desk, keep things small: an open notebook with a pencil, a laptop turned half away, a steel tumbler with a wisp of steam. Paint the room and the view once, as a sequence of steps you run a slice at a time over the first frames, so no single task is long, and make the night copy from it by laying the dark over what was painted. Each frame, paint the sky behind the window as a gradient between colour stops from indigo to a warm horizon, let the stars fade and the morning star hold on longest, send a few birds across once it is light enough, then lay the night copy and the day copy over it at an opacity that grows with the dawn. Keep the laptop’s cool glow the same all through, so it matters less as the day comes. Make the dawn a pure function of a fraction from 0 to 1. In warm, time moves it over about half a minute and then the scene rests. In playful, the pointer moves it: left is the dark, right is first light. Quiet is a hairline drawing of the same room.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a gradient between colour stops from indigo to a warm horizon | colour | skyAt(u) interpolates a top and a horizon colour between four stops, and the sky is one vertical gradient between them each frame. |
| Paint the room and the view once, as a sequence of steps you run a slice at a time | texture | The painting is a generator: each step (the wall, the view, each palm, the shutters, the frame, the cat, the desk, each object) yields, and the renderer runs steps for about 8 ms a frame, reading one pixel after each so the rasteriser works inside the slice. The night copy is the same painting with the dark laid over it; sg-ready waits for both. |
| a pure function of a fraction from 0 to 1 | model | dawn(u, t, seed) returns the sky, how visible the stars and the morning star are, the light on the desk and the birds, and runs in Node. |
| send a few birds across once it is light enough | easing | The birds fade in between 62% and 80% of the dawn and fly across once; when they have gone and the sky is light, the scene is settled and stops drawing. |
| the pointer moves it | interaction | In playful, the hand's place across the window becomes the dawn fraction the moment it moves; Enter or Space starts the dawn again from the dark. |
| three palms with inked fronds and hanging leaflets | seed | Where the palms stand, where the stars are and where the morning star rises come from the seed. |

## Accessibility

The drawing says nothing a person needs; the page text carries the message. Warm plays the dawn once, in about half a minute, and rests. In playful, the drawing takes focus: the arrow keys move a hand left and right across the window to move the dawn, and Enter or Space starts it again from the dark. Quiet is a hairline still at first light; reduced motion shows the finished morning.

## Credit

The steel tumbler, the barred window and the palms are everyday Goa; nothing here is anyone's in particular.
