// Prahar: raga hours. Importing this registers the scene.
//
//   <sg-scene name="prahar" register="playful"></sg-scene>
//   <sg-scene name="prahar" hour="19.2" label="The light at the villa now"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model, say } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { skyAt, watchAt, hourAt, WATCHES, KEYS, LOOKS, say, fmt } from './model.js';

export default defineScene({
  name: 'prahar',
  meta,
  params: {
    // unset: time turns the day; set (0 to 24, from the page's own clock): the light holds at that hour
    hour: { type: 'number', default: null, min: 0, max: 24 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: params => (params.hour == null ? '' : say(params.hour)),
});
