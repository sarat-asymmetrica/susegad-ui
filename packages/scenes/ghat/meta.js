// Ghat: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in ghat.prompt.md (prompts.test.js checks).
import { W, H, STILL_TIME } from './model.js';

export const meta = {
  id: 'ghat',
  title: 'A survey of the ghats',
  word: 'Ghat',
  gloss: 'Marathi and Konkani: a mountain pass, and the Sahyadri range above Goa',
  alt: 'An old survey sheet of the Western Ghats above Goa: brown contour lines climbing from the sea to a high ridge, a river winding down to the coast, a dotted road switchbacking up the escarpment, and hand-lettered names.',
  caption:
    'A survey sheet of the Western Ghats where they drop to the Goan coast. The hills are made from noise, the contours are traced out of it, and the river finds its own way down to the sea. The sheet inks itself from sea level up, then the river, the road and the names; a page can tie that to its own scroll through progress. Monsoon clouds come in off the sea and catch on the ridge. Point at the ground to read its height.',
  keys: 'Arrow keys move a hand over the sheet and say the height of the ground under it.',
  W, H, seed: 1, stillTime: STILL_TIME,
  tier: 'local',
  credit: 'Drawn after the old survey sheets of the Western Ghats. The ground is invented from noise; the names (the Mhadei and the Mandovi, the Arabian Sea, the Sahyadri) are real, but the shapes are not a map of them.',
  techniques: ['fields', 'emergence', 'state', 'particles', 'interaction', 'noise', 'calm'],
  prompt:
    'Draw a topographic survey sheet of the Western Ghats above Goa in canvas JavaScript, with no image files. Build a height field from seeded fractal noise: a low coastal plain in the west, a steep escarpment cut by gullies, and a high ridge in the east, with the sea beyond the coast. Extract contour lines every 50 metres with marching squares, draw every fifth one heavier with small handwritten elevation labels, and add hachures where the slope is steep. Give the sea a pale wash with a few ripple lines along the shore. Let water find its own way: fill the pits, follow the steepest descent, and trace the river that collects the most water down to the sea, then letter its name along its course. Add a dotted ghat road that switchbacks up the escarpment. Give it a progress attribute from 0 to 1 that inks the contours from sea level upward, then the river, then the labels, so a page can tie the drawing to its own scroll; without it, ink the sheet on a clock. Let monsoon clouds drift in from the sea and pile up against the ridge, and keep them and the names off any words laid over the sheet. Show the height under the pointer as a pencilled note and highlight that contour, and say it as text when the arrow keys move a hand over the sheet. Give it three registers: quiet is the inked sheet as a still, warm inks it and lets the clouds drift, playful adds the keyboard hand.',
  map: [
    ['Extract contour lines every 50 metres with marching squares', 'fields', 'The height field is sampled on a grid of 6-unit cells. Each grid square is tested against a level, and one of sixteen cases says where the line crosses it. Joining the pieces gives the contour lines.'],
    ['fill the pits, follow the steepest descent', 'emergence', 'A priority flood raises every hollow until water can escape. Then each cell drains to its steepest neighbour, and adding up what flows through each cell reveals the river network. Nobody places the river.'],
    ['a dotted ghat road that switchbacks up the escarpment', 'emergence', 'The road is a shortest-path search that refuses any stretch steeper than 11% and pays heavily for anything near it. The hairpins appear on their own, where going straight up costs more than turning.'],
    ['inks the contours from sea level upward', 'state', 'Progress becomes a rising height threshold. A mask shows the land wherever its place in the reveal is below the front, so the ink seems to climb the hills. With progress set, time stands still and the status says how far the sheet is inked; without it, the sheet inks itself in 22 seconds in warm and 14 in playful.'],
    ['pile up against the ridge', 'particles', 'Each cloud drifts east and slows as the ground under it rises, so they bunch against the escarpment the way the monsoon does.'],
    ['keep them and the names off any words laid over the sheet', 'calm', 'The page reports where its text sits. A cloud, a spot height or a name within reach of those boxes is not drawn.'],
    ['Show the height under the pointer', 'interaction', 'The pointer position is read back from the height grid and rounded to the nearest contour, which is drawn again in red pencil. The keyboard hand’s height is said once in a polite live region.'],
  ],
};
