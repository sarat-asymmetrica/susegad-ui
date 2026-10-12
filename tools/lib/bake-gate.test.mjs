// The bake gate's legs, each handed a broken input to prove it can go red (A10), and the committed mutants run end to end:
// `--break kn` (a Kannada overflow) and `--break floor` (a recolor with its floor repair gone) exit 1, a clean run exits 0.
// Every planted fault below was written to fail against the gate before this file's fixes (see the slice report).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { colourLeg, motionLeg, soundLeg, soundCacheProblems, stopsOutside, imageLeg, specViolations, FLOOR_SPEC, OVERSHOOT_CAP, CURVE_AUDIT } from './bake-gate.core.js';
import { bake, recolor } from '../../packages/tokens/bake.js';
import { motion, springOvershoot } from '../../packages/tokens/tokens.js';
import { bakeFrames, drive, still } from '../../packages/sound/bake/bake.core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const gate = (...args) => spawnSync(process.execPath, [path.join(root, 'tools/bake-gate.mjs'), ...args], { cwd: root, encoding: 'utf8' });

// ── colour ──────────────────────────────────────────────────────────────────

// the code that drops its floor repair and also stops noticing (its own violation list is empty): what a weakened or deleted
// FLOORS table in bake.js looks like from outside
const noFloor = (cache, o = {}) => ({ ...recolor(cache, { ...o, floors: false }), violations: [] });

test('colour: shipped palettes pass; a cache whose text sits on its ground fails, and so does a dropped floor', () => {
  const good = colourLeg({ caches: [{ name: 'susegad', cache: bake('susegad') }, { name: 'casa', cache: bake('casa') }] });
  assert.equal(good.ok, true, good.failures.join('\n'));
  assert.ok(good.checks > 100);

  const bad = bake('haldi');
  bad.roles['text-soft'].light = { ...bad.roles.surface.light, l: bad.roles.surface.light.l - 0.1 };
  const r = colourLeg({ caches: [{ name: 'haldi', cache: bad }] });
  assert.equal(r.ok, false);
  assert.match(r.failures.join('\n'), /haldi light as baked: text-soft on surface/);

  const dropped = colourLeg({ caches: [{ name: 'azulejo', cache: bake('azulejo') }], recolorFn: noFloor });
  assert.equal(dropped.ok, false);
  assert.match(dropped.failures.join('\n'), /recolors drop a floor, first at hue \d+/);
});

test('colour: the floors are the gate\'s own spec, so a repair that is gone or weakened in the code is caught', () => {
  assert.equal(FLOOR_SPEC.find(f => f.role === 'text').min, 4.5);
  assert.equal(FLOOR_SPEC.find(f => f.role === 'focus').min, 3);
  const r = colourLeg({ caches: [{ name: 'susegad', cache: bake('susegad') }], recolorFn: noFloor });
  assert.equal(r.ok, false, 'a recolor with no repair, reporting no violations of its own, must fail');
  assert.match(r.failures.join('\n'), /recolors drop a floor/);
  assert.equal(specViolations({ text: { l: 0.6, c: 0, h: 0 }, surface: { l: 0.7, c: 0, h: 0 } }).length, 1);
  // the gate's spec must know every token text role
  const lean = colourLeg({ caches: [{ name: 'susegad', cache: bake('susegad') }], spec: FLOOR_SPEC.filter(f => f.role !== 'info') });
  assert.match(lean.failures.join('\n'), /text roles info have no floor/);
});

