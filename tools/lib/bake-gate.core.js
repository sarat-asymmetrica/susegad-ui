// The bake gate's legs: the pure reflow half of each bake surface, checked headless.
//
// Every leg takes its inputs as arguments (a baked cache, a list of easings, a baked fixture) and returns
//   { leg, ok, status, checks, failures: string[], warnings: string[], notes: string[] }
// so a test can hand a leg a broken input and watch it go red. tools/bake-gate.mjs builds the real inputs from the
// shipped tokens, easings and fixtures, runs the text gate and the image hook, and prints. No browser, no oracle:
// nothing here measures anything; it reads caches and does arithmetic over them (decision 0030).
//
// Each check here is judged against something the code under test does not control: the contrast spec, the source
// easing before it is baked, an absolute overshoot cap, the direction of the sound unit. A check that can only agree
// with the code it checks cannot fail (A10).

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { recolor, checkRamps, ramp, CACHE_KIND as COLOUR_KIND } from '../../packages/tokens/bake.js';
import { inGamut, oklchToRgb, contrast } from '../../packages/tokens/color.js';
import { textRoles } from '../../packages/tokens/tokens.js';
import { bake as bakeEasing, tween, still as tweenStill, spring as springCurve } from '../../packages/transitions/tween/tween.core.js';
import { continuityAudit, frequencyAudit, C1_SHARE, C2_SHARE, OSC_RATIO_THRESHOLD } from '../../packages/transitions/tween/curve-audit.core.js';
import { drive, still as soundStill, bakeFrames, CACHE_KIND as SOUND_KIND } from '../../packages/sound/bake/bake.core.js';

// status is 'pass', 'fail' or 'pending'. A leg that checked nothing is not a pass: zero checks fails, and only a leg
// that says it is pending (its input does not exist yet) may report none.
const result = (leg, checks, failures, warnings = [], notes = []) => {
  if (checks === 0 && !failures.length) failures = [`${leg}: ran 0 checks, so it proved nothing (an empty input list is a failure, not a pass)`];
  return { leg, ok: failures.length === 0, status: failures.length ? 'fail' : 'pass', checks, failures, warnings, notes };
};
export const pendingLeg = (leg, note) => ({ leg, ok: false, status: 'pending', checks: 0, failures: [], warnings: [], notes: [note] });

/** A leg result from outside (the image leg's file) in the same shape, whatever it returned. */
export function normaliseLeg(leg, r) {
  if (!r || typeof r !== 'object') return result(leg, 0, [`${leg}: the leg returned ${r}`]);
  if (r.status === 'pass' || r.status === 'fail') return { ...r, leg };
  const failures = [...(r.failures ?? [])];
  const status = r.status === 'pending' ? 'pending' : failures.length || r.ok === false || !(r.checks > 0) ? 'fail' : 'pass';
  if (status === 'fail' && !failures.length) failures.push(`${leg}: ran ${r.checks ?? 0} checks and did not say what failed`);
  return { leg, ok: status === 'pass', status, checks: r.checks ?? 0, failures, warnings: r.warnings ?? [], notes: r.notes ?? [] };
}

/**
 * The image leg. Pending is not a pass: it says so, and is counted apart. But pending only while packages/image/ does not
 * exist: once it does, packages/image/bake-gate.leg.js must too, or the leg fails (a ratchet, so pending cannot last forever).
 * @param {{ root: string }} o
 */
export async function imageLeg({ root }) {
  const dir = path.join(root, 'packages/image'), file = path.join(dir, 'bake-gate.leg.js');
  if (fs.existsSync(file)) return normaliseLeg('image', await (await import(`${pathToFileURL(file).href}?read=${Date.now()}`)).default({ root }));
  if (fs.existsSync(dir)) return normaliseLeg('image', { failures: ['packages/image/ exists but packages/image/bake-gate.leg.js does not, so the image bake has no gate leg. Add it: default-export async ({ root }) => ({ leg, ok, checks, failures, warnings, notes }); boxes from cached dimensions must never overflow their column.'], checks: 0 });
  return pendingLeg('image', 'pending: packages/image/ does not exist yet; once it does, packages/image/bake-gate.leg.js is required');
}

