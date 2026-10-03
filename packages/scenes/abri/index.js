// Abri: cloud paper. Importing this registers the scene.
//
//   <sg-scene name="abri" register="warm"></sg-scene>
//   <sg-scene name="abri" register="playful" seed="4">…slotted text…</sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { plan, cloudRows, makeBath, stepBath, pushDrop, splat, stylusAt, times, sheetSeed, stillAt, LOOKS } from './model.js';

export default defineScene({
  name: 'abri',
  meta,
  params: {},
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
