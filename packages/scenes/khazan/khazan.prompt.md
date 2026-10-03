# Khazan

*Konkani: Goa’s old tidal wetlands, reclaimed for paddy behind earthen bunds and sluice gates.*

Some four hundred fireflies in the mangroves, each blinking on its own clock. Every firefly watches only its neighbours and nudges its rhythm toward theirs, and within half a minute the whole bank is flashing together in slow waves. Nobody leads. In playful, move through the swarm to scatter them, then watch them find each other again. Set progress and the bank falls into step exactly as far as the work has gone.

```html
<script type="module" src="susegad/scenes/khazan/index.js"></script>

<!-- a sync in progress: the bank falls into step as the work is done -->
<sg-scene id="sync" name="khazan" progress="0" label="Syncing your bookings"></sg-scene>
<script type="module">
  // call this from your real sync, never from a timer
  const sync = document.getElementById('sync');
  function onProgress(done, total) { sync.setAttribute('progress', (done / total).toFixed(3)); }
</script>

<!-- playful: move through the swarm, or use the arrow keys and Enter -->
<sg-scene name="khazan" register="playful"></sg-scene>
```

| Param | Values | Default | What it does |
|---|---|---|---|
| `progress` | 0 to 1 | absent | Absent: the swarm lives by itself and falls into step in about half a minute. Set: the bank is exactly that far in step, the corner reads "40% done", and the status says it in words. |

## The prompt

Paint a moonless night over a Goan khazan wetland in canvas JavaScript: a deep indigo sky, a far bank of coconut palms, dark mangrove clumps with arching prop roots, an earthen bund running into still water that mirrors everything. Draw the silhouettes once with slightly wobbly ink edges into a cached layer. Then add about 400 fireflies living in the mangrove canopies. Model each one as a phase oscillator with its own natural frequency, and use Kuramoto coupling: every frame, nudge each firefly’s phase toward the phases of neighbours within a small radius, found with a spatial grid. Flash when the phase passes zero. Render glows as soft radial-gradient sprites with additive blending, plus stretched, rippling reflections in the water. When the pointer moves through the swarm, scramble nearby phases and push the fireflies aside. In a corner, write how in step the swarm is, from the order parameter, in a small handwritten style. Give it a progress attribute: when it is set, place every firefly’s phase that far from its own scattered phase toward a travelling wave, so the bank is exactly as in step as the work is done, and write the percentage instead. Keep the quiet register a still of a wave passing through the bank, and let the fireflies under any words on the page glow low and steady.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| Kuramoto coupling | emergence | The only rule is “drift toward your neighbours’ rhythm.” Global synchrony, and the travelling waves, are never programmed; they emerge. The swarm is stepped in fixed sixtieths of a second, so the same seed always falls into step the same way. |
| neighbours within a small radius, found with a spatial grid | particles | Checking every firefly against every other is slow. Bucketing them into grid cells 70 units wide means each one only looks at the few nearby. |
| soft radial-gradient sprites with additive blending | texture | One glow is drawn once into a tiny canvas and stamped hundreds of times. “Lighter” blending makes overlapping glows add up, so a synchronised clump blooms. The wide halos go into a quarter-resolution layer; on a slow machine the governor drops the reflections, then the halos. |
| scramble nearby phases and push the fireflies aside | interaction | The pointer injects disorder within 130 units. Watching the swarm re-synchronise afterwards is the clearest way to see the coupling at work. In playful the arrow keys move a hand and Enter sweeps it through. |
| slightly wobbly ink edges | noise | Silhouette outlines are pushed in and out by smooth noise, so the trees read as drawn rather than computed. |
| so the bank is exactly as in step as the work is done | state | With progress set, the phases come from the number alone and everyone blinks at one shared rate, so the pattern of synchrony never drifts while the work stands still. The status says the percentage in words. |
| let the fireflies under any words on the page glow low and steady | calm | A firefly within 60 units of a text box, and any reflection that would land there, is drawn at a low steady glow instead of flashing, and no halo is laid within 90 units, so no light spills onto the words. |

## Accessibility

The drawing's name is its `alt`. With `progress` set, the element says the percentage in a polite status region, at most once a second. The fireflies flash slowly (under once a second each) and never strobe the whole frame; the pause button stops them. In playful the drawing takes focus: the arrow keys move a hand drawn as a faint ring, and Enter or Space sweeps it through the fireflies there. Fireflies under any words on the page glow low and steady.

## Credit

The khazans are Goa's tidal wetlands, farmed for centuries behind bunds and sluice gates by village communities. "Khazan" and its gloss are on the owner's confirm list for a Konkani reader.
