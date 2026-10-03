// The applier for the words-in-world primitive: an orientation written as one composited
// transform on a text layer, and nothing else. quat.core.js is the maths, orient.core.js is the
// policy, and this file is the only part that touches the DOM (decision 0022).
//
// Why a composited transform and not a reflow: the words are the layout engine's, measured once,
// one span a line, and a turn must not move a line box, break a word or take the text out of the
// accessibility tree. So the transform goes on one layer, never on a descendant that carries
// text, and this module reads no text metric at all: no rect on a line span, no font measurement,
// no reflow of its own.
//
// The turn is about the layer's own centre, which is what makes the inverse possible: the centre
// is on the rotation axis and projects to itself, so a rect measured through the turn is the
// projection of a flat rect, and the flat rect comes back from the quaternion, the perspective
// and that centre (unproject). The layer must keep the default transform-origin (50% 50%).
//
// The register is obeyed in the model: quiet, reduced motion, a browser that cannot composite
// matrix3d and a teardown all leave the layer at identity, with no transition and no frame loop.

import { IDENTITY, qNorm, qAngle, qMul, toMatrix4, cssMatrix3d } from './quat.core.js';
import { SETTLE, params, aim, softConstrain, settle, sway, isIdentity, tiltWords } from './orient.core.js';

const MOVING = 180;     // ms of transition while the orientation is still moving; cleared at rest
const EASE = 'var(--sg-ease-out, cubic-bezier(.22,.61,.36,1))';
const SEED = 'orient';  // the piece's seed: the same page at the same moment draws the same words
const R2D = 180 / Math.PI;
const ONE = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';

let supported;          // the one matrix3d feature test, done once, at createOrient time
function canTurn() {
  if (supported === undefined) {
    try { supported = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('transform', `perspective(900px) ${ONE}`); }
    catch { supported = false; }
  }
  return supported;
}

/**
 * Mount the turn on a text layer.
 * @param {HTMLElement} layer one layer the words sit in: the transform goes here, and nowhere else
 * @param {HTMLElement|null} stage the stage the pointer is relative to; watched, so a layout change re-asks the policy
 * @param {string} register quiet, warm or playful
 * @param {boolean} reduced reduced motion: identity, whatever the register
 * @param {number} perspective the CSS perspective in px
 * @param {((said: string) => void)|null} onSaid the polite status line: once per settling, never per frame
 * @returns {{ apply, pointer, setRegister, setReduced, unproject, state, destroy }}
 */
