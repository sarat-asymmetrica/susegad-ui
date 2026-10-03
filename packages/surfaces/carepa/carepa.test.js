import test from 'node:test';
import assert from 'node:assert/strict';
import { panes, paneShape, sheenHue, sheenNear, driftSun, model, ARCH, WIN } from './model.js';

test('the same seed gives the same panes, every time (A5: seeds make it deterministic)', () => {
  const a = panes(7), b = panes(7);
  assert.equal(a.length, b.length);
  assert.deepEqual(a, b);
  assert.notDeepEqual(panes(7), panes(8));
});

test('49 grid panes plus a fan light of 3 + 7 wedges', () => {
  const p = panes(1);
  assert.equal(p.filter(q => q.kind === 'grid').length, 49);
  assert.equal(p.filter(q => q.kind === 'fan').length, 10);
});

test('a grid pane\'s shape is its own rectangle', () => {
  const p = panes(1).find(q => q.kind === 'grid');
  const shape = paneShape(p);
  assert.equal(shape.length, 4);
  assert.ok(shape.every(([x, y]) => x >= WIN.x && x <= WIN.x + WIN.w && y >= WIN.y && y <= WIN.y + WIN.h));
});

test('a fan pane\'s shape stays within the arch\'s radius', () => {
  const p = panes(1).find(q => q.kind === 'fan');
  const shape = paneShape(p);
  assert.ok(shape.length > 0);
  for (const [x, y] of shape) assert.ok(Math.hypot(x - ARCH.cx, y - ARCH.cy) <= ARCH.r + 1);
});

test('sheen hue is a full 0..360 circle and repeats for the same angle', () => {
  const p = { cx: 500, cy: 400, tone: 0 };
  const sun = { x: 500, y: 100 };
  const hue = sheenHue(p, sun);
  assert.ok(hue >= 0 && hue < 360);
  assert.equal(sheenHue(p, sun), hue, 'pure: same inputs, same hue');
  assert.notEqual(sheenHue(p, { x: 100, y: 700 }), hue, 'a different light angle turns the sheen');
});

test('sheen brightness falls off with distance from the light, and never goes negative', () => {
  const p = { cx: 500, cy: 400 };
  const near = sheenNear(p, { x: 500, y: 400 });
  const far = sheenNear(p, { x: 500 + 2000, y: 400 });
  assert.equal(near, 1);
  assert.equal(far, 0);
  assert.ok(near > sheenNear(p, { x: 500 + 300, y: 400 }));
});

test('without a pointer, the sun drifts smoothly and deterministically across the top of the window', () => {
  const a = driftSun(0), b = driftSun(0);
  assert.deepEqual(a, b);
  const c = driftSun(3);
  assert.notDeepEqual(a, c);
  assert.ok(Math.abs(a.x - ARCH.cx) <= 231 && Math.abs(c.x - ARCH.cx) <= 231);
});

test('model() returns every pane with a hue and a nearness, and playful brightens', () => {
  const warm = model({ time: 1, seed: 3, register: 'warm' });
  const playful = model({ time: 1, seed: 3, register: 'playful' });
  assert.equal(warm.panes.length, 59);
  assert.ok(warm.panes.every(p => typeof p.hue === 'number' && typeof p.near === 'number'));
  assert.equal(warm.brighten, 1);
  assert.equal(playful.brighten, 1.35);
  assert.ok(playful.brighten > warm.brighten, 'playful catches more light (brief: "the same, brighter and more of them")');
});

test('a given sun in params overrides the time-driven drift, and the model stays pure', () => {
  const sun = { x: 111, y: 222 };
  const a = model({ time: 5, seed: 1, params: { sun } });
  const b = model({ time: 999, seed: 1, params: { sun } });
  assert.deepEqual(a.sun, sun);
  assert.deepEqual(a.panes.map(p => p.hue), b.panes.map(p => p.hue), 'the same sun gives the same sheen regardless of time');
});
