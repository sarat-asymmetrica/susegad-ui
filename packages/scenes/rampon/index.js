// Rampon: dusk on the Goan shore. Importing this registers the scene.
//
//   <sg-scene name="rampon" register="playful" seed="3">…</sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { makeScene, scene, palmSway, visibleBirds, birdX, LOOKS } from './model.js';

export default defineScene({
  name: 'rampon',
  meta,
  params: {},
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
