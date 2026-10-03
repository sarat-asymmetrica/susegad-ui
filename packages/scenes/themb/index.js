// Themb: rain on a taro leaf. WebGL with a full 2D painting. Importing this registers the scene.
//
//   <sg-scene name="themb" register="playful"></sg-scene>
//   <sg-scene name="themb" renderer="2d">…slotted text…</sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { createLeaf, leafAt, leafR, leafSd, leafHeight, areaOf, LOOKS, STILL_TIME } from './model.js';

export default defineScene({
  name: 'themb',
  meta,
  params: {
    // '2d' always paints on a canvas; 'webgl' keeps the shader even when frames are slow
    renderer: { type: 'enum', values: ['auto', 'webgl', '2d'], default: 'auto' },
  },
  model,
  createRenderer,
  kind: 'webgl',
  interactive: ['playful'],
  status: () => '',
});
