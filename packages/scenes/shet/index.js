// Shet: one year of a paddy field. Importing this registers the scene.
//
//   <sg-scene name="shet" register="warm"></sg-scene>
//   <sg-scene name="shet" progress="0.4" label="Season progress"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { buildField, season, windAt, gustAt, proj, unproj, T, LOOKS, STILL_AT, localOf } from './model.js';

export default defineScene({
  name: 'shet',
  meta,
  params: {
    // unset: time turns the year; set (0 to 1): the field holds at that point of the year
    progress: { type: 'number', default: null, min: 0, max: 1 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: params => (params.progress == null ? '' : `${Math.round(params.progress * 100)}% done`),
});
