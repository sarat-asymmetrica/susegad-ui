# Using <sg-scene>

*Reference file for [`SKILL.md`](../SKILL.md), split out in rung 7 of docs/requests/2026-09-28-open-the-door.md so the top file stays short. Content moved verbatim; nothing here is new.*

## 5. Use `<sg-scene>`

A scene is a drawing that does a job. It can host your words (surface), show something real (state) and answer the person using it (response).

Every scene, generated from `registry/registry.json` by `node tools/skill-inventory.mjs` (never hand-edited; `--check` catches it going stale), with **use for** tags where the scene's own description supports one: honest fit, not a wish list, so an empty entry means nothing here is a confident match yet, not that the scene has no answer. Three are picked apart in depth below (Kolam, Paus, Tollem); this list is every scene there is, today.

<!-- inventory:scene:start -->
- **abri** {background, section-break} -- Deccani cloud paper being made: drops of indigo, ochre, madder and grey-green land on a tray of size and push each other into rings by the area-preserving marbling map, a stylus combs them, a curl drift billows them, and a sheet is laid, lifted and turned to show its print. Quiet is the print as a still; warm makes sheet after sheet; playful takes a hand in the size (pointer, or arrow keys and Enter to drop a colour).
- **chai** {divider, loader} -- Three small ink drawings on one sheet, meant as a loader, a toggle and a divider: a cutting-chai glass whose steam follows a curl-noise field, a clay diya whose flame leans from the pointer and goes out with a curl of smoke, and a tulsi creeper that grows along a rule. Set lit to put the lamp out or light it. Quiet is the plate's still; warm steams and flickers; playful takes a tap on the flame and a hover on the creeper.
- **chiro** {background, section-break} -- A Goan laterite compound wall up close through a year: the pits in each cut block grow as a Gray-Scott reaction-diffusion, the monsoon darkens the stone from the top, moss creeps out of the joints and the sun bleaches it back. Quiet is the monsoon-green still; warm an easier year; playful takes a hand (pointer, or arrow keys and Enter) that leaves a damp print, and a brush that rubs red dust loose.
- **dar** {empty-state, hero} -- Yours to keep: a Goan house front in elevation, with a laterite wall under lime plaster, a painted door in a lime-white surround, a window of oyster-shell panes and bougainvillea. A key on a ring with a wooden tag swings in, catches on the brass hook by the door and sways to rest, and the tower bolt slides home. Quiet is a hairline elevation; playful swings the key and slides the bolt.
- **ferry** {divider, section-break} -- Four stops across the Mandovi: a river ferry in ballpoint hatching, with a small jetty on the far side, two channel posts and a big jetty on the near bank, each with a lamp. The step attribute sails it to a stop; absent, it idles at the first and never moves on by itself. Quiet is a hairline still; playful advances a stop on a click and a kite circles.
- **ghat** {background, hero} -- A survey sheet of the Western Ghats above Goa: contours traced out of a noise height field with marching squares, rivers that find their own way to the sea, a ghat road that switchbacks up the escarpment, hand lettering, and monsoon clouds catching on the ridge. progress inks it from sea level up (a page can tie it to its own scroll); the pointer, or the keyboard hand in playful, reads the height of the ground as text.
- **kairi** {background, divider} -- A printed sari border drawn by a machine of spinning circles: each paisley's outline is a Fourier series, the chain grows one circle at a time until the pencil sketch sharpens, then the pen inks it and madder, indigo and turmeric fill it. Set progress from real work and the border is drawn exactly that far ("40% done"). Quiet is the finished border, warm draws it once and rests, playful draws border after border and slows near the pointer; Enter goes on to the next paisley.
- **kantar** {background, hero, interlude} -- The tiatr stage and curtain: painted proscenium with gold-fringed pelmet, footlights, orchestra pit, and three backdrops (church square, dusk beach, balcão night) behind a heavy red velvet curtain. Quiet is a lit still; warm rises once and rests; playful cycles through scenes, curtain drops, and kantars sung in the spotlight.
- **khazan** {background, hero} -- Fireflies over a Goan tidal wetland at night: some four hundred phase oscillators with Kuramoto coupling fall into step in slow waves, with additive glows and rippling reflections. Quiet is a still of a wave passing through the bank; warm lets them find each other; playful lets a hand scatter them. Set progress and the bank is exactly that far in step: a calm loader for syncs and uploads.
- **kolam** {hero, loader} -- One unbroken line of rice flour around a grid of dots, found with the mirror-curve method. Hairline ink in quiet, drawn once at a hand's pace in warm, poured by your hand with rangoli colour and ants in playful. The progress attribute draws it exactly that far.
- **mankurad** {story} -- A short story about a mango in coloured pencil: it ripens in the May heat while a koel calls, clouds come in, the first monsoon rain falls, and it drops into a puddle on red laterite. Hatched tone, boiling outlines, a noise-driven pendulum. Quiet is the plate's still; warm tells the story at an easy pace; playful tells it again on Enter. Set progress and the story holds at that beat, a gentle order or delivery tracker.
- **maun** {background, section-break} -- A colour field that paints itself in thin veils, rolled on and scraped back so a warm ground glows through, then rests with only a slow breath of light. Four palettes (turmeric, monsoon, kokum, indigo on lime); the same seed is always the same painting. A quiet background for words and a document cover; in playful, a click scrapes a band back. After V. S. Gaitonde's method, not his pictures.
- **mithagar** {empty-state, hero, progress} -- The Ribandar salt pans at dawn: a geometric grid of clay bunds, shallow brine reflecting the Goan sky, wooden sluice gates, crystalline white salt crusts, and pyramidal salt heaps. Evaporation recedes the brine and grows the harvest. Quiet is a crisp architectural grid; warm ripples the water; playful lets sandpipers scurry and clicks rake salt pyramids.
- **mosaico** {background, divider} -- The cement-tile floor of an old Goan balcão, seen from above: one Truchet tile laid in two turns, so the oxide-red bands join into long winding ribbons, worn and chipped under late window light. Now and then a tile lifts and turns and the ribbons re-route, and a small ant walks the pale line down one ribbon, following the new way. In playful, hover or Enter turns a tile and a click re-lays a patch. Dark pages get the same floor at night.
- **neel** {background, divider} -- Hand block printing on khadi cotton: a carved buti block generated from the seed is pressed one impression at a time, indigo outlines first, then a second colour off register, every impression a little starved and turned. Quiet is the finished length; warm prints it at an unhurried pace and rests; playful prints faster and presses where you click or press Enter. Set progress and exactly that share is printed: a loader that shows real work.
- **nod** {story} -- The helper that asks first: a cutting chai steams beside a phone on a marble café table; a message arrives, a helper drafts a reply in a dashed card with an empty tick, and it goes out only when a person nods. Warm plays one exchange with a finger's tap; playful waits for your click or Enter; quiet is the draft, waiting.
- **pahat** {background, hero} -- The desk at dawn: a barred window at half past four over a laptop and a steel tumbler. The sky goes from indigo to first light, the stars fade, the morning star holds on, the room comes out of the dark and a few birds cross; then it rests. Quiet is a hairline still; in playful your hand moves the dawn.
- **paus** {hero} -- The monsoon through a Goan window: rain beads, merges and runs down fogged glass. Hosts text in calm zones, clears from the sill up with progress, and wipes under a finger or the arrow keys.
- **posta** {empty-state, hero, progress} -- The Old Post Office in Fontainhas: a vintage rosewood sorting desk beneath an oyster shell carepa window with sunbeams, wooden cubbies holding jute-tied letter bundles, a crimson postbox with brass flap, and a brass balance scale.
- **prahar** {background, hero} -- A day over a Goan river village in the eight watches of raga time: the sky blended in OKLab, every land layer tinted to the light, the sun and moon on their arcs, lamps after dusk, and a ruler of the eight prahars with each raga in English and Devanagari. Set hour from the page's own clock for a theme that follows the viewer's day; in playful, drag the ruler. The raga-to-hour mapping is one common reckoning; traditions differ.
- **rampon** {background, hero} -- Dusk on the Goan shore: a ballpoint sea of short hatching strokes that boils like hand-drawn animation, a sun sinking into haze, palms swaying in seeded wind, a ramponkar's canoe with its net heaped inside, and a few distant birds. Quiet is a single still; warm boils gently; playful boils in full, a click draws a new evening, and a koel calls.
- **saanj** {background, hero} -- Dusk over flooded paddy: a sky mixed in OKLCH from apricot through rose to indigo, a line of ink palms, and a murmuration of six hundred rosy starlings flown by boids, which pours into the palms to roost and leaves at dawn. Quiet is one finished frame of the murmuration; warm an easier dusk with a smaller flock; playful makes the pointer, or the arrow keys, a hawk the flock parts around. The flock flies round slotted text.
- **shet** -- One year of a Goan paddy field seen from a low rise: cracked April mud, the first rain darkening it drop by drop, flooded plots, green rice combed by wind, ripe gold, the harvest, and the mud cracking again, with two cattle egrets that come with the water. Quiet is the ripening gold as a finished still, warm turns the year at an easier pace, playful gives the wind to the hand. Set progress and the field holds at that point of the year. A scape: the still loads first, the turning year after.
- **taverna** {background, empty-state, hero} -- Rain on bottle glass: a village taverna window on a rainy monsoon night with dark wooden bars, dark green wine bottles, a ceramic jug, and a slate blackboard. Outside, rain sweeps down a cobblestone alley under a glowing streetlamp; on the glass, warm indoor air condenses and raindrops trickle in delicate rivulets. Quiet is a crisp ink elevation; warm settles gracefully; playful chimes the bottles and wipes the misted glass.
- **themb** {background, divider} -- Rain on a taro leaf seen from above: a WebGL shader draws the velvet leaf, its inked veins and the beads as signed distance fields joined by a smooth minimum, each a lens over the leaf; a full 2D painting takes over when WebGL is missing, lost or too slow. Beads roll, merge keeping their area, gather in the cup, and the leaf pours them off its tip. Quiet is the still after a shower; warm an easier rain; playful tilts under the pointer or arrow keys, and Enter pours.
- **tinto** {background, hero} -- A crowded Goan village square at half past ten, where every figure has a line: the poder on his round, a fish seller and her cat, a card game under the tree, the bus to Mapusa. Point at anyone to read their line; every line is also real text for screen readers. Quiet is a still, warm an easy morning with a slow round of captions, playful the full square with a keyboard hand. For empty states and 404s (focus pins one line). With words="world", the page’s words are chalked on a board outside the Taverna and each shop hangs its hours on a plaque that opens its detail; quiet and small screens keep them flat.
- **tollem** {background, hero} -- Looking down into a Goan pool at noon: a WebGL net of light over pale tiles, a frangipani that drops a flower now and then, and a full 2D painting when WebGL is missing, lost or too slow. Quiets under text, shows progress as a flower's place across the pool, and ripples under a finger or the arrow keys.
- **toran** {divider, section-break} -- A Goan doorway on the morning of Chovoth, with a garland of marigolds and mango leaves strung across it from three nails: a Verlet rope that sags, swings in a noise breeze and settles. Quiet is the garland at rest with petals on the step; warm a gentle breeze; playful the full breeze, and the hand (pointer or arrow keys) brushes it, knocking petals loose that drift down and stay. Night with a lantern on dark pages.
- **vad** {background, hero} -- A banyan grows in pen and ink by space colonisation: branch tips reach for the nearest points of an umbrella canopy, limbs thicken by the pipe model, leaf masses are hatched over a green wash, and aerial roots drop and thicken into pillar trunks round a stone platform. Quiet is the grown tree; warm grows it slowly and lets the ink boil; playful grows a new one on Enter. Set progress and the tree grows exactly as far as the work has. With words="world", the page’s words are written in the sky beside the tree, each line ending where the canopy begins, and make room for it four times as it grows.
- **vahi** {story} -- The pile becomes a ledger: loose receipts, invoices, a bill book and a scrawled chit lift one at a time from a teak table, drift over an open account book while their line is written, and settle on a neat stack; then the book closes and its string is wound. Quiet is a hairline plan of the closed book and the stack; playful scatters the pile at a click. The progress attribute sorts exactly that much.
- **vel** {hero, section-break} -- A magenta bougainvillea grows from behind a laterite compound wall by a seeded L-system, arches up and spills down the lime-washed cap, drawn as inline SVG. Quiet is the grown vine as a still, warm grows it and lets a breeze move a few tips while a bract lets go now and then, playful stirs the branch under the hand and shakes bracts loose. For heroes and seasonal sections over a wall of text.
- **veranda** {background, hero} -- A Goan veranda drawn in ink and wash, seen from a seat on it: laterite pillars with a balcão between them, a teak door and a shuttered window in a lime-washed wall, a brass lamp under the rafters, and the garden and paddy beyond. The pillars' shadows are traced from the same solids as the drawing, and so is an exact depth map (white near, sky 0) that lets <sg-depth-photo treatment="drawn"> rack focus and walk the camera in. Quiet is a hairline still, warm sways the lamp, playful lets your hand move the sun, and the dark theme is dusk with the lamp lit. A scape: the still loads first.
<!-- inventory:scene:end -->

