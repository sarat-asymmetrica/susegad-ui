// Vaati: the bowl fills. Importing this registers the scene.
//
//   <sg-scene name="vaati" register="playful"></sg-scene>
//   <sg-scene name="vaati" pieces="tortellini" sauce="pesto" topping="none"></sg-scene>
//   <sg-scene name="vaati" progress="0.4" label="Your order"></sg-scene>
//
// A page learns the meal is made from the `sg-scene-settled` event (bubbles, composed), which
// fires once per run when the garnish has landed and never under `progress`. A page that came
// late can read the `data-settled` attribute the scene sets at the same moment.

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model, SHAPES, SAUCES } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { makeBowl, bowl, shapeOf, pack, timeline, piecePose, arrangement, swirlPoint, settleGate, SHAPES, KINDS, BOWL, PACE, TOSS } from './model.js';

export default defineScene({
  name: 'vaati',
  meta,
  params: {
    pieces: { type: 'enum', values: Object.keys(SHAPES), default: 'ravioli' },
    sauce: { type: 'enum', values: SAUCES, default: 'tomato' },
    topping: { type: 'enum', values: ['cheese', 'none'], default: 'cheese' },
    garnish: { type: 'enum', values: ['basil', 'none'], default: 'basil' },
    // absent: time fills the bowl. 0 to 1: exactly that full, and time stands still.
    progress: { type: 'number', default: null, min: 0, max: 1 },
    // set by the scene itself when the bowl is tossed (playful): the model time it began and how many tosses so far
    tossAt: { type: 'number', default: null },
    tossN: { type: 'int', default: 0, min: 0 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: p => (p.progress === null ? '' : `${Math.round(p.progress * 100)}% full`),
});
