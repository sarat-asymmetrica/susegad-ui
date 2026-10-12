import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAP, FULL, R, plan, countOf, seedOf, sizeOf, describe, growStep, petalPath, GROW_TOTAL_MS, gradientStops } from './bloom.core.js';

test('countOf reads a whole count and clamps it to the cap', () => {
  assert.equal(countOf('37'), 37);
  assert.equal(countOf('37.6'), 38);
  assert.equal(countOf('0'), 0);
  assert.equal(countOf('9999'), 9999, 'the number is said as written; only the drawing is capped');
  assert.equal(countOf('-4'), 0);
  for (const bad of [null, undefined, '', '  ', 'many', 'NaN']) assert.equal(countOf(bad), null, String(bad));
  assert.equal(CAP, 400);
});

test('seedOf prefers seed-from, then seed, then a plain default', () => {
  assert.equal(seedOf('Maria', 'x'), 'Maria');
  assert.equal(seedOf('', 'x'), 'x');
  assert.equal(seedOf(null, null), 'bloom');
});

test('sizeOf takes pixels, rems and the three words, and falls back to a safe size', () => {
  assert.equal(sizeOf('120'), '120px');
  assert.equal(sizeOf('lg'), '14rem');
  assert.equal(sizeOf('6rem'), '6rem');
  assert.equal(sizeOf(''), '8rem');
  assert.equal(sizeOf('url(x)'), '8rem', 'a value that is not a length is never written into CSS');
});

test('describe: the words come first, the picture follows them', () => {
  assert.deepEqual(describe({ count: 37, label: 'people registered', hasText: false }), { text: '37 people registered', role: 'none', name: '' });
  assert.deepEqual(describe({ count: 37, label: '', hasText: false }), { text: '37', role: 'none', name: '' });
  assert.deepEqual(describe({ count: 0, label: '', hasText: false }).text, '0', 'zero is a number too');
  assert.deepEqual(describe({ count: 37, label: 'x', hasText: true }), { text: '', role: 'none', name: '' }, 'the author wrote the words');
  assert.deepEqual(describe({ count: null, label: "Maria's bloom", hasText: false }), { text: '', role: 'img', name: "Maria's bloom" });
  assert.deepEqual(describe({ count: null, label: '', hasText: false }), { text: '', role: 'none', name: '' }, 'decoration');
});

test('a head of n has n florets, a full head by default, never more than the cap', () => {
  assert.equal(plan().florets.length, FULL);
  assert.equal(plan({ count: 37 }).florets.length, 37);
  assert.equal(plan({ count: 0 }).florets.length, 0);
  assert.equal(plan({ count: 5000 }).florets.length, CAP);
  assert.equal(plan({ count: 400 }).florets.length, 400);
});

test('same seed, same head; another seed, another head', () => {
  const a = plan({ seed: 'Asha' }), b = plan({ seed: 'Asha' }), c = plan({ seed: 'Bruno' });
  assert.deepEqual(a.florets, b.florets);
  assert.notDeepEqual(a.florets.map(f => [f.x, f.y]), c.florets.map(f => [f.x, f.y]));
  assert.ok(new Set(['Asha', 'Bruno', 'Chandra', 'Dev', 'Esha', 'Farid', 'Gita', 'Hari', 'Isha', 'Jiya'].map(s => plan({ seed: s }).family)).size === 2, 'both marigold families turn up');
});

test('adding a floret never moves the ones already placed', () => {
  for (const mode of ['zendu', 'dots']) {
    const small = plan({ count: 36, seed: 'Asha', mode }), big = plan({ count: 37, seed: 'Asha', mode }), full = plan({ count: FULL, seed: 'Asha', mode });
    assert.deepEqual(big.florets.slice(0, 36).map(({ ring, ...f }) => f), small.florets.map(({ ring, ...f }) => f), `${mode}: 36 → 37`);
    assert.deepEqual(full.florets.slice(0, 37).map(({ ring, ...f }) => f), big.florets.map(({ ring, ...f }) => f), `${mode}: 37 → ${FULL}`);
    assert.equal(small.scale, full.scale, 'one scale up to a full head');
  }
});

test('florets keep their own place and stay inside the head', () => {
  for (const n of [1, 37, FULL, CAP]) {
    const p = plan({ count: n, seed: 'x' });
    for (const f of p.florets) assert.ok(Math.hypot(f.x, f.y) + f.len * 0.9 <= R + 0.5, `n ${n}, floret ${f.i}: reach ${Math.hypot(f.x, f.y) + f.len}`);
    assert.ok(p.reach <= R);
  }
  const f = plan({ count: FULL }).florets;
  assert.ok(f[FULL - 1].len > f[10].len * 1.1, 'rim florets are the big ones');
});

test('florets do not sit on top of each other', () => {
  const f = plan({ count: FULL, seed: 'Asha', mode: 'dots' }).florets;
  let m = Infinity;
  for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) m = Math.min(m, Math.hypot(f[i].x - f[j].x, f[i].y - f[j].y));
  assert.ok(m > 3, `closest pair ${m}`);
});

test('a zendu is in the toran palette: orange or saffron, darker at the rim and lighter at the heart', () => {
  const p = plan({ count: FULL, seed: 'Asha' });
  assert.ok(['orange', 'saffron'].includes(p.family));
  const rim = p.florets.slice(-30).map(f => f.grad.l), heart = p.florets.slice(0, 30).map(f => f.grad.l), mean = a => a.reduce((x, y) => x + y) / a.length;
  assert.ok(mean(heart) > mean(rim) + 4, `heart ${mean(heart)}, rim ${mean(rim)}`);
  assert.ok(p.grads.size > 3 && p.grads.size < 60, `${p.grads.size} gradients`);
  const [s0, s1, s2] = gradientStops([...p.grads.values()][0]);
  assert.ok(s0[0] === 0 && s2[0] === 1 && s0[1].startsWith('hsl(') && s1[1] !== s0[1]);
  for (const f of p.florets) assert.ok(f.d.startsWith('M') && f.d.endsWith('Z') && f.crevice.startsWith('M'));
});

test('dots are the quiet head: same places, no colour, no petals', () => {
  const z = plan({ count: 50, seed: 'Asha' }), d = plan({ count: 50, seed: 'Asha', mode: 'dots' });
  assert.deepEqual(d.florets.map(f => [f.x, f.y]), z.florets.map(f => [f.x, f.y]));
  assert.ok(d.florets.every(f => f.d === undefined && f.grad === undefined && f.len > 0));
  assert.equal(d.grads.size, 0);
});

test('the growth takes about as long for a small head as for a full one', () => {
  for (const n of [1, 37, FULL, CAP]) assert.ok(growStep(n) * n <= GROW_TOTAL_MS + 1e-9, `n ${n}`);
  assert.equal(growStep(10), 22);
  assert.ok(growStep(CAP) < growStep(FULL));
});

test('petalPath is one closed path, and a swollen crevice is a different one', () => {
  const d = petalPath(4, 0.75);
  assert.match(d, /^M[^MZ]+Z$/);
  assert.equal((d.match(/Q/g) ?? []).length, 4);
  assert.notEqual(d, petalPath(4, 0.75, 1.08, 0.02, 0.03));
});
