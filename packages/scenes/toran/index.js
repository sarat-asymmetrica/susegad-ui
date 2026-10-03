// Toran: the doorway on the morning of Chovoth. Importing this registers the scene.
//
//   <sg-scene name="toran" register="playful"></sg-scene>
//   <sg-scene name="toran" register="warm">…slotted text…</sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { buildToran, step, settle, brush, stepPetals, createDoorway, doorwayAt, tapStrokes, sweepStrokes, breeze, LOOKS } from './model.js';

export default defineScene({
  name: 'toran',
  meta,
  params: {},
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
