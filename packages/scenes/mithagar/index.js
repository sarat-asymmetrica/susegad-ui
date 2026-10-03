// Mithagar: The Ribandar Salt Pans at Dawn. Importing this registers the scene.
//
//   <sg-scene name="mithagar" register="warm"></sg-scene>
//   <sg-scene name="mithagar" progress="0.6" time-of-day="0"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export * from './model.js';

export default defineScene({
  name: 'mithagar',
  meta,
  params: {
    progress: { type: 'number', default: null, min: 0, max: 1 },
    timeOfDay: { type: 'number', default: 0, min: 0, max: 1 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: params => (params.progress == null ? '' : `${Math.round(params.progress * 100)}% crystallized`),
});
