import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curtainEdge } from './curtain.js';

const box = { x0: 100, y0: 50, x1: 500, y1: 250 };

test('curtainEdge: a dropped curtain runs a little past the foot, an up one sits at the top', () => {
  const down = curtainEdge(box, 1, (x, b) => b);
  assert.equal(down[1][1], 280);
  const up = curtainEdge(box, 0, (x, b) => b);
  assert.equal(up[1][1], 50);
});

test('curtainEdge: starts and ends at the top corners and spans the opening', () => {
  const e = curtainEdge(box, 0.5, (x, b) => b, 25);
  assert.deepEqual(e[0], [100, 50]);
  assert.deepEqual(e.at(-1), [500, 50]);
  assert.equal(e[1][0], 100);
  assert.equal(e.at(-2)[0], 500);
});

test('curtainEdge: the hem function gets x and the straight bottom, and shapes the edge', () => {
  const seen = [];
  const e = curtainEdge(box, 1, (x, b) => { seen.push([x, b]); return b + (x - 100) * 0.1; }, 100);
  assert.ok(seen.every(([, b]) => b === 280));
  assert.equal(e[1][1], 280);
  assert.equal(e.at(-2)[1], 320);
});
