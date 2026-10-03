// Saanj: the hour the birds come home. Importing this registers the scene.
//
//   <sg-scene name="saanj" register="playful"></sg-scene>
//   <sg-scene name="saanj" register="warm">…slotted text…</sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { buildScene, createFlock, stepFlock, simulate, darkness, skyLch, oklchToRgb, hawkField, LOOKS } from './model.js';

export default defineScene({
  name: 'saanj',
  meta,
  params: {},
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
