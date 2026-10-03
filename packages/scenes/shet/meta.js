// Shet: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in shet.prompt.md (prompts.test.js checks).
import { W, H, STILL_AT } from './model.js';

export const meta = {
  id: 'shet',
  title: 'One year of a paddy field',
  word: 'Shet',
  gloss: 'Marathi and Konkani: a field, here a paddy field in April',
  alt: 'A Goan paddy field seen from a low rise, divided by earth bunds and receding to a line of coconut palms, through one year: cracked dry mud, the first rain, flooded plots, green rice combed by wind, ripe gold, harvest.',
  caption:
    'In April the field is bare mud baked into plates, with last year’s stubble still standing in rows. The first rain darkens it one drop at a time until the cracks close, water gathers in the low places, and the seedlings go in. Wind combs the rice in waves; it ripens gold, is cut, and the mud cracks again. In playful, move across the field and the wind follows you. Set progress and the field holds at that point of the year.',
  keys: 'Arrow keys move a hand over the field and the wind follows it. Enter or Space sends a gust across the rice.',
  W, H, seed: 1, stillTime: STILL_AT,
  tier: 'local',
  credit: 'Drawn from the paddy fields of Goa through a monsoon year, with the cattle egrets that follow the water and the harvest.',
  techniques: ['fields', 'noise', 'seed', 'particles', 'interaction', 'state', 'calm'],
  prompt:
    'Draw a Goan paddy field through one year, in canvas JavaScript with no image files, seen from a low rise so the plots recede in perspective toward a line of coconut palms. Divide it with raised earth bunds. In April the mud is dry and cracked into plates: generate the cracks as a Voronoi diagram from seeded points, big cells first and then finer cells inside each one, and make the older, bigger cracks darker and wider. Leave rows of pale stubble from the last harvest. Then bring the first monsoon rain: drops darken the soil in spots until it is all wet and the cracks close, water gathers in the lowest cells and then covers each plot, and green seedlings rise in rows. Comb every blade with a noise flow field and send gusts across the field as visible waves. Let the rice ripen to harvest gold, cut it, and let the mud dry and crack again, slowly, as if nothing could stop it. Let the wind follow the pointer so the viewer can bend the field. Give it three registers: quiet is the ripening gold as a finished still, warm turns the year at an easier pace, and playful gives the wind to the pointer and the arrow keys. Give it a progress attribute: when it is set, the field holds at that point of the year and the number is said in words. Where words sit over the field, hold the picture under them still.',
  map: [
    ['a Voronoi diagram from seeded points, big cells first and then finer cells inside each one', 'fields', 'Every plate of mud is the set of ground closer to one seeded point than to any other. The big cells are split again by finer points, and each edge remembers which level made it, so an old crack can be cut wider than a young one.'],
    ['drops darken the soil in spots', 'particles', 'Each drop lands at a seeded time and place and stamps a dark spot into a small wetness mask. The wet mud shows through the mask, so the field darkens drop by drop.'],
    ['Comb every blade with a noise flow field', 'fields', 'Perlin noise gives the wind a direction at every point that drifts slowly over time, so neighbouring clumps lean together and distant ones lean their own way. The near rows are redrawn leaf by leaf 24 times a second in warm and 30 in playful.'],
    ['send gusts across the field as visible waves', 'noise', 'A gust is a narrow band of stronger wind travelling across the ground plane, its front bent by noise. Blades inside the band bow and turn their pale undersides up, which is how you see wind on a real paddy.'],
    ['Let the wind follow the pointer', 'interaction', 'The pointer is mapped back onto the ground. Clumps near it bend the way it is moving, and the prevailing wind slowly swings round to follow. Enter or Space sends a gust from the keyboard hand.'],
    ['seen from a low rise so the plots recede in perspective', 'seed', 'Everything is laid out on a flat ground plane in metres and divided by distance to draw it. The seed moves the bunds, the crack points and the rows, so every field is a different field.'],
    ['the field holds at that point of the year', 'state', 'progress 0 is the dry April field and 1 the field dry again after the harvest. With it set, time stands still, the scene rests, and the status says how far through the year it is.'],
    ['hold the picture under them still', 'calm', 'Under the page’s text boxes, and 30 units round them, the field is shown as it was at the start of each six-second step of the year, so the words sit on a picture that does not move while the season turns round them.'],
  ],
};
