// Saanj: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in saanj.prompt.md (prompts.test.js checks).
import { W, H, STILL_TIME } from './model.js';

export const meta = {
  id: 'saanj',
  title: 'The hour the birds come home',
  word: 'Saanj',
  gloss: 'Hindi and Marathi: dusk, the hour the birds come home',
  alt: 'Dusk over flooded paddy fields: a sky going from apricot to rose to indigo, a line of coconut palms in ink, and a murmuration of starlings wheeling above them.',
  caption:
    'Rosy starlings winter in India in huge flocks, and at dusk they pour over the fields before dropping into the palms for the night. Each bird follows three rules about its neighbours and one about home. The sky darkens from apricot through rose to indigo and the stars come out one at a time. In the playful register, move over the flock to be the hawk: it parts around you and a dark wave runs through it.',
  keys: 'Arrow keys fly a hawk over the flock, which parts around it. Enter or Space startles the birds near the hawk.',
  W, H, seed: 1, stillTime: STILL_TIME,
  tier: 'pan-Indian',
  credit: 'Rosy starlings (Pastor roseus) winter across India, Goa included, and roost in their thousands in palms and reeds at dusk. The flock follows the classic boids rules (1987); the stars are spaced by Poisson-disc sampling.',
  techniques: ['emergence', 'colour', 'fields', 'particles', 'interaction', 'noise', 'calm', 'governor'],
  prompt:
    'Draw dusk over Goan paddy fields in canvas JavaScript, with no image files: a flat horizon, flooded plots that mirror the sky, and a line of coconut palms in wobbly ink silhouette. Mix the sky gradient in OKLCH, converting the colours yourself, so it runs apricot to rose to indigo with no muddy middle, and let it darken over a slow cycle. Fly a murmuration of several hundred rosy starlings with boids: separation, alignment and cohesion with nearby birds found through a spatial grid, a pull along a wandering path so the flock stretches and folds, and a little noise so no bird is perfectly obedient. Draw each bird as a tiny ink tick that thickens and thins with its heading and banking, so the density of the flock shimmers as it turns. As the light goes, place stars with Poisson-disc sampling so they are evenly but naturally spaced, and fade them in one at a time. Then let the flock pour down into the palms to roost, hold the night, and send the birds out again at dawn. Let the pointer be a hawk-shaped absence the flock parts around, with a wave of alarm running through the birds. Give it three registers: quiet is one finished frame of the murmuration as the light goes, warm is an easier dusk with a smaller flock, and playful brings the hawk, with the arrow keys flying it and Enter startling the birds beside it. Where the page puts its own words over the sky, let the flock fly round them, and when frames run slow, fly fewer birds.',
  map: [
    ['separation, alignment and cohesion with nearby birds', 'emergence', 'No bird knows the shape of the flock. Each one steers away from birds that are too close, matches the heading of its neighbours and drifts towards their middle, and the murmuration appears from those three rules.'],
    ['found through a spatial grid', 'particles', 'The birds are sorted into square cells of 24 units every step, so each one only checks the nine cells around it instead of all six hundred and twenty birds.'],
    ['Mix the sky gradient in OKLCH, converting the colours yourself', 'colour', 'The sky colours are converted to OKLab, a space built so equal steps look equal, and blended by lightness, chroma and hue there. Blending apricot and indigo in plain RGB passes through grey; in OKLCH it passes through rose. A dark page gets the same evening later on, never an inverted one.'],
    ['place stars with Poisson-disc sampling', 'fields', 'The method throws candidate points around existing stars and keeps one only if nothing is closer than 34 units, which gives the even but unruly spacing of a real sky.'],
    ['thickens and thins with its heading and banking', 'noise', 'Each tick’s width comes from its heading plus how hard it is turning, so when the flock wheels together a band of it darkens at once, the way a real murmuration flickers.'],
    ['a hawk-shaped absence the flock parts around', 'interaction', 'The hawk is six capsules (body, swept wings, primaries, tail). Birds within 60 units of that shape flee along it, and those within 34 pass their alarm to their neighbours, so a dark wave ripples outward.'],
    ['let the flock fly round them', 'calm', 'The page reports where its words sit. A bird inside one of those boxes, grown by 28 units, is pushed out through the nearest edge, so the flock streams round the text; birds going home to the palms keep their line.'],
    ['fly fewer birds', 'governor', 'The flock is stepped and drawn only up to the governor’s share of its birds, never fewer than 120: all 620 at full quality in playful, 496 in warm.'],
  ],
};