// ── colour ──────────────────────────────────────────────────────────────────

/** The recolor sweep every cache must hold its contrast floors across: hue x chroma x light, both themes. */
export const COLOUR_SWEEP = {
  hueShift: [0, 60, 120, 180, 240, 300],
  chromaScale: [0, 0.5, 1, 1.6],
  lightShift: [-0.06, 0, 0.06],
};

/**
 * The contrast floors, written out here on purpose. The code has its own table (FLOORS in bake.js) and repairs to it, so a
 * check against that table only shows the repair and the check agree. This is the number from the docs: weaken or delete a
 * floor in the code and the recolored roles stop meeting this spec, and the leg goes red.
 */
const SURFACES = ['surface', 'surface-raised', 'surface-sunk'];
export const FLOOR_SPEC = [
  ...['text', 'text-soft', 'text-faint', 'accent-text', 'success', 'warning', 'danger', 'info'].map(role => ({ role, on: SURFACES, min: 4.5 })),
  { role: 'rule-strong', on: SURFACES, min: 3 },
  { role: 'focus', on: SURFACES, min: 3 },
  { role: 'on-accent', on: ['accent'], min: 4.5 },
];

/** Every floor of the spec that a set of recolored roles ({ l, c, h }) misses. */
export function specViolations(roles, spec = FLOOR_SPEC) {
  const out = [];
  for (const { role, on, min } of spec) {
    if (!roles[role]) continue;
    for (const ground of on) {
      if (!roles[ground]) continue;
      const ratio = contrast(roles[role], roles[ground]);
      if (ratio < min) out.push({ role, on: ground, ratio: +ratio.toFixed(2), min });
    }
  }
  return out;
}

/**
 * How many ramp stops outside sRGB each cache may flag. Since rung M4 the ramp projects every stop onto the sRGB
 * boundary (`ramp()` in bake.js), so a correct ramp flags none: the ceiling is empty, and the check below now guards
 * the projection (a ramp that leaves the gamut, e.g. a broken `gamutMap`, fails). Before M4 the straight OKLab line
 * could leave the gamut and casa-photo flagged 36; the projector took that count to 0.
 */
export const FLAGGED_CEILING = {};

/**
 * Colour: for each baked palette, (1) the floors hold as baked, (2) they hold across the recolor sweep,
 * (3) every ramp the cache can generate steps evenly, (4) every ramp stop stays inside sRGB (the M4 projection;
 * a stop outside is a regression and fails under the ceiling). Floors are judged against FLOOR_SPEC on the recolored
 * roles themselves, not against the violations the code reports.
 * @param {{ caches: { name: string, cache: object }[], sweep?: typeof COLOUR_SWEEP, steps?: number, recolorFn?: typeof recolor,
 *   rampFn?: typeof ramp, flaggedCeiling?: Record<string, number>, spec?: typeof FLOOR_SPEC }} o
 *   `recolorFn` is the recolor under test (a mutant can be handed in: --break floor does); `rampFn` is the ramp under
 *   test, so a mutant that skips the M4 projection can prove the outside-sRGB check still bites.
 */