### Attributes

| Attribute | What it does |
|---|---|
| `name` | Which scene, by its registry name with the `scene-` prefix dropped (`kolam` for `scene-kolam`). See the full, generated list below. Required. |
| `register` | Overrides the inherited register for this scene. |
| `seed` | A number or a word. Same seed, same drawing. |
| `paused` | Present: start paused. Removing it plays again, unless the register or reduced motion calls for a still. |
| `label` | The accessible name of the drawing. Defaults to the scene's own description. Use it when the scene stands for something, such as "Upload progress". |
| every param | Each scene's params, as kebab-case attributes (below). |

Changing any attribute updates the scene with no glue code, so a server can drive it by swapping attributes (htmx works as it is). Numbers are clamped to their range, and an unreadable value falls back to the default. A bare boolean attribute is true; `false`, `0`, `off` and `no` are false. Removing a param attribute returns it to its default.

### Slotted content and the scrim

Put your words inside the element. They sit in a reading layer over the drawing, on a scrim that keeps them readable, and the scene quietens its motion around them (the calm zone).

```html
<sg-scene name="paus" register="warm">
  <h2>Come for the rain</h2>
  <p>Our lowest rate, June to September.</p>
</sg-scene>
```

- The scrim is `--sg-scrim`, with text in `--sg-scrim-ink` if you set it, else `--sg-text`.
- `--sg-reading-place` places the panel (default `end start`, bottom left). `--sg-reading-inset` sets its padding from the edge.
- Style the insides through `::part(panel)`, `::part(reading)`, `::part(stage)` and `::part(toggle)`.
- When the panel would cover more than 45% of the drawing's height (on a phone, usually), it moves below the drawing on the same scrim, and comes back over it under 40%.
- The panel hides itself when nothing is slotted. Keep slotted text short: a heading and a sentence or two. Long reading belongs outside the scene.
- The element sizes itself: it is a block as wide as its container, with the drawing held at the scene's aspect ratio. Size it with `width` or `max-width` in CSS.

