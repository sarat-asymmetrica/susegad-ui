# Ghat

*Marathi and Konkani: a mountain pass, and the Sahyadri range above Goa.*

A survey sheet of the Western Ghats where they drop to the Goan coast. The hills are made from noise, the contours are traced out of it, and the river finds its own way down to the sea. The sheet inks itself from sea level up, then the river, the road and the names; a page can tie that to its own scroll through progress. Monsoon clouds come in off the sea and catch on the ridge. Point at the ground to read its height.

```html
<script type="module" src="susegad/scenes/ghat/index.js"></script>

<!-- warm: the sheet inks itself, then the monsoon drifts in -->
<sg-scene name="ghat" register="warm"></sg-scene>

<!-- tie the inking to the page's own scroll -->
<sg-scene id="survey" name="ghat" progress="0" label="The survey sheet"></sg-scene>
<script type="module">
  const el = document.getElementById('survey');
  const update = () => {
    const r = el.getBoundingClientRect(), vh = innerHeight;
    el.setAttribute('progress', Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.55 + r.height * 0.55))).toFixed(3));
  };
  addEventListener('scroll', update, { passive: true }); update();
</script>
```

| Param | Values | Default | What it does |
|---|---|---|---|
| `progress` | 0 to 1 | absent | Absent: time inks the sheet (22 s in warm, 14 in playful). Set: the sheet is inked exactly that far (sea, then the land from sea level up, then rivers, road and names), time stands still, and the status says "40% done". |

## The prompt

Draw a topographic survey sheet of the Western Ghats above Goa in canvas JavaScript, with no image files. Build a height field from seeded fractal noise: a low coastal plain in the west, a steep escarpment cut by gullies, and a high ridge in the east, with the sea beyond the coast. Extract contour lines every 50 metres with marching squares, draw every fifth one heavier with small handwritten elevation labels, and add hachures where the slope is steep. Give the sea a pale wash with a few ripple lines along the shore. Let water find its own way: fill the pits, follow the steepest descent, and trace the river that collects the most water down to the sea, then letter its name along its course. Add a dotted ghat road that switchbacks up the escarpment. Give it a progress attribute from 0 to 1 that inks the contours from sea level upward, then the river, then the labels, so a page can tie the drawing to its own scroll; without it, ink the sheet on a clock. Let monsoon clouds drift in from the sea and pile up against the ridge, and keep them and the names off any words laid over the sheet. Show the height under the pointer as a pencilled note and highlight that contour, and say it as text when the arrow keys move a hand over the sheet. Give it three registers: quiet is the inked sheet as a still, warm inks it and lets the clouds drift, playful adds the keyboard hand.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| Extract contour lines every 50 metres with marching squares | fields | The height field is sampled on a grid of 6-unit cells. Each grid square is tested against a level, and one of sixteen cases says where the line crosses it. Joining the pieces gives the contour lines. |
| fill the pits, follow the steepest descent | emergence | A priority flood raises every hollow until water can escape. Then each cell drains to its steepest neighbour, and adding up what flows through each cell reveals the river network. Nobody places the river. |
| a dotted ghat road that switchbacks up the escarpment | emergence | The road is a shortest-path search that refuses any stretch steeper than 11% and pays heavily for anything near it. The hairpins appear on their own, where going straight up costs more than turning. |
| inks the contours from sea level upward | state | Progress becomes a rising height threshold. A mask shows the land wherever its place in the reveal is below the front, so the ink seems to climb the hills. With progress set, time stands still and the status says how far the sheet is inked; without it, the sheet inks itself in 22 seconds in warm and 14 in playful. |
| pile up against the ridge | particles | Each cloud drifts east and slows as the ground under it rises, so they bunch against the escarpment the way the monsoon does. |
| keep them and the names off any words laid over the sheet | calm | The page reports where its text sits. A cloud, a spot height or a name within reach of those boxes is not drawn. |
| Show the height under the pointer | interaction | The pointer position is read back from the height grid and rounded to the nearest contour, which is drawn again in red pencil. The keyboard hand’s height is said once in a polite live region. |

## Accessibility

The drawing's name is its `alt`. With `progress` set, the status says how far the sheet is inked, at most once a second. In warm and playful the pointer reads the height of the ground as a pencilled note; in playful the drawing takes focus, the arrow keys move a hand over the sheet, and the height under it is said once in a polite live region ("Height here: 350 m"). Clouds and names are not drawn over words laid on the sheet.

## Credit

Drawn after the old survey sheets of the Western Ghats. The ground is invented from noise; the names (the Mhadei and the Mandovi, the Arabian Sea, the Sahyadri, "THE SAHYADRI above Goa") and the graticule figures are real names on an invented map. They are on the owner's confirm list.
