// Taverna: Rain on Bottle Glass.
//
//   <sg-scene name="taverna" register="warm"></sg-scene>
//   <sg-scene name="taverna" rain="0.8" lamp="0.9" steamer="0.6"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { W, H, REST, WINDOW, BOTTLES, JUG, BLACKBOARD, STREETLAMP, BULB, weather } from './model.js';

export default defineScene({
  name: 'taverna',
  meta,
  params: {
    rain: { type: 'number', default: 0.6, min: 0, max: 1 },
    lamp: { type: 'number', default: 0.85, min: 0, max: 1 },
    steamer: { type: 'number', default: 0.5, min: 0, max: 1 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
