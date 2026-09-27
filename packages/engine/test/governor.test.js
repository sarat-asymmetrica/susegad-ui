import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGovernor } from '../index.js';

const feed = (g, ms, n) => { for (let i = 0; i < n; i++) g.sample(ms); return g.level; };

test('a fast machine never leaves max', () => {
  const g = createGovernor();
  assert.equal(feed(g, 16.7, 5000), 1);
  assert.equal(feed(g, 8.3, 5000), 1, '120 Hz');
});

test('steps down a notch per slow window, to min and no further', () => {
  const changes = [];
  const g = createGovernor({ window: 30, onchange: (l, p) => changes.push([p, l]) });
  assert.equal(feed(g, 33, 29), 1, 'settles for a whole window first');
  assert.equal(feed(g, 33, 1), 0.75);
  assert.equal(feed(g, 33, 30), 0.5);
  assert.equal(feed(g, 33, 30), 0.25);
  assert.equal(feed(g, 33, 300), 0.25, 'min holds');
  assert.deepEqual(changes, [[1, 0.75], [0.75, 0.5], [0.5, 0.25]]);
  assert.ok(g.mean > 30);
});

test('climbs back up after calm, and backs off when a climb was too hopeful', () => {
  const g = createGovernor({ window: 20, patience: 3 });
  feed(g, 40, 20);
  assert.equal(g.level, 0.75);
  // calm: a window to settle, then patience × window calm samples
  assert.equal(feed(g, 16, 20 + 58), 0.75);
  assert.equal(feed(g, 16, 1), 1, 'steps up');
  // too hopeful: slow again at max
  feed(g, 40, 20);
  assert.equal(g.level, 0.75);
  // patience has doubled: the old wait is not enough now
  assert.equal(feed(g, 16, 20 + 60), 0.75);
  assert.equal(feed(g, 16, 60), 1);
});

test('middling frames neither step down nor up', () => {
  const g = createGovernor({ window: 20 });
  feed(g, 40, 20);
  assert.equal(feed(g, 16.7 * 1.3, 2000), 0.75);
});

test('ignores hidden-tab gaps and nonsense', () => {
  const g = createGovernor({ window: 10 });
  for (const v of [0, -5, NaN, 1000, Infinity]) feed(g, v, 50);
  assert.equal(g.level, 1);
});

test('custom range and step; reset goes back to max and tells onchange', () => {
  let seen = null;
  const g = createGovernor({ min: 0.5, max: 0.9, step: 0.2, window: 5, target: 1000 / 30 });
  g.onchange = l => { seen = l; };
  assert.equal(g.level, 0.9);
  feed(g, 40, 50);
  assert.equal(g.level, 0.9, '40 ms is fine against a 30 Hz target');
  feed(g, 80, 5);
  assert.equal(g.level, 0.7);
  feed(g, 80, 50);
  assert.equal(g.level, 0.5);
  g.reset();
  assert.equal(g.level, 0.9);
  assert.equal(seen, 0.9);
});
