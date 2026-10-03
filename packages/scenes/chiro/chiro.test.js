import test from 'node:test';
import assert from 'node:assert/strict';
import chiro from './index.js';
import {
  buildWall, rasterWall, allocFields, fieldRows, gsStep, reaction, seedStone, mossTimes, seasons, stampHand, model, LOOKS,
  W, H, GW, GH, NC, T0, CYCLE, STILL_T, STONE_RATE, STONE_MAX,
} from './model.js';
import { makeNoise } from '../../engine/index.js';
import { meta } from './meta.js';

const strip = w => ({ ...w, nz: null });

test('same seed, same wall; different seeds differ', () => {
  assert.deepEqual(strip(buildWall(3)), strip(buildWall(3)));
  assert.notDeepEqual(strip(buildWall(3)).blocks.map(b => b.x), strip(buildWall(4)).blocks.map(b => b.x));
});

test('the wall is courses of blocks in a running bond, with joints between', () => {
  const w = buildWall(1);
  assert.ok(w.blocks.length > 12, `${w.blocks.length} blocks`);
  assert.ok(w.J > 10 && w.J < 16);
  const g = rasterWall(w);
  const count = v => g.mask.reduce((n, m) => n + (m === v ? 1 : 0), 0);
  assert.ok(count(2) > NC * 0.5, 'mostly stone');
  assert.ok(count(1) > NC * 0.05, 'joints between the blocks');
  assert.ok(count(0) > 0, 'the ground hides the foot');
});

test('each block is its own dish: a reaction never crosses a joint', () => {
  const w = buildWall(1), g = rasterWall(w), fl = allocFields();
  fieldRows(w, g, fl, 0, GH);
  const s = reaction();
  seedStone(s, w, g, fl.F);
  for (let k = 0; k < 60; k++) { gsStep(s.U, s.V, s.U2, s.V2, fl.F, fl.K, g.onStone, fl.D, g.stoneSpans); s.swap(); }
  for (let c = 0; c < NC; c++) if (g.mask[c] !== 2) assert.equal(s.V[c], 0, `cell ${c} off the stone stays clean`);
  assert.ok(s.V.some(v => v > 0.05), 'the pits have begun');
});

test('the reaction is deterministic for a seed', () => {
  const run = () => {
    const w = buildWall(2), g = rasterWall(w), fl = allocFields(); fieldRows(w, g, fl, 0, GH);
    const s = reaction(); seedStone(s, w, g, fl.F);
    for (let k = 0; k < 30; k++) { gsStep(s.U, s.V, s.U2, s.V2, fl.F, fl.K, g.onStone, fl.D, g.stoneSpans); s.swap(); }
    return Array.from(s.V.slice(20000, 20400));
  };
  assert.deepEqual(run(), run());
});

test('the year: pits first, then rain, moss, grass, and the sun bleaching it back', () => {
  assert.equal(seasons(T0 - 1).cycle, -1);
  const wet = seasons(T0 + 5), green = seasons(STILL_T), dry = seasons(T0 + 45);
  assert.ok(wet.rain > 0.9 && wet.sun < 0.1);
  assert.ok(green.mossVis === 1 && green.wf > 1 && green.rain === 0);
  assert.ok(dry.bleach > 0.5 && dry.sun === 1 && dry.brown === 1);
  assert.deepEqual(seasons(T0 + 5 + CYCLE).rain, wet.rain, 'the seasons repeat');
  assert.ok(STONE_MAX / STONE_RATE < T0, 'the pits are finished before the first rain');
});

test('moss reaches the joints before the open faces', () => {
  const w = buildWall(1), g = rasterWall(w), fl = allocFields(); fieldRows(w, g, fl, 0, GH);
  mossTimes(w, g, fl, new Float32Array(NC));
  let joint = 0, nj = 0, face = 0, nf = 0;
  for (let c = 0; c < NC; c++) {
    if (g.mask[c] === 1) { joint += fl.mossT[c]; nj++; }
    else if (g.mask[c] === 2 && g.edge[c] > 6) { face += fl.mossT[c]; nf++; }
  }
  assert.ok(joint / nj < face / nf, `joints ${(joint / nj).toFixed(2)} before faces ${(face / nf).toFixed(2)}`);
});

test('a handprint is damp where the hand pressed, and dry away from it', () => {
  const damp = new Float32Array(NC), nz = makeNoise('hand');
  stampHand(damp, 600, 400, 0, nz);
  const at = (x, y) => damp[Math.floor(y / 4) * GW + Math.floor(x / 4)];
  assert.ok(at(600, 420) > 0.5, 'the palm');
  assert.equal(at(900, 400), 0, 'nothing far away');
});

test('registers: quiet is the still, warm an easier year, playful takes the hand', () => {
  assert.equal(LOOKS.quiet.pace, 0);
  assert.ok(LOOKS.warm.pace < LOOKS.playful.pace);
  assert.ok(!LOOKS.warm.touch && LOOKS.playful.touch);
  assert.deepEqual(model({ register: 'nonsense' }).look, LOOKS.warm);
  assert.equal(meta.stillTime, STILL_T);
  assert.deepEqual(chiro.interactive, ['playful']);
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
  assert.equal(W / GW, H / GH);
});
