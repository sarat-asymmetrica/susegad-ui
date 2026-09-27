import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneName, sceneParams, illustration, DEFAULT_SCENE, STRINGS } from './empty.core.js';

test('runs in Node with no DOM', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof STRINGS, 'object');
});

test('scene names are folder names, or the default', () => {
  assert.equal(sceneName('paus'), 'paus');
  assert.equal(sceneName(' kolam '), 'kolam');
  assert.equal(sceneName(null), DEFAULT_SCENE);
  assert.equal(sceneName(''), DEFAULT_SCENE);
  for (const bad of ['../core', 'Paus', 'paus/index', 'https://x.test/a', 'a'.repeat(40)]) assert.equal(sceneName(bad), DEFAULT_SCENE, bad);
});

test('scene-* attributes pass through, nothing else does', () => {
  const p = sceneParams([['scene', 'paus'], ['scene-intensity', '0.5'], ['scene-seed', '4'], ['class', 'x'], ['scene-', 'y'], ['scene-Bad', 'z'], ['role', 'region']]);
  assert.deepEqual(p, { intensity: '0.5', seed: '4' });
});

test('the quiet drawing is plain path data, the same every time', () => {
  const a = illustration('paus'), b = illustration('paus');
  assert.deepEqual(a, b);
  assert.equal(a.viewBox, '0 0 160 112');
  for (const d of [a.lines, a.marks]) { assert.match(d, /^M/); assert.ok(!/NaN|undefined/.test(d)); }
  const other = illustration('kolam');
  assert.notEqual(other.lines, a.lines, 'other scenes get the neutral tray');
  assert.equal(other.marks, '');
});

test('the drawing stays inside its box', () => {
  for (const name of ['paus', 'other']) {
    const nums = (illustration(name).lines + illustration(name).marks).match(/-?\d+(\.\d+)?/g).map(Number);
    // absolute coordinates sit in 0..160; relative moves (h-100) can be negative, never beyond the box width
    assert.ok(nums.every(n => n >= -160 && n <= 160), `${name}: ${nums.filter(n => n < -160 || n > 160)}`);
  }
});
