// Maun: silence, in layers. Importing this registers the scene.
//
//   <sg-scene name="maun" register="quiet" palette="indigo">…a document's title…</sg-scene>
//   <sg-scene name="maun" register="playful" seed="7"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model, PALETTE_NAMES } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { plan, planOf, passesAt, scrapeAt, breathAt, PALETTES, PALETTE_NAMES, RATE } from './model.js';

export default defineScene({
  name: 'maun',
  meta,
  params: {
    // 'seed' lets the seed choose, as the plate did; or name one
    palette: { type: 'enum', values: ['seed', ...PALETTE_NAMES], default: 'seed' },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
