// depth-photo.core.js: the pure side of <sg-depth-photo>. Params and their
// ranges, what each register allows, the sea's flow, and the numbers a test
// or a report needs (blur in px, parallax travel). No DOM; runs in Node.

import { coc, apertureFor } from './story-shims.js';
import { cameraAt, coverWindow, projectPoint, parseVec } from '../stage3d.core.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Every param: [default, min, max]. Attributes are the kebab-case names. */
export const PARAMS = {
  focus: [0.2, 0, 1],       // the sharp depth: 0 the horizon, 1 the nearest thing
  aperture: [1, 0, 2],      // a gain on the register's blur
  dolly: [0, 0, 1],         // how far along dolly-path the camera has moved
  parallax: [1, 0, 2],      // a gain on the register's pointer and tilt parallax
  sea: [1, 0, 2],           // a gain on the register's water motion (needs a layers map)
  clarity: [0, 0, 1],       // local contrast where the image is in focus (a lens pulled sharp)
  t: [0, 0, 1e6],           // time in seconds, for the water; the element's clock drives it when live
};

/** Per register: how much may move. Reduced motion is handled by the tier (it never animates). */
export const PROFILES = {
  quiet: { parallax: 0, sea: 0, swell: 0 },
  warm: { parallax: 0, sea: 0.7, swell: 0.6 },
  playful: { parallax: 0.045, sea: 1, swell: 1 },
};
export const profileFor = register => PROFILES[register] ?? PROFILES.warm;

/** Coerce a partial params object: numbers clamped, unreadable values dropped (so they keep their current value). */
export function coerce(params) {
  const out = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (!(k in PARAMS)) continue;
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (Number.isFinite(n)) out[k] = clamp(n, PARAMS[k][1], PARAMS[k][2]);
  }
  return out;
}

export const defaults = () => Object.fromEntries(Object.entries(PARAMS).map(([k, [d]]) => [k, d]));

/**
 * The sea's flow for photo row v (0 top, 1 bottom) between the horizon and the
 * shore: how far the water moves toward the viewer per cycle, as a fraction of
 * the photo height. Grows with nearness, the way a wave's travel grows on the
 * way in, and fades out at both edges of the band. Pure; the shader does the same.
 */
export function seaFlow(v, horizon, shore) {
  const y = clamp((v - horizon) / Math.max(1e-6, shore - horizon), 0, 1);
  return 0.0015 + 0.018 * Math.pow(y, 1.4);
}
/** Seconds per flow cycle. */
export const SEA_PERIOD = 3.2;

/**
 * Everything a renderer needs for one frame, in one plain object. Pure.
 * @param {object} p params (coerced)
 * @param {{ register: string, va: number, pa: number, keep: number[], path: number[], pointer?: number[], fovY?: number }} view
 */
export function frameState(p, { register = 'warm', va, pa, keep = [0.5, 0.5], path, pointer = [0, 0], fovY = 50, overscan = 0.92 }) {
  const prof = profileFor(register), ap = apertureFor(register);
  const tanY = Math.tan(fovY * Math.PI / 360);
  return {
    tanY, pa, register,
    win: coverWindow(va, pa, tanY, { keep, overscan }),
    cam: cameraAt(p.dolly, path, pointer, prof.parallax * p.parallax),
    focus: p.focus,
    blur: { max: ap.max, band: ap.band, gain: p.aperture },
    sea: prof.sea * p.sea,
    swell: prof.swell * p.sea,
    clarity: p.clarity,
    t: p.t,
  };
}

/** The blur radius in px, on a stage `h` px tall, of a point at depth d in frame state `s`. */
export const blurPx = (s, d, h) => coc(d, s.focus, { max: s.blur.max, band: s.blur.band, gain: s.blur.gain }) * h;

/** Where photo point (u, v, depth d) sits on a stage w x h px in frame state `s`. */
export function placeOnStage(s, u, v, d, w, h) {
  const [x, y] = projectPoint(u, v, d, s.win, s.cam, s.tanY, s.pa);
  return [x * w, y * h];
}

export { parseVec };
