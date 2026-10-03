// Vad: a tree that grows its own pillars. Importing this registers the scene.
//
//   <sg-scene name="vad" register="warm"></sg-scene>
//   <sg-scene name="vad" progress="0.4" label="Set-up progress"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { growBanyan, banyan, schedule, scheduleOf, birthTimeOf, clumpGrow, LOOKS } from './model.js';

export default defineScene({
  name: 'vad',
  meta,
  params: {
    // unset: time grows the tree; set (0 to 1, from real work): the growth stands exactly that far along
    progress: { type: 'number', default: null, min: 0, max: 1 },
    // "world": in warm and playful the slotted words sit in the sky beside the canopy, flowing round it as it grows
    words: { type: 'enum', values: ['panel', 'world'], default: 'panel' },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: params => (params.progress == null ? '' : `${Math.round(params.progress * 100)}% done`),
});
