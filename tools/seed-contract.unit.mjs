// (Named .unit.mjs, not .test.mjs: `npm run test:unit` lists it, and test:tools globs *.test.mjs, so it runs once.)
// The same-seed contract (docs/GOAL-RIGOUR.md, rung 3d): every scene's pure model, built twice from the same
// { seed, time, register, params }, returns deeply equal data; built from a different seed, it differs where the scene
// is seeded. The scenes are found by walking packages/ for model.js, so a new scene is covered without editing this file.
//
// A scene whose frame does not depend on the seed is named in UNSEEDED with the reason. The test goes red both ways:
// a scene that ignores its seed and is not listed, and a listed scene that has begun to use one. Node only, no browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'packages');

// Scenes whose model takes no seed, and why. Each is checked: the listed reason has to still be true.
export const UNSEEDED = {
  mankurad: 'its model signature takes no seed: the frame is a function of time, register and params alone',
};

/** Every model.js under packages/ as { name, file }, the name being the scene's folder. */
export function findModels(root = PACKAGES) {
  const found = [];
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'model.js') found.push({ name: path.basename(dir), file: p });
    }
  };
  walk(root);
  return found.sort((a, b) => a.file.localeCompare(b.file));
}

const REGISTERS = ['quiet', 'warm', 'playful'];
const TIMES = [0, 3.7, 41];
const SEEDS = [1, 7, 20260418];

// The data a frame carries, with functions named rather than compared (two builds make two closures), typed arrays
// and collections as plain ones, and cycles kept (vel's tree points at its parents).
function plain(v, seen = new WeakMap()) {
  if (typeof v === 'function') return '[function]';
  if (v === null || typeof v !== 'object') return v;
  if (seen.has(v)) return seen.get(v);
  if (ArrayBuffer.isView(v)) return Array.from(v);
  const out = Array.isArray(v) ? [] : {};
  seen.set(v, out);
  const entries = v instanceof Map ? [...v] : v instanceof Set ? [...v] : null;
  if (entries) return entries.map(e => plain(e, seen));
  for (const k of Object.keys(v)) out[k] = plain(v[k], seen);
  return out;
}
const same = (x, y) => isDeepStrictEqual(x, y);
const call = (model, seed, time, register) => model({ time, seed, register, params: {}, W: 1000, H: 1000 });

const models = findModels();

test('the walk finds the scenes (a count that has dropped means the walk broke)', () => {
  assert.ok(models.length >= 34, `found ${models.length} model.js files`);
});

for (const { name, file } of models) {
  test(`seed contract: ${name}`, async () => {
    // two instances of the module, so a scene that caches its build per seed is built from scratch twice
    const one = await import(`${pathToFileURL(file).href}?build=1`), two = await import(`${pathToFileURL(file).href}?build=2`);
    const mod = one;
    assert.equal(typeof mod.model, 'function', `${name}/model.js exports no model()`);
    let differs = false;
    for (const register of REGISTERS) for (const time of TIMES) {
      const a = plain(call(mod.model, SEEDS[0], time, register)), b = plain(call(two.model, SEEDS[0], time, register));
      assert.ok(same(a, b), `${name}: same seed ${SEEDS[0]}, time ${time}, ${register} gave two different frames across two builds`);
      for (const seed of SEEDS.slice(1)) {
        const c = plain(call(mod.model, seed, time, register));
        assert.ok(same(c, plain(call(two.model, seed, time, register))), `${name}: same seed ${seed}, time ${time}, ${register} gave two different frames`);
        if (!same(c, a)) differs = true;
      }
    }
    if (name in UNSEEDED) assert.equal(differs, false, `${name} is listed as unseeded (${UNSEEDED[name]}) but a different seed changed its frame: take it off UNSEEDED`);
    else assert.equal(differs, true, `${name}: no seed in ${SEEDS.join(', ')} changed any frame at any time or register. If the scene really takes no seed, name it in UNSEEDED with the reason`);
  });
}

test('every UNSEEDED name is a scene that exists', () => {
  const names = new Set(models.map(m => m.name));
  for (const n of Object.keys(UNSEEDED)) assert.ok(names.has(n), `UNSEEDED lists ${n}, which has no model.js`);
});
