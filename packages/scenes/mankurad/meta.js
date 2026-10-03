// Mankurad: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in mankurad.prompt.md (prompts.test.js checks).
import { W, H, STILL_LT } from './model.js';

export const meta = {
  id: 'mankurad',
  title: 'A short story about a mango',
  word: 'Mankurad',
  gloss: 'Goa’s own mango, the one every Goan waits for in May',
  alt: 'A coloured-pencil drawing of a ripening mango hanging from a branch of long mango leaves, with a koel on the branch, a sun, and red laterite ground below.',
  caption:
    'A mango ripens in the May heat while a koel calls from the branch. The clouds come in, the first rain of the monsoon arrives, and the mango lets go into a puddle on the red laterite. Every leaf, raindrop and pencil stroke is drawn by JavaScript, frame by frame. Set progress and the story holds at that beat, from the ripening fruit to the card after the rain.',
  keys: 'Enter or Space tells the story again from the start.',
  W, H, seed: 1, stillTime: STILL_LT,
  tier: 'local',
  credit: 'The mankurad (malcorada) is Goa’s own mango, ripe in May before the monsoon; the koel’s call is the sound of the Indian summer.',
  techniques: ['hatch', 'boil', 'easing', 'noise', 'particles', 'texture', 'state', 'calm'],
  prompt:
    'Make a quiet, 45-second animated short in canvas JavaScript, drawn to look like coloured pencil on cream handmade paper, with faint diagonal bands of sunlight. A single Goan Mankurad mango hangs from a branch of long drooping leaves while a koel calls and flies off. Build tone from hatching, not gradients: pack the strokes tighter on the shadow side and let a red blush cross-hatch the cheek. Give every outline a slight ink wobble and re-roll it about ten times a second so the drawing breathes like hand-drawn animation. Then tell the story on a timeline: grey hatched clouds drift in, noise-driven gusts swing the mango like a pendulum, the first monsoon rain falls as diagonal streaks, and the mango drops into a puddle on red laterite with a soft bounce and spreading ripples. Cache the paper and ground so each frame stays cheap. Keep the whole story a pure function of its own clock, stepping the pendulum at fixed sixtieths, so a progress attribute can hold it at any beat, from the ripening fruit to the card after the rain. Keep the rain and the words off any text laid over the drawing.',
  map: [
    ['tone from hatching, not gradients', 'hatch', 'Light and shadow are how many short strokes land in each spot. A density function makes strokes likelier on the shadow side, so tone emerges from marks.'],
    ['re-roll it about ten times a second', 'boil', 'The wobble’s random seed changes ten times a second, cycling through three variants, so outlines shimmer the way traced animation drawings do. Each hatched shape is painted once per variant into a sprite, so a frame is a handful of drawImage calls.'],
    ['tell the story on a timeline', 'easing', 'Each beat is a window of time. phase(t, start, end) turns the clock into 0→1 dials that fade clouds in, ramp the rain and release the fruit at 28.6 s of a 46 s story.'],
    ['noise-driven gusts swing the mango like a pendulum', 'noise', 'Wind is smooth Perlin noise fed as a push into a tiny spring simulation, so the sway builds and settles instead of jittering.'],
    ['diagonal streaks', 'particles', 'Three hundred and twenty raindrops, each just a start position and a speed, wrapped around the frame. Rain intensity only decides how many get drawn; a slow machine draws half.'],
    ['stepping the pendulum at fixed sixtieths', 'state', 'The swing is computed once for the whole story and remembered, and the fall starts from where it hung at 28.6 s. With progress set, the story sits at that beat (1.3 s to 40.5 s), time stands still, and the status says the percentage.'],
    ['Keep the rain and the words off any text laid over the drawing', 'calm', 'A raindrop, a ring or a splash that would cross the page’s text boxes is not drawn, and the drawn words hide when they would sit under them.'],
  ],
};