test('colour: no palettes at all fails; a ramp that leaves sRGB is caught, and its count under a ceiling, with a reason', () => {
  const none = colourLeg({ caches: [] });
  assert.equal(none.ok, false);
  assert.match(none.failures[0], /no palettes/);
  // a ramp that skips rung M4's gamut projection: what the pre-M4 straight line (or a broken gamutMap) leaves behind
  const unprojected = () => [{ l: 0.7, c: 0.45, h: 150 }, { l: 0.6, c: 0.45, h: 240 }, { l: 0.5, c: 0.45, h: 330 }];
  const c = bake('casa');
  const sweep = { hueShift: [0], chromaScale: [1], lightShift: [0] };
  const flat = colourLeg({ caches: [{ name: 'loud', cache: c }], sweep, rampFn: unprojected });
  assert.equal(flat.ok, false, 'a ramp that leaves sRGB, with no allowance, fails');
  assert.match(flat.failures.join(), /ramp stops lie outside sRGB, over the 0 allowed \(shipped palettes flag none/);
  const n = Number(/(\d+) ramp stops lie outside/.exec(flat.failures.join())[1]);
  // the shipped projector keeps every stop in gamut: the very same cache passes on the real ramp
  assert.equal(colourLeg({ caches: [{ name: 'loud', cache: c }], sweep }).ok, true, 'the M4 ramp flags no stop outside sRGB');
  const at = colourLeg({ caches: [{ name: 'loud', cache: c }], sweep, rampFn: unprojected, flaggedCeiling: { loud: n } });
  assert.ok(!at.failures.some(f => /outside sRGB/.test(f)), at.failures.join());
  const under = colourLeg({ caches: [{ name: 'loud', cache: c }], sweep, rampFn: unprojected, flaggedCeiling: { loud: n - 1 } });
  assert.match(under.failures.join(), new RegExp(`over the ${n - 1} allowed \\(${n - 1} is what this cache measured`));
});

test('colour: an uneven ramp and a non-cache fail', () => {
  assert.equal(colourLeg({ caches: [{ name: 'x', cache: {} }] }).ok, false);
  // a ramp under test that leaves sRGB is flagged (a warning, under a ceiling)
  const unprojected = () => [{ l: 0.7, c: 0.45, h: 150 }, { l: 0.6, c: 0.45, h: 240 }, { l: 0.5, c: 0.45, h: 330 }];
  const c = bake('casa');
  const r = colourLeg({ caches: [{ name: 'loud', cache: c }], sweep: { hueShift: [0], chromaScale: [1], lightShift: [0] }, rampFn: unprojected, flaggedCeiling: { loud: 9999 } });
  assert.ok(r.warnings.some(w => /outside sRGB/.test(w)), 'out-of-gamut ramp stops are flagged');
  assert.equal(stopsOutside([{ l: 0.7, c: 0.45, h: 150 }, { l: 0.5, c: 0.02, h: 80 }]), 1);
});

// ── motion ──────────────────────────────────────────────────────────────────

test('motion: the token easings pass; a curve that runs backwards, leaves range, overshoots too far or never settles fails', () => {
  const ok = motionLeg({ easings: [{ name: 'out', easing: motion.easings.out, kind: 'monotone' }, { name: 'spring', easing: { spring: 0.72 }, kind: 'spring', maxOvershoot: 0.043 }] });
  assert.equal(ok.ok, true, ok.failures.join());
  const backwards = motionLeg({ easings: [{ name: 'wobbly', easing: t => t + 0.2 * Math.sin(t * 12) * (1 - t), kind: 'monotone' }] });
  assert.match(backwards.failures.join(), /runs backwards|leaves 0..1/);
  const range = motionLeg({ easings: [{ name: 'back', easing: t => t * t * (2.7 * t - 1.7), kind: 'monotone' }] });
  assert.match(range.failures.join(), /leaves 0..1/);
  const over = motionLeg({ easings: [{ name: 'playful as warm', easing: { spring: 0.48 }, kind: 'spring', maxOvershoot: 0.043 }] });
  assert.match(over.failures.join(), /overshoots by 17\.\d%, over the 4\.3% allowed/);
  const unsettled = motionLeg({ easings: [{ name: 'ringing', easing: t => (t === 1 ? 1 : 1 - Math.cos(t * 40) * 0.3), kind: 'spring', maxOvershoot: 0.5 }] });
  assert.match(unsettled.failures.join(), /not settled|dips/);
  const nan = motionLeg({ easings: [{ name: 'nan', easing: () => NaN, kind: 'monotone' }] });
  assert.equal(nan.ok, false);
});

test('motion: the curve audit fails a C0 or C1 break, and a spring\'s ring is flagged, not hidden (M5)', () => {
  // the shipped curves all pass, springs' findings surface as warnings
  const shipped = motionLeg({ easings: [
    { name: 'out', easing: motion.easings.out, kind: 'monotone' },
    { name: 'playful', easing: { spring: 0.48 }, kind: 'spring' },
  ] });
  assert.equal(shipped.ok, true, shipped.failures.join());
  assert.equal(shipped.status, 'pass');

  // a C0 break fails the leg
  const step = motionLeg({ easings: [{ name: 'step', easing: t => (t < 0.5 ? 0 : 1), kind: 'monotone' }] });
  assert.equal(step.ok, false);
  assert.match(step.failures.join('\n'), /1 C0 violation - the curve is not C0 smooth/);

  // a C1 kink fails the leg (a rise that pauses and catches up: value continuous, velocity not)
  const kink = motionLeg({ easings: [{ name: 'pause', easing: t => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)), kind: 'monotone' }] });
  assert.equal(kink.ok, false);
  assert.match(kink.failures.join('\n'), /C[12] violation/);

  // a C2 ripple on a monotone curve fails the leg
  const ripple = motionLeg({ easings: [{ name: 'ripple', easing: t => 0.5 + 0.2 * Math.sin(t * 63), kind: 'monotone' }] });
  assert.match(ripple.failures.join('\n'), /C2 violation/);

  // the declared policy, restated so a change in it is seen here
  assert.deepEqual(CURVE_AUDIT.failOrders, ['C0', 'C1']);
  assert.equal(CURVE_AUDIT.c2FailsMonotone, true);
  assert.ok(CURVE_AUDIT.oscRatioThreshold > 0 && CURVE_AUDIT.oscRatioThreshold < 1);
});

