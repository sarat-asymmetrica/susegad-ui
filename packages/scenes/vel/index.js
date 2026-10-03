// Vel: over the compound wall. Importing this registers the scene.
//
//   <sg-scene name="vel" register="warm"></sg-scene>
//   <sg-scene name="vel" register="playful" seed="4">…slotted text…</sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { derive, buildVine, buildWall, fallPlan, fallFrames, sceneOf, LOOKS } from './model.js';

export default defineScene({
  name: 'vel',
  meta,
  params: {},
  model,
  createRenderer,
  kind: 'svg',
  interactive: ['playful'],
  status: () => '',
});
