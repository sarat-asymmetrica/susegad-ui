import test from 'node:test';
import assert from 'node:assert/strict';
import { percentile, frameStats, bytesByFolder, baselineRatio } from './stats.mjs';

test('nearest-rank percentile', () => {
  const v = [5, 1, 4, 2, 3, 6, 7, 8, 9, 10];
  assert.equal(percentile(v, 50), 5);
  assert.equal(percentile(v, 95), 10);
  assert.equal(percentile(v, 0), 1);
  assert.equal(percentile([7], 95), 7);
  assert.ok(Number.isNaN(percentile([], 95)));
});

test('frame stats count whole missed intervals as dropped frames', () => {
  const vs = 1000 / 60;
  const st = frameStats([vs, vs, 24, 2 * vs, 3 * vs + 1]);
  assert.equal(st.count, 5);
  assert.equal(st.dropped, 0 + 0 + 0 + 1 + 2);
  assert.equal(st.worst, 3 * vs + 1);
  assert.ok(Math.abs(st.mean - (4 * vs + 24 + 3 * vs + 1) / 5) < 1e-9);
  assert.equal(frameStats([]).count, 0);
});

test('bytes group by piece folder', () => {
  const g = bytesByFolder([
    { path: '/packages/engine/src/rng.js', bytes: 100 },
    { path: '/packages/engine/index.js', bytes: 10 },
    { path: '/packages/scenes/kolam/model.js', bytes: 300 },
    { path: '/packages/scenes/kolam/render.js', bytes: 200 },
    { path: '/packages/core/index.js', bytes: 50 },
    { path: '/tools/fixtures/fixture-scene/index.js', bytes: 7 },
    { path: '/app.js', bytes: 1 },
  ]);
  const by = Object.fromEntries(g.map(x => [x.folder, x]));
  assert.equal(by['packages/scenes/kolam'].bytes, 500);
  assert.equal(by['packages/scenes/kolam'].files, 2);
  assert.equal(by['packages/engine'].bytes, 110);
  assert.equal(by['packages/core'].bytes, 50);
  assert.equal(by['tools/fixtures'].bytes, 7);
  assert.equal(by['(root)'].bytes, 1);
  assert.equal(g[0].folder, 'packages/scenes/kolam');
});

test('baseline ratio and the 10% slack', () => {
  assert.deepEqual(baselineRatio(11, 10), { ratio: 1.1, within: true });
  assert.equal(baselineRatio(11.2, 10).within, false);
  assert.equal(baselineRatio(5, 10).within, true);
  assert.equal(baselineRatio(5, 0).within, false);
});
