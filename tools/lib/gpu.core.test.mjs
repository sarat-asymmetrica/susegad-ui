import test from 'node:test';
import assert from 'node:assert/strict';
import { decideGpu, gpuGate, parseSkips, skipLine, forcedSoftware } from './gpu.core.js';
import { isSoftwareRenderer } from '../../packages/stage3d/stage3d.core.js';

const SWIFT = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)';
const NVIDIA = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)';

test('the decision is the library\'s: software exactly when isSoftwareRenderer says so', () => {
  for (const r of [SWIFT, NVIDIA, 'llvmpipe (LLVM 19.1.1, 256 bits)', 'Apple GPU', 'Microsoft Basic Render Driver', '']) {
    assert.equal(decideGpu({ available: true, renderer: r }, { forced: false }).software, isSoftwareRenderer(r), r);
  }
  assert.equal(decideGpu({ available: true, renderer: SWIFT }, { forced: false }).software, true);
  assert.equal(decideGpu({ available: true, renderer: NVIDIA }, { forced: false }).software, false);
  assert.equal(decideGpu({ available: true, renderer: 'Apple GPU' }, { forced: false }).software, false);
});

test('real GPUs are never software: Intel UHD, AMD Radeon, Apple M-series', () => {
  for (const r of ['ANGLE (Intel, Intel(R) UHD Graphics (0x000046D1) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ANGLE (AMD, AMD Radeon RX 7800 XT (0x0000747E) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', 'Apple M3 Pro']) {
    assert.equal(decideGpu({ available: true, renderer: r }, { forced: false }).software, false, r);
  }
});

test('no WebGL at all is a skip too, labelled "none"', () => {
  const g = decideGpu({ available: false, renderer: '' }, { forced: false });
  assert.equal(g.software, true);
  assert.equal(g.label, 'none');
});

test('the override makes any renderer software and says so', () => {
  const g = decideGpu({ available: true, renderer: NVIDIA }, { forced: true });
  assert.equal(g.software, true);
  assert.match(g.label, /^forced by SG_FORCE_SOFTWARE_GL: ANGLE \(NVIDIA/);
  assert.equal(forcedSoftware({ SG_FORCE_SOFTWARE_GL: '1' }), true);
  assert.equal(forcedSoftware({ SG_FORCE_SOFTWARE_GL: '0' }), false);
  assert.equal(forcedSoftware({}), false);
});

test('a hardware gate never skips; a software gate skips, prints the line and counts it', () => {
  const lines = [];
  const hw = gpuGate(decideGpu({ available: true, renderer: NVIDIA }, { forced: false }), l => lines.push(l));
  assert.equal(hw.skip('x'), false);
  assert.deepEqual(lines, []);
  assert.equal(hw.finalLine(22, 22), '22 of 22 pass');
  const sw = gpuGate(decideGpu({ available: true, renderer: SWIFT }, { forced: false }), l => lines.push(l));
  assert.equal(sw.skip('warm: draws on the live tier'), true);
  assert.deepEqual(lines, [`skip  warm: draws on the live tier  (no GPU: ${SWIFT})`]);
  assert.equal(sw.finalLine(17, 17), '17 of 17 pass, 1 skipped (no GPU)');
});

test('parseSkips reads the skip lines back, and only the no-GPU ones', () => {
  const sw = decideGpu({ available: true, renderer: SWIFT }, { forced: false });
  const out = ['pass  a  (x)', skipLine('warm: draws on the live tier (a, b)', sw), 'skip  c  (needs the live WebGL readback: Chromium only; this run is webkit)', skipLine('playful: the camera leans', sw), 'FAIL  d', '17 of 17 pass, 2 skipped (no GPU)'].join('\n');
  assert.deepEqual(parseSkips(out), ['warm: draws on the live tier (a, b)', 'playful: the camera leans']);
  assert.deepEqual(parseSkips('pass  a\n3 of 3 pass'), []);
  // a line that merely contains a skip line (a FAIL quoting one) is not a skip: the anchor matters
  assert.deepEqual(parseSkips('FAIL  a  skip  x  (no GPU: y)'), []);
});
