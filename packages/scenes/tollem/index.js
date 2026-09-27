// Tollem, the pool at noon: a WebGL scene with a full 2D fallback.
//
//   <sg-scene name="tollem" register="playful" swell="0.6"></sg-scene>
//   <sg-scene name="tollem" progress="0.4">…slotted text…</sg-scene>

// core/index.js also defines <sg-scene>, so loading this one module is enough on a page
import { defineScene } from '../../core/index.js';
import { model, PALETTE_NAMES } from './model.js';
import { createRenderer } from './render.js';
import { meta } from './meta.js';

export default defineScene({
  name: 'tollem',
  meta,
  params: {
    swell: { type: 'number', default: 0.5, min: 0, max: 1 },
    flowers: { type: 'bool', default: true },
    palette: { type: 'enum', values: ['seed', ...PALETTE_NAMES], default: 'seed' },
    touch: { type: 'bool', default: true },
    // unset: time drives the flowers; set: one flower sits that far across, and only this moves it
    progress: { type: 'number', default: null, min: 0, max: 1 },
    // '2d' forces the canvas painting; 'webgl' keeps the shader even when frames stay slow
    renderer: { type: 'enum', values: ['auto', 'webgl', '2d'], default: 'auto' },
  },
  model,
  createRenderer,
  kind: 'webgl',
  interactive: ['playful'],
  status: params => (params.progress == null ? '' : `${Math.round(params.progress * 100)}% done`),
});
