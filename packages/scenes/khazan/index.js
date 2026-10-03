// Khazan: fireflies over the khazan. Importing this registers the scene.
//
//   <sg-scene name="khazan" register="playful"></sg-scene>
//   <sg-scene name="khazan" progress="0.4" label="Sync progress"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { neighbours, kuramoto, localOrder, order, flash, buildScene, swarm, scatter, wavePhases, heldPhases, runSwarm, LOOKS } from './model.js';

export default defineScene({
  name: 'khazan',
  meta,
  params: {
    // unset: the swarm lives by itself; set (0 to 1, from real work): the bank is exactly that far in step
    progress: { type: 'number', default: null, min: 0, max: 1 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: params => (params.progress == null ? '' : `${Math.round(params.progress * 100)}% done`),
});
