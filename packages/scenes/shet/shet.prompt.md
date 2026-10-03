# Shet

*Marathi and Konkani: a field, here a paddy field in April.*

In April the field is bare mud baked into plates, with last year’s stubble still standing in rows. The first rain darkens it one drop at a time until the cracks close, water gathers in the low places, and the seedlings go in. Wind combs the rice in waves; it ripens gold, is cut, and the mud cracks again. In playful, move across the field and the wind follows you. Set progress and the field holds at that point of the year.

```html
<script type="module" src="susegad/scenes/shet/index.js"></script>

<!-- warm: the year turns at an easier pace (133 s) -->
<sg-scene name="shet" register="warm">
  <h2>Grown on the farm</h2>
  <p>Our rice comes from the fields behind the house.</p>
</sg-scene>

<!-- state: a season that is 40% through, from the page's own numbers -->
<sg-scene name="shet" progress="0.4" label="Season progress"></sg-scene>
```

| Param | Values | Default | What it does |
|---|---|---|---|
| `progress` | 0 to 1 | absent | Absent: time turns the year (80 s in playful, 133 s in warm). Set: the field holds at that point of the year, from the dry April field (0) to the field dry again after the harvest (1); time stands still and the status says "40% done". Set it from real work, never from a timer. |

## The prompt

Draw a Goan paddy field through one year, in canvas JavaScript with no image files, seen from a low rise so the plots recede in perspective toward a line of coconut palms. Divide it with raised earth bunds. In April the mud is dry and cracked into plates: generate the cracks as a Voronoi diagram from seeded points, big cells first and then finer cells inside each one, and make the older, bigger cracks darker and wider. Leave rows of pale stubble from the last harvest. Then bring the first monsoon rain: drops darken the soil in spots until it is all wet and the cracks close, water gathers in the lowest cells and then covers each plot, and green seedlings rise in rows. Comb every blade with a noise flow field and send gusts across the field as visible waves. Let the rice ripen to harvest gold, cut it, and let the mud dry and crack again, slowly, as if nothing could stop it. Let the wind follow the pointer so the viewer can bend the field. Give it three registers: quiet is the ripening gold as a finished still, warm turns the year at an easier pace, and playful gives the wind to the pointer and the arrow keys. Give it a progress attribute: when it is set, the field holds at that point of the year and the number is said in words. Where words sit over the field, hold the picture under them still.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a Voronoi diagram from seeded points, big cells first and then finer cells inside each one | fields | Every plate of mud is the set of ground closer to one seeded point than to any other. The big cells are split again by finer points, and each edge remembers which level made it, so an old crack can be cut wider than a young one. |
| drops darken the soil in spots | particles | Each drop lands at a seeded time and place and stamps a dark spot into a small wetness mask. The wet mud shows through the mask, so the field darkens drop by drop. |
| Comb every blade with a noise flow field | fields | Perlin noise gives the wind a direction at every point that drifts slowly over time, so neighbouring clumps lean together and distant ones lean their own way. The near rows are redrawn leaf by leaf 24 times a second in warm and 30 in playful. |
| send gusts across the field as visible waves | noise | A gust is a narrow band of stronger wind travelling across the ground plane, its front bent by noise. Blades inside the band bow and turn their pale undersides up, which is how you see wind on a real paddy. |
| Let the wind follow the pointer | interaction | The pointer is mapped back onto the ground. Clumps near it bend the way it is moving, and the prevailing wind slowly swings round to follow. Enter or Space sends a gust from the keyboard hand. |
| seen from a low rise so the plots recede in perspective | seed | Everything is laid out on a flat ground plane in metres and divided by distance to draw it. The seed moves the bunds, the crack points and the rows, so every field is a different field. |
| the field holds at that point of the year | state | progress 0 is the dry April field and 1 the field dry again after the harvest. With it set, time stands still, the scene rests, and the status says how far through the year it is. |
| hold the picture under them still | calm | Under the page’s text boxes, and 30 units round them, the field is shown as it was at the start of each six-second step of the year, so the words sit on a picture that does not move while the season turns round them. |

## Accessibility

The drawing's name is its `alt`. With `progress` set, the element says how far through the year the field is, naming the work from its `label`. The year turns slowly and the pause button stops it; the still is the ripening gold. In playful the drawing takes focus: the arrow keys move a hand (drawn as a small ring) that the wind follows, and Enter or Space sends a gust across the rice. Under any words laid over the field the picture holds still.

## Credit

Drawn from the paddy fields of Goa through a monsoon year, with the cattle egrets that follow the water and the harvest. "Shet" is on the owner's confirm list for a Konkani reader.
