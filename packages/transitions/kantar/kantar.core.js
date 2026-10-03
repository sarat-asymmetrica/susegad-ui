// The Kantar interlude: the pure core. Runs in Node.
//
// Ported from the sketchbook's kantar.js (a tiatr stage: the curtain drops,
// a singer steps into the spot and sings while the set changes, the curtain
// rises on somewhere new), taking the principle rather than the likeness
// (HOMAGE rule 1): a three-phase timeline — down, wait, up — where "wait"
// is not a fixed song length but however long the real work actually takes,
// with a skip that jumps straight to "up" from anywhere.
//
// Nothing here touches the DOM, a timer or a Promise: every function is a
// question about elapsed milliseconds and a couple of flags, answered the
// same way every time.

export const STRINGS = {};

/**
 * The curtain's own theatrical durations, in milliseconds. Not the wait.
 * `curtainUp` and `minWaitMs` are both small on purpose (Sutradhar review,
 * 25 Sep, KB1): the first draft used 900ms for both, measured from when the
 * "wait" phase itself began — so real work of a second or so (not instant,
 * but not slow either) could still be held for several hundred extra
 * milliseconds after it had already finished, because the floor was larger
 * than the time already spent. `minWaitMs` only needs to rescue genuinely
 * instant work from flashing past unreadably; once real work has taken any
 * noticeable time, swap()ping the moment it resolves is what "never
 * outlasts the real wait" means. `curtainUp` is capped the same way: the
 * rise is a fixed flourish, not something the visitor should wait through.
 */
export const DEFAULT_TIMING = { curtainDown: 700, curtainUp: 300, minWaitMs: 300, msPerLine: 2200 };

export const PHASES = ['down', 'wait', 'up', 'done'];

/**
 * How far down the curtain has travelled, 0 (open) to 1 (fully down), eased
 * so it gathers speed and settles rather than moving at a constant rate.
 * @param {number} t 0..1, the phase's own progress
 */
export function curtainEase(t) {
  const c = Math.max(0, Math.min(1, t));
  // easeOutCubic falling, easeInCubic rising: read by curtainAt below, which
  // knows which direction it is.
  return c;
}

/** A cubic ease-out: starts fast, settles — the curtain falling under its own weight. */
export const easeOutCubic = t => 1 - (1 - t) ** 3;
/** A cubic ease-in: starts slow, gathers speed — the curtain rising, drawn up. */
export const easeInCubic = t => t ** 3;

/**
 * The curtain's openness for the whole interlude, 0 (open, the step showing)
 * to 1 (closed, the curtain covering it), as a function of the phase and
 * the phase's own progress (0..1, from `phaseProgress`).
 * @param {'down'|'wait'|'up'|'done'} phase
 * @param {number} p phase progress, 0..1
 */
export function curtainAt(phase, p) {
  if (phase === 'down') return easeOutCubic(curtainEase(p));
  if (phase === 'wait') return 1;
  if (phase === 'up') return 1 - easeInCubic(curtainEase(p));
  return 0; // done
}

/** A phase's own progress, 0..1, from how long the interlude has spent in it. */
export function phaseProgress(msInPhase, durationMs) {
  if (durationMs <= 0) return 1;
  return Math.max(0, Math.min(1, msInPhase / durationMs));
}

/**
 * Whether the "wait" phase may end: the real work is done, AND the phase
 * has run at least `minWaitMs`. For real work that takes any noticeable
 * time, `msInPhase` is already past a small `minWaitMs` the moment
 * `workDone` flips true, so this returns true on the very next tick —
 * "swap the instant the work resolves". The floor only holds the wait open
 * further for work that resolves faster than `minWaitMs` itself (down to
 * genuinely instant), so even that gets one readable beat.
 * @param {{ workDone: boolean, msInPhase: number, minWaitMs?: number }} args
 */
export function waitIsOver({ workDone, msInPhase, minWaitMs = DEFAULT_TIMING.minWaitMs }) {
  return !!workDone && msInPhase >= minWaitMs;
}

/** The state machine's one transition table, as a pure lookup. */
const NEXT = { down: 'wait', wait: 'up', up: 'done', done: 'done' };
export const nextPhase = phase => NEXT[phase] ?? 'done';

/**
 * Which song line is showing, cycling through `lines` every `msPerLine`.
 * With no lines, there is nothing to show.
 * @param {number} msInPhase
 * @param {string[]} lines
 * @param {number} [msPerLine]
 */
export function songLineIndex(msInPhase, lines, msPerLine = DEFAULT_TIMING.msPerLine) {
  if (!lines?.length) return -1;
  return Math.floor(Math.max(0, msInPhase) / msPerLine) % lines.length;
}

/**
 * The skip control's target: from any phase, straight to "up", so a
 * skipped interlude still shows the curtain rising rather than vanishing.
 * "down" skips straight to "up" too — never to "wait", since there is
 * nothing left to wait for once the visitor has asked to move on.
 * @param {'down'|'wait'|'up'|'done'} phase
 */
export function skipTarget(phase) {
  return phase === 'up' || phase === 'done' ? phase : 'up';
}

// ── the curtain's own drawing, as geometry (Sutradhar review, 25 Sep, KS1)
// ──────────────────────────────────────────────────────────────────────────
//
// The plate (asymmetrica-web/explorations/susegad/pieces/kantar.js) drew a
// tiatr stage: folds, a hem that ripples with a damped wave when it lands,
// a painted proscenium, a spotlight pool, a singer's silhouette. A flat
// coloured box with hand-lettered text lost the point of the harvest.
// These functions are the geometry a canvas layer needs to draw that,
// still phase-driven and pure — no canvas context, no Date.now(), just
// numbers in and numbers out.

