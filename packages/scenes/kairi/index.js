// Kairi: a border for a sari, drawn by spinning circles. Importing this registers the scene.
//
//   <sg-scene name="kairi" register="playful"></sg-scene>
//   <sg-scene name="kairi" progress="0.4" label="Order progress"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { buildBorder, border, paisley, dft, chain, curve, resampleN, dotRow, stageAt, clockOfProgress, nextSlotClock, LOOKS, SLOTS, N } from './model.js';

export default defineScene({
  name: 'kairi',
  meta,
  params: {
    // unset: time draws the border; set (0 to 1, from real work): the border is drawn exactly that far
    progress: { type: 'number', default: null, min: 0, max: 1 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: params => (params.progress == null ? '' : `${Math.round(params.progress * 100)}% done`),
});
