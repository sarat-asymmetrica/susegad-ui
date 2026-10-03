// Tinto: everyone in the square. Importing this registers the scene.
//
//   <sg-scene name="tinto" register="playful"></sg-scene>
//   <sg-scene name="tinto" focus="tourist" label="Page not found">…slotted text…</sg-scene>

import { defineScene } from '../../core/index.js';
import { meta } from './meta.js';
import { model, IDS } from './model.js';
import { createRenderer } from './render.js';

export { meta, model, createRenderer };
export { VIGNETTES, IDS, LOOKS, pickLine, placeCard, poderAt, walkerAt, kidsAt, SHOPS, BOARD, slateOf, minSizes, boardSizes, inWorld } from './model.js';

export default defineScene({
  name: 'tinto',
  meta,
  params: {
    // pin one person's line: the tourist on a 404, the dog on an empty inbox
    focus: { type: 'enum', values: IDS, default: null },
    // false: the square with no caption cards at all (the list for screen readers stays)
    lines: { type: 'bool', default: true },
    // "world": in warm and playful the slotted words go on the Taverna's chalkboard and each shop
    // carries a plaque; quiet (and any surface too small to read) keeps the panel and a plain list
    words: { type: 'enum', values: ['panel', 'world'], default: 'panel' },
  },
  model,
  createRenderer,
  kind: 'canvas2d',
  interactive: ['playful'],
  status: () => '',
});
