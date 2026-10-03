// Dar: yours to keep. Importing this registers the scene.
//
//   <sg-scene name="dar" register="warm"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { arrival, swingAngle, boltAt, weather, HOOK, KEY, BOLT, ARRIVE, SWING, BOLTING, REST, DOOR, WINDOW } from './model.js';

export default defineScene({
  name: 'dar',
  meta,
  params: {},
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
