# Mankurad

*Goa’s own mango, the one every Goan waits for in May.*

A mango ripens in the May heat while a koel calls from the branch. The clouds come in, the first rain of the monsoon arrives, and the mango lets go into a puddle on the red laterite. Every leaf, raindrop and pencil stroke is drawn by JavaScript, frame by frame. Set progress and the story holds at that beat, from the ripening fruit to the card after the rain.

```html
<script type="module" src="susegad/scenes/mankurad/index.js"></script>

<!-- warm: the story at an easy pace, looping through paper -->
<sg-scene name="mankurad" register="warm"></sg-scene>

<!-- an order on its way: the story holds at the beat the work has reached -->
<sg-scene id="order" name="mankurad" progress="0" label="Order progress"></sg-scene>
<script type="module">
  // call this from your real order status, never from a timer
  document.getElementById('order').setAttribute('progress', '0.4');
</script>
```

| Param | Values | Default | What it does |
|---|---|---|---|
| `progress` | 0 to 1 | absent | Absent: time tells the 46-second story (58 s in warm). Set: the story holds at that beat, from the ripening fruit (0) to the card after the rain (1), time stands still, and the status says "40% done". |

## The prompt

Make a quiet, 45-second animated short in canvas JavaScript, drawn to look like coloured pencil on cream handmade paper, with faint diagonal bands of sunlight. A single Goan Mankurad mango hangs from a branch of long drooping leaves while a koel calls and flies off. Build tone from hatching, not gradients: pack the strokes tighter on the shadow side and let a red blush cross-hatch the cheek. Give every outline a slight ink wobble and re-roll it about ten times a second so the drawing breathes like hand-drawn animation. Then tell the story on a timeline: grey hatched clouds drift in, noise-driven gusts swing the mango like a pendulum, the first monsoon rain falls as diagonal streaks, and the mango drops into a puddle on red laterite with a soft bounce and spreading ripples. Cache the paper and ground so each frame stays cheap. Keep the whole story a pure function of its own clock, stepping the pendulum at fixed sixtieths, so a progress attribute can hold it at any beat, from the ripening fruit to the card after the rain. Keep the rain and the words off any text laid over the drawing.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| tone from hatching, not gradients | hatch | Light and shadow are how many short strokes land in each spot. A density function makes strokes likelier on the shadow side, so tone emerges from marks. |
| re-roll it about ten times a second | boil | The wobble’s random seed changes ten times a second, cycling through three variants, so outlines shimmer the way traced animation drawings do. Each hatched shape is painted once per variant into a sprite, so a frame is a handful of drawImage calls. |
| tell the story on a timeline | easing | Each beat is a window of time. phase(t, start, end) turns the clock into 0→1 dials that fade clouds in, ramp the rain and release the fruit at 28.6 s of a 46 s story. |
| noise-driven gusts swing the mango like a pendulum | noise | Wind is smooth Perlin noise fed as a push into a tiny spring simulation, so the sway builds and settles instead of jittering. |
| diagonal streaks | particles | Three hundred and twenty raindrops, each just a start position and a speed, wrapped around the frame. Rain intensity only decides how many get drawn; a slow machine draws half. |
| stepping the pendulum at fixed sixtieths | state | The swing is computed once for the whole story and remembered, and the fall starts from where it hung at 28.6 s. With progress set, the story sits at that beat (1.3 s to 40.5 s), time stands still, and the status says the percentage. |
| Keep the rain and the words off any text laid over the drawing | calm | A raindrop, a ring or a splash that would cross the page’s text boxes is not drawn, and the drawn words hide when they would sit under them. |

## Accessibility

The drawing's name is its `alt`. With `progress` set, the element says the percentage in a polite status region, at most once a second. The story loops through a fade to paper, and the pause button stops it. In playful the drawing takes focus and Enter or Space tells the story again from the start. The koel's call is drawn as words, never played: this scene makes no sound. Rain, ripples, splashes and the drawn words keep off any text laid over the drawing.

## Credit

The mankurad (malcorada) is Goa's own mango, ripe in May before the monsoon. "Mankurad", its gloss and the drawn words "ku-hoo" and "mankurad · the first rain" are on the owner's confirm list for a Goan reader.
