// FireflySync, the pure core: a small swarm of fireflies as phase oscillators
// with Kuramoto coupling. No DOM; runs in Node; deterministic for a seed.
//
// The part that matters: only `connected` pulls the fireflies together. While
// connecting or offline the coupling is slightly repulsive, so the swarm keeps
// itself out of step rather than drifting into agreement by chance. Sync on
// screen always means the connection is up.

import { rng } from '../../engine/index.js';

const TAU = Math.PI * 2, STEP = 1 / 60;

export const STATES = ['connecting', 'connected', 'offline'];

/**
 * Every word the component shows, per register. The state is always in text.
 * The words are the same in every register on purpose: a connection is a fact
 * people act on, so the fireflies carry the register and the words stay plain.
 * `reconnecting` is for connecting again after the connection was up.
 */
export const STRINGS = {
  quiet: { connecting: 'Connecting', reconnecting: 'Reconnecting', connected: 'Connected', offline: 'Offline' },
  warm: { connecting: 'Connecting', reconnecting: 'Reconnecting', connected: 'Connected', offline: 'Offline' },
  playful: { connecting: 'Connecting', reconnecting: 'Reconnecting', connected: 'Connected', offline: 'Offline' },
};

/** The line of text for a state, with the optional label naming what connects.
 *  `again`: it has been connected before, so connecting is reconnecting. */
export function textFor(state, register = 'warm', label = '', again = false) {
  const s = normState(state), key = again && s === 'connecting' ? 'reconnecting' : s;
  const words = (STRINGS[register] || STRINGS.warm)[key];
  return label ? `${label}: ${words.toLowerCase()}` : words;
}

export const normState = s => (STATES.includes(s) ? s : 'connecting');

/** Coupling K per state: positive only when connected. */
export const COUPLING = { connecting: -0.8, connected: 4, offline: -0.8 };
/** How fast they blink (a multiplier on each firefly's own rhythm) and how bright. */
export const PACE = { connecting: 1, connected: 1, offline: 0.45 };
export const GLOW = { connecting: 1, connected: 1, offline: 0.3 };

/**
 * A swarm of n fireflies in a W × H field (CSS pixels). Each has a resting
 * place, a small hover, its own rhythm near 0.5 Hz, and a phase.
 */
export function createSwarm(seed = 1, n = 7, { W = 64, H = 24, pad = 5 } = {}) {
  const r = rng(`fireflies:${seed}`);
  const x0 = [], y0 = [], omega = [], phase = [], hover = [];
  for (let i = 0; i < n; i++) {
    // spread along the field in slots, jittered, so no two sit on top of each other
    x0.push(pad + ((i + 0.2 + r() * 0.6) / n) * (W - 2 * pad));
    y0.push(pad + r() * (H - 2 * pad));
    omega.push(TAU * (0.5 + r.gauss() * 0.05));
    phase.push(r() * TAU);
    hover.push([r() * TAU, r() * TAU, 0.5 + r() * 0.6]);
  }
  return { n, W, H, x0, y0, omega, phase, hover, t: 0, carry: 0 };
}

/** Order parameter r in [0, 1]: 0 all out of step, 1 perfectly together. */
export function order(phase) {
  let c = 0, s = 0;
  for (const p of phase) { c += Math.cos(p); s += Math.sin(p); }
  return phase.length ? Math.hypot(c, s) / phase.length : 0;
}

/** One fixed step of mean-field Kuramoto: dθi = ωi·pace + K·r·sin(ψ − θi). */
function kuramoto(sw, state) {
  const K = COUPLING[state], pace = PACE[state], n = sw.n;
  let c = 0, s = 0;
  for (const p of sw.phase) { c += Math.cos(p); s += Math.sin(p); }
  const r = Math.hypot(c, s) / n, psi = Math.atan2(s, c);
  for (let i = 0; i < n; i++) {
    const d = sw.omega[i] * pace + K * r * Math.sin(psi - sw.phase[i]);
    sw.phase[i] = (((sw.phase[i] + d * STEP) % TAU) + TAU) % TAU;
  }
  sw.t += STEP;
}

/**
 * Advance the swarm by dt seconds in `state`, in fixed 1/60 s steps (the
 * remainder carries to the next call), so the result does not depend on the
 * frame rate. Long gaps (a hidden tab) are capped at one second.
 */
export function advance(sw, dt, state) {
  state = normState(state);
  sw.carry += Math.min(1, Math.max(0, dt));
  while (sw.carry >= STEP) { sw.carry -= STEP; kuramoto(sw, state); }
  return sw;
}

/** A firefly's brightness for its phase: a quick rise at the flash, a slow afterglow. */
export function flash(phase) {
  const rise = 0.35, decay = 1.5;
  const a = phase < TAU - rise ? phase : phase - TAU;
  return a < 0 ? (1 + a / rise) ** 2 : Math.exp(-a / decay);
}

/** Where each firefly is and how bright, at the swarm's time, for a state. */
export function lights(sw, state) {
  state = normState(state);
  const out = [];
  for (let i = 0; i < sw.n; i++) {
    const [a, b, k] = sw.hover[i];
    out.push({
      x: sw.x0[i] + Math.sin(sw.t * 0.7 * k + a) * 1.6,
      y: sw.y0[i] + Math.sin(sw.t * 0.9 * k + b) * 1.2,
      // a faint steady glow between flashes, so the swarm is always there to see
      glow: GLOW[state] * (0.22 + 0.78 * flash(sw.phase[i])),
    });
  }
  return out;
}

/**
 * The finished still for reduced motion: connected, all lit together;
 * connecting, a scatter of bright and dim; offline, all dim.
 */
export function still(sw, state) {
  state = normState(state);
  const s = { ...sw, phase: sw.phase.map((_, i) => (state === 'connected' ? 0.12 : ((i * 0.618034) % 1) * TAU)) };
  return lights(s, state);
}
