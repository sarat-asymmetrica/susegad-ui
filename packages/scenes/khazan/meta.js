// Khazan: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in khazan.prompt.md (prompts.test.js checks).
import { W, H } from './model.js';

export const meta = {
  id: 'khazan',
  title: 'Fireflies over the khazan',
  word: 'Khazan',
  gloss: 'Konkani: Goa’s old tidal wetlands, reclaimed for paddy behind earthen bunds and sluice gates',
  alt: 'A moonless night over a Goan tidal wetland: palms on the far bank, dark mangroves, an earthen bund with a small sluice gate, still water, and hundreds of fireflies glowing in the mangroves and their reflections.',
  caption:
    'Some four hundred fireflies in the mangroves, each blinking on its own clock. Every firefly watches only its neighbours and nudges its rhythm toward theirs, and within half a minute the whole bank is flashing together in slow waves. Nobody leads. In playful, move through the swarm to scatter them, then watch them find each other again. Set progress and the bank falls into step exactly as far as the work has gone.',
  keys: 'Arrow keys move a hand through the swarm. Enter or Space sweeps it through the fireflies there.',
  W, H, seed: 1, stillTime: 0,
  tier: 'local',
  credit: 'The khazans are Goa’s tidal wetlands, farmed for centuries behind bunds and sluice gates by village communities; fireflies gather in their mangroves after the rains.',
  techniques: ['emergence', 'particles', 'interaction', 'noise', 'texture', 'state', 'calm'],
  prompt:
    'Paint a moonless night over a Goan khazan wetland in canvas JavaScript: a deep indigo sky, a far bank of coconut palms, dark mangrove clumps with arching prop roots, an earthen bund running into still water that mirrors everything. Draw the silhouettes once with slightly wobbly ink edges into a cached layer. Then add about 400 fireflies living in the mangrove canopies. Model each one as a phase oscillator with its own natural frequency, and use Kuramoto coupling: every frame, nudge each firefly’s phase toward the phases of neighbours within a small radius, found with a spatial grid. Flash when the phase passes zero. Render glows as soft radial-gradient sprites with additive blending, plus stretched, rippling reflections in the water. When the pointer moves through the swarm, scramble nearby phases and push the fireflies aside. In a corner, write how in step the swarm is, from the order parameter, in a small handwritten style. Give it a progress attribute: when it is set, place every firefly’s phase that far from its own scattered phase toward a travelling wave, so the bank is exactly as in step as the work is done, and write the percentage instead. Keep the quiet register a still of a wave passing through the bank, and let the fireflies under any words on the page glow low and steady.',
  map: [
    ['Kuramoto coupling', 'emergence', 'The only rule is “drift toward your neighbours’ rhythm.” Global synchrony, and the travelling waves, are never programmed; they emerge. The swarm is stepped in fixed sixtieths of a second, so the same seed always falls into step the same way.'],
    ['neighbours within a small radius, found with a spatial grid', 'particles', 'Checking every firefly against every other is slow. Bucketing them into grid cells 70 units wide means each one only looks at the few nearby.'],
    ['soft radial-gradient sprites with additive blending', 'texture', 'One glow is drawn once into a tiny canvas and stamped hundreds of times. “Lighter” blending makes overlapping glows add up, so a synchronised clump blooms. The wide halos go into a quarter-resolution layer; on a slow machine the governor drops the reflections, then the halos.'],
    ['scramble nearby phases and push the fireflies aside', 'interaction', 'The pointer injects disorder within 130 units. Watching the swarm re-synchronise afterwards is the clearest way to see the coupling at work. In playful the arrow keys move a hand and Enter sweeps it through.'],
    ['slightly wobbly ink edges', 'noise', 'Silhouette outlines are pushed in and out by smooth noise, so the trees read as drawn rather than computed.'],
    ['so the bank is exactly as in step as the work is done', 'state', 'With progress set, the phases come from the number alone and everyone blinks at one shared rate, so the pattern of synchrony never drifts while the work stands still. The status says the percentage in words.'],
    ['let the fireflies under any words on the page glow low and steady', 'calm', 'A firefly within 60 units of a text box, and any reflection that would land there, is drawn at a low steady glow instead of flashing, and no halo is laid within 90 units, so no light spills onto the words.'],
  ],
};
