// The oracle's door on its failure path, in a process of its own: Pretext keeps the first context it makes for the
// whole process, so this case must run before any prepare has succeeded (measure.canvas.test.js holds the others).

import { test } from 'node:test';
import assert from 'node:assert/strict';

const fresh = async () => import('./measure.js?fail');

test('a first prepare that throws still gives the page its OffscreenCanvas back, and the next prepare puts the stand-in in place again', async () => {
  const { createPretextOracle } = await fresh();
  class Broken { getContext() { return null; } }
  let fail = true;
  const fullCtx = { font: '', measureText: t => { if (fail) throw new Error('a font the canvas refused'); return { width: t.length * 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 9, fontBoundingBoxDescent: 3 }; } };
  globalThis.OffscreenCanvas = Broken;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fullCtx }) };
  try {
    const oracle = createPretextOracle();
    assert.throws(() => oracle.prepare('Come for the rain once more', '400 20px Nowhere'));
    assert.equal(globalThis.OffscreenCanvas, Broken, 'back on the failure path too');
    fail = false;
    assert.ok(oracle.prepare('Come for the rain, at last', '400 20px Kalam'), 'the next prepare measures');
    assert.equal(globalThis.OffscreenCanvas, Broken, 'and gives it back again');
  } finally { delete globalThis.OffscreenCanvas; delete globalThis.document; }
});
