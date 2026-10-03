import test from 'node:test';
import assert from 'node:assert/strict';
import { luminance, ratio, over, needed, judge } from './contrast.mjs';

test('black on white is 21:1, and a colour on itself is 1:1', () => {
  assert.equal(Math.round(ratio([0, 0, 0], [255, 255, 255])), 21);
  assert.equal(ratio([120, 40, 40], [120, 40, 40]), 1);
  assert.equal(luminance([255, 255, 255]), 1);
});

test('known WCAG pairs', () => {
  // #767676 on white is the classic 4.54:1 grey
  assert.ok(Math.abs(ratio([118, 118, 118], [255, 255, 255]) - 4.54) < 0.01);
  assert.ok(ratio([119, 119, 119], [255, 255, 255]) < 4.5);
});

test('the order of the two colours does not matter', () => {
  assert.equal(ratio([10, 20, 30], [200, 210, 220]), ratio([200, 210, 220], [10, 20, 30]));
});

test('source-over compositing', () => {
  assert.deepEqual(over([0, 0, 0, 1], 0.5, [255, 255, 255]), [128, 128, 128]);
  assert.deepEqual(over([10, 20, 30], 1, [255, 255, 255]), [10, 20, 30]);
  assert.deepEqual(over([10, 20, 30], 0, [200, 200, 200]), [200, 200, 200]);
});

test('large text needs 3:1, the rest 4.5:1', () => {
  assert.equal(needed(16, 400), 4.5);
  assert.equal(needed(24, 400), 3);
  assert.equal(needed(18.66, 700), 3);
  assert.equal(needed(18.66, 400), 4.5);
  assert.equal(needed(18, 700), 4.5);
});

test('judge: passes, fails, and never passes what it could not measure', () => {
  const white = [[255, 255, 255, 1]];
  const r = judge([
    { path: 'ok', text: 'a', fg: [0, 0, 0, 1], layers: white, size: 16, weight: '400' },
    { path: 'grey', text: 'b', fg: [130, 130, 130, 1], layers: white, size: 16, weight: '400' },
    { path: 'big grey', text: 'c', fg: [130, 130, 130, 1], layers: white, size: 30, weight: '400' },
    { path: 'on image', text: 'd', fg: [0, 0, 0, 1], layers: [], size: 16, weight: '400', unknown: 'a background image' },
    { path: 'on tint', text: 'e', fg: [0, 0, 0, 1], layers: [[255, 255, 255, 1], [200, 0, 0, 0.5]], size: 16, weight: '400' },
  ]);
  assert.equal(r.checked, 4);
  assert.deepEqual(r.failures.map(f => f.path), ['grey']);
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0].path, 'on image');
});

test('judge: a floor raises the bar for everything', () => {
  const r = judge([{ path: 'x', text: 'x', fg: [118, 118, 118, 1], layers: [[255, 255, 255, 1]], size: 16, weight: '400' }], { floor: 7 });
  assert.equal(r.failures.length, 1);
});
