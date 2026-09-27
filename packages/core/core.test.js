import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRegister, resolveMotion, stepDown, normalizeRegister, readRegister, observeRegister } from './register.js';
import {
  defineScene, getScene, whenSceneDefined, coerceParam, paramsFromAttributes, mergeParams,
  defaultParams, coerceSeed, toKebab, toCamel,
} from './define-scene.js';
import * as core from './index.js';

test('register: nearest wins, own beats ancestors, default warm', () => {
  assert.equal(resolveRegister().register, 'warm');
  assert.equal(resolveRegister({ ancestors: [null, 'quiet', 'playful'] }).register, 'quiet');
  assert.equal(resolveRegister({ own: 'playful', ancestors: ['quiet'] }).register, 'playful');
  assert.equal(resolveRegister({ own: 'loud', ancestors: [' Quiet '] }).register, 'quiet', 'invalid values are skipped');
});

test('register: Save-Data and low power step down once', () => {
  assert.equal(stepDown('playful'), 'warm');
  assert.equal(stepDown('warm'), 'quiet');
  assert.equal(stepDown('quiet'), 'quiet');
  const r = resolveRegister({ own: 'playful', saveData: true, lowPower: true });
  assert.equal(r.register, 'warm');
  assert.equal(r.declared, 'playful');
});

test('motion: reduced motion always wins; quiet scenes are still', () => {
  assert.equal(resolveMotion('playful', { reducedMotion: true }), 'still');
  assert.equal(resolveMotion('quiet'), 'still');
  assert.equal(resolveMotion('quiet', { forScene: false }), 'state');
  assert.equal(resolveMotion('warm'), 'ambient');
  assert.equal(resolveMotion('playful'), 'full');
  assert.equal(normalizeRegister('WARM'), 'warm');
  assert.equal(normalizeRegister(3), null);
});

test('register DOM edge is inert without a DOM', () => {
  const el = { getAttribute: n => (n === 'register' ? 'quiet' : null), parentNode: null };
  assert.equal(readRegister(el), 'quiet');
  assert.equal(typeof observeRegister(el, () => {}), 'function');
});

test('params: coercion by type, clamped, with defaults', () => {
  const n = { type: 'number', default: 0.5, min: 0, max: 1 };
  assert.equal(coerceParam(n, '0.25'), 0.25);
  assert.equal(coerceParam(n, '7'), 1);
  assert.equal(coerceParam(n, '-2'), 0);
  assert.equal(coerceParam(n, 'soon'), 0.5);
  assert.equal(coerceParam(n, null), 0.5);
  assert.equal(coerceParam({ type: 'number', default: null }, null), null, 'null default means unset');
  assert.equal(coerceParam({ type: 'int', min: 3, max: 9 }, '4.6'), 5);
  const b = { type: 'bool', default: false };
  assert.equal(coerceParam(b, ''), true, 'a bare attribute is true');
  assert.equal(coerceParam(b, 'false'), false);
  assert.equal(coerceParam(b, 'off'), false);
  assert.equal(coerceParam(b, null), false);
  const e = { type: 'enum', default: 'a', values: ['a', 'b'] };
  assert.equal(coerceParam(e, 'b'), 'b');
  assert.equal(coerceParam(e, 'c'), 'a');
  assert.equal(coerceParam({ type: 'string' }, 42), '42');
});

test('params: kebab-case attributes, merge and seeds', () => {
  assert.equal(toKebab('dotSpacing'), 'dot-spacing');
  assert.equal(toCamel('dot-spacing'), 'dotSpacing');
  const params = { dotSpacing: { type: 'number', default: 1, max: 4 }, shape: { type: 'enum', default: 'a', values: ['a', 'b'] } };
  const attrs = { 'dot-spacing': '9' };
  assert.deepEqual(paramsFromAttributes(params, a => attrs[a] ?? null), { dotSpacing: 4, shape: 'a' });
  assert.deepEqual(mergeParams(params, defaultParams(params), { 'dot-spacing': '2', shape: 'b', nope: 1 }), { dotSpacing: 2, shape: 'b' });
  assert.equal(coerceSeed('12'), 12);
  assert.equal(coerceSeed('monsoon'), 'monsoon');
  assert.equal(coerceSeed(null, 7), 7);
});

test('defineScene: registry, whenSceneDefined, validation', async () => {
  const waiting = whenSceneDefined('test-scene');
  const def = defineScene({
    name: 'test-scene', meta: { W: 10, H: 10 },
    params: { progress: { type: 'number', default: null, min: 0, max: 1 } },
    model: () => ({}), createRenderer: () => ({ render() {}, destroy() {} }),
  });
  assert.equal(await waiting, def);
  assert.equal(getScene('test-scene'), def);
  assert.deepEqual(def.attributes, ['progress']);
  assert.equal(def.kind, 'canvas2d');
  assert.ok(Object.isFrozen(def));
  const base = { meta: { W: 1, H: 1 }, model() {}, createRenderer() {} };
  assert.throws(() => defineScene({ ...base, name: 'Bad Name' }), /kebab-case/);
  assert.throws(() => defineScene({ ...base, name: 'x', params: { seed: { type: 'int' } } }), /clashes/);
  assert.throws(() => defineScene({ ...base, name: 'x', params: { a: { type: 'enum' } } }), /values/);
  assert.throws(() => defineScene({ ...base, name: 'x', meta: {} }), /W and H/);
});

test('core index loads in Node without defining an element', () => {
  assert.equal(typeof core.defineScene, 'function');
  assert.equal(typeof core.SgScene, 'function');
});