test('motion: the source easing must run 0 to 1 (the baker forces the table to, so only the source can show it)', () => {
  for (const [name, easing, why] of [
    ['ends at 0.9', t => 0.9 * t, /source easing runs from 0 to 0\.9, not 0 to 1/],
    ['ends at 0.5', t => 0.5 * t, /to 0\.5, not 0 to 1/],
    ['starts at 0.3', t => 0.3 + 0.7 * t, /from 0\.3 to 1, not 0 to 1/],
    ['linear() ending at 0.9', 'linear(0, 0.5, 0.9)', /to 0\.9, not 0 to 1/],
    ['linear() starting at 0.2', 'linear(0.2, 0.5, 1)', /from 0\.2/],
  ]) {
    const r = motionLeg({ easings: [{ name, easing, kind: 'monotone' }] });
    assert.equal(r.ok, false, name);
    assert.match(r.failures.join('\n'), why, name);
  }
  // 0 at the start and 1 at the end, then a jump: the ends are right, the table is not an ease
  const jump = motionLeg({ easings: [{ name: 'jumps to 1', easing: t => (t <= 0 ? 0 : 1), kind: 'monotone' }] });
  assert.equal(jump.ok, false);
  assert.match(jump.failures.join('\n'), /jumps 100\.0% in one sample/);
  const bez = motionLeg({ easings: [{ name: 'bad bezier', easing: 'cubic-bezier(1.4, 0, 0.2, 1)', kind: 'monotone' }] });
  assert.match(bez.failures.join('\n'), /control x outside 0\.\.1/);
  // and the honest ones still pass, springs included (their closed form settles within 0.5% of 1)
  const fine = motionLeg({ easings: [
    { name: 'out', easing: 'cubic-bezier(0.22, 1, 0.36, 1)', kind: 'monotone' },
    { name: 'linear()', easing: motion.easings.spring, kind: 'spring', maxOvershoot: 0.043 },
    { name: 'playful', easing: { spring: 0.48 }, kind: 'spring', maxOvershoot: springOvershoot(0.48) + 0.005 },
  ] });
  assert.equal(fine.ok, true, fine.failures.join());
});

test('motion: a spring may not overshoot past the absolute cap, whatever its own token says', () => {
  assert.equal(OVERSHOOT_CAP, 0.25);
  for (const z of [0.1, 0.05]) {
    // the runner's token-derived bound for that very damping: it allows the overshoot, the cap must not
    const r = motionLeg({ easings: [{ name: `damping ${z}`, easing: { spring: z }, kind: 'spring', maxOvershoot: springOvershoot(z) + 0.005 }] });
    assert.equal(r.ok, false, `damping ${z}`);
    assert.match(r.failures.join('\n'), new RegExp(`overshoots by ${(springOvershoot(z) * 100).toFixed(1)}%, over the 25% any spring here may`));
  }
  const shipped = motionLeg({ easings: [{ name: 'playful', easing: { spring: 0.48 }, kind: 'spring', maxOvershoot: springOvershoot(0.48) + 0.005 }] });
  assert.equal(shipped.ok, true, shipped.failures.join());
  const empty = motionLeg({ easings: [] });
  assert.equal(empty.ok, false);
  assert.match(empty.failures[0], /no easings/);
});