export function colourLeg({ caches, sweep = COLOUR_SWEEP, steps = 9, recolorFn = recolor, rampFn = ramp, flaggedCeiling = FLAGGED_CEILING, spec = FLOOR_SPEC }) {
  const failures = [], warnings = [];
  let checks = 0, flagged = 0, ramps = 0, worstRamp = 0;
  if (!caches?.length) return result('colour', 0, ['colour: no palettes were given to check']);
  const unknown = textRoles.filter(r => !spec.some(f => f.role === r));
  checks++;
  if (unknown.length) failures.push(`the token text roles ${unknown.join(', ')} have no floor in the gate's spec (FLOOR_SPEC in tools/lib/bake-gate.core.js); add them at 4.5:1`);
  for (const { name, cache } of caches) {
    if (cache?.kind !== COLOUR_KIND) { failures.push(`${name}: not a baked colour cache`); continue; }
    for (const dark of [false, true]) {
      const theme = dark ? 'dark' : 'light';
      checks++;
      const base = specViolations(recolorFn(cache, { dark, floors: false }).roles, spec);
      if (base.length) failures.push(`${name} ${theme} as baked: ${base.map(v => `${v.role} on ${v.on} ${v.ratio}:1 under ${v.min}:1`).slice(0, 3).join('; ')}. Next: give that role more contrast in packages/tokens/tokens.js (the palette itself is below its floor)`);
      let sweepBad = 0, first = null;
      for (const hueShift of sweep.hueShift) for (const chromaScale of sweep.chromaScale) for (const lightShift of sweep.lightShift) {
        checks++;
        const v = specViolations(recolorFn(cache, { dark, hueShift, chromaScale, lightShift }).roles, spec);
        if (v.length) { sweepBad++; first ??= { hueShift, chromaScale, lightShift, v: v[0] }; }
      }
      if (sweepBad) failures.push(`${name} ${theme}: ${sweepBad} recolors drop a floor, first at hue ${first.hueShift}, chroma x${first.chromaScale}, light ${first.lightShift >= 0 ? '+' : ''}${first.lightShift}: ${first.v.role} on ${first.v.on} is ${first.v.ratio}:1, under ${first.v.min}:1. Next: recolor() in packages/tokens/bake.js must pull the role back to the floor (check its floor table and the fitContrast call)`);
    }
    const r = checkRamps(cache, { steps });
    checks++;
    ramps += r.checked;
    worstRamp = Math.max(worstRamp, r.worst?.spread ?? 0);
    if (r.uneven.length) failures.push(`${name}: ${r.uneven.length} of ${r.checked} ramps are uneven, worst ${r.worst.from} to ${r.worst.to}${r.worst.dark ? ' (dark)' : ''} at ${(r.worst.spread * 100).toFixed(0)}% of the mean step. Next: ramp() in packages/tokens/bake.js must step evenly between those two roles`);
  }
  // Ramp stops outside sRGB fail under the ceiling for that cache (empty since M4's projection: a stop outside is a
  // regression); checkRamps above judges evenness.
  for (const { name, cache } of caches) {
    if (cache?.kind !== COLOUR_KIND) continue;
    const ends = ['surface', 'text', 'accent', 'danger', 'info', 'success', 'warning'].filter(r => cache.roles[r]);
    let n = 0;
    for (const dark of [false, true]) for (const from of ends) for (const to of ends) if (from !== to) n += stopsOutside(rampFn(cache, { from, to, steps, dark }));
    const ceiling = flaggedCeiling[name] ?? 0;
    checks++;
    if (n > ceiling) failures.push(`${name}: ${n} ramp stops lie outside sRGB, over the ${ceiling} allowed${ceiling ? ` (${ceiling} is what this cache measured when the ceiling was set; the count may fall, not grow)` : ' (shipped palettes flag none; fix the ramp or give the cache a measured ceiling in FLAGGED_CEILING)'}`);
    else if (n) { flagged += n; warnings.push(`${name}: ${n} ramp stops lie outside sRGB (flagged, not failed; ceiling ${ceiling})`); }
  }
  return result('colour', checks, failures, warnings, [`${caches.length} palettes, ${ramps} ramps checked (worst spread ${(worstRamp * 100).toFixed(1)}%), ${flagged} ramp stops outside sRGB`]);
}

/** Count the stops of a ramp outside sRGB, for the flag. */
export const stopsOutside = stops => stops.filter(s => !inGamut(oklchToRgb(s))).length;

// ── motion ──────────────────────────────────────────────────────────────────

/**
 * A spring may overshoot at most this much, whatever its own damping says. The shipped playful spring (damping 0.48)
 * overshoots 17.9%; 25% leaves room above it for a livelier spring (damping about 0.41) and stops there: a damping of 0.1
 * (72.9%) or 0.05 (85.4%) is a rubber band, not a spring. The token-derived bound (a table must overshoot like its own
 * spring) still applies too, so the effective limit is the smaller of the two.
 */
