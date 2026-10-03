// Kolam: what the scene is, in words. Ported from the Susegad sketchbook and
// updated for the library: registers, the progress param, the element.

export const meta = {
  id: 'kolam',
  title: 'The threshold at dawn',
  word: 'Kolam',
  gloss: 'Tamil: the rice-flour line drawn at the doorstep every morning and gone by evening. The threshold drawings of Tamil Nadu and South India, with kin forms across India',
  caption:
    'First a grid of dots, then one line that loops around every dot without lifting. The line comes from a trick mathematicians use to study kolam: put tiny mirrors between some dots and bounce a ray diagonally through the grid. Rice flour feeds the ants, so the ants come.',
  alt: 'A kolam: one unbroken line looping around a grid of dots',
  keys: 'Arrow keys move your hand over the floor and pour the flour faster. Enter or Space draws the kolam again.',
  W: 1000,
  H: 1000,
  seed: 7,
  stillTime: 1e6,
  techniques: ['emergence', 'seed', 'particles', 'easing', 'texture', 'state', 'calm'],
  credit:
    'Kolam is drawn every morning, mostly by women, across Tamil Nadu and much of South India, with kin traditions in rangoli, muggu, rangavalli and Goa’s own threshold designs. The mirror-curve method is Paulus Gerdes’s mathematical reading of these line drawings; the drawing practice is theirs.',
  tier: 'shared',
  prompt:
    'Draw a South Indian kolam as a web component, entirely with canvas and no image files. Lay out a diamond or square grid of dots. Generate one unbroken line that loops around every dot using the mirror-curve method: imagine small mirrors between some neighbouring dots and trace a ray that moves diagonally and bounces off them. Choose the mirrors with four-way symmetry from a seed, and keep reshuffling until the whole design is a single closed loop. Smooth the path with Catmull-Rom curves. Render the line as rice flour: sprinkle tiny grains along it with a gaussian spread, and let the density waver like a pinch of flour running low. Give it three registers. Quiet: the finished kolam as a hairline ink drawing on paper, with no motion. Warm: flour on a polished red-oxide floor, drawn once at a human hand’s pace, then a slow wave of light through the dots. Playful: flour on laterite with coloured powder on the dots; moving the pointer pours faster, a click draws it again, and ants come for the flour. Add a progress attribute from 0 to 1: when it is set, draw exactly that far and let time stop moving the line, and say the percentage in text for screen readers. When text sits over the drawing, move the kolam aside so the words have clear floor. With reduced motion, show the finished kolam.',
  map: [
    ['mirror-curve method … bounces off them', 'emergence', 'One local rule (bounce or pass straight through) at every gap produces the whole design. Nobody draws the curve; the rule finds it.'],
    ['keep reshuffling until … a single closed loop', 'seed', 'Random choices are cheap to test. The code tries symmetric mirror layouts until one yields a single loop, and a seed makes that search repeatable.'],
    ['sprinkle tiny grains … gaussian spread', 'particles', 'The line is never stroked. It is tens of thousands of grains, bunched along the path and thinning at the edges like real flour, written straight into the pixels at device resolution and copied to the canvas as one rectangle. That is about six times faster than drawing each grain as a shape.'],
    ['at a human hand’s pace', 'easing', 'Drawing speed follows a gentle wave instead of a constant rate, so the line hurries on straights and slows into turns. The wave is monotonic: the line never goes backwards.'],
    ['polished red-oxide floor … laterite', 'texture', 'Each floor is painted once into an offscreen canvas (a gradient, cloudy noise stretched from a tiny image, grain, and for laterite irregular pores and mortar joints) and reused every frame. Once the line is closed, floor and flour are baked into one layer.'],
    ['a slow wave of light through the dots', 'calm', 'One glow is drawn at each dot, brightening in a wave from the centre every seven seconds. Near the slotted text it fades to almost nothing.'],
    ['let time stop moving the line', 'state', 'With progress set, the model ignores time and the element stops its loop. The drawing moves only when the work moves, and the same number is read out as text.'],
    ['move the kolam aside', 'calm', 'The element reports the boxes of slotted text in the scene’s units. If they cover the kolam, it moves into the largest clear band beside them and shrinks only as much as it must.'],
  ],
};
