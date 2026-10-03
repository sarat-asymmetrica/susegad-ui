// The few pure helpers <sg-depth-photo> takes from story-1 code that is not on main yet, copied
// verbatim from story/1-sevpuri @ 61f7b53: components/focus/focus.core.js (APERTURE, coc, apertureFor)
// and story/frame.js (clampTime, settle). When story 1 merges, point the importers back and delete this.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Blur per register: the widest blur, as a fraction of the stage's height, and the in-focus band. */
export const APERTURE = {
  quiet: { max: 0.006, band: 0.06 },
  warm: { max: 0.016, band: 0.05 },
  playful: { max: 0.022, band: 0.04 },
};

/** Circle-of-confusion radius as a fraction of the stage height. depth 0 far .. 1 near; focus is the sharp depth. */
export function coc(depth, focus, { max = APERTURE.warm.max, band = APERTURE.warm.band, gain = 1 } = {}) {
  const off = Math.max(0, Math.abs(clamp(depth, 0, 1) - clamp(focus, 0, 1)) - band);
  return clamp(off / Math.max(1e-6, 1 - band) * gain, 0, 1) * max;
}

/** The aperture for a register, reduced motion or not (a still keeps its blur: it is the picture, not motion). */
export const apertureFor = register => APERTURE[register] ?? APERTURE.warm;

/** Clamp a requested time into [0, duration]. NaN reads as 0. */
export const clampTime = (t, duration) => (Number.isFinite(t) ? Math.min(Math.max(t, 0), duration) : 0);

/** Wait until a canvas really holds what was drawn: read one pixel back, which finishes every queued draw. */
export async function settle(canvas) {
  const gl = canvas.__sgGL;
  if (gl) {
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return;
  }
  const ctx = canvas.getContext('2d');
  ctx?.getImageData(0, 0, 1, 1);
}