export const OVERSHOOT_CAP = 0.25;
/** The steepest shipped easing steps 0.03 between two of its 256 samples; more than twice that is a jump, not an ease. */
export const MAX_STEP = 0.06;
/** How near 0 and 1 the source easing must start and end. The baker snaps the table's ends to exactly 0 and 1, so a source that stops short would hide in the table. */
export const END_TOLERANCE = 0.01;

/**
 * The curve audit's declared limits, restated here on purpose (A10: the gate holds the curve to numbers written
 * outside it). The audit module owns the tolerances; the gate owns the policy of which orders FAIL and which are
 * flagged. C0 and C1 breaks fail: a curve that jumps in value or velocity is not an ease. A C2 finding fails for
 * monotone curves and is flagged for springs, whose acceleration envelope is intentionally the liveliest thing in
 * the library (the spring's linear() bake pokes to 0.87 of max |a| at its first sample interval; the closed form
 * stays under 0.50). The frequency flag is never a failure by itself: photosensitivity prudence flags energy in the
 * 3-60 Hz band, the owner rules on it; but a resolvable wobble over the threshold must be SEEN, and a spring that
 * rings in band must be named (a spring rings; that is what a spring is for, and its duration is what keeps the
 * cycles prudent).
 */
export const CURVE_AUDIT = {
  /** C0 and C1 violations fail, always. */
  failOrders: ['C0', 'C1'],
  /** C2 fails for monotone curves; for springs it is flagged, with the finding. */
  c2FailsMonotone: true,
  /** The frequency audit flags above this oscRatio when the window resolves the band (never fails by itself). */
  oscRatioThreshold: OSC_RATIO_THRESHOLD,
  /** The audit's shares, restated so a test watching the gate sees the numbers the gate enforces. */
  c2Share: C2_SHARE,
  c1Share: C1_SHARE,
};

/**
 * Where the SOURCE easing starts and ends, before baking (the baker forces its first sample to 0 and its last to 1, so the
 * table cannot show a source that does not). A function and a spring are evaluated at 0 and 1; a linear() string is read at
 * its first and last stop; a cubic-bezier starts at 0 and ends at 1 by definition, so only a control x outside 0..1 can be wrong.
 * @returns {{ start: number, end: number, problem?: string }}
 */
export function easingEnds(easing) {
  if (typeof easing === 'function') return { start: easing(0), end: easing(1) };
  if (easing && typeof easing === 'object' && 'spring' in easing) { const f = springCurve(easing.spring); return { start: f(0), end: f(1) }; }
  const bez = typeof easing === 'string' ? /^\s*cubic-bezier\(([^)]*)\)\s*$/.exec(easing)?.[1].split(',').map(Number) : easing?.bezier;
  if (Array.isArray(bez) && bez.length === 4) {
    const bad = bez.some(n => !Number.isFinite(n)) || bez[0] < 0 || bez[0] > 1 || bez[2] < 0 || bez[2] > 1;
    return { start: 0, end: 1, ...(bad ? { problem: `cubic-bezier(${bez.join(', ')}) has a control x outside 0..1` } : {}) };
  }
  if (typeof easing === 'string' && /^\s*linear\(/.test(easing)) {
    const stops = easing.replace(/^\s*linear\(/, '').replace(/\)\s*$/, '').split(',').map(x => parseFloat(x.trim()));
    if (stops.length >= 2 && stops.every(Number.isFinite)) return { start: stops[0], end: stops[stops.length - 1] };
  }
  return { start: NaN, end: NaN, problem: 'cannot read where this easing starts and ends' };
}

/**
 * Motion: each easing is a well-formed curve: the SOURCE starts at 0 and ends at 1 (judged before baking), it bakes to a
 * finite table with no jump in it, the still is the end, it is monotone where it must be, and a spring's overshoot is
 * bounded both by its own damping and by an absolute cap.
 * @param {{ name: string, easing: any, kind: 'monotone'|'spring', maxOvershoot?: number }[]} easings
 */
