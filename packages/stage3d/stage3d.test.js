import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseTier, isSoftwareRenderer, depthToZ, reproject, coverWindow, projectPoint, cameraAt, parseVec, follow, Z_NEAR, Z_FAR } from './stage3d.core.js';

test('chooseTier: live only with WebGL, three and motion; quiet and reduced motion draw in 2D', () => {
  assert.equal(chooseTier({ motion: 'ambient' }), 'live');
  assert.equal(chooseTier({ motion: 'full' }), 'live');
  assert.equal(chooseTier({ motion: 'still' }), '2d', 'reduced motion never downloads three');
  assert.equal(chooseTier({ motion: 'state' }), '2d', 'quiet never downloads three');
  assert.equal(chooseTier({ motion: 'ambient', webgl: false }), '2d');
  assert.equal(chooseTier({ motion: 'ambient', three: false }), '2d');
  assert.equal(chooseTier({ motion: 'ambient', lite: true }), '2d');
  assert.equal(chooseTier({ motion: 'still', forced: 'live' }), 'live', 'an explicit renderer attribute wins');
  assert.equal(chooseTier({ motion: 'ambient', forced: 'nonsense' }), 'live');
  assert.equal(chooseTier({ motion: 'ambient', software: true }), '2d', 'no GPU: a CPU-emulated live stage costs ten times a 2D one');
});

test('isSoftwareRenderer knows the CPU rasterisers and nothing else', () => {
  assert.equal(isSoftwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'), true);
  assert.equal(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)'), true);
  assert.equal(isSoftwareRenderer('ANGLE (Intel, Intel(R) UHD Graphics (0x000046D1) Direct3D11 vs_5_0 ps_5_0, D3D11)'), false);
  assert.equal(isSoftwareRenderer('Apple GPU'), false);
  assert.equal(isSoftwareRenderer(undefined), false);
});

test('depthToZ is linear in inverse distance from near (d = 1) to far (d = 0)', () => {
  assert.equal(depthToZ(1), Z_NEAR);
  assert.ok(Math.abs(depthToZ(0) - Z_FAR) < 1e-9);
  const mid = depthToZ(0.5);
  assert.ok(Math.abs(1 / mid - (1 / Z_NEAR + 1 / Z_FAR) / 2) < 1e-9);
  assert.equal(depthToZ(2), Z_NEAR, 'clamped');
});

test('from the rest camera every point projects back onto its own photo position, whatever its depth', () => {
  const pa = 0.75, tanY = Math.tan(25 * Math.PI / 180);
  const win = { left: -tanY * pa, right: tanY * pa, top: tanY, bottom: -tanY }; // the whole photo, no crop
  const rest = cameraAt(0);
  for (const [u, v, d] of [[0.5, 0.5, 0.2], [0.1, 0.9, 1], [0.47, 0.6, 0.87], [0.9, 0.05, 0]]) {
    const [x, y] = projectPoint(u, v, d, win, rest, tanY, pa);
    assert.ok(Math.abs(x - u) < 1e-9 && Math.abs(y - v) < 1e-9, `${u},${v},${d} -> ${x},${y}`);
  }
});

test('a camera move gives parallax: near points travel further than far ones', () => {
  const pa = 0.75, tanY = Math.tan(25 * Math.PI / 180);
  const win = coverWindow(0.75, pa, tanY, { overscan: 1 });
  const moved = cameraAt(0, undefined, [1, 0], 0.05);
  const [nearX] = projectPoint(0.5, 0.6, 1, win, moved, tanY, pa);
  const [farX] = projectPoint(0.5, 0.4, 0, win, moved, tanY, pa);
  assert.ok(Math.abs(nearX - 0.5) > 5 * Math.abs(farX - 0.5), `near moved ${nearX - 0.5}, far ${farX - 0.5}`);
  assert.ok(nearX < 0.5, 'moving the camera right slides near things left');
});

test('coverWindow crops the long side, keeps the chosen point near the centre, and never leaves the photo', () => {
  const tanY = 0.5, pa = 0.75;
  const phone = coverWindow(390 / 844, pa, tanY, { keep: [0.46, 0.56], overscan: 1 });
  assert.ok(Math.abs((phone.top - phone.bottom) - 2 * tanY) < 1e-9, 'a tall screen shows the full height');
  assert.ok((phone.right - phone.left) / (phone.top - phone.bottom) - 390 / 844 < 1e-9, 'at the screen aspect');
  const wide = coverWindow(16 / 9, pa, tanY, { keep: [0.5, 0.95], overscan: 1 });
  assert.ok(wide.bottom >= -tanY - 1e-9, 'a kept point near the edge is clamped so the window stays on the photo');
  const z = coverWindow(0.75, pa, tanY, { overscan: 0.9 });
  assert.ok(Math.abs((z.top - z.bottom) - 2 * tanY * 0.9) < 1e-9, 'overscan zooms in');
});

test('cameraAt follows the dolly path and the parallax strength', () => {
  const c = cameraAt(1, [0, -0.06, 0.28, -3]);
  assert.deepEqual([c.x, +c.y.toFixed(3), +c.z.toFixed(3)], [0, -0.06, -0.28]);
  assert.ok(Math.abs(c.pitch + 3 * Math.PI / 180) < 1e-12);
  assert.equal(cameraAt(0.5, [0, 0, 0.2, 0], [1, 0], 0.04).x, 0.04);
  assert.equal(cameraAt(0, undefined, [9, 0], 0.04).x, 0.04, 'pointer is clamped to [-1, 1]');
});

test('parseVec and follow', () => {
  assert.deepEqual(parseVec('0.4 0.6', [0.5, 0.5]), [0.4, 0.6]);
  assert.deepEqual(parseVec('x 0.6', [0.5, 0.5]), [0.5, 0.6]);
  assert.deepEqual(parseVec(null, [1, 2]), [1, 2]);
  assert.equal(follow(0, 1, 0, 0.3), 0);
  assert.ok(Math.abs(follow(0, 1, 0.3, 0.3) - (1 - Math.exp(-1))) < 1e-12);
  assert.ok(follow(0, 1, 10, 0.3) > 0.999);
});
