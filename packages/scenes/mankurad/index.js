// Mankurad: a short story about a mango. Importing this registers the scene.
//
//   <sg-scene name="mankurad" register="warm"></sg-scene>
//   <sg-scene name="mankurad" progress="0.4" label="Order progress"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { beats, swingAt, mangoAt, branchBend, beatOf, LOOKS, T, T_FALL, STILL_LT } from './model.js';

export default defineScene({
  name: 'mankurad',
  meta,
  params: {
    // unset: time tells the story; set (0 to 1, from real work): the story holds at that beat
    progress: { type: 'number', default: null, min: 0, max: 1 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: params => (params.progress == null ? '' : `${Math.round(params.progress * 100)}% done`),
});