### `progress` is real state

Kolam, Paus and Tollem each take `progress` from 0 to 1. Absent, time drives the scene. Set, only the real number moves it, time stands still, and the element says the same number in a polite status region, naming the work: `label="Upload progress"` gives "Upload progress: 40% done". Without a `label` it uses the scene's title ("The threshold at dawn: 40% done"), so always give a state scene a label. It speaks only when the sentence changes, at most once a second.

- Set `progress` only from real work: bytes uploaded, steps finished. Never animate it on a timer. A drawing that moves when the work has not moved is a lie.
- Remove the attribute (or `set({ progress: null })`) to hand the scene back to time.

### Methods, properties and events

| Member | What it does |
|---|---|
| `play()`, `pause()` | Start or stop motion. `play()` also works under reduced motion and in quiet, because the viewer asked. |
| `replay()` | From the start, and play. |
| `reseed(seed?)` | A new drawing: the seed you give, or the next one. |
| `set(params)` | Merge and coerce params, for example `set({ intensity: 0.3 })`. Calls made before the scene loads are kept. |
| `still()` | Draw the finished still and stop. |
| `destroy()` | Tear it down for good. |
| `playing` | True while frames are running. False off screen and in hidden tabs. |
| `wanted` | The viewer's intent: true after `play()`, false after `pause()` or `still()`. Use this, not `playing`, for a play/pause button's label. |
| `params`, `seed`, `meta` | Read only. `meta` has the scene's title, alt text, caption, prompt, map and logical size `W` × `H`. |
| `lastPointer` | The last pointer position the scene saw, in its own units, or `null`. |
| `sg-ready` event | After the first frame is drawn. Bubbles and crosses shadow roots. |
| `sg-state` event | When `wanted` or the still changes. `detail: { wanted, still, playing }`. |

