// Chai: three small things. Importing this registers the scene.
//
//   <sg-scene name="chai" register="warm"></sg-scene>
//   <sg-scene name="chai" lit="false" label="Closed for the evening"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { curl, streamline, wispWindow, wispsAt, vineGeometry, vineGrowth, LOOKS, STEAM } from './model.js';

export default defineScene({
  name: 'chai',
  meta,
  params: {
    // the lamp: lit or out
    lit: { type: 'bool', default: true },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
