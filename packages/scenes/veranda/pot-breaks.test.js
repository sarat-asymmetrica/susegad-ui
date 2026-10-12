import { test } from 'node:test';
import assert from 'node:assert/strict';
import { potBreaks } from './pot-breaks.core.js';

const TAU = Math.PI * 2;

test('a constant corridor has no critical angles and one break state', () => {
  const pb = potBreaks({ widths: [10, 10, 10, 10] }, () => 35);
  assert.deepEqual(pb.criticalAngles(), []);
  assert.equal(pb.quantize(2.5), 0);
  assert.equal(pb.breakStatesPerTurn(), 1);
  // at width 35, three words fit (30 <= 35, the fourth would need 40): one break after word 2
  assert.deepEqual(pb.breaksAt(0), [2]);
});

test('a corridor that widens and narrows flips a break exactly where it crosses the words plus their spaces', () => {
  // words 10 wide with a 2-wide space between: the break after word i flips at 10 + i*(10+2) + 10
  const pb = potBreaks({ widths: [10, 10, 10, 10], space: 2 }, th => 30 - 15 * Math.cos(th));
  const crit = pb.criticalAngles();
  // w_crit = 22 (after 1 word + space) and 34 (after 2); the corridor 15..45 strictly crosses both, twice each on the ring
  const expect = w => [Math.acos((30 - w) / 15), TAU - Math.acos((30 - w) / 15)].sort((a, b) => a - b);
  const want = [...expect(22), ...expect(34)].sort((a, b) => a - b);
  assert.equal(crit.length, want.length, 'crossings: ' + crit.map(c => c.toFixed(3)) + ' vs ' + want.map(c => c.toFixed(3)));
  crit.forEach((c, i) => assert.ok(Math.abs(c - want[i]) < 1e-3, `crossing ${i}: ${c} vs ${want[i]}`));
  // just before and just after the first flip the breaks differ, and only there
  const a = expect(22)[0];
  assert.deepEqual(pb.breaksAt(a - 0.01), [0]);
  assert.deepEqual(pb.breaksAt(a + 0.01), [1]);
  // quantize snaps into the middle of the step, clear of every flip
  const q = pb.quantize(a + 0.01);
  assert.ok(Math.abs(q - a) > 1e-3, 'not on the flip itself');
  assert.deepEqual(pb.breaksAt(q), [1]);
});

test('quantize only ever returns angles the breaks are stable across', () => {
  const pb = potBreaks({ widths: [8, 8, 8, 8, 8], space: 2 }, th => 20 + 10 * Math.sin(th)); // 10..30
  const crit = pb.criticalAngles();
  assert.ok(crit.length >= 2, 'some flips: ' + crit.length);
  for (let i = 0; i < 360; i++) {
    const th = i / 360 * TAU, q = pb.quantize(th);
    assert.ok(q >= 0 && q < TAU, 'in range');
    // the break state at the snapped angle holds a little either side of it: the step is break-stable
    assert.deepEqual(pb.breaksAt(q - 1e-6), pb.breaksAt(q + 1e-6), `stable at ${q} (from ${th})`);
    // and the snapped state is the state the fine sample carries: snapping lost nothing
    assert.deepEqual(pb.breaksAt(q), pb.breaksAt(th));
  }
  // every critical angle is a real flip: the state changes across it
  for (const c of crit) assert.notDeepEqual(pb.breaksAt(c - 1e-4), pb.breaksAt(c + 1e-4), `a flip at ${c}`);
});

test('a per-band corridor (one width per line) flips where a band crosses, and a constant band never does', () => {
  // line 0's band swings 25..35; line 1's band is constant 30 (the pot never reaches it)
  const pb = potBreaks({ widths: [10, 10, 10, 10], space: 2 }, th => [30 - 5 * Math.cos(th), 30]);
  const crit = pb.criticalAngles();
  // band 1 cannot flip; band 0 crosses w_crit = 22 (never, 25..35) and 34 (twice)
  const expect = w => [Math.acos((30 - w) / 5), TAU - Math.acos((30 - w) / 5)].sort((a, b) => a - b);
  const want = expect(34);
  assert.equal(crit.length, want.length, 'crossings: ' + crit.map(c => c.toFixed(3)) + ' vs ' + want.map(c => c.toFixed(3)));
  crit.forEach((c, i) => assert.ok(Math.abs(c - want[i]) < 1e-3, `crossing ${i}: ${c} vs ${want[i]}`));
});