What every scene does without being asked: pauses off screen and in hidden tabs; shows the still in quiet and under reduced motion; puts a native "Pause animation" button in the top right corner in warm and playful whenever it can move (WCAG 2.2.2); in playful, becomes focusable so the arrow keys move a pointer and Enter or Space acts; keeps running through `moveBefore()` and View Transitions; runs the quality governor so slow devices draw less detail.

### Kolam: the threshold at dawn

One unbroken line of rice flour looping around a grid of dots. Hairline ink in quiet, drawn once at a hand's pace on a red-oxide floor in warm, poured by your hand on laterite with rangoli colour and ants in playful. A kind loader.

| Param | Values | Default | What it does |
|---|---|---|---|
| `progress` | 0 to 1 | absent | Absent: time draws the kolam. Set: drawn exactly that far. |
| `grid` | 3 to 9 | absent | Dots across, rounded up to odd. Absent: the seed picks. |
| `palette` | `auto`, `flour`, `rangoli` | `auto` | `auto` is white flour in warm and coloured powder in playful. |

```html
<sg-scene id="upload" name="kolam" progress="0" label="Photo upload progress"></sg-scene>
<p id="upload-text">0 of 5 photos uploaded</p>
<script type="module">
  const kolam = document.getElementById('upload');
  // call this from your real upload code, never from a timer
  function onProgress(done, total) {
    kolam.setAttribute('progress', (done / total).toFixed(3));
    document.getElementById('upload-text').textContent = `${done} of ${total} photos uploaded`;
  }
</script>
```

