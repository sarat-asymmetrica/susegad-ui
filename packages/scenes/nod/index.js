// Nod: the helper that asks first. Importing this registers the scene.
//
//   <sg-scene name="nod" register="playful"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { thread, fingerAt, talk, wisps, streamline, curl, BEATS, FIRST, WARM_NOD, LOOKS } from './model.js';

export default defineScene({
  name: 'nod',
  meta,
  params: {},
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
