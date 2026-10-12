// The oracle boundary (decision 0029): the only file outside vendor/ that
// imports Pretext. Pretext answers how wide the segments are and where the
// breaks go; this file wraps that as the oracle layout.core.js expects
// (prepare / nextLine / stats / start) and keeps every Pretext detail on this
// side of the door, including the shape of its cursors and prepared handles.
//
// Pretext measures with a canvas it finds for itself (OffscreenCanvas, else a
// DOM canvas) the first time it is used, and keeps that context. It cannot be
// handed one, so a measuring function is not injectable here; pure geometry is
// tested against oracle.fake.js, and this path against a fake OffscreenCanvas
// installed before the first prepare (pretext.test.js).

import {
  prepareWithSegments, layoutNextLineRange, materializeLineRange, measureLineStats, clearCache,
} from './vendor/pretext.js';

const START = Object.freeze({ segmentIndex: 0, graphemeIndex: 0 });

/** Did this line end partway through a word (not at a space, a hyphen or the text's end)? */
function brokeInsideWord(prepared, { end }) {
  if (end.graphemeIndex === 0) return false;
  const seg = prepared.segments[end.segmentIndex];
  return !!seg && !/^\s/u.test(seg);
}

/** Thrown by the oracle when this page has no canvas to measure with. Scenes treat it as "the words stay in the flat reading". */
export class NoMeasuringCanvas extends Error {
  constructor() { super('Text measurement needs a 2D canvas (OffscreenCanvas or a DOM canvas), and this page has neither.'); this.name = 'NoMeasuringCanvas'; }
}

let canvasChecked = false;
let putBack = null; // the page's own OffscreenCanvas, restored once Pretext holds its context
/**
 * Pretext builds its own `new OffscreenCanvas(1, 1).getContext('2d')` on first use and keeps it, so what it finds must work
 * before its first prepare. Three cases:
 *   - OffscreenCanvas with a 2D context: nothing to do.
 *   - no OffscreenCanvas (Playwright's Windows WebKit, old browsers): Pretext already falls back to a DOM canvas; this only checks that one exists.
 *   - an OffscreenCanvas whose 2D context is null (Safari before 17): Pretext would crash on it, so a stand-in is put in its place, backed by a
 *     detached `document.createElement('canvas')` (never attached to the page). Pretext keeps the context it makes on first use, so
 *     the page's own OffscreenCanvas is put back after the first prepare: nothing else on the page ever sees the stand-in.
 * With no usable canvas at all, throws NoMeasuringCanvas: the scene catches it and keeps the flat reading.
 */
export function ensureMeasuringCanvas(g = globalThis) {
  if (canvasChecked) return;
  let offscreen = typeof g.OffscreenCanvas === 'function';
  if (offscreen) { try { offscreen = !!new g.OffscreenCanvas(1, 1).getContext('2d'); } catch { offscreen = false; } }
  if (!offscreen) {
    let dom = null;
    try { dom = g.document?.createElement?.('canvas')?.getContext?.('2d') ?? null; } catch { dom = null; }
    if (!dom) throw new NoMeasuringCanvas(); // not remembered: a later call may find a document
    if (typeof g.OffscreenCanvas === 'function') {
      const own = g.OffscreenCanvas;
      putBack = () => { g.OffscreenCanvas = own; };
      g.OffscreenCanvas = class DetachedCanvas {
        constructor(width = 1, height = 1) { this.el = g.document.createElement('canvas'); this.el.width = width; this.el.height = height; }
        getContext(type, options) { return this.el.getContext(type, options); }
      };
    }
  }
  canvasChecked = true;
}

/** The default oracle: vendored Pretext, measuring with the browser's canvas. */
export function createPretextOracle() {
  return {
    start: START,
    clear: () => clearCache(),
    prepare(text, font) {
      ensureMeasuringCanvas();
      let ok = false;
      try {
        const prepared = prepareWithSegments(text, font);
        ok = true;
        return prepared;
      } catch (e) {
        if (/requires OffscreenCanvas or a DOM canvas/.test(String(e?.message))) throw new NoMeasuringCanvas();
        throw e;
      } finally {
        // the page's own OffscreenCanvas comes back on every path; if this first prepare failed, Pretext may not hold a context
        // yet, so the next prepare checks again and puts the stand-in back in place for as long as that prepare runs
        if (putBack) { putBack(); putBack = null; if (!ok) canvasChecked = false; }
      }
    },
    nextLine(prepared, cursor, maxWidth) {
      const range = layoutNextLineRange(prepared, cursor, maxWidth);
      if (range === null) return null;
      return {
        text: materializeLineRange(prepared, range).text,
        width: range.width,
        end: range.end,
        brokeWord: brokeInsideWord(prepared, range),
      };
    },
    stats(prepared, maxWidth) {
      const { lineCount, maxLineWidth } = measureLineStats(prepared, maxWidth);
      return { lineCount, maxLineWidth };
    },
  };
}