// ── sound ───────────────────────────────────────────────────────────────────

test('sound: a baked fixture passes; a cache with a value above 1 or the wrong size fails', () => {
  const fr = Array.from({ length: 10 }, (_, i) => Uint8Array.from({ length: 512 }, (_, k) => (k > 20 && i > 4 ? 200 : 0)));
  const good = bakeFrames(fr, { hopMs: 50 });
  assert.equal(soundLeg({ fixtures: [{ name: 'burst', cache: good }] }).ok, true);
  const loud = { ...good, data: good.data.map((v, i) => (i === 50 ? 1.6 : v)) };
  assert.deepEqual(soundCacheProblems(loud), ['a band energy is outside 0..1']);
  assert.equal(soundLeg({ fixtures: [{ name: 'loud', cache: loud }] }).ok, false);
  const short = { ...good, data: good.data.slice(0, 20) };
  assert.match(soundLeg({ fixtures: [{ name: 'short', cache: short }] }).failures[0], /not 10 frames x 16 bands/);
  assert.equal(soundLeg({ fixtures: [{ name: 'not a cache', cache: {} }] }).ok, false);
});

test('sound: the unit points the right way: silence 0, full scale 1, louder never reads lower; an inverted or constant unit fails', () => {
  const frames = v => Array.from({ length: 10 }, () => new Uint8Array(512).fill(v));
  const fixtures = [
    { name: 'silence', cache: bakeFrames(frames(0), { hopMs: 50 }), expect: { all: 0 } },
    { name: 'full scale', cache: bakeFrames(frames(255), { hopMs: 50 }), expect: { all: 1 } },
  ];
  assert.equal(soundLeg({ fixtures }).ok, true);
  const inverted = soundLeg({ fixtures, driveFn: (c, t, o) => 1 - drive(c, t, o), stillFn: (c, o) => 1 - still(c, o) });
  assert.equal(inverted.ok, false);
  assert.match(inverted.failures.join('\n'), /silence reads 1\.000/);
  assert.match(inverted.failures.join('\n'), /drive should read 0 throughout/);
  const constant = soundLeg({ fixtures, driveFn: () => 0.5, stillFn: () => 0.5 });
  assert.equal(constant.ok, false);
  assert.match(constant.failures.join('\n'), /silence reads 0\.500/);
  // right at both ends but dipping in the middle: not monotonic in the level
  const dip = soundLeg({ fixtures, driveFn: (c, t, o) => { const v = drive(c, t, o); return v > 0.4 && v < 0.6 ? 0.1 : v; } });
  assert.match(dip.failures.join('\n'), /drive falls from/);
  // a burst must be louder after than before
  const burst = bakeFrames(Array.from({ length: 40 }, (_, i) => new Uint8Array(512).fill(i >= 20 ? 230 : 0)), { hopMs: 50 });
  assert.equal(soundLeg({ fixtures: [{ name: 'burst', cache: burst, expect: { louderAfterMs: 1000 } }] }).ok, true);
  const quiet = soundLeg({ fixtures: [{ name: 'burst', cache: burst, expect: { louderAfterMs: 1000 } }], driveFn: (c, t, o) => 1 - drive(c, t, o) });
  assert.match(quiet.failures.join('\n'), /not louder than before it/);
  const empty = soundLeg({ fixtures: [] });
  assert.equal(empty.ok, false);
  assert.match(empty.failures[0], /no baked fixtures/);
});

// ── the image leg: pending is not a pass ────────────────────────────────────

test('image: pending while packages/image/ is absent (not ok); fails once the directory exists without its leg; runs the leg when present', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-bake-gate-'));
  const pending = await imageLeg({ root: tmp });
  assert.equal(pending.status, 'pending');
  assert.equal(pending.ok, false);
  assert.equal(pending.failures.length, 0);
  fs.mkdirSync(path.join(tmp, 'packages/image'), { recursive: true });
  const missing = await imageLeg({ root: tmp });
  assert.equal(missing.status, 'fail');
  assert.match(missing.failures[0], /packages\/image\/ exists but packages\/image\/bake-gate\.leg\.js does not/);
  const leg = body => fs.writeFileSync(path.join(tmp, 'packages/image/bake-gate.leg.js'), `export default async () => (${body});`);
  leg("{ leg: 'image', ok: true, checks: 12, failures: [], warnings: [], notes: ['boxes'] }");
  assert.equal((await imageLeg({ root: tmp })).status, 'pass');
  leg("{ leg: 'image', ok: true, checks: 0, failures: [], warnings: [], notes: [] }");
  assert.equal((await imageLeg({ root: tmp })).status, 'fail', 'a leg that ran nothing is not a pass');
  leg("{ leg: 'image', ok: false, checks: 3, failures: ['a box overflows'], warnings: [], notes: [] }");
  assert.deepEqual((await imageLeg({ root: tmp })).failures, ['a box overflows']);
});

