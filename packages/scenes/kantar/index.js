// Kantar: the tiatr stage and curtain.
//
// Importing this registers the scene with the Susegad scene registry:
//   <sg-scene name="kantar" register="warm"></sg-scene>
//   <sg-scene name="kantar" progress="0.5" set="1"></sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import {
  model,
  W,
  H,
  OPEN,
  APRON,
  SCENES,
  SONGS,
  PHASES,
  ACT_DURATION,
  SHOW_DURATION,
  RISE_TIME,
  HERO_LINE,
  HERO_ACT,
  showAt,
  nextPhase,
  heroAt,
  heroNext,
} from './model.js';
import { createRenderer } from './render.js';

export {
  meta,
  model,
  createRenderer,
  W,
  H,
  OPEN,
  APRON,
  SCENES,
  SONGS,
  PHASES,
  ACT_DURATION,
  SHOW_DURATION,
  RISE_TIME,
  HERO_LINE,
  HERO_ACT,
  showAt,
  nextPhase,
  heroAt,
  heroNext,
};

export default defineScene({
  name: 'kantar',
  meta,
  params: {
    // 0..1: curtain position (0 fully up, 1 fully down). When unset, time drives the curtain.
    progress: { type: 'number', min: 0, max: 1, default: null },
    // 0..2: active backdrop (0 church square, 1 sunset beach, 2 balcão night). When unset, cycles with the show.
    set: { type: 'int', min: 0, max: 2, default: null },
    // 0..1: spotlight intensity on singer. When unset, lights up during the kantar song.
    spot: { type: 'number', min: 0, max: 1, default: null },
    // The front door's hero: in playful the show runs only when asked (rises once, rests, one act per click) and sings our own line.
    hero: { type: 'bool', default: false },
    // hero only, set by the click: the scene-clock time the last act was struck, and how many have been.
    cue: { type: 'number', default: null },
    acts: { type: 'int', min: 0, default: 0 },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: (params, sceneMeta) => {
    if (params.progress !== null && params.progress !== undefined) {
      return `Curtain at ${Math.round(params.progress * 100)}%`;
    }
    if (params.set !== null && params.set !== undefined) {
      const idx = Math.floor(params.set);
      return SCENES[idx]?.title ?? '';
    }
    return '';
  },
});
