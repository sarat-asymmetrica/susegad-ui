import test from 'node:test';
import assert from 'node:assert/strict';
import { pixelDistance, comparePixels } from './pixeldiff.mjs';

const img = (w, h, rgba) => {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < a.length; i += 4) a.set(rgba, i);
  return a;
};

test('pixel distance runs from 0 for equal pixels to 1 for black against white', () => {
  assert.equal(pixelDistance(10, 20, 30, 255, 10, 20, 30, 255), 0);
  assert.ok(Math.abs(pixelDistance(0, 0, 0, 255, 255, 255, 255, 255) - 1) < 1e-9);
  // Transparent anything reads as white.
  assert.equal(pixelDistance(0, 0, 0, 0, 255, 255, 255, 255), 0);
  const small = pixelDistance(100, 100, 100, 255, 102, 100, 100, 255);
  assert.ok(small > 0 && small < 0.01);
});

test('identical images pass with nothing changed', () => {
  const a = img(4, 3, [30, 40, 50, 255]);
  const r = comparePixels(a, a.slice(), 4, 3);
  assert.equal(r.changed, 0);
  assert.equal(r.pass, true);
  assert.equal(r.bbox, null);
  assert.equal(r.diff.length, 4 * 3 * 4);
});

test('changed pixels are counted, boxed and painted', () => {
  const a = img(10, 10, [255, 255, 255, 255]);
  const b = a.slice();
  for (const [x, y] of [[2, 3], [7, 5]]) b.set([0, 0, 0, 255], (y * 10 + x) * 4);
  const r = comparePixels(a, b, 10, 10, { maxRatio: 0.01 });
  assert.equal(r.changed, 2);
  assert.equal(r.ratio, 0.02);
  assert.equal(r.pass, false);
  assert.deepEqual(r.bbox, { x: 2, y: 3, w: 6, h: 3 });
  const at = (3 * 10 + 2) * 4;
  assert.deepEqual([...r.diff.slice(at, at + 4)], [227, 66, 52, 255]);
  assert.equal(comparePixels(a, b, 10, 10, { maxRatio: 0.02 }).pass, true);
});

test('the threshold ignores tiny colour noise', () => {
  const a = img(2, 2, [100, 100, 100, 255]);
  const b = img(2, 2, [101, 100, 99, 255]);
  assert.equal(comparePixels(a, b, 2, 2).changed, 0);
  assert.equal(comparePixels(a, b, 2, 2, { threshold: 0 }).changed, 4);
});

test('mismatched buffers throw', () => {
  assert.throws(() => comparePixels(new Uint8ClampedArray(16), new Uint8ClampedArray(12), 2, 2), /does not match/);
});
