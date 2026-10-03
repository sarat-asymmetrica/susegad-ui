// Mosaico: an ant on the balcão floor. Importing this registers the scene.
//
//   <sg-scene name="mosaico" register="warm"></sg-scene>
//   <sg-scene name="mosaico" register="playful" seed="4">…slotted text…</sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { layFloor, makeAnt, exitOf, walk, antPlace, turnQuarter, floorAt, createFloor, advance, rippleTurns, layTime, LAY_END, LOOKS } from './model.js';

export default defineScene({
  name: 'mosaico',
  meta,
  params: {},
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