export function motionLeg({ easings }) {
  const failures = [];
  const warnings = [];
  let checks = 0;
  const notes = [];
  if (!easings?.length) return result('motion', 0, ['motion: no easings were given to check']);
  for (const { name, easing, kind, maxOvershoot = OVERSHOOT_CAP } of easings) {
    checks++;
    const ends = easingEnds(easing);
    if (ends.problem) failures.push(`${name}: ${ends.problem}`);
    else if (!(Math.abs(ends.start) <= END_TOLERANCE) || !(Math.abs(ends.end - 1) <= END_TOLERANCE)) failures.push(`${name}: the source easing runs from ${+ends.start.toFixed(4)} to ${+ends.end.toFixed(4)}, not 0 to 1 (the baker would snap the last sample to 1 and hide it). Next: make the easing return 0 at t = 0 and 1 at t = 1`);
    let c;
    try { c = bakeEasing(easing); } catch (e) { failures.push(`${name}: will not bake (${e.message}). Next: give the baker a function, a CSS easing string, { spring } or { bezier }`); continue; }
    checks++;
    const s = c.samples;
    if (!s.every(Number.isFinite)) { failures.push(`${name}: a sample is not a number`); continue; }
    if (tween(c, 1) !== 1 || tweenStill(c) !== 1 || tween(c, 0.5, { reducedMotion: true }) !== 1) failures.push(`${name}: the reduced-motion still is not the end state`);
    let jump = 0, at = 0;
    for (let i = 1; i < s.length; i++) if (Math.abs(s[i] - s[i - 1]) > jump) { jump = Math.abs(s[i] - s[i - 1]); at = i; }
    if (jump > MAX_STEP) failures.push(`${name}: jumps ${(jump * 100).toFixed(1)}% in one sample at t = ${(at / c.n).toFixed(3)}, over the ${(MAX_STEP * 100).toFixed(0)}% a curve of ${c.n} samples may step (a jump, not an ease). Next: use a smooth curve (a cubic-bezier or a spring), not a step`);
    // the curve audit (M5): continuity, then the photosensitivity band
    checks++;
    const audit = continuityAudit(c);
    for (const [order, count] of [['C0', audit.c0], ['C1', audit.c1], ['C2', audit.c2]]) {
      if (!count) continue;
      const where = audit.worst && audit.worst.order === order ? ` (worst at t = ${audit.worst.at.toFixed(3)})` : '';
      const fails = CURVE_AUDIT.failOrders.includes(order) || (order === 'C2' && kind === 'monotone' && CURVE_AUDIT.c2FailsMonotone);
      const msg = `${name}: ${count} ${order} violation${count === 1 ? '' : 's'}${where} - the curve is not ${order} smooth. Next: ${order === 'C0' ? 'remove the jump (a curve of samples must not step over the tolerance)' : order === 'C1' ? 'smooth the velocity across the kink' : 'smooth the acceleration; a monotone curve must not break its envelope'}`;
      if (fails) failures.push(msg);
      else warnings.push(msg);
    }
    checks++;
    // the frequency audit runs at the token `slow` duration, the slowest common one that still resolves the 3 Hz
    // band edge (a slower window resolves the band better; a faster one cannot, and says so via `resolvable`)
    const freq = frequencyAudit(c, { durationMs: 560 });
    if (freq.resolvable && freq.oscRatio > CURVE_AUDIT.oscRatioThreshold) {
      warnings.push(`${name}: carries ${(freq.oscRatio * 100).toFixed(0)}% of its motion energy in the 3-60 Hz band (peak ${freq.bandPeakHz.toFixed(1)} Hz, over the ${(CURVE_AUDIT.oscRatioThreshold * 100).toFixed(0)}% flagged) - a spring rings by design; name the duration that keeps it prudent, or damp the wobble`);
    }
    const lo = Math.min(...s), hi = Math.max(...s);
    if (kind === 'monotone') {
      if (lo < 0 || hi > 1) failures.push(`${name}: leaves 0..1 (${lo.toFixed(4)} to ${hi.toFixed(4)}) and should not. Next: pull the control points back inside 0..1, or make it a spring if overshoot is meant`);
      for (let i = 1; i < s.length; i++) if (s[i] < s[i - 1] - 1e-9) { failures.push(`${name}: runs backwards at t = ${(i / c.n).toFixed(3)}. Next: use a curve that only moves forward`); break; }
    } else {
      const over = Math.max(0, hi - 1), under = Math.max(0, -lo);
      if (over > OVERSHOOT_CAP) failures.push(`${name}: overshoots by ${(over * 100).toFixed(1)}%, over the ${(OVERSHOOT_CAP * 100).toFixed(0)}% any spring here may (the shipped playful spring is 17.9%; damping 0.1 would be 72.9%). Next: raise the spring's damping (higher damping overshoots less)`);
      else if (over > maxOvershoot) failures.push(`${name}: overshoots by ${(over * 100).toFixed(1)}%, over the ${(maxOvershoot * 100).toFixed(1)}% allowed. Next: the table must overshoot like the spring it came from; re-bake it, or fix the damping`);
      if (under > 0.01) failures.push(`${name}: dips ${(under * 100).toFixed(1)}% below the start. Next: a spring must not dip under 0 before it moves; check the easing at small t`);
      const tail = s.slice(Math.floor(c.n * 0.95));
      if (tail.some(v => Math.abs(v - 1) > 0.01)) failures.push(`${name}: has not settled by 95% of the way. Next: raise the damping so it settles, or lengthen the curve`);
      notes.push(`${name} overshoots ${(over * 100).toFixed(1)}%`);
    }
  }
  return result('motion', checks, failures, warnings, [`${easings.length} easings baked; ${notes.join(', ')}`]);
}

