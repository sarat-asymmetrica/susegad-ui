// Posta: the sorting desk in Fontainhas. Importing this registers the scene.
//
//   <sg-scene name="posta" register="warm"></sg-scene>
//   <sg-scene name="posta" progress="0.6" label="Mail sorted"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export {
  W,
  H,
  REST,
  CUBBIES_COUNT,
  DESK,
  WINDOW,
  RACK,
  POSTBOX,
  SCALE,
  STAMP,
  scaleAngle,
  flapOpening,
  stampState,
  sortingProgress,
  makeRackData,
} from './model.js';

export default defineScene({
  name: 'posta',
  meta,
  params: {
    // unset: time drives sorting. 0 to 1: exactly that much sorted, time stands still.
    progress: { type: 'number', default: null, min: 0, max: 1 },
    // unset: time and pushes control flap. 0 to 1: manual flap opening.
    flap: { type: 'number', default: null, min: 0, max: 1 },
    // unset: time and clicks drive stamp. 0 to 1: manual stamp descent.
    stamped: { type: 'number', default: null, min: 0, max: 1 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: p => (p.progress === null ? '' : `${Math.round(p.progress * 100)}% sorted`),
});
