import test from 'node:test';
import assert from 'node:assert/strict';
import { diffMask, alphaMask, rasterize, shiftShapes, grow, count, share, agreement } from './pixelcheck.mjs';

const W = 60, H = 40;
const blank = () => new Uint8ClampedArray(W * H * 4).fill(255);
function paint(buf, x0, y0, x1, y1, rgb = [0, 0, 0]) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) buf.set([...rgb, 255], (y * W + x) * 4);
  return buf;
}

test('rasterize: a box and the same box as a polygon fill the same pixels; a triangle fills about half its box', () => {
  const box = rasterize([{ x: 10, y: 5, w: 20, h: 10 }], W, H);
  assert.equal(count(box), 200);
  assert.deepEqual(box, rasterize([[[10, 5], [30, 5], [30, 15], [10, 15]]], W, H));
  const tri = count(rasterize([[[0, 0], [40, 0], [0, 40]]], W, H));
  assert.ok(Math.abs(tri - 800) < 40, `triangle ${tri}`);
  assert.equal(count(rasterize([{ x: -50, y: -50, w: 20, h: 10 }], W, H)), 0, 'wholly off the buffer');
});

test('diffMask: finds exactly the pixels a layer added', () => {
  const a = blank(), b = paint(blank(), 10, 5, 30, 15);
  assert.equal(count(diffMask(a, b)), 200);
  assert.equal(count(diffMask(a, a)), 0);
  assert.equal(count(diffMask(a, paint(blank(), 10, 5, 30, 15, [250, 250, 250]))), 0, 'below the threshold');
  assert.throws(() => diffMask(a, new Uint8ClampedArray(8)), RangeError);
  assert.equal(count(alphaMask(new Uint8ClampedArray([0, 0, 0, 0, 1, 1, 1, 9]))), 1);
});

test('grow: one pixel out and one pixel in', () => {
  const m = rasterize([{ x: 10, y: 10, w: 10, h: 10 }], W, H);
  assert.equal(count(grow(m, W, H, 1)), 144);
  assert.equal(count(grow(m, W, H, -1)), 64);
  assert.equal(grow(m, W, H, 0), m);
});

test('agreement: drawing that matches the prediction scores 1; a slid prediction falls (the red control)', () => {
  const ink = diffMask(blank(), paint(blank(), 10, 5, 30, 15));
  const boxes = [{ x: 10, y: 5, w: 20, h: 10 }];
  const good = agreement(ink, rasterize(boxes, W, H), W, H);
  assert.equal(good.inside, 1);
  assert.equal(good.covered, 1);
  assert.equal(good.spill, 0);
  const slid = agreement(ink, rasterize(shiftShapes(boxes, 15, 10), W, H), W, H);
  assert.ok(slid.inside < 0.2 && slid.covered < 0.2, `slid ${slid.inside}, ${slid.covered}`);
  assert.equal(slid.inside < 0.6, true);
  assert.equal(good.inside < 0.6, false, 'the same assertion fails on the matching drawing');
});

test('agreement: ink spilling past the prediction is counted, and a tolerance band forgives a hair', () => {
  const ink = diffMask(blank(), paint(blank(), 10, 5, 34, 15)); // 4 px wider than predicted
  const pred = rasterize([{ x: 10, y: 5, w: 20, h: 10 }], W, H);
  const a = agreement(ink, pred, W, H);
  assert.ok(Math.abs(a.inside - 200 / 240) < 1e-9 && a.covered === 1);
  assert.ok(Math.abs(a.spill - 40 / 240) < 1e-9);
  assert.equal(agreement(ink, pred, W, H, { tolerance: 4 }).spill, 0);
  assert.equal(share(new Uint8Array(4), new Uint8Array(4).fill(1)), 0, 'an empty drawing shares nothing');
});
