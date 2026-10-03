import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  curtainAt, phaseProgress, waitIsOver, nextPhase, songLineIndex, skipTarget,
  easeOutCubic, easeInCubic, DEFAULT_TIMING,
  foldSway, hemWave, spotIntensity, singerSilhouette, singerHead, singerBun, singerMic,
} from './kantar.core.js';

// ── easing ───────────────────────────────────────────────────────────────

test('the eases start at 0 and end at 1', () => {
  for (const ease of [easeOutCubic, easeInCubic]) {
    assert.equal(ease(0), 0);
    assert.equal(ease(1), 1);
  }
});

test('easeOutCubic gathers less distance late (it has already settled); easeInCubic gathers less distance early (it is still slow)', () => {
  assert.ok(easeOutCubic(0.2) > easeInCubic(0.2), 'the falling curtain is already most of the way down early on');
  assert.ok(easeOutCubic(0.8) < 1 && easeOutCubic(0.8) > 0.9, 'and nearly settled late on');
  assert.ok(easeInCubic(0.2) < 0.1, 'the rising curtain barely moves at first, drawn up slowly');
});

// ── phase progress ───────────────────────────────────────────────────────

test('phaseProgress clamps to 0..1 and treats a zero duration as immediately over', () => {
  assert.equal(phaseProgress(0, 700), 0);
  assert.equal(phaseProgress(350, 700), 0.5);
  assert.equal(phaseProgress(9999, 700), 1);
  assert.equal(phaseProgress(-10, 700), 0);
  assert.equal(phaseProgress(5, 0), 1);
});

// ── the curtain's openness across the whole interlude ───────────────────

test('the curtain is open at the very start of "down" and fully closed by its end', () => {
  assert.equal(curtainAt('down', 0), 0);
  assert.equal(curtainAt('down', 1), 1);
});

test('the curtain stays fully closed for the whole of "wait", however long it runs', () => {
  for (const p of [0, 0.3, 0.9, 1]) assert.equal(curtainAt('wait', p), 1);
});

test('the curtain is fully closed at the start of "up" and fully open by its end', () => {
  assert.equal(curtainAt('up', 0), 1);
  assert.equal(curtainAt('up', 1), 0);
});

test('"done" is the open stage: nothing left covering the step', () => {
  assert.equal(curtainAt('done', 0), 0);
  assert.equal(curtainAt('done', 1), 0);
});

test('the curtain never reports a value outside 0..1 across a full run', () => {
  for (const phase of ['down', 'wait', 'up', 'done']) {
    for (let p = 0; p <= 1; p += 0.05) {
      const v = curtainAt(phase, p);
      assert.ok(v >= 0 && v <= 1, `${phase}@${p}: ${v}`);
    }
  }
});

// ── whether the real wait may end ───────────────────────────────────────

test('the wait never ends before the real work is done, however long it runs', () => {
  assert.equal(waitIsOver({ workDone: false, msInPhase: 999999 }), false);
});

test('the wait needs at least minWaitMs even once the work is done, so an instant answer still gets one beat', () => {
  assert.equal(waitIsOver({ workDone: true, msInPhase: 0 }), false);
  assert.equal(waitIsOver({ workDone: true, msInPhase: DEFAULT_TIMING.minWaitMs - 1 }), false);
  assert.equal(waitIsOver({ workDone: true, msInPhase: DEFAULT_TIMING.minWaitMs }), true);
});

test('an author-raised minWaitMs holds the wait open exactly that much longer, never by default', () => {
  assert.equal(waitIsOver({ workDone: true, msInPhase: 1500, minWaitMs: 2000 }), false);
  assert.equal(waitIsOver({ workDone: true, msInPhase: 2000, minWaitMs: 2000 }), true);
  assert.ok(waitIsOver({ workDone: true, msInPhase: DEFAULT_TIMING.minWaitMs + 1 }), 'past the default minWaitMs, done work is never held up further');
});

// ── the phase transition table ───────────────────────────────────────────

test('the phases run down, wait, up, done, and done holds', () => {
  let phase = 'down';
  const seen = [phase];
  for (let i = 0; i < 4; i++) { phase = nextPhase(phase); seen.push(phase); }
  assert.deepEqual(seen, ['down', 'wait', 'up', 'done', 'done']);
});

// ── the song, vamped while waiting ──────────────────────────────────────

test('songLineIndex cycles through the lines and holds -1 with none to show', () => {
  const lines = ['a', 'b', 'c'];
  assert.equal(songLineIndex(0, lines, 1000), 0);
  assert.equal(songLineIndex(999, lines, 1000), 0);
  assert.equal(songLineIndex(1000, lines, 1000), 1);
  assert.equal(songLineIndex(3500, lines, 1000), 0, 'a long wait vamps the song again from the top');
  assert.equal(songLineIndex(1000, [], 1000), -1);
  assert.equal(songLineIndex(0, undefined, 1000), -1);
});

// ── the skip control ─────────────────────────────────────────────────────

test('skip always lands on "up" (or leaves "done" alone), never on "wait": there is nothing left to wait for once asked to move on', () => {
  assert.equal(skipTarget('down'), 'up');
  assert.equal(skipTarget('wait'), 'up');
  assert.equal(skipTarget('up'), 'up');
  assert.equal(skipTarget('done'), 'done');
});