/**
 * The fold pattern's slow horizontal drift, a bounded sway.
 * @param {number} tSec seconds since the interlude mounted
 */
export function foldSway(tSec) {
  return Math.sin(tSec * 0.4) * 6;
}

/**
 * The hem's wave offset at a point across the curtain's width, in the same
 * units as the curtain's own height (the caller scales). Two regimes, both
 * bounded and continuous at the handover: while still moving, a gentle
 * wave scaled by how much motion is happening right now (zero at both
 * fully open and fully closed, peaking mid-travel); once landed (fully
 * closed for `landedSec` seconds), a travelling ripple that decays
 * exponentially, the way heavy velvet settles instead of stopping dead.
 * @param {number} xFrac 0..1 across the curtain's width
 * @param {number} curtain 0..1, from curtainAt()
 * @param {number | null} landedSec seconds since the curtain last reached
 *   fully closed; null while still moving and not yet landed
 */
export function hemWave(xFrac, curtain, landedSec) {
  if (landedSec != null && landedSec >= 0) {
    const amp = 7 * Math.exp(-landedSec * 2.2);
    return amp * Math.sin(xFrac * 12 - landedSec * 9);
  }
  const amp = 2.4 * curtain * (1 - curtain) * 4;
  return amp * Math.sin(xFrac * 12);
}

/**
 * The spotlight's intensity, 0..1: off outside "wait", a short fade in once
 * it starts (time-based, not phase-progress-based, since "wait" has no
 * fixed length — it lasts as long as the real work does).
 * @param {'down'|'wait'|'up'|'done'} phase
 * @param {number} msInPhase
 */
export function spotIntensity(phase, msInPhase) {
  if (phase !== 'wait') return 0;
  return Math.max(0, Math.min(1, msInPhase / 400));
}

// The plate's figure is drawn in a 240-unit-tall design space, feet at the
// origin (y grows upward as a negative fraction of that 240), with a sway
// that leans the figure more at the feet than the head — the same point
// helper the plate's own singerShape() and singer() both used, kept as one
// pure function here so the body, the head and the bun all read it once.
const singerPoint = (dx, dy, sway) => [(dx + sway * (240 - dy) * 0.012) / 240, -dy / 240];

/**
 * A singer's silhouette (the body only) as a closed polygon, in units where
 * 1 = the figure's own height, feet at the origin, standing upright with
 * `sway` tilting it left/right. The plate's own body outline, ported
 * point for point — see `singerHead`, `singerBun` and `singerMic` for the
 * rest of the figure the plate's `singer()` draws onto the same shape.
 * @param {number} [sway] roughly -1..1
 */
export function singerSilhouette(sway = 0) {
  const P = (dx, dy) => singerPoint(dx, dy, sway);
  // The plate's own fixed points (Volume III's second round: "the singer was
  // a peg doll" until the shoulder, arm and hand detail below was added).
  // An earlier draft of this port simplified this down to 16 points and
  // quietly lost that fix, reading as a plain cone again — Rasika's Wave 5
  // review, S3. Restored verbatim, only re-centred (the plate's own P(x, dy)
  // used feet as the origin with x offset; here dx already is that offset).
  return [
    P(-46, 0), P(-30, 60), P(-22, 118), P(-26, 150), P(-24, 170), P(-12, 180), P(-8, 190),
    P(-6, 197), P(8, 197), P(10, 192),
    P(14, 182), P(24, 176), P(30, 166), P(40, 176), P(44, 196), P(38, 200), P(28, 186), P(26, 160),
    P(22, 118), P(30, 60), P(48, 0),
  ];
}

/**
 * The head, an ellipse: the plate's `singer()` draws it onto the same
 * Path2D as the body (`path.ellipse(hx, hy, 12k, 15k, 0.1, 0, TAU)` at
 * `hx = x + (2 + sway·28·0.012)·k, hy = feet - 212·k`), which the S3 review
 * caught this port never had — the body alone stops at the shoulders and
 * reads as headless. `hx, hy` is exactly `singerPoint(2, 212, sway)`: the
 * same sway law as the body, evaluated at the neck's height.
 * @param {number} [sway]
 * @returns {{ cx: number, cy: number, rx: number, ry: number, rotation: number }}
 */
export function singerHead(sway = 0) {
  const [cx, cy] = singerPoint(2, 212, sway);
  return { cx, cy, rx: 12 / 240, ry: 15 / 240, rotation: 0.1 };
}

/**
 * The hair bun, a second ellipse up and to the left of the head, fixed
 * relative to it (not swayed a second time — the plate offsets it from the
 * already-swayed `hx, hy` by a plain `-13k, -8k`).
 * @param {number} [sway]
 * @returns {{ cx: number, cy: number, rx: number, ry: number }}
 */
export function singerBun(sway = 0) {
  const head = singerHead(sway);
  return { cx: head.cx - 13 / 240, cy: head.cy - 8 / 240, rx: 7.5 / 240, ry: 7 / 240 };
}

/**
 * The mic and its stand, three points for an open polyline (never swayed
 * in the plate either — `ink(g, [[x+38,feet],[x+38,feet-h*0.72],[x+30,feet-h*0.8]], …)`).
 * `feet - h·0.72` is exactly `feet` minus 0.72 of the figure's own height,
 * which in these normalised units (1 = the figure's height) is simply `-0.72`.
 * @returns {[number, number][]}
 */
export function singerMic() {
  return [[38 / 240, 0], [38 / 240, -0.72], [30 / 240, -0.8]];
}
