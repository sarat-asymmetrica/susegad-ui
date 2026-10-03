// Ferry: four stops across the Mandovi. Importing this registers the scene.
//
//   <sg-scene name="ferry" step="2" label="How it goes"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { getRoute, ferryAt, scaleAt, journey, journeyTime, bob, bank, kiteAt, STOPS, STOP_AT, LEG, LOOKS } from './model.js';

export default defineScene({
  name: 'ferry',
  meta,
  params: {
    // absent: the ferry idles at the first stop. 1 to 4: it sails to that stop, and only a change moves it.
    step: { type: 'int', default: null, min: 1, max: 4 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: p => (p.step === null ? '' : `stop ${p.step} of 4`),
});