// ── the runner, and the committed mutants ───────────────────────────────────

test('the gate runs clean: four legs pass and the image leg is pending, counted apart, or all five pass once packages/image/ has its leg', () => {
  const r = gate();
  console.log(`\n--- node tools/bake-gate.mjs (exit ${r.status}) ---\n${r.stdout}`);
  if (fs.existsSync(path.join(root, 'packages/image')) && !fs.existsSync(path.join(root, 'packages/image/bake-gate.leg.js'))) {
    // the ratchet: packages/image/ has landed and its leg has not. Failing is the point.
    assert.equal(r.status, 1);
    assert.match(r.stdout, /FAIL  image/);
    assert.match(r.stdout, /4 of 5 legs pass, 1 FAIL \(image\)/);
  } else if (fs.existsSync(path.join(root, 'packages/image/bake-gate.leg.js'))) {
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /\b5 of 5 legs pass/);
    assert.match(r.stdout, /pass  image +\d+ checks/);
  } else {
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /\b4 of 4 legs pass, 1 pending \(image\)/);
    assert.match(r.stdout, /PEND  image/);
  }
  assert.match(r.stdout, /kn 16\/16/);
  assert.match(r.stdout, /gom-Deva 16\/16/);
});

test('the Kannada mutant: the long notice overflows the Tinto board, the text leg fails, and the gate exits 1', () => {
  const r = gate('--break', 'kn');
  console.log(`\n--- node tools/bake-gate.mjs --break kn (exit ${r.status}) ---\n${r.stdout}`);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL  text/);
  assert.match(r.stdout, /tinto\.board kn desktop-1280: falls-back/);
  assert.match(r.stdout, /kn 14\/16/);
  assert.match(r.stdout, /pass  colour/);
});

test('the floor mutant: a recolor with its repair gone (code, not input) fails the colour leg, and the gate exits 1', () => {
  const r = gate('--break', 'floor');
  console.log(`\n--- node tools/bake-gate.mjs --break floor (exit ${r.status}) ---\n${r.stdout.split('\n').slice(0, 12).join('\n')}`);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL  colour/);
  assert.match(r.stdout, /recolors drop a floor/);
  assert.match(r.stdout, /hint: the repair is recolor\(\)/);
  assert.match(r.stdout, /pass  text/);
});

test('an unknown leg or break is refused, not ignored', () => {
  assert.equal(gate('--leg', 'nope').status, 2);
  assert.equal(gate('--break', 'nope').status, 2);
});

test('when checks.mjs has just run the text gate it says so and the bake gate skips its own text leg', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'tools/bake-gate.mjs')], { cwd: root, encoding: 'utf8', env: { ...process.env, SG_TEXT_GATE_RAN: '1' } });
  assert.match(r.stdout, /text leg skipped: tools\/text-gate\.mjs already ran it/);
  assert.doesNotMatch(r.stdout, /cells passing per language/);
  assert.match(r.stdout, /(3 of 3 legs pass, 1 pending|4 of 4 legs pass)/);
  // asking for the text leg by name still runs it
  const named = spawnSync(process.execPath, [path.join(root, 'tools/bake-gate.mjs'), '--leg', 'text'], { cwd: root, encoding: 'utf8', env: { ...process.env, SG_TEXT_GATE_RAN: '1' } });
  assert.match(named.stdout, /cells passing per language/);
});

test('every failure message names a next step', () => {
  const bad = motionLeg({ easings: [{ name: 'e', easing: t => 0.9 * t, kind: 'monotone' }, { name: 's', easing: { spring: 0.1 }, kind: 'spring' }] });
  assert.ok(bad.failures.length >= 2);
  for (const f of bad.failures) assert.match(f, /Next: /, f);
  const sound = soundLeg({ fixtures: [{ name: 'x', cache: {} }] });
  for (const f of sound.failures) assert.match(f, /Next: |not a baked sound cache/, f);
});
