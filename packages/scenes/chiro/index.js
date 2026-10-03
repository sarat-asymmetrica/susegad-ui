// Chiro: the red stone after the rain. Importing this registers the scene.
//
//   <sg-scene name="chiro" register="warm"></sg-scene>
//   <sg-scene name="chiro" register="playful" seed="4">…slotted text…</sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { buildWall, rasterWall, seasons, gsStep, stampHand, LOOKS, STILL_T } from './model.js';

export default defineScene({
  name: 'chiro',
  meta,
  params: {},
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
