// gif.js: the browser-facing GIF export. Paints frames to an offscreen
// canvas at fixed, evenly-spaced times (as webm.js does), reads each one's
// pixels, and hands them to gif.core.js's dependency-free encoder.

import { framesToGif } from './gif.core.js';

/**
 * Record `frames` calls to `draw(time, i, frames)` (each paints `canvas`)
 * into an animated GIF Blob.
 * @param {HTMLCanvasElement} canvas
 * @param {{ fps?: number, durationSec?: number, draw: (t: number, i: number, frames: number) => void | Promise<void>,
 *   maxColors?: number, loop?: boolean }} opts
 * @returns {Promise<Blob>}
 */
export async function recordCanvasToGif(canvas, { fps = 12, durationSec = 3, draw, maxColors = 128, loop = true } = {}) {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const frames = Math.max(1, Math.round(fps * durationSec)), out = [];
  for (let i = 0; i < frames; i++) {
    await draw(i / fps, i, frames);
    out.push({ rgba: g.getImageData(0, 0, canvas.width, canvas.height).data, delayMs: Math.round(1000 / fps) });
  }
  const bytes = framesToGif({ width: canvas.width, height: canvas.height, frames: out, maxColors, loop });
  return new Blob([bytes], { type: 'image/gif' });
}

/**
 * Record a Susegad scene definition to an animated GIF, the same way
 * `webm.js`'s `recordSceneToWebm` does: fixed times, not the wall clock.
 * @param {import('../core/define-scene.js').SceneDef} def
 * @param {{ seed?: number|string, register?: 'quiet'|'warm'|'playful', params?: object,
 *   fps?: number, durationSec?: number, maxColors?: number, width?: number, height?: number }} [opts]
 *   `width`/`height` downscale the output (a GIF at a scene's full logical
 *   size, e.g. Paus at 1200 × 800, both grows very large and takes a long
 *   time to encode; a social-post GIF wants a few hundred pixels, not the
 *   scene's full canvas).
 * @returns {Promise<Blob>}
 */
export async function recordSceneToGif(def, opts = {}) {
  const { seed = def.meta.seed ?? 1, register = 'warm', params = {}, fps = 10, durationSec = 3, maxColors = 128 } = opts;
  const { W, H } = def.meta;
  const width = opts.width ?? W, height = opts.height ?? H;
  const motion = register === 'quiet' ? 'state' : register === 'playful' ? 'full' : 'ambient';
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:-99999px';
  document.body.appendChild(host);
  const governor = { level: 1 };
  const renderer = def.createRenderer(host, { W, H, register, motion, seed, governor, invalidate() {}, advance() {} });
  const src = host.querySelector('canvas');
  if (!src) { renderer.destroy(); host.remove(); throw new Error(`recordSceneToGif: ${def.name} drew no canvas`); }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  try {
    return await recordCanvasToGif(canvas, {
      fps, durationSec, maxColors,
      draw(t) {
        const data = def.model({ time: t, seed, register, params, W, H });
        renderer.render(data, { time: t, dt: 1 / fps, calm: [], pointer: { x: 0, y: 0, inside: false, down: false, keyboard: false }, quality: 1, still: false, epoch: 0, register, motion });
        g.clearRect(0, 0, width, height);
        g.drawImage(src, 0, 0, width, height);
      },
    });
  } finally {
    renderer.destroy();
    host.remove();
  }
}

export { framesToGif } from './gif.core.js';