// ── sound ───────────────────────────────────────────────────────────────────

/** A baked sound cache is well formed: right size, every value in 0..1. */
export function soundCacheProblems(cache) {
  const out = [];
  if (cache?.kind !== SOUND_KIND) return ['not a baked sound cache'];
  if (cache.data.length !== cache.frames * cache.bands) out.push(`holds ${cache.data.length} values, not ${cache.frames} frames x ${cache.bands} bands`);
  if (cache.data.some(v => !Number.isFinite(v) || v < 0 || v > 1)) out.push('a band energy is outside 0..1');
  return out;
}

/** A cache of `frames` identical frames at one byte level in every bin. */
const flatCache = (level, frames = 8, bins = 512) => bakeFrames(Array.from({ length: frames }, () => new Uint8Array(bins).fill(level)), { hopMs: 50 });
export const LEVELS = [0, 32, 64, 96, 128, 160, 192, 224, 255];

/**
 * Sound: for each baked fixture, drive and still stay in 0..1 (and are numbers) for every option shape and every time,
 * including times before the start, after the end, and not numbers. And the unit points the right way: across a ladder of
 * steady levels from silence to full scale, drive and still never fall as the level rises, silence reads 0 and full scale
 * reads 1. A fixture may add `expect`: { all: n } (drive reads n throughout: silence 0, full scale 1) or { louderAfterMs: t }
 * (a burst: drive after t is louder than before it).
 * @param {{ name: string, cache: object, expect?: { all?: number, louderAfterMs?: number } }[]} fixtures
 * @param {{ driveFn?: typeof drive, stillFn?: typeof soundStill }} [fns] the units under test (a mutant can be handed in)
 */
