// Neel: a block, a table, a length of cotton. Importing this registers the scene.
//
//   <sg-scene name="neel" register="playful" seed="3"></sg-scene>
//   <sg-scene name="neel" progress="0.4" label="Printing your order"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { carve, plan, planOf, printerAt, visibleSeq, pressAt, printLength, lift, LOOKS, PALETTES } from './model.js';

export default defineScene({
  name: 'neel',
  meta,
  params: {
    // unset: the printer's clock prints the length; set (0 to 1, from real work): exactly that share is printed
    progress: { type: 'number', default: null, min: 0, max: 1 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: params => (params.progress == null ? '' : `${Math.round(params.progress * 100)}% done`),
});
