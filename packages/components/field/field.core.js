// Field: the pure core. The ink line's geometry and the reading of lines. Runs in Node.
//
// The ink is a filled outline, not a stroke: a pen line whose width swells
// and thins with pressure and whose path drifts a little off the rule, from
// smooth noise seeded by the field's name. Same seed, same line. "Boiling"
// (playful) re-rolls the drift twelve times a second while someone types,
// the way hand-drawn animation is drawn on twos.

import { makeNoise } from '../../engine/src/noise.js';
import { hashSeed, rng } from '../../engine/src/rng.js';

/** Every string a person reads or hears. Kathakar edits these. */
export const STRINGS = {
  // read after the field's own label when the field has a maxlength
  count: (n, max) => `${n} of ${max} characters`,
  countLeft: left => (left === 1 ? '1 character left' : `${left} characters left`),
};

const noises = new Map();
const noiseFor = seed => {
  const k = hashSeed(seed);
  if (!noises.has(k)) { if (noises.size > 64) noises.clear(); noises.set(k, makeNoise(k)); }
  return noises.get(k);
};

/**
 * An ink line `w` units long along y = 0, as SVG path data for a filled
 * outline. `drift` is how far the pen strays from the rule; `weight` the
 * middle width; `phase` moves along the noise (the boil). The ends taper
 * like a nib landing and lifting (`land` and `lift` are how long each
 * takes, in units). Pure.
 */
export function inkPath(w, { seed = 1, drift = 0.7, weight = 1.6, phase = 0, step = 6, land = 5, lift = 12 } = {}) {
  if (!(w > 0.5)) return '';
  const n = noiseFor(seed);
  // sample at fixed x, so the start of the line stays put as it grows
  const xs = [];
  for (let x = 0; x < w; x += step) xs.push(x);
  xs.push(w);
  const pts = xs.map(x => {
    const taper = Math.max(0, Math.min(1, x / land, (w - x) / lift)) ** 0.6; // lands quickly, lifts slowly
    const y = n(x / 38, phase) * drift;
    const half = (weight / 2) * (0.5 + 0.5 * taper) * (1 + 0.28 * n(x / 17, 9.1 + phase));
    return [x, y, Math.max(0.2, half)];
  });
  const f = v => +v.toFixed(2);
  const top = pts.map(([x, y, h]) => `${f(x)} ${f(y - h)}`);
  const bottom = pts.slice().reverse().map(([x, y, h]) => `${f(x)} ${f(y + h)}`);
  return `M${top.join(' L')} L${bottom.join(' L')} Z`;
}

/**
 * The resting rule drawn in pencil: a long first pass that runs a little past
 * both ends of the field, and a lighter second pass over part of it, the way
 * a hand goes back over a line. Returns the passes as [{ d, x, y, alpha }],
 * each an inkPath outline to be placed at (x, y). Same seed, same rule. Pure.
 */
export function pencilRule(w, { seed = 1, weight = 1.5, drift = 1.1 } = {}) {
  if (!(w > 4)) return [];
  const r = rng(`field-pencil:${seed}`);
  const f = v => +v.toFixed(2);
  const x0 = -r.range(1.5, 4), x1 = w + r.range(2, 5.5);
  const a = r.range(0.03, 0.28) * w, b = w - r.range(0.02, 0.3) * w;
  return [
    { d: inkPath(x1 - x0, { seed: `${seed}:1`, drift, weight, step: 8, land: 22, lift: 30 }), x: f(x0), y: 0, alpha: 1 },
    { d: inkPath(b - a, { seed: `${seed}:2`, drift: drift * 1.6, weight: weight * 0.75, step: 8, land: 30, lift: 40 }), x: f(a), y: f(r.sign() * r.range(0.8, 1.4)), alpha: 0.6 },
  ];
}

/**
 * How the focused rule inks in, by component motion: over the register's
 * slow duration in warm, a little quicker in playful, and not at all in
 * quiet or under reduced motion (the ink is simply there). Pure.
 */
export function inkIn(motion) {
  if (motion === 'ambient') return { duration: 560, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)' };
  if (motion === 'full') return { duration: 420, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' };
  return null;
}

/**
 * Paper grain through graphite, as SVG filter primitives: a turbulence alpha
 * mask composited in the pencil, so a pencil line reads as pencil beside ink.
 * Select and combobox draw their warm rule with it too.
 */
export const GRAIN = '<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="7"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.5 1.65"/><feComposite in="SourceGraphic" operator="in"/>';

/** The boil's frame: a new drift twelve times a second, on twos. */
export const boilPhase = (ms, fps = 12) => Math.floor(ms / (1000 / fps)) * 0.37;

/**
 * Lines of text from the client rects of a Range over the text (one or more
 * rects per line), relative to a box. Rects on the same line (within half a
 * line) merge; empty rects are dropped. Returns [{ x, y, w }] with y at the
 * baseline side (the bottom of the line box), top to bottom. Pure.
 * @param {{ left: number, top: number, right: number, bottom: number, width: number }[]} rects
 * @param {{ left: number, top: number }} box
 */
export function lineRuns(rects, box = { left: 0, top: 0 }) {
  const lines = [];
  for (const r of rects) {
    if (!(r.width > 0.5)) continue;
    const mid = (r.top + r.bottom) / 2;
    const line = lines.find(l => Math.abs(l.mid - mid) < (r.bottom - r.top) / 2);
    if (line) { line.left = Math.min(line.left, r.left); line.right = Math.max(line.right, r.right); line.bottom = Math.max(line.bottom, r.bottom); }
    else lines.push({ mid, left: r.left, right: r.right, bottom: r.bottom });
  }
  return lines.sort((a, b) => a.mid - b.mid).map(l => ({ x: l.left - box.left, y: l.bottom - box.top, w: l.right - l.left }));
}

/** What the count says, and whether it is worth saying yet (the last fifth, or over). */
export function countState(length, max) {
  if (!(max > 0)) return { show: false, text: '', over: false };
  const left = max - length;
  return { show: left <= Math.max(10, Math.round(max * 0.2)), text: left >= 0 ? STRINGS.countLeft(left) : STRINGS.count(length, max), over: left < 0, left };
}
