# Prahar

*a watch of about three hours; in Hindustani music each raga belongs to one of the eight watches of the day and night.*

A day over a village on a Goan river: the Ghats, the paddy, a chapel, a shrine and a line of palms. Each watch of the day is named for a raga sung at that hour, from Lalit before dawn to Malkauns at midnight, and the light shifts from one to the next. This mapping of ragas to hours is one common reckoning; traditions differ. In playful, drag along the ruler to move through the day. Set the hour from your own clock and it becomes a theme that warms and cools with the viewer’s day.

```html
<script type="module" src="susegad/scenes/prahar/index.js"></script>

<!-- the light at the place, from the page's own clock -->
<sg-scene id="now" name="prahar" register="warm" label="The light in the village now"></sg-scene>
<script type="module">
  const el = document.getElementById('now');
  const tick = () => { const d = new Date(); el.setAttribute('hour', (d.getHours() + d.getMinutes() / 60).toFixed(2)); };
  tick(); setInterval(tick, 60000);
</script>

<!-- playful: drag the ruler, or use the arrow keys -->
<sg-scene name="prahar" register="playful"></sg-scene>
```

| Param | Values | Default | What it does |
|---|---|---|---|
| `hour` | 0 to 24 | absent | Absent: time turns the day (144 s in warm, 72 s in playful). Set: the light holds at that hour, time stands still, and the status says the watch ("Evening, Yaman, 19:10"). Set it from a real clock, never from a timer of its own. |

## The prompt

Draw one day over a village on a Goan river in plain JavaScript on a canvas: blue ridges of the Western Ghats, a wide river that mirrors the sky, paddy plots with bunds, palms, a whitewashed chapel, a small shrine with a tulsi planter, and a house with windows. Keep the sky as keyframes for about a dozen hours of the day, each a zenith and a horizon colour, and blend between them in OKLab so dawn goes through rose and apricot rather than grey. Paint every land layer once as a mask and tint it each frame from its own day and night colours, warmed near sunrise and sunset, so the whole scene follows the light. Move the sun and moon on arcs, light the windows after dusk, and bring out stars at night. Along the bottom, draw a ruler of the eight prahars, each labelled with its raga in English and Devanagari, with a brass bead at the current hour; dragging along it scrubs the day. Give it an hour attribute: when the page sets it from its own clock, the light holds at that hour and the watch is said in words. Give it three registers: quiet is one finished hour, warm turns the day slowly, and playful turns it at full speed with the ruler under your hand and the arrow keys.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| blend between them in OKLab | colour | OKLab is built so that equal steps look equal. Blending dawn keyframes there keeps the rose and apricot instead of sliding through grey as plain RGB does. |
| Paint every land layer once as a mask and tint it each frame | texture | Each layer’s shapes and hatching are painted once in black. They are recoloured with source-in compositing into two group canvases, which are repainted only when a colour has moved more than 2 of 255; most frames are one blit per group. The sketchbook measured about 18 ms a frame this way, down from 45. |
| warmed near sunrise and sunset | colour | A warmth value peaks at dawn and dusk and pulls every layer toward apricot by a little, which is what makes the golden hours read as golden. |
| dragging along it scrubs the day | interaction | While you drag, the pointer’s position on the ruler is the hour. When you let go, the scene’s clock is moved to that hour and the day carries on from there. Each arrow key moves it by the hand’s step along the ruler, about 48 minutes. |
| Move the sun and moon on arcs | easing | The sun’s height is a sine of the hour between sunrise and sunset, so it climbs quickly, lingers at noon and drops quickly again. |
| the light holds at that hour and the watch is said in words | state | With hour set, time stands still and the scene rests until the attribute changes. The status says the watch, its raga and the time, such as "Evening, Yaman, 19:10". |

## Accessibility

The drawing's name is its `alt`. With `hour` set, the scene says the watch, its raga and the time in a polite status region, at most once a second and only when the sentence changes. In playful the drawing takes focus and the left and right arrow keys move the day. The raga names drawn on the canvas are also in this prompt and in the meta, in English and Devanagari.

## After

After **the time theory of Hindustani music, and the Goan singers who carried it: Kesarbai Kerkar, Mogubai Kurdikar, Kishori Amonkar.** Took: the idea that a colour, like a raga, belongs to an hour. Left: the music itself; the ragas are named, never imitated (HOMAGE.md).

## Credit

The eight watches and their ragas (Bhairav at dawn, Todi, Sarang, Multani, Yaman in the evening, Bageshri, Malkauns at midnight, Lalit before dawn) follow one common reckoning; other traditions place some ragas differently. The mapping and the Devanagari names are on the owner's confirm list.
