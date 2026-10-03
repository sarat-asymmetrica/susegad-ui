// Veranda: a Goan veranda, drawn, with depth from its own geometry. Importing this registers the scene.
//
//   <sg-scene name="veranda" register="warm"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model, SUN_REST } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { sunAt, lampSwing, motes, LOOKS, SUN_REST } from './model.js';

export default defineScene({
  name: 'veranda',
  meta,
  params: {
    // where the sun is: 0 low and out beyond the paddy, 1 high and more ahead; playful's hand moves it
    sun: { type: 'number', default: SUN_REST, min: 0, max: 1 },
    // the light: auto follows the theme (dusk in dark, with the lamp lit); monsoon is the same veranda in the rain
    mood: { type: 'enum', values: ['auto', 'day', 'dusk', 'monsoon'], default: 'auto' },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