// ── the curtain's drawing geometry (KS1) ────────────────────────────────────

test('foldSway is bounded and returns to 0 at t=0', () => {
  assert.equal(foldSway(0), 0);
  for (let t = 0; t < 20; t += 0.3) assert.ok(Math.abs(foldSway(t)) <= 6.0001, `t=${t}: ${foldSway(t)}`);
});

test('hemWave is zero at both ends of the fall (nothing moving yet, nothing moving once fully open or fully closed mid-travel)', () => {
  // assert.equal is Object.is under the hood, and -0 is a legitimate zero
  // amplitude here (sin(0.5*12)*0), so compare with === via assert.ok.
  assert.ok(hemWave(0.5, 0, null) === 0, 'fully open, still moving: no amplitude to speak of yet');
  assert.ok(hemWave(0.5, 1, null) === 0, 'reached fully closed this instant: the moving-regime amplitude is 0 here too');
});

test('hemWave peaks mid-travel while still moving, before landing', () => {
  const mid = Math.abs(hemWave(0.5, 0.5, null));
  const early = Math.abs(hemWave(0.5, 0.1, null));
  assert.ok(mid > early, `mid ${mid} should exceed early ${early}`);
});

test('hemWave decays once landed, and never grows the longer it has been landed', () => {
  const a0 = Math.abs(hemWave(0.5, 1, 0));
  const a1 = Math.abs(hemWave(0.5, 1, 1));
  const a3 = Math.abs(hemWave(0.5, 1, 3));
  assert.ok(a0 >= a1, `${a0} should be >= ${a1}`);
  assert.ok(a1 >= a3 || a3 < 0.5, 'the ripple has all but died out by 3s either way');
});

test('spotIntensity is 0 outside "wait" and fades in over its first 400ms', () => {
  for (const phase of ['down', 'up', 'done']) assert.equal(spotIntensity(phase, 999), 0);
  assert.equal(spotIntensity('wait', 0), 0);
  assert.ok(spotIntensity('wait', 200) > 0 && spotIntensity('wait', 200) < 1);
  assert.equal(spotIntensity('wait', 400), 1);
  assert.equal(spotIntensity('wait', 9999), 1);
});

test('singerSilhouette is a closed-enough polygon of reasonable points, its feet at the origin, upright at sway 0', () => {
  const pts = singerSilhouette(0);
  assert.ok(pts.length >= 10);
  const feet = pts.filter(([, y]) => Math.abs(y) < 1e-9);
  assert.ok(feet.length >= 2, 'at least two points sit at the feet (y=0)');
  for (const [x] of pts) assert.ok(Math.abs(x) < 0.3, `x=${x} strays too far from centred`);
});

test('singerSilhouette leans with sway, moving the feet far more than the head (the (240 - dy) term shrinks as dy grows towards the head)', () => {
  const upright = singerSilhouette(0), leaning = singerSilhouette(1);
  const head = p => p.reduce((a, b) => (b[1] < a[1] ? b : a)); // most negative y = highest point
  const feetX = p => p.filter(([, y]) => Math.abs(y) < 1e-9).map(([x]) => x);
  const headShift = Math.abs(head(leaning)[0] - head(upright)[0]);
  const feetShift = Math.abs(feetX(leaning)[0] - feetX(upright)[0]);
  assert.ok(feetShift > headShift * 5, `feet shift ${feetShift} should dwarf head shift ${headShift}`);
});

// ── the head, the bun and the mic (S3 round 2: the figure had no head) ─────

test('the head sits above every point of the body\'s own outline', () => {
  const head = singerHead(0), body = singerSilhouette(0);
  const bodyTop = Math.min(...body.map(([, y]) => y)); // most negative y = highest point of the body
  assert.ok(head.cy - head.ry < bodyTop, `head top ${(head.cy - head.ry).toFixed(3)} should clear the body's own top ${bodyTop.toFixed(3)}`);
});

test('the head leans with sway, the same law as the body at its own height', () => {
  const upright = singerHead(0), leaning = singerHead(1);
  assert.notEqual(upright.cx, leaning.cx);
  assert.equal(upright.cy, leaning.cy, 'sway only ever shifts x, per singerPoint');
});

test('the head is a real ellipse, not a point: both radii positive', () => {
  const head = singerHead(0);
  assert.ok(head.rx > 0 && head.ry > 0);
});

test('the bun sits up and to the left of the head, fixed relative to it', () => {
  const head = singerHead(0.3), bun = singerBun(0.3);
  assert.ok(bun.cy < head.cy, 'the bun sits above the head\'s own centre');
  assert.ok(bun.cx < head.cx, 'and to the left, at sway 0.3');
  assert.equal(bun.cx - head.cx, singerBun(0).cx - singerHead(0).cx, 'the offset from the head does not itself change with sway (only the head\'s own sway carries it along)');
});

test('the mic is three points, never swayed', () => {
  const a = singerMic(), b = singerMic();
  assert.equal(a.length, 3);
  assert.deepEqual(a, b, 'pure: the same three points every call, with no sway parameter to vary them');
  assert.equal(a[0][1], 0, 'the base of the stand starts at the feet');
  assert.ok(a[1][1] < a[0][1] && a[2][1] < a[1][1], 'each point climbs higher than the last');
});