export function createOrient({ layer, stage = null, register = 'warm', reduced = false, perspective = 900, onSaid = null } = {}) {
  if (!layer?.style) throw new Error('createOrient needs a layer element');
  const ok = canTurn();
  let reg = register, still = !!reduced;
  let q = IDENTITY;                 // where the settle has the words
  let shown = IDENTITY;              // what the layer carries: q with the sway composed in, the two only ever apart by the sway
  let look = IDENTITY;              // the look the reader asked for, already inside the cone
  let over = 0;                     // how far past the cone that ask was, in degrees
  let ptr = [0, 0], since = 0;      // the pointer, and when it last moved (the sway's clock)
  let raf = 0, at = 0;              // the frame loop, and the timestamp of its last frame
  let told = IDENTITY, said = 0;    // what the status line last spoke for, and its pending call

  const p = () => params(reg, { reduced: still });
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ── the plane, in the layer's own frame: (x, y) from the centre, y down, exactly where CSS
  // puts the matrix. One geometry, taken from the same matrix CSS is handed, so the two cannot
  // drift apart.
  const project = (x, y, m) => {
    const X = m[0] * x + m[4] * y + m[12], Y = m[1] * x + m[5] * y + m[13], Z = m[2] * x + m[6] * y + m[14];
    // perspective(N) is applied outside the matrix, so w' = w - z / N: the plane's own depth,
    // divided out, is the whole of the perspective.
    const w = 1 - Z / perspective;
    return [X / w, Y / w];
  };
  /** The bounds a flat rect projects to: what a rect measured through the turn would be. */
  const bounds = (r, m) => {
    const c = [project(r.left, r.top, m), project(r.left + r.width, r.top + r.height, m), project(r.left, r.top + r.height, m), project(r.left + r.width, r.top, m)];
    const l = Math.min(c[0][0], c[1][0], c[2][0], c[3][0]), t = Math.min(c[0][1], c[1][1], c[2][1], c[3][1]);
    return { left: l, top: t, width: Math.max(c[0][0], c[1][0], c[2][0], c[3][0]) - l, height: Math.max(c[0][1], c[1][1], c[2][1], c[3][1]) - t };
  };
  /**
   * The layer's flat centre in client px. The centre projects to itself, so the measured box is
   * the flat box moved by the projection of its own corners about that centre: one rect, on the
   * layer only, never on the words.
   */
  const centre = () => {
    const b = layer.getBoundingClientRect(), w = layer.offsetWidth, h = layer.offsetHeight;
    const c = bounds({ left: -w / 2, top: -h / 2, width: w, height: h }, toMatrix4(shown));
    return { x: (b.left + b.right) / 2 - c.left - c.width / 2, y: (b.top + b.bottom) / 2 - c.top - c.height / 2 };
  };

  // ── what CSS is given
  /**
   * One composited transform on the layer, its register attribute, and a transition only while
   * the orientation is still moving. Identity is no transform at all and no transition.
   */
  const write = (next, { immediate = false, moving = false } = {}) => {
    const on = ok && !isIdentity(next);
    shown = next;                          // what the layer carries from here: the state and the inverse read this
    layer.style.transform = on ? `perspective(${perspective}px) ${cssMatrix3d(next)}` : '';
    layer.style.transition = on && moving && !immediate ? `transform ${MOVING}ms ${EASE}` : '';
    layer.dataset.orient = on ? 'on' : 'off';
  };

  // ── what the policy says
  /** Where the reader's pointer asks the words to look, held inside the register's cone. */
  const asked = () => {
    const r = softConstrain(aim({ pointer: ptr, turn: 1, params: p() }), IDENTITY, p().maxTiltDeg);
    over = r.overDeg;
    return r.q;
  };
  /**
   * The words as they are `t` seconds after the reader last asked: the look with the seeded sway
   * riding it, still inside the cone.
   *
   * The sway rides the motion and comes to rest with it. A drift that never stopped would leave
   * the transform changing for ever after the look had arrived, which is the jitter the settle's
   * deadband exists to prevent (and the check's settle window reads). A piece that wants a
   * continuous idle drift drives this module through apply() from its own loop.
   */
  const composed = t => {
    const m = p();
    const d = m.swayOn ? sway(t, SEED, { swayDeg: m.swayDeg, maxTiltDeg: m.maxTiltDeg }) : IDENTITY;
    return softConstrain(qMul(look, d), IDENTITY, m.maxTiltDeg).q;
  };

  // ── the status line, once per settling and never per frame
  const say = () => {
    if (!onSaid || qAngle(shown, told) <= SETTLE.deadbandDeg / R2D) return; // the words did not move
    told = shown;
    onSaid(tiltWords(shown, IDENTITY));
  };
  /** A coalesced call for a caller-driven write, whose motion the transition finishes. */
  const saySoon = () => { clearTimeout(said); said = setTimeout(() => { said = 0; say(); }, MOVING + 40); };

  // ── the frame loop: the damped settle of orient.core, one write a frame
  const tick = time => {
    raf = 0;
    const dt = at ? Math.min(0.1, (time - at) / 1000) : 0.016;
    at = time;
    const m = p();
    const step = settle(q, look, dt, { tau: m.tau });
    q = step.q;
    write(composed((now() - since) / 1000), { moving: !step.settled });
    if (step.settled) { at = 0; say(); }
    else raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf && ok) { at = 0; raf = requestAnimationFrame(tick); } };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; at = 0; };
  /** Identity, at once and with no transition: quiet, reduced motion, no matrix3d, a teardown. */
  const toStill = () => {
    stop();
    q = look = IDENTITY;
    over = 0;
    write(IDENTITY, { immediate: true });
    say();
  };

  // ── what a caller calls
  /**
   * The caller's own orientation, held inside the cone, written at once. It stops this module's
   * pointer loop: the caller owns the motion from here.
   */
  const apply = (next, { immediate = false } = {}) => {
    stop();
    const r = softConstrain(qNorm(next ?? IDENTITY), IDENTITY, p().maxTiltDeg);
    q = look = r.q;
    over = r.overDeg;
    write(q, { immediate, moving: !immediate });
    (immediate || !ok ? say : saySoon)();
  };
  /**
   * The pointer, in [-1, 1] each way, relative to the stage. A no-op where the register does not
   * follow the pointer (quiet, reduced motion, a touch screen): nothing is asked of the words.
   * @returns {boolean} whether the look was taken
   */
  const pointer = xy => {
    if (!ok || !p().followsPointer) return false;
    ptr = [Number(xy?.[0]) || 0, Number(xy?.[1]) || 0];
    since = now();
    look = asked();
    start();
    return true;
  };
  /** A register change is a change of model, not of colour: a register that may not turn goes still at once. */
  const setRegister = next => {
    reg = next;
    if (!p().followsPointer) return toStill();
    since = now();
    look = asked();
    start();
  };
  const setReduced = next => {
    still = !!next;
    if (still) return toStill();
    setRegister(reg);
  };
  /**
   * A client rect measured through the turn, back in the flat plane, in the same units. The
   * veranda's settle judges occlusion in the plane's own space, where its 15% rule was written
   * (decision 0022). A rect measured through a perspective is not the rect that was turned, so
   * the flat rect is the one whose own projection has these bounds, found by repeated correction.
   */
  const unproject = rect => {
    const m = toMatrix4(shown), c = centre();
    const want = { left: rect.left - c.x, top: rect.top - c.y, width: rect.width, height: rect.height };
    let f = { ...want };
    // Half-steps, because the projection of a flat rect is not an identity map of its own bounds:
    // a roll stretches the bounds faster than the rect, and a full step there would ring.
    for (let i = 0; i < 40; i++) {
      const g = bounds(f, m);
      const dx = g.left - want.left, dy = g.top - want.top, dw = g.width - want.width, dh = g.height - want.height;
      if (Math.abs(dx) < 0.005 && Math.abs(dy) < 0.005 && Math.abs(dw) < 0.005 && Math.abs(dh) < 0.005) break;
      f = { left: f.left - dx / 2, top: f.top - dy / 2, width: f.width - dw / 2, height: f.height - dh / 2 };
    }
    return { left: f.left + c.x, top: f.top + c.y, width: f.width, height: f.height };
  };
  /** { q, centre, perspective, transformed, overDeg }: where the words are, and what they were asked. */
  const state = () => ({ q: [...shown], centre: centre(), perspective, transformed: ok && !isIdentity(shown), overDeg: over });

  // A layout change under a turn: the origin moved with the layer, so ask the policy again.
  const watch = stage && typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (ok && p().followsPointer && (raf || !isIdentity(q))) { since = now(); look = asked(); start(); } }) : null;
  watch?.observe(stage);
  write(IDENTITY, { immediate: true });   // data-orient="off" from the first paint

  return {
    apply, pointer, setRegister, setReduced, unproject, state,
    destroy() {
      stop();
      clearTimeout(said);
      said = 0;
      watch?.disconnect();
      layer.style.transform = '';
      layer.style.transition = '';
      layer.dataset.orient = 'off';
    },
  };
}