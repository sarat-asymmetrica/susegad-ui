// Themb: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in themb.prompt.md (prompts.test.js checks).
import { W, H, STILL_TIME } from './model.js';

export const meta = {
  id: 'themb',
  title: 'Rain on a taro leaf',
  word: 'Themb',
  gloss: 'Marathi and Konkani: a drop',
  alt: 'A broad taro leaf seen from above in the rain, its veins inked pale on velvet green, with silver beads of water resting on it and gathering in the cup at its centre.',
  caption:
    'An alu leaf in the rain. It sheds water, so each drop sits on it as a silver bead that rolls and joins the others. The beads gather in the cup at the centre until the leaf dips under the weight and pours them off its tip. In playful, move the pointer to tilt the leaf and roll the water where you like; Enter pours the cup. WebGL, with a full 2D painting when WebGL is missing, lost or too slow.',
  keys: 'Arrow keys move a hand over the leaf and tip it toward the hand. Enter or Space pours the cup off the tip, or sets a bead down when the leaf is dry.',
  W, H, seed: 1, stillTime: STILL_TIME,
  tier: 'local',
  credit: 'Alu (taro) grows in every Goan garden and field bund in the monsoon, and its leaves shed rain as beads. Drawn from the leaf after a shower.',
  techniques: ['shader', 'fields', 'physics', 'interaction', 'texture', 'fallback', 'calm'],
  prompt:
    'Draw rain beading on a broad taro leaf, looked at from above, with a WebGL fragment shader and no image files. Shape the leaf as a heart with a pointed tip, with veins radiating from where the stalk joins it, and paint it velvety green with a faint blue bloom and inked veins and edges. The leaf repels water, so drops sit on it as perfect silver beads. Draw each bead as a signed distance field and join them with a smooth minimum, so two beads that touch neck and merge. Render the beads as lenses: a darker rim, a sharp highlight, the veins magnified and shifted inside, and a soft contact shadow. Run the physics on the CPU: the leaf has a shallow cup at the centre, beads roll downhill with a little friction, small beads stay pinned where they land, and beads that touch merge and keep their total area. Pass the beads to the shader as a uniform array. Let showers come and go, with new drops landing with a small splash. Tilt the leaf toward the pointer so the viewer can roll the water into one big bead, and when the pool grows heavy, let the leaf dip and spill it off the tip before the next shower. Step the water at fixed ticks from the start, so the same seed and the same hands always give the same leaf. Give it three registers: quiet is the leaf just after a shower as a still, warm is an easier rain, and playful tilts under the pointer or the arrow keys, with Enter to pour. Keep new drops and the rain off any words laid over the leaf, and push beads out from under them. Paint the whole leaf on a 2D canvas when WebGL is missing, its context is lost, or frames stay too slow.',
  map: [
    ['join them with a smooth minimum, so two beads that touch neck and merge', 'fields', 'Each bead is a distance: how far a pixel is from its edge. A smooth minimum blends nearby distances instead of picking the smallest, so where two beads nearly touch the edge swells into a neck and they look like one body of water.'],
    ['Render the beads as lenses', 'shader', 'Inside a bead the shader works out how steep the water is at that pixel and reads the leaf from a point shifted toward the centre. The veins underneath come out magnified, and the rim darkens where the surface turns away.'],
    ['beads roll downhill with a little friction, small beads stay pinned', 'physics', 'The leaf is a height field: a cup at the centre, a droop toward the tip, and a tilt. Each bead feels the slope where it sits. Small beads need a steeper slope before they let go, which is how real drops cling to a leaf.'],
    ['merge and keep their total area', 'physics', 'When two beads touch they pull together, and the merged bead’s radius is the square root of the sum of their squared radii, so no water appears or vanishes. The new bead wobbles for a moment as it settles.'],
    ['Tilt the leaf toward the pointer', 'interaction', 'The pointer lowers the side of the leaf nearest it, by up to 0.17 of a unit per unit. The tilt eases in, so water starts slowly, gathers speed and swallows the small beads in its path. Each change of tilt is kept as an input with its time, which is what makes a replay exact.'],
    ['Step the water at fixed ticks from the start', 'model', 'The leaf steps in 1/120 s ticks from zero and the run is memoised, so a playing scene only pays for new ticks; going back in time, or a change in the page’s words, steps it again from zero with the same inputs.'],
    ['inked veins and edges', 'texture', 'The veins, the leaf edge and a fine paper grain are all worked out in the shader, so the beads magnify the same ink lines you see around them.'],
    ['Keep new drops and the rain off any words laid over the leaf', 'calm', 'A drop that would land within 30 units of the page’s text is placed again elsewhere, the rain streaks skip those boxes, and a bead inside one is pushed out through its nearest edge.'],
    ['Paint the whole leaf on a 2D canvas', 'fallback', 'The leaf, its veins and the other leaves are inked once and cached; the beads are round lenses with a highlight. The same water drives both, so the picture keeps its place when the context is lost.'],
    ['frames stay too slow', 'governor', 'The element’s governor lowers the shader’s resolution when frames run long, down to 30%. If frames still take over 90 ms at the floor, or over 180 ms at any level, for four seconds, the leaf switches to the 2D painting.'],
  ],
};
