// Vahi: the pile becomes a ledger. Importing this registers the scene.
//
//   <sg-scene name="vahi" register="warm"></sg-scene>
//   <sg-scene name="vahi" progress="0.4" label="Records sorted"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { makeDesk, desk, paperPose, timeline, entryLine, fitAround, actionBox, scatterOffset, KINDS, COUNT, PACE, BEATS } from './model.js';

export default defineScene({
  name: 'vahi',
  meta,
  params: {
    // absent: time sorts the pile. 0 to 1: exactly that much is sorted, and time stands still.
    progress: { type: 'number', default: null, min: 0, max: 1 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: p => (p.progress === null ? '' : `${Math.round(p.progress * 100)}% done`),
});
