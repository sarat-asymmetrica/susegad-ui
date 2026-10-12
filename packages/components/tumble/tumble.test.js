import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LETTERS, MAX_TOTAL_MS, isClear, letters, groupLines, warmPlan, warmFrames, playfulPlan, dropFrames, totalMs } from './tumble.core.js';

test('letters are what a person sees: spaces draw nothing, and each says where it sits in the string', () => {
  const l = letters('Eat good pasta');
  assert.equal(l.map(x => x.ch).join(''), 'Eatgoodpasta');
  assert.deepEqual(l[3], { ch: 'g', at: 4, len: 1 });
  assert.equal(letters('  \n ').length, 0);
});

test('a letter with an accent or an emoji is one letter, not two code units', () => {
  const l = letters('café 🍝!');
  assert.deepEqual(l.map(x => x.ch), ['c', 'a', 'f', 'é', '🍝', '!']);
  assert.equal(l.find(x => x.ch === '🍝').len, 2, 'the emoji spans two UTF-16 units');
  const decomposed = letters('éa');
  assert.equal(decomposed.length, 2, 'e and its combining accent are one letter');
  assert.equal(decomposed[0].len, 2);
});

test('letters are found at the right offsets so a Range can measure them', () => {
  const text = 'ab 🍝 cd';
  for (const x of letters(text)) assert.equal(text.slice(x.at, x.at + x.len), x.ch);
});

test('groupLines gathers letters into the lines the browser laid out, top to bottom', () => {
  const boxes = [
    { y: 100, h: 40 }, { y: 101, h: 40 }, { y: 99, h: 40 }, // line two, listed first on purpose
    { y: 0, h: 40 }, { y: 1, h: 40 },
    { y: 200, h: 40 },
  ];
  assert.deepEqual(groupLines(boxes), [[3, 4], [0, 1, 2], [5]]);
});

test('a raised letter (a smaller or higher box) stays on its line; a new line does not merge', () => {
  const boxes = [{ y: 0, h: 40 }, { y: -6, h: 30 }, { y: 48, h: 40 }];
  assert.deepEqual(groupLines(boxes), [[0, 1], [2]]);
  assert.deepEqual(groupLines([]), []);
});

test('warm: lines come from alternate sides, first from the left, one after another', () => {
  const plan = warmPlan(4, 800);
  assert.deepEqual(plan.map(p => Math.sign(p.from)), [-1, 1, -1, 1]);
  assert.ok(plan.every((p, i) => i === 0 || p.delay > plan[i - 1].delay), 'each line starts later than the one above');
  assert.ok(plan.every(p => Math.abs(p.from) >= 140), 'far enough to be seen coming');
  assert.ok(totalMs(plan) < MAX_TOTAL_MS);
});

test('warm: the slide ends at rest, passes a little over, and starts out of sight', () => {
  for (const from of [-300, 300]) {
    const k = warmFrames(from);
    assert.equal(k[0].opacity, 0);
    assert.equal(k.at(-1).transform, 'translateX(0)');
    assert.equal(k.at(-1).opacity, 1);
    const s = Math.sign(from), over = parseFloat(k[1].transform.match(/-?\d+(\.\d+)?/)[0]);
    assert.ok(Math.sign(over) === -s, 'the overshoot goes the other way, past rest');
    assert.deepEqual(k.map(f => f.offset), [0, 0.72, 0.88, 1]);
  }
});

test('playful: one plan per letter, in reading order, never slower than the cap however long the heading', () => {
  for (const n of [1, 5, 28, 100, MAX_LETTERS]) {
    const plan = playfulPlan(n);
    assert.equal(plan.length, n);
    assert.ok(plan.every((p, i) => i === 0 || p.delay >= plan[i - 1].delay));
    assert.ok(totalMs(plan) <= MAX_TOTAL_MS + 1, `${n} letters take ${totalMs(plan)} ms`);
  }
  assert.equal(playfulPlan(0).length, 0);
});

test('playful: each letter spins either way, drops from above, bounces a little, and is seeded', () => {
  const plan = playfulPlan(60, 'pasta');
  assert.deepEqual(plan, playfulPlan(60, 'pasta'));
  assert.notDeepEqual(plan, playfulPlan(60, 'sauce'));
  assert.ok(plan.some(p => p.spin > 0) && plan.some(p => p.spin < 0));
  assert.ok(plan.every(p => Math.abs(p.spin) >= 14 && Math.abs(p.spin) <= 34 && p.drop >= 1.3 && p.bounce > 0.1 && p.bounce < 0.3));
});

test('playful: a letter drops, touches down, bounces once and settles, and ends exactly at rest', () => {
  const p = playfulPlan(1)[0];
  const k = dropFrames(p, 40);
  assert.equal(k.length, 4);
  const y = f => parseFloat(f.transform.match(/translateY\((-?[\d.]+)(?:px)?\)/)[1]);
  assert.ok(y(k[0]) < -40, 'starts more than a letter above');
  assert.equal(y(k[1]), 0, 'touches down');
  assert.ok(y(k[2]) < 0 && y(k[2]) > -15, 'one small bounce up');
  assert.equal(k[3].transform, 'translateY(0) rotate(0deg)', 'settled');
  assert.equal(k[0].opacity, 0);
  assert.ok(k.slice(1).every(f => f.opacity === 1));
  assert.deepEqual(k.map(f => f.offset), [0, 0.5, 0.72, 1]);
});

test('the bounce is only one: after the touch-down the letter lifts once and never goes below rest', () => {
  const k = dropFrames(playfulPlan(1)[0], 40);
  const ys = k.map(f => parseFloat(f.transform.match(/translateY\((-?[\d.]+)(?:px)?\)/)[1]));
  assert.ok(ys.slice(1).every(v => v <= 0), 'never below rest');
  assert.equal(ys.slice(1).filter(v => v < 0).length, 1, 'one frame of lift');
});

test('totalMs is the last settle', () => {
  assert.equal(totalMs([{ delay: 0, duration: 500 }, { delay: 300, duration: 900 }]), 1200);
  assert.equal(totalMs([]), 0);
});

test('a colour is clear only when it has no alpha: black is ink, transparent is not', () => {
  for (const c of ['transparent', 'rgba(0, 0, 0, 0)', 'rgba(255, 0, 0, 0)', 'oklch(0.3 0.1 20 / 0)', 'rgb(0 0 0 / 0%)', '']) assert.equal(isClear(c), true, c);
  for (const c of ['rgb(0, 0, 0)', 'rgb(255, 0, 0)', 'rgba(10, 20, 30, 0.5)', 'oklch(0.3 0.1 20 / 0.5)', 'rgba(1, 2, 0, 0.5)', 'color(srgb 0 0 0)']) assert.equal(isClear(c), false, c);
});
