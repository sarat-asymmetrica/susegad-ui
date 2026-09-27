import test from 'node:test';
import assert from 'node:assert/strict';
import { inkPath, boilPhase, lineRuns, countState, pencilRule, inkIn, STRINGS } from './field.core.js';

const xs = d => [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => [+m[1], +m[2]]);

test('the ink is a closed outline exactly as long as the words', () => {
  const d = inkPath(120, { seed: 'name' });
  assert.match(d, /^M.* Z$/);
  const pts = xs(d);
  assert.equal(Math.min(...pts.map(p => p[0])), 0);
  assert.equal(Math.max(...pts.map(p => p[0])), 120);
  assert.equal(inkPath(0), '', 'no words, no ink');
});

test('the same seed draws the same line; a different seed a different one', () => {
  assert.equal(inkPath(80, { seed: 'email' }), inkPath(80, { seed: 'email' }));
  assert.notEqual(inkPath(80, { seed: 'email' }), inkPath(80, { seed: 'phone' }));
});

test('the start of the line stays put as it grows, so typing never shakes what is already inked', () => {
  const short = xs(inkPath(60, { seed: 's' })), long = xs(inkPath(200, { seed: 's' }));
  // compare the top edge from 12 units in (past the landing) to 40 units
  const top = pts => pts.slice(0, Math.floor(pts.length / 2)).filter(([x]) => x >= 12 && x <= 40);
  assert.deepEqual(top(short), top(long));
});

test('the pen stays near the rule and has weight', () => {
  const pts = xs(inkPath(300, { seed: 'w', drift: 0.7, weight: 1.6 }));
  for (const [, y] of pts) assert.ok(Math.abs(y) < 2.5, `y ${y}`);
  const heavier = xs(inkPath(300, { seed: 'w', weight: 3 }));
  const spread = p => Math.max(...p.map(q => q[1])) - Math.min(...p.map(q => q[1]));
  assert.ok(spread(heavier) > spread(pts));
});

test('the boil changes twelve times a second, not every frame', () => {
  assert.equal(boilPhase(0), boilPhase(80));
  assert.notEqual(boilPhase(0), boilPhase(90));
  assert.equal(new Set([0, 16, 33, 50, 66].map(t => boilPhase(t))).size, 1);
});

test('client rects become one run per line, top to bottom', () => {
  const rects = [
    { left: 110, right: 300, top: 50, bottom: 78, width: 190 },
    { left: 10, right: 110, top: 50, bottom: 78, width: 100 },
    { left: 10, right: 180, top: 78, bottom: 106, width: 170 },
    { left: 10, right: 10, top: 106, bottom: 134, width: 0 },
  ];
  assert.deepEqual(lineRuns(rects, { left: 10, top: 50 }), [{ x: 0, y: 28, w: 290 }, { x: 0, y: 56, w: 170 }]);
  assert.deepEqual(lineRuns([]), []);
});

test('the count speaks up only near the limit', () => {
  assert.equal(countState(10, 200).show, false);
  const near = countState(185, 200);
  assert.equal(near.show, true);
  assert.equal(near.text, '15 characters left');
  assert.equal(countState(199, 200).text, '1 character left');
  assert.equal(countState(5, 12).show, true, 'a short limit shows early: the last 10 characters');
  assert.equal(countState(3, 0).show, false, 'no maxlength, no count');
  assert.equal(STRINGS.count(210, 200), '210 of 200 characters');
});

test('the pencil rule runs a little past both ends, with a lighter second pass inside it', () => {
  const [first, second] = pencilRule(300, { seed: 'town' });
  const span = p => { const x = xs(p.d).map(q => q[0] + p.x); return [Math.min(...x), Math.max(...x)]; };
  const [a, b] = span(first);
  assert.ok(a < 0 && a > -5 && b > 300 && b < 306, `first pass ${a} to ${b}`);
  const [c, d] = span(second);
  assert.ok(c > a && d < b, 'the second pass sits inside the first');
  assert.ok(second.alpha < first.alpha);
  assert.deepEqual(pencilRule(300, { seed: 'town' }), pencilRule(300, { seed: 'town' }), 'same seed, same rule');
  assert.notDeepEqual(pencilRule(300, { seed: 'town' }), pencilRule(300, { seed: 'name' }));
  assert.deepEqual(pencilRule(2), [], 'no room, no rule');
});

test('the focused rule inks in slowly in warm, quicker in playful, and not at all in quiet or reduced motion', () => {
  assert.ok(inkIn('ambient').duration > inkIn('full').duration);
  assert.equal(inkIn('state'), null);
  assert.equal(inkIn('still'), null);
});
