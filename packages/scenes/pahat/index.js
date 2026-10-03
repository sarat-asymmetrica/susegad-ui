// Pahat: the desk at dawn. Importing this registers the scene.
//
//   <sg-scene name="pahat" register="warm"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { dawn, skyAt, sky, DAWN, STILL_U, SKY, WIN } from './model.js';

export default defineScene({
  name: 'pahat',
  meta,
  params: {},
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