export function soundLeg({ fixtures, driveFn = drive, stillFn = soundStill }) {
  const failures = [];
  let checks = 0, evaluations = 0;
  if (!fixtures?.length) return result('sound', 0, ['sound: no baked fixtures were given to check']);
  const optionSets = [
    {}, { reducedMotion: true }, { band: 0 }, { band: 7 }, { band: 99 }, { bands: [2, 5] }, { bands: [9, 3] },
    { floor: 0.2, ceil: 0.8 }, { floor: 0.5, ceil: 0.5 }, { floor: NaN, ceil: NaN }, { of: 'mean' },
  ];
  for (const { name, cache, expect } of fixtures) {
    const bad = soundCacheProblems(cache);
    checks++;
    if (bad.length) { failures.push(`${name}: ${bad.join('; ')}. Next: re-bake the fixture with bakeFrames or bakeBuffer`); continue; }
    const times = [NaN, -500, 0, cache.durationMs / 3, cache.durationMs / 2, cache.durationMs, cache.durationMs + 500, ...Array.from({ length: 40 }, (_, i) => (i * cache.durationMs) / 39)];
    let worst = null;
    for (const o of optionSets) for (const t of times) {
      evaluations++;
      const v = driveFn(cache, t, o);
      if (!Number.isFinite(v) || v < 0 || v > 1) { worst ??= `${name}: drive(${t}, ${JSON.stringify(o)}) = ${v}`; }
    }
    for (const o of optionSets) {
      evaluations++;
      const v = stillFn(cache, o);
      if (!Number.isFinite(v) || v < 0 || v > 1) worst ??= `${name}: still(${JSON.stringify(o)}) = ${v}`;
    }
    if (worst) failures.push(worst);
    if (expect) {
      checks++;
      if (expect.all !== undefined) {
        const off = times.filter(t => !(Math.abs(driveFn(cache, t) - expect.all) <= 1e-6));
        if (off.length) failures.push(`${name}: drive should read ${expect.all} throughout, but reads ${driveFn(cache, off[0])} at ${off[0]} ms (and at ${off.length - 1} other times). Next: check shape() in packages/sound/bake/bake.core.js`);
      }
      if (expect.louderAfterMs !== undefined) {
        const before = driveFn(cache, 0), after = driveFn(cache, expect.louderAfterMs + 100);
        if (!(after > before)) failures.push(`${name}: drive after the burst (${after} at ${expect.louderAfterMs + 100} ms) is not louder than before it (${before}): the unit may be inverted. Next: check shape() and rowEnergy() in packages/sound/bake/bake.core.js`);
      }
    }
  }
  // the unit's direction, on a ladder of steady levels (independent of the fixtures above)
  checks++;
  const ladder = LEVELS.map(l => ({ l, d: driveFn(flatCache(l), 75), s: stillFn(flatCache(l)) }));
  evaluations += ladder.length * 2;
  const wrong = [];
  const first = ladder[0], top = ladder[ladder.length - 1];
  if (!(Math.abs(first.d) <= 1e-6) || !(Math.abs(first.s) <= 1e-6)) wrong.push(`silence reads ${first.d.toFixed(3)} (drive) and ${first.s.toFixed(3)} (still), not 0`);
  if (!(Math.abs(top.d - 1) <= 1e-6) || !(Math.abs(top.s - 1) <= 1e-6)) wrong.push(`full scale reads ${top.d.toFixed(3)} (drive) and ${top.s.toFixed(3)} (still), not 1`);
  for (let i = 1; i < ladder.length; i++) {
    if (ladder[i].d < ladder[i - 1].d - 1e-9) { wrong.push(`drive falls from ${ladder[i - 1].d.toFixed(3)} to ${ladder[i].d.toFixed(3)} as the level rises from ${ladder[i - 1].l} to ${ladder[i].l}`); break; }
    if (ladder[i].s < ladder[i - 1].s - 1e-9) { wrong.push(`still falls from ${ladder[i - 1].s.toFixed(3)} to ${ladder[i].s.toFixed(3)} as the level rises from ${ladder[i - 1].l} to ${ladder[i].l}`); break; }
  }
  if (!(top.d > first.d && top.s > first.s)) wrong.push('drive and still do not rise from silence to full scale');
  if (wrong.length) failures.push(`level ladder (steady levels ${LEVELS[0]} to ${LEVELS[LEVELS.length - 1]}): ${wrong.join('; ')}. Next: drive() and still() in packages/sound/bake/bake.core.js must map silence to 0, full scale to 1, and never read lower for louder input`);
  return result('sound', checks, failures, [], [`${fixtures.length} baked fixtures, ${evaluations} evaluations`]);
}
