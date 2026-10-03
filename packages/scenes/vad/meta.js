// Vad: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in vad.prompt.md (prompts.test.js checks).
import { W, H } from './model.js';

export const meta = {
  id: 'vad',
  title: 'A tree that grows its own pillars',
  word: 'Vad',
  gloss: 'Marathi: the banyan, India’s national tree, and the village’s shade, meeting place and landmark',
  alt: 'A banyan in pen and ink on handmade paper: a wide umbrella of leafy limbs over a round stone platform, aerial roots hanging from the branches, a few thickened into pillar trunks, and a bicycle leaning on the platform.',
  caption:
    'The branches are not drawn. They are grown: invisible points fill the shape of a canopy, and every branch tip reaches toward the points nearest it until the space is claimed. Then the banyan does what only a banyan does. Roots drop from its limbs, a few reach the ground and slowly thicken into new trunks, which is how one tree becomes a grove. Set progress and the tree grows exactly as far as the work has gone.',
  keys: 'Enter or Space grows a new banyan.',
  W, H, seed: 1, stillTime: 90,
  tier: 'pan-Indian',
  credit: 'The banyan and the stone platform round its trunk (the katta or par) are the village meeting place across India; the tree is drawn in pen and ink the way a book illustrator would.',
  techniques: ['emergence', 'seed', 'wobble', 'hatch', 'boil', 'state', 'calm'],
  prompt:
    'Grow a banyan tree in pen and ink on handmade paper, in canvas JavaScript. Use the space-colonization algorithm: scatter about a thousand attractor points inside a wide, umbrella-shaped canopy, start a short stout trunk that splits into two or three leaders, and let every branch tip grow a small step toward the attractors nearest it, deleting attractors once a branch reaches them. Record the step at which each node was born, and replay the growth over about twenty seconds. Thicken limbs with the pipe model, so a parent’s thickness follows from its children’s. Draw thin branches as wobbly ink ribbons, and thick ones as outlines with hatching on the shaded side. Suggest leaf masses with short hatch strokes over a pale green wash. Then drop aerial roots from the limbs in hanging bunches; let a few reach the ground and thicken into new pillar trunks. Add a stone platform around the trunk and a bicycle leaning on it for scale. Redraw at twelve frames a second with the wobble re-rolled, so the ink boils gently. Give it a progress attribute that holds the growth exactly that far along, three registers (quiet shows the grown tree, warm grows it slowly, playful grows a new one on Enter), and show the grown tree, still, under any words laid over it. When the page asks for words in the world, write its own words in the sky beside the tree, each line ending where the canopy begins, and let the paragraph make room as the tree grows.',
  map: [
    ['space-colonization algorithm', 'emergence', 'No branch is placed by hand. Each tip only asks “which attractors are nearest me?”, and the whole branching structure emerges from that.'],
    ['Record the step at which each node was born', 'seed', 'The tree is grown instantly and completely from a seed, then replayed in birth order. The growth animation is just a filter: show the nodes born before now. The whole replay, roots and pillars included, takes about 36 seconds (45 in warm).'],
    ['outlines with hatching on the shaded side', 'hatch', 'Big limbs get two contour lines and diagonal strokes on the side away from the light, the way a pen illustrator models form.'],
    ['wobbly ink ribbons', 'wobble', 'Every branch is a filled ribbon whose edges drift with smooth noise and whose width breathes, so no line is ruler-straight.'],
    ['twelve frames a second with the wobble re-rolled', 'boil', 'While it grows, the tree is redrawn only on a twelve-a-second beat. Once it is grown, three boil variants are painted once and cycled 3 times a second in warm and 4 in playful, so the finished drawing shimmers for the cost of one image.'],
    ['a progress attribute that holds the growth exactly that far along', 'state', 'With progress set, the moment of the growth comes from the number alone: 0 is the bare platform, 1 the grown tree with its pillars. Time never moves it, and the status says the percentage.'],
    ['show the grown tree, still, under any words', 'calm', 'The page reports where its text sits; inside those boxes, and 20 units round them, the first finished variant is drawn over the growing tree, so the words never sit on moving ink.'],
    ['write its own words in the sky beside the tree', 'calm', 'With words="world", the type tier (Pretext) lays each line from a fixed margin to the canopy’s edge, one width per line, at the largest size you can read; the words stay real text. The paragraph is laid again only four times while the tree grows, each time against the canopy as it will be when that quarter of the growth ends, so no leaf ever grows under a line. On a phone or with text at 200% the words go back to the panel.'],
  ],
};