Text slotted over a kolam moves the drawing aside into the largest clear space, so the words sit on clear floor.

### Paus: monsoon, through the glass

A Goan window in the monsoon. Rain beads on fogged glass, merges and runs; the palms lean in the wind. The heavy scene of the set, and the frame-time baseline for every other.

| Param | Values | Default | What it does |
|---|---|---|---|
| `intensity` | 0 to 1 | 0.8 | How hard it rains: beads, streaks outside, rings on the paddy. |
| `fog` | 0 to 1 | 0.8 | How thick the condensation is and how fast it creeps back. |
| `progress` | 0 to 1 | absent | Set: the fog clears from the sill up in step with it. |
| `wipe` | boolean | true | Pointer and keyboard wiping, and the passing hand in playful. |

```html
<!-- a hero that hosts text; rain stays off the words -->
<sg-scene name="paus" register="warm" intensity="0.6">
  <h2>Come for the rain</h2>
  <p>Our lowest rate, June to September.</p>
</sg-scene>

<!-- a gentle drizzle, no wiping, on a quiet page that wants one living thing -->
<sg-scene name="paus" register="warm" intensity="0.3" fog="0.5" wipe="false"></sg-scene>
```

In a dark theme the same window is painted at dusk, with a lamp lit inside.

### Tollem: the pool at noon

Looking down into a Goan pool at noon: a moving net of light over pale tiles, and a frangipani that drops a flower now and then. WebGL, with a full 2D painting when WebGL is missing, lost or too slow.

| Param | Values | Default | What it does |
|---|---|---|---|
| `swell` | 0 to 1 | 0.5 | How much the surface moves. 0 is a still pool with only the net of light. |
| `flowers` | boolean | true | Whether the tree drops flowers. |
| `palette` | `seed`, `aqua`, `sky`, `celadon` | `seed` | Tile and flower colours. `seed` lets the seed choose. |
| `touch` | boolean | true | Ripples from pointer and keyboard, in playful. |
| `progress` | 0 to 1 | absent | Set: one flower sits that far along an arc across the pool. |
| `renderer` | `auto`, `webgl`, `2d` | `auto` | `2d` always paints on a canvas; `webgl` keeps the shader even when frames are slow. |

```html
<sg-scene name="tollem" register="warm">
  <h2>Swim before lunch</h2>
  <p>The pool is open from seven. Towels are by the steps.</p>
</sg-scene>

<!-- booking progress, three steps of five done -->
<sg-scene name="tollem" progress="0.6" label="Booking progress"></sg-scene>

<!-- playful: touch the water, or use the arrow keys and Enter -->
<sg-scene name="tollem" register="playful" swell="0.7"></sg-scene>
```
