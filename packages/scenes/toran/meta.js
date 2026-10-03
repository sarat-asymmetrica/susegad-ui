// Toran: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in toran.prompt.md (prompts.test.js checks).
import { W, H, STILL_TIME } from './model.js';

export const meta = {
  id: 'toran',
  title: 'The doorway on the morning of Chovoth',
  word: 'Toran',
  gloss: 'Hindi and Marathi: the garland strung across a doorway for a festival',
  alt: 'A Goan doorway on a festival morning: an ochre wall, a lime-washed frame and a closed teak door, with a garland of orange and saffron marigolds and mango leaves strung across the top from three nails, a pair of chappals on the step and a few fallen petals.',
  caption:
    'Marigolds and mango leaves are strung across the doorway for Chovoth, and someone has just gone inside. The garland is a chain of points that remember where they were a moment ago, held to three nails, so it sags and swings the way string does. A breeze keeps it moving. In playful, brush it with the cursor and it swings and settles; brush it hard and a few petals come loose and drift down to the step, where they stay.',
  keys: 'Arrow keys move a hand through the garland and brush it. Enter or Space sweeps the hand through the garland, one way and then the other.',
  W, H, seed: 1, stillTime: STILL_TIME,
  tier: 'shared',
  credit: 'The toran of marigolds and mango leaves hangs over doorways across India for festivals and weddings; in Goa, for Chovoth (Ganesh Chaturthi). Quoted here as a doorway on a festival morning, drawn with care, never as decoration for its own sake.',
  techniques: ['physics', 'interaction', 'noise', 'particles', 'texture', 'calm'],
  prompt:
    'Draw a Goan doorway on the morning of Ganesh Chaturthi, in canvas JavaScript with no image files: an ochre wall under the eave shadow, a lime-washed door frame with a cornice, a closed teak double door with raised panels, a laterite step with a pale stone top, and the red oxide seats of the balcão on either side. Across the top of the frame, string a toran of marigolds and mango leaves from three nails: two sagging swags and three shorter strands hanging down. Simulate it with Verlet ropes: each flower is a particle that remembers its previous position, and distance constraints between neighbours are solved several times a frame, with the nails pinned. Hang each mango leaf on its own little stick so it swings as a pendulum. Build the marigolds from layers of small ruffled petals in orange and saffron, and light them from one side. Move the whole garland with a soft breeze from Perlin noise. When the pointer brushes it, let it swing and settle, and if the brush is hard, knock a few petals loose to flutter down and stay on the step. Start as if someone has just stepped inside and brushed the strands. Make the whole garland a pure function of the seed, the time and the hand’s strokes, stepped in fixed slices of time so the same strokes always give the same swing. Give it three registers: quiet is the garland hanging at rest with a few petals already on the step, warm is a gentle breeze, and playful is the full breeze with the hand, where the arrow keys move a hand through it and Enter sweeps the hand through the strands. Where the page puts its own words over the doorway, let the breeze die down around them.',
  map: [
    ['Simulate it with Verlet ropes', 'physics', 'Each flower stores where it is and where it was a moment ago; the difference is its speed. After gravity and wind move everything, the gaps between neighbours are corrected back to their length a dozen times, and that alone makes a string that sags, swings and settles.'],
    ['Hang each mango leaf on its own little stick', 'physics', 'A leaf is one more particle tied to its flower by a single fixed length. It catches more wind than a flower does, so the leaves flutter while the heavy marigolds only sway.'],
    ['a soft breeze from Perlin noise', 'noise', 'The wind is smooth noise read over time and position, with slower noise deciding when gusts come, so the sway never repeats and neighbouring flowers move together. Warm turns it down to 55%.'],
    ['if the brush is hard, knock a few petals loose', 'interaction', 'The hand’s speed is measured every frame. Particles within 42 units of its path get part of that speed, and above 800 units a second the flowers it touched shed petals. The keyboard hand, and its sweep on Enter, are capped at 700, a firm brush that never sheds.'],
    ['flutter down and stay on the step', 'particles', 'A loose petal is a tiny particle with gravity, air drag and a sideways wobble. When it lands it is painted into a layer on the step, so it stays there.'],
    ['layers of small ruffled petals in orange and saffron', 'texture', 'Each marigold is about sixty frilled petals, dark at the rim and bright at the heart, drawn once into a small sprite. A separate shading sprite is laid on top unturned, so the light stays put while the flower rolls.'],
    ['stepped in fixed slices of time', 'model', 'The garland advances in steps of 1/120 s from the start, memoised, so a playing scene only pays for the steps since its last frame. Each stroke is fed in at the step its moment falls in, and petals shed on a seeded clock, so a replay gives the same swing.'],
    ['let the breeze die down around them', 'calm', 'Within 60 units of the page’s text the wind is turned down by 85% and no petal lets go by itself, so the words sit under a garland that barely stirs.'],
  ],
};
