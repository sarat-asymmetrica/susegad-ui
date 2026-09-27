// Kolam: the scene definition. Importing this registers `kolam` and, in a
// browser, defines <sg-scene>.

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { buildKolam, geometry, pointAt } from './model.js';

export default defineScene({
  name: 'kolam',
  meta,
  params: {
    // null: time draws the kolam. 0 to 1: drawn exactly that far, and time stands still.
    progress: { type: 'number', default: null, min: 0, max: 1 },
    // null: the seed picks the grid. Otherwise dots across, rounded up to odd.
    grid: { type: 'int', default: null, min: 3, max: 9 },
    // auto: flour in warm, rangoli colours on the dots in playful.
    palette: { type: 'enum', default: 'auto', values: ['auto', 'flour', 'rangoli'] },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: p => (p.progress === null ? '' : `${Math.round(p.progress * 100)}% done`),
});
