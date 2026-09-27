// Paus: the monsoon, seen through a Goan window. Importing this registers the scene.
//
//   <sg-scene name="paus" register="warm" intensity="0.6" progress="0.4">…</sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export default defineScene({
  name: 'paus',
  meta,
  params: {
    intensity: { type: 'number', default: 0.8, min: 0, max: 1 },
    fog: { type: 'number', default: 0.8, min: 0, max: 1 },
    progress: { type: 'number', default: null, min: 0, max: 1 },
    wipe: { type: 'bool', default: true },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: p => (p.progress == null ? '' : `${Math.round(p.progress * 100)}% done`),
});
