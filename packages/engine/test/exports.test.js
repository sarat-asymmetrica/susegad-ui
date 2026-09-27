import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../index.js';

// Every name the Wave 0 shim (a copy of Susegad's lib/sketch.js) exported.
// Scenes were ported against these; they must keep working.
const SHIM = [
  'TAU', 'clamp', 'lerp', 'invLerp', 'smoothstep', 'dist', 'phase', 'ease', 'boil',
  'hashSeed', 'rng', 'makeNoise', 'N', 'hexToRgb', 'rgba', 'mix',
  'resample', 'catmull', 'measure', 'ellipse', 'blob', 'roughen', 'toPath', 'bbox',
  'stage', 'loop', 'run', 'pointer', 'grainPattern', 'paper', 'ink', 'pencil', 'hatch', 'wash',
];
const ADDED = [
  'chaikin', 'flow', 'curl', 'domainWarp', 'sampleGrid', 'contours', 'poissonDisc',
  'grayScott', 'gsSpot', 'gsStep', 'createGovernor',
  'FULLSCREEN_VERT', 'shaderError', 'compileProgram', 'createGL', 'glSurface',
];

test('index.js exports a superset of the shim, importable in Node', () => {
  for (const name of SHIM) assert.ok(name in engine, `missing ${name}`);
  for (const name of ADDED) assert.ok(name in engine, `missing ${name}`);
});

test('shim names have the shim types', () => {
  assert.equal(typeof engine.TAU, 'number');
  assert.equal(typeof engine.ease, 'object');
  assert.equal(typeof engine.N, 'function');
  assert.equal(typeof engine.N.fbm, 'function');
  for (const name of SHIM.filter(n => !['TAU', 'ease'].includes(n))) assert.equal(typeof engine[name], 'function', name);
});

test('pure modules never touch the DOM', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const m of ['math', 'rng', 'noise', 'color', 'geom', 'fields', 'governor']) {
    const src = (await readFile(new URL(`../src/${m}.js`, import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(src, /\b(window\.|document\.|globalThis\.|Path2D|DOMMatrix|getContext|performance\.|requestAnimationFrame)/, m);
  }
});
