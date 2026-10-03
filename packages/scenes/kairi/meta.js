// Kairi: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in kairi.prompt.md (prompts.test.js checks).
import { W, H, STILL_TIME } from './model.js';

export const meta = {
  id: 'kairi',
  title: 'A border for a sari',
  word: 'Kairi',
  gloss: 'Hindi and Marathi: a raw mango, and the paisley named after it',
  alt: 'A printed sari border on cream cloth: five paisleys in madder, indigo and turmeric between two rows of madder triangles, drawn by a machine of spinning pencil circles.',
  caption:
    'Every closed line can be drawn by a chain of circles, each turning at its own whole-number speed, laid end to end. Here the chain grows one circle at a time until its sketch sharpens into a paisley, then a pen at the end of the chain inks it. An echo line follows inside, then colour and dots, like a painted border. Set progress from real work and the border is drawn exactly that far; in playful, bring the pointer near the machine to slow it down and see the circles.',
  keys: 'Arrow keys move a hand; near the machine it slows down. Enter or Space goes on to the next paisley.',
  W, H, seed: 1, stillTime: STILL_TIME,
  tier: 'pan-Indian',
  credit: 'The paisley (kairi, the raw mango shape; boteh) is shared across India and far beyond, printed, woven and embroidered. The madder, indigo and turmeric are the dyes of hand block printing.',
  techniques: ['fields', 'pattern', 'seed', 'easing', 'texture', 'interaction', 'state'],
  prompt:
    'Draw a hand-painted paisley border on cream paper in canvas JavaScript, with no image files, and let a machine of spinning circles draw it. Design each paisley from a few control points: a round belly, a tapering body and a tip that curls over, smoothed with closed Catmull-Rom curves, with small seeded differences between them. Resample each outline to 256 evenly spaced points and take its discrete Fourier transform in a pure function. Sort the terms by size and chain them as epicycles, each circle turning at its own speed on the rim of the one before. First add the circles one at a time and show a faint pencil sketch of the outline they make, so the drawing sharpens as circles are added, then let the pen at the end of the chain ink the paisley. Trace a smaller echo line inside, then fill it like a printed border with madder, indigo and turmeric washes, a row of dots and a small flower. Draw the circles delicately in pencil and add a handwritten note with the number of circles. Hovering near the machine should slow it and show the circles more strongly. Give it a progress attribute: when it is set, the border is drawn exactly that far and time stands still. Give it three registers: quiet is the finished border, warm draws it once and rests, and playful draws border after border and answers the pointer and the keys.',
  map: [
    ['take its discrete Fourier transform in a pure function', 'fields', 'The outline becomes 256 complex numbers, and the transform turns them into 256 circles, each with a size, a starting angle and a whole-number speed. A pure function does this, so it can be tested without a canvas.'],
    ['chain them as epicycles', 'pattern', 'Each circle sits on the rim of the one before it and turns at its own speed. Add up every turning arm and the tip of the last one lands exactly on the outline.'],
    ['so the drawing sharpens as circles are added', 'easing', 'The number of circles eases up from one to the full count (37 to 61, chosen by the seed), and the pencil sketch is redrawn each frame from only those circles: an oval first, then a pear shape, then a paisley with a curling tip.'],
    ['small seeded differences between them', 'seed', 'The seed nudges every control point, the plumpness, the curl and the tilt, so no two paisleys in the border are quite alike. It also picks the colours for each one.'],
    ['on cream paper', 'texture', 'The paper, the pencil guidelines and the striped edges are painted once into cached layers. Each finished paisley is painted into another layer so it is never drawn twice. On a dark page the same cloth is lit by a lamp.'],
    ['Hovering near the machine should slow it', 'interaction', 'In playful the machine keeps the scene’s clock; near the pointer, or the keyboard hand, the clock runs at about a third of the speed and the pencil circles darken, so you can follow a single arm. Enter goes on to the next paisley.'],
    ['the border is drawn exactly that far', 'state', 'Progress maps onto the machine’s clock, from the bare border at 0 to the fifth paisley finished at 1, so only the number moves it. The status says it in words, such as "40% done".'],
  ],
};
