import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDENTITY, fromEuler, fromAxisAngle, qAngle, slerp, rotate, forward } from './quat.core.js';
import { TURN, SETTLE, READABLE, params, aim, softConstrain, settle, sway, isIdentity, tiltWords } from './orient.core.js';

const DEG = Math.PI / 180;
const deg = (a, b) => qAngle(a, b) / DEG;                     // the angle between two orientations, in degrees
const unit = q => Math.abs(Math.hypot(q[0], q[1], q[2], q[3]) - 1) < 1e-9;
const source = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const CORES = ['./quat.core.js', './orient.core.js'];
// a small seeded generator, so the sweeps are the same on every run and every machine
function rnd32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('the pure cores carry no library: the policy core imports its sibling and nothing else', () => {
  for (const name of CORES) {
    const src = source(name);
    const imports = [...src.matchAll(/^\s*import\b[^\n]*/gm)].map(m => m[0]);
    assert.ok(imports.length <= 1, `${name} has at most one import (${imports.length})`);
    for (const line of imports) assert.match(line, /from '\.\/quat\.core\.js';/, `${name} imports only its sibling`);
    assert.equal(/require\s*\(/.test(src), false, `${name} has no require`);
    for (const lib of ['react', 'preact', 'gl-matrix', 'requestAnimationFrame', 'getComputedStyle']) {
      assert.equal(new RegExp(lib, 'i').test(src), false, `${name} carries no ${lib}`);
    }
  }
  // one quaternion, derived once: the policy core shares the maths core rather than repeating it
  assert.equal(/^\s*import\b/m.test(source('./orient.core.js')), true, 'the policy core imports the maths core');
});

test('every orientation the policy hands out is unit-norm', () => {
  const p = params('playful');
  assert.ok(unit(aim({ pointer: [0.7, -0.4], params: p })));
  assert.ok(unit(softConstrain(fromEuler(30, 40, 10), IDENTITY, 6).q));
  assert.ok(unit(settle(IDENTITY, fromEuler(4, 9, 0), 0.016).q));
  for (let t = 0; t < 9; t += 0.9) assert.ok(unit(sway(t, 'veranda', { swayDeg: 3.5, maxTiltDeg: 16 })), `t ${t}`);
});

test('the register changes the model, not just the colour', () => {
  assert.deepEqual(params('quiet'), { maxTiltDeg: 0, swayDeg: 0, tau: 0.9, followsPointer: false, swayOn: false });
  assert.deepEqual(params('warm'), { maxTiltDeg: 6, swayDeg: 1.2, tau: 0.9, followsPointer: true, swayOn: true });
  assert.deepEqual(params('playful'), { maxTiltDeg: 16, swayDeg: 3.5, tau: 0.45, followsPointer: true, swayOn: true });
  // a lite device or Save-Data steps one register down, and quiet has nowhere to go
  assert.deepEqual(params('playful', { saveData: true }), params('warm'));
  assert.deepEqual(params('playful', { lite: true }), params('warm'));
  assert.deepEqual(params('warm', { lite: true }), params('quiet'));
  assert.deepEqual(params('quiet', { saveData: true }), params('quiet'));
  // a touch screen has no hovering pointer, so the sway carries the motion
  assert.equal(params('warm', { touch: true }).followsPointer, false);
  assert.equal(params('warm', { touch: true }).swayOn, true);
  assert.deepEqual(params('what else?'), params('warm'), 'an unknown register reads as warm');
  assert.equal(TURN.playful > TURN.warm && TURN.warm > TURN.quiet, true);
  assert.equal(READABLE.limitDeg > TURN.playful, true, 'the readable limit is never the register cone');
});

test('aim points where the reader asked, inside the register, and clamps what it cannot reach', () => {
  const warm = params('warm');
  const right = aim({ pointer: [1, 0], params: warm });
  assert.ok(Math.abs(deg(right, IDENTITY) - 6) < 1e-6, 'a full pointer right is the whole cone');
  const front = rotate(softConstrain(right, IDENTITY, 6).q, [0, 0, 1]);
  assert.ok(front[0] > 0 && forward(right)[0] < 0, 'the face turns toward +X, so the look axis goes to -X');
  assert.ok(Math.abs(deg(aim({ pointer: [0, 1], params: warm }), IDENTITY) - 6) < 1e-6, 'and down is the same size');
  assert.deepEqual(aim({ pointer: [1, 0], params: warm, turn: 0 }), IDENTITY, 'no turn asked for is no turn');
  assert.deepEqual(aim({ pointer: [9, -9], params: warm }), aim({ pointer: [1, -1], params: warm }), 'the pointer clamps');
  assert.deepEqual(aim({ pointer: [1, 1], params: params('quiet') }), IDENTITY, 'quiet asks for nothing');
  const corner = aim({ pointer: [1, 1], params: params('playful') });
  assert.ok(deg(corner, IDENTITY) > TURN.playful, 'the corners ask for more tilt than the cone holds');
  assert.ok(deg(softConstrain(corner, IDENTITY, TURN.playful).q, IDENTITY) <= TURN.playful + 1e-6, 'and the constraint trims it');
});

test('softConstrain projects onto the cone, keeping the direction, and says how far over it was', () => {
  const target = fromAxisAngle([0, 1, 0], 60 * DEG);
  for (const max of [0, 6, 16]) {
    const r = softConstrain(target, IDENTITY, max);
    assert.ok(deg(r.q, IDENTITY) <= max + 1e-6, `inside a ${max} degree cone`);
    assert.equal(r.clamped, true);
    assert.ok(Math.abs(r.overDeg - (60 - max)) < 1e-6, 'and it is honest about the overshoot');
    if (max > 0) assert.ok(rotate(r.q, [0, 0, 1])[0] > 0, 'the words still turned the way the reader asked');
  }
  const inside = softConstrain(fromAxisAngle([0, 1, 0], 3 * DEG), IDENTITY, 16);
  assert.equal(inside.clamped, false);
  assert.equal(inside.overDeg, 0);
  assert.ok(deg(inside.q, fromAxisAngle([0, 1, 0], 3 * DEG)) < 1e-5, 'a target inside the cone is left alone');
  assert.ok(deg(softConstrain(target, IDENTITY, 0).q, IDENTITY) < 1e-9, 'a zero cone is the viewer axis exactly');
});

test('the readability cone is never crossed: a seeded sweep across every register', () => {
  const rnd = rnd32(20260929);
  const views = [IDENTITY, fromEuler(0, 24, 0), fromEuler(-11, -60, 7)];
  for (const register of ['quiet', 'warm', 'playful']) {
    const { maxTiltDeg } = params(register);
    for (const qView of views) {
      for (let i = 0; i < 300; i++) {
        const target = fromEuler((rnd() * 2 - 1) * 180, (rnd() * 2 - 1) * 180, (rnd() * 2 - 1) * 180);
        const r = softConstrain(target, qView, maxTiltDeg);
        const off = deg(r.q, qView);
        assert.ok(off <= maxTiltDeg + 1e-6, `${register}: ${off.toFixed(5)} deg over a ${maxTiltDeg} deg cone`);
        assert.ok(off <= READABLE.limitDeg + 1e-6, `${register}: never past the readable limit either`);
        assert.ok(unit(r.q), 'and the result is still a unit orientation');
      }
    }
  }
});

test('settle is frame-rate independent', () => {
  const b = fromEuler(4, -16, 2);
  for (const tau of [0.45, 0.9, 2.4]) {
    let q = IDENTITY;
    for (let i = 0; i < 100; i++) q = settle(q, b, 0.01, { tau }).q;   // a hundred slow frames
    const one = settle(IDENTITY, b, 1, { tau }).q;                     // one long frame of the same second
    const apart = qAngle(q, one);
    assert.ok(apart < 1e-3, `tau ${tau}: ${apart} rad apart`);
  }
  const near = settle(slerp(IDENTITY, b, 0.999), b, 0.016);
  assert.equal(near.settled, true, 'the deadband ends the settle');
  assert.ok(qAngle(near.q, b) < 1e-12, 'and it lands on the target itself, so nothing jitters');
  assert.equal(settle(b, b, 0.016).settled, true, 'arriving is settled');
  assert.equal(settle(IDENTITY, b, 0.016).settled, false, 'a fresh turn is not');
  assert.ok(Math.abs(SETTLE.deadbandDeg - 0.25) < 1e-12);
});

test('quiet and reduced motion are the finished still, and so is a still sway', () => {
  for (const p of [params('quiet'), params('playful', { reduced: true }), params('warm', { reduced: true }), params('warm', { lite: true })]) {
    assert.equal(p.maxTiltDeg, 0);
    assert.equal(p.swayDeg, 0);
    assert.equal(p.followsPointer, false);
    assert.equal(p.swayOn, false);
    for (const t of [0, 0.7, 9.1]) assert.deepEqual(sway(t, 'veranda', { swayDeg: p.swayDeg, maxTiltDeg: p.maxTiltDeg }), IDENTITY);
    assert.deepEqual(aim({ pointer: [1, -1], params: p }), IDENTITY);
  }
  assert.deepEqual(sway(2.5, 'veranda', { swayDeg: 0 }), IDENTITY, 'no sway asked for is the still');
  assert.equal(isIdentity(sway(2.5, 'veranda', { swayDeg: 0 })), true);
});

test('the same seed and time give the same tilt, here and in the next process', () => {
  const opts = { swayDeg: 1.2, maxTiltDeg: 6 };
  const here = sway(1.25, 'veranda', opts);
  assert.deepEqual(sway(1.25, 'veranda', opts), here, 'twice in this process');
  assert.deepEqual(here, [-0.002724345445654671, 0.005325818400559714, -0.0029040035475444044, 0.9999778899373988], 'and in the next one');
  assert.ok(qAngle(sway(1.25, 'garden', opts), here) > 1e-4, 'another seed drifts elsewhere');
  assert.ok(qAngle(sway(2.5, 'veranda', opts), here) > 1e-4, 'and so does another time');
  assert.equal(deg(sway(1.25, 'veranda', opts), IDENTITY) <= 6 + 1e-6, true, 'the sway respects the cone');
  assert.equal(deg(sway(0.5, 'veranda', { swayDeg: 3.5, maxTiltDeg: 16 }), IDENTITY) > 0.5, true, 'and a playful sway really moves');
});

test('tiltWords says where the words are turned, in plain words', () => {
  assert.equal(tiltWords(IDENTITY, IDENTITY), 'The words face you.');
  assert.equal(tiltWords(fromEuler(0, 0, 0), IDENTITY), 'The words face you.');
  assert.match(tiltWords(aim({ pointer: [0.6, 0], params: params('playful') }), IDENTITY), /^The words are turned (a little|slightly|quite a way) to the right\.$/);
  assert.match(tiltWords(aim({ pointer: [-0.6, 0], params: params('playful') }), IDENTITY), / to the left\.$/);
  assert.match(tiltWords(aim({ pointer: [0, 0.9], params: params('playful') }), IDENTITY), / toward you\.$/);
  assert.match(tiltWords(fromAxisAngle([0, 1, 0], READABLE.limitDeg * 2 * DEG), IDENTITY), /^The words are turned too far to the right to read comfortably\.$/);
  for (const q of [IDENTITY, fromEuler(5, 40, 0), fromAxisAngle([1, 1, 1], 1)]) {
    const said = tiltWords(q, IDENTITY);
    assert.ok(!/\d/.test(said), 'never coordinates');
    assert.ok(!said.includes('\u2014'), 'and never an em dash');
  }
});

test('isIdentity allows the smallest drift and nothing more', () => {
  assert.equal(isIdentity(IDENTITY), true);
  assert.equal(isIdentity(undefined), true, 'nothing to say about an absent orientation');
  assert.equal(isIdentity(fromAxisAngle([0, 1, 0], 0.02 * DEG)), true);
  assert.equal(isIdentity(fromAxisAngle([0, 1, 0], 0.2 * DEG)), false);
  assert.equal(isIdentity(fromEuler(0, 6, 0)), false);
  assert.equal(isIdentity(sway(0.4, 'veranda', { swayDeg: 0 })), true);
});

test('text stays real: the pure cores touch no DOM, no layout and no element', () => {
  // The applier writes the transform on the text layer; the cores must never
  // measure or move the words, so the browser check reads the line boxes.
  for (const name of CORES) {
    const src = source(name);
    for (const word of ['document', 'window', 'getBoundingClientRect', 'requestAnimationFrame', 'style', 'innerHTML', 'textContent']) {
      assert.equal(new RegExp(word, 'i').test(src), false, `${name} must not touch ${word}`);
    }
  }
  assert.equal(/rotate\(q, \[0, 0, -1\]\)/.test(source('./quat.core.js')), true, 'the maths it does have turns a vector, not a line box');
});

test('the two pure cores fit the 12 KB allowance together', () => {
  const bytes = CORES.map(name => source(name).length);
  const total = bytes[0] + bytes[1];
  assert.ok(bytes.every(n => n < 12288), `each under 12 KB: ${bytes.join(' + ')}`);
  assert.ok(total <= 12288, `quat ${bytes[0]} + orient ${bytes[1]} = ${total} bytes`);
});