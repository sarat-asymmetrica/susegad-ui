import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bracket, quoteMark, inkIn } from './quote.core.js';

const nums = d => d.match(/-?[\d.]+/g).map(Number);

test('the bracket is deterministic, two passes, and fits its height', () => {
  const a = bracket(120, 'q');
  assert.deepEqual(a, bracket(120, 'q'));
  assert.notDeepEqual(a, bracket(120, 'r'));
  assert.equal(a.length, 2);
  for (const d of a) {
    const v = nums(d);
    const ys = v.filter((_, i) => i % 2), xs = v.filter((_, i) => !(i % 2));
    assert.ok(Math.min(...ys) >= 0 && Math.max(...ys) <= 120);
    assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= 12);
  }
});

test('a short quote still gets a whole bracket', () => {
  const v = nums(bracket(5, 'x')[0]).filter((_, i) => i % 2);
  assert.ok(Math.max(...v) >= 20);
});

test('with no wobble the bracket stands straight', () => {
  const xs = nums(bracket(90, 's', 0)[0]).filter((_, i) => !(i % 2)).slice(1, -1);
  assert.ok(xs.every(x => x === 3.2));
});

test('the quotation mark: two closed blots inside 64 × 52, the second to the right, different per seed', () => {
  const m = quoteMark('a');
  assert.equal(m.length, 2);
  assert.deepEqual(m, quoteMark('a'));
  assert.notDeepEqual(m, quoteMark('b'));
  const cx = m.map(d => { const v = nums(d); const xs = v.filter((_, i) => !(i % 2)), ys = v.filter((_, i) => i % 2); assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= 64 && Math.min(...ys) >= 0 && Math.max(...ys) <= 52); assert.ok(d.endsWith('Z')); return (Math.min(...xs) + Math.max(...xs)) / 2; });
  assert.ok(cx[1] > cx[0] + 20);
});

test('it inks in only at full motion, the second blot after the first, opacity and transform only', () => {
  for (const m of ['still', 'state', 'ambient']) assert.equal(inkIn(m, 0), null);
  const a = inkIn('full', 0), b = inkIn('full', 1);
  assert.ok(b.timing.delay > a.timing.delay);
  for (const f of a.frames) assert.deepEqual(Object.keys(f).filter(k => !['opacity', 'transform', 'offset'].includes(k)), []);
});
