// Ghat: a survey of the ghats. Importing this registers the scene.
//
//   <sg-scene name="ghat" register="warm"></sg-scene>
//   <sg-scene name="ghat" progress="0.4" label="Survey inked"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { buildGhat, ghatSteps, contours, heightAt, heightText, inkAt, front, TL, LOOKS } from './model.js';

export default defineScene({
  name: 'ghat',
  meta,
  params: {
    // unset: time inks the sheet; set (0 to 1, from the page's own scroll or work): the sheet is inked exactly that far
    progress: { type: 'number', default: null, min: 0, max: 1 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: params => (params.progress == null ? '' : `${Math.round(params.progress * 100)}% done`),
});