test('the real corridor (flowShape over the turning pot): the kernel matches the type tier, and counts its states', async () => {
  const { surfacePoints, toScreen, extentIn, flowShape, columnAt } = await import('./matka.core.js');
  const { createLayout } = await import('../../type/layout.core.js');
  const { createFakeOracle } = await import('../../type/oracle.fake.js');
  const WORDS = 'The clay pot on the seat is where the water is kept cool. It has stood there since before the roof was retiled, and it turns, slowly, when nobody is looking, so that every side of it gets the same share of the evening light.';
  const hq = 78, col = columnAt(hq), px = 14.4, font = `400 ${px}px Kalam`, lh = px * 1.4;
  const lay = createLayout(createFakeOracle());
  const o = createFakeOracle();
  const words = WORDS.split(' ');
  const widths = words.map(w => o.nextLine(o.prepare(w, font), o.start, 1e6).width);
  const space = (() => { const p = o.prepare('a b', font); return o.nextLine(p, o.start, 1e6).width - o.nextLine(o.prepare('a', font), o.start, 1e6).width - o.nextLine(o.prepare('b', font), o.start, 1e6).width; })();
  const prepared = lay.prepare(WORDS, font);
  // the real relation, as matka-view's plan() builds it: every band the paragraph holds, first line first, through flowShape
  const bandsAt = th => {
    const pot = toScreen(surfacePoints(th), 0, 0, hq);
    const shape = flowShape(col, (t, b) => extentIn(pot, t, b), Math.max(8, hq * 0.2));
    const bands = [];
    for (let k = 0; k < 12; k++) {
      const room = shape(col.y + k * lh, col.y + (k + 1) * lh);
      bands.push(room ? room.w : col.w);
    }
    return bands;
  };
  const pb = potBreaks({ widths, space }, bandsAt, { samples: 720 });
  const states = pb.breakStatesPerTurn();
  // The honest count: three distinct break states per turn at this pose (the
  // tier's own fine layouts hold exactly the same three — see the assert below),
  // against the goal's guess of ~4. The written finding is in docs/reports/karigar-m1.md.
  assert.ok(states >= 1 && states <= 3, 'break states per turn, matching the tier: ' + states);
  // the count is the fine-sampled truth: snapping hid no state
  const truth = new Set();
  for (let i = 0; i < 720; i++) truth.add(pb.breaksAt(i / 720 * TAU).join(','));
  assert.equal(truth.size, states, 'the count is the fine-sampled truth: ' + truth.size + ' vs ' + states);
  // against the type tier itself: the distinct full layouts over the turn, laid by layIntoShape, agree with the kernel's states
  // (the tier's layout also moves line x/y with the pot's cut, so it can only be the same or finer — never coarser)
  const full = new Set();
  for (let i = 0; i < 360; i++) {
    const th = i / 360 * TAU;
    const pot = toScreen(surfacePoints(th), 0, 0, hq);
    const shape = flowShape(col, (t, b) => extentIn(pot, t, b), Math.max(8, hq * 0.2));
    const { lines } = lay.layIntoShape([{ prepared, lineHeight: lh, gap: 0 }], shape, { top: col.y, bottom: col.y + col.h, scale: 1, minWidth: px * 4 });
    full.add(lines.map(l => l.text.trimEnd()).join('\u0001'));
    // the kernel's first-line break agrees with the tier's own first line (the same words, the same greedy rule)
    const kern = pb.breaksAt(th);
    const tierFirst = lines[0] ? lines[0].text.trimEnd().split(' ').length - 1 : words.length - 1;
    assert.equal(kern[0] ?? words.length - 1, tierFirst, `first-line break at ${i}: kernel ${kern[0]} vs tier ${tierFirst}`);
  }
  assert.ok(full.size >= states, 'the tier holds at least the kernel\'s break states (its layouts also move x/y): ' + full.size + ' vs ' + states);
});

test('the break pattern is scale invariant: one flip map serves every pot size', () => {
  // The corridor width and the word widths both scale with the pot's on-screen
  // size, so the ratio a break decision compares does not, and the same map
  // holds at every size. matka-view.js's rebuildBreaks keys on the font and the
  // column's growth, not on the scale, and leans on exactly this (rung M1);
  // without it, a walk would have to re-measure the map every time the pot's
  // size crosses an eighth.
  const widths = [18, 22, 14, 26, 20, 16, 24, 12, 19, 21], space = 4;
  const corridor = th => 90 + 40 * Math.cos(th); // 50..130
  const base = potBreaks({ widths, space }, corridor, { samples: 360 });
  assert.ok(base.breakStatesPerTurn() >= 2, 'the fixture really turns a break over: ' + base.breakStatesPerTurn());
  for (const k of [0.7, 1, 1.5, 2.7]) {
    const scaled = potBreaks({ widths: widths.map(w => w * k), space: space * k }, th => corridor(th) * k, { samples: 360 });
    assert.equal(scaled.breakStatesPerTurn(), base.breakStatesPerTurn(), `states at scale ${k}`);
    for (let i = 0; i < 72; i++) {
      const th = i / 72 * TAU;
      assert.deepEqual(scaled.breaksAt(th), base.breaksAt(th), `breaks at ${th.toFixed(3)} at scale ${k}`);
    }
    const a = base.criticalAngles(), b = scaled.criticalAngles();
    assert.equal(b.length, a.length, `critical angles at scale ${k}`);
    b.forEach((v, i) => assert.ok(Math.abs(v - a[i]) < 1e-3, `critical angle ${i} at scale ${k}: ${v} vs ${a[i]}`));
  }
  // the control: a corridor that does not scale with the words is a different
  // map, so this test can fail (the invariance is a property, not a tautology)
  const leaky = potBreaks({ widths: widths.map(w => w * 1.5), space: space * 1.5 }, corridor, { samples: 360 });
  assert.notDeepEqual(leaky.breaksAt(0.3), base.breaksAt(0.3), 'an unscaled corridor makes a different break pattern');
});
