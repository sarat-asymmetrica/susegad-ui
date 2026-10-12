// The oracle's door when the page has no usable OffscreenCanvas (decision 0029): a stand-in backed by a detached DOM canvas, or a clean
// NoMeasuringCanvas for the scene to turn into its flat reading. No OffscreenCanvas is installed in this file on purpose.

import { test } from 'node:test';
import assert from 'node:assert/strict';

let n = 0;
const fresh = async () => import(`./measure.js?case=${n++}`); // its own `checked` flag each time (Pretext itself is shared)
const ctx = { font: '', measureText: t => ({ width: t.length }) };
const documentWith = (canvases = []) => ({ createElement: tag => { assert.equal(tag, 'canvas'); const c = { width: 0, height: 0, getContext: () => ctx }; canvases.push(c); return c; } });

test('an OffscreenCanvas whose 2D context is null (Safari before 17) is replaced by a detached DOM canvas', async () => {
  const { ensureMeasuringCanvas } = await fresh();
  const canvases = [];
  class Broken { constructor(w, h) { this.w = w; } getContext() { return null; } }
  const g = { OffscreenCanvas: Broken, document: documentWith(canvases) };
  ensureMeasuringCanvas(g);
  assert.notEqual(g.OffscreenCanvas, Broken, 'replaced');
  const c = new g.OffscreenCanvas(1, 1);
  assert.equal(c.getContext('2d'), ctx, 'its 2D context is the DOM canvas\'s');
  assert.ok(canvases.length >= 2, 'a probe canvas and the stand-in\'s own, none attached to anything');
});

test('a working OffscreenCanvas is left alone', async () => {
  const { ensureMeasuringCanvas } = await fresh();
  class Fine { getContext() { return ctx; } }
  const g = { OffscreenCanvas: Fine, document: documentWith() };
  ensureMeasuringCanvas(g);
  assert.equal(g.OffscreenCanvas, Fine);
});

test('no OffscreenCanvas but a document (Playwright WebKit on Windows): nothing is installed, Pretext uses its own DOM-canvas fallback', async () => {
  const { ensureMeasuringCanvas } = await fresh();
  const g = { document: documentWith() };
  ensureMeasuringCanvas(g);
  assert.equal('OffscreenCanvas' in g, false);
});

test('no canvas at all: NoMeasuringCanvas, not a TypeError, and a later call may try again', async () => {
  const { ensureMeasuringCanvas, NoMeasuringCanvas } = await fresh();
  assert.throws(() => ensureMeasuringCanvas({}), NoMeasuringCanvas);
  assert.throws(() => ensureMeasuringCanvas({ OffscreenCanvas: class { getContext() { return null; } } }), NoMeasuringCanvas);
  assert.throws(() => ensureMeasuringCanvas({ document: { createElement: () => ({ getContext: () => null }) } }), NoMeasuringCanvas);
  ensureMeasuringCanvas({ document: documentWith() }); // a document turned up
});

test('the real oracle, in a page with nothing to measure with, says so by name instead of crashing inside Pretext', async () => {
  const { createPretextOracle, NoMeasuringCanvas } = await fresh();
  assert.equal(typeof globalThis.OffscreenCanvas, 'undefined');
  assert.equal(typeof globalThis.document, 'undefined');
  assert.throws(() => createPretextOracle().prepare('Come for the rain', '400 20px Kalam'), e => e instanceof NoMeasuringCanvas && e.name === 'NoMeasuringCanvas');
});

test('the stand-in lives only until Pretext has its context: the page gets its own OffscreenCanvas back after the first prepare', async () => {
  const { createPretextOracle } = await fresh();
  class Broken { getContext() { return null; } }
  const fullCtx = { font: '', measureText: t => ({ width: t.length * 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 9, fontBoundingBoxDescent: 3 }) };
  globalThis.OffscreenCanvas = Broken;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fullCtx }) };
  try {
    const oracle = createPretextOracle();
    const prepared = oracle.prepare('Come for the rain', '400 20px Kalam');
    assert.ok(prepared, 'measured through the stand-in');
    assert.equal(globalThis.OffscreenCanvas, Broken, 'the page\'s own OffscreenCanvas is back');
    assert.ok(oracle.stats(oracle.prepare('Come for the rain again', '400 20px Kalam'), 1e6).maxLineWidth > 0, 'Pretext still measures with the context it kept');
  } finally { delete globalThis.OffscreenCanvas; delete globalThis.document; }
});
