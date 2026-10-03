// Veranda: the pictures <sg-depth-photo> needs, made at load from the scene's own geometry.
//
//   const a = await verandaAssets({ mood: 'day' });
//   a.look     a canvas: the finished still (the drawing)
//   a.depth    blob URL of the depth map, white near, exact by construction
//   a.layers   blob URL of the layers map (G sky, B the subject: the lamp)
//   a.depthBytes  the depth map's bytes, width x height (a.width x a.height), for anything that reads the depth (the pane's mask)
//   a.release()
//
// Not part of the scene's first sight: only a page that stages the drawing in 3D imports this.
// No photograph and no depth model: the depth map is world.js's ray caster, pixel by pixel.

import { W, H, depthMap, layersMap } from './world.js';
import { createPainter, gStep, drawLamp } from './paint.js';
import { sunAt, SUN_REST } from './model.js';

const toBlob = canvas => new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('could not encode the map'))), 'image/png'));

/** The depth map as a canvas (r = g = b = depth byte), from a G-buffer. */
export function depthCanvas(g) {
  const c = Object.assign(document.createElement('canvas'), { width: g.w, height: g.h }), ctx = c.getContext('2d'), img = ctx.createImageData(g.w, g.h), d = depthMap(g);
  for (let k = 0; k < d.length; k++) { img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = d[k]; img.data[k * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return c;
}
export function layersCanvas(g) {
  const c = Object.assign(document.createElement('canvas'), { width: g.w, height: g.h }), ctx = c.getContext('2d');
  ctx.putImageData(new ImageData(layersMap(g), g.w, g.h), 0, 0);
  return c;
}

/**
 * Paint the still, the depth map and the layers map.
 * @param {{ mood?: 'day'|'dusk', px?: number, sun?: number, dark?: boolean }} [o] px: look pixels per logical unit (1 gives 1200 x 800)
 */
export async function verandaAssets({ mood = 'day', px = 1, sun = SUN_REST } = {}) {
  let g;
  while (!(g = gStep(1000))) await new Promise(r => setTimeout(r));
  const painter = createPainter({ mode: 'ink', mood, px, paper: '#f1ede4', paperInk: null });
  const job = painter.build(g, sunAt(sun));
  for (let t0 = performance.now(), r = job.next(); !r.done; r = job.next()) if (performance.now() - t0 > 12) { painter.flush(); await new Promise(r2 => setTimeout(r2)); t0 = performance.now(); }
  const look = Object.assign(document.createElement('canvas'), { width: Math.round(W * px), height: Math.round(H * px) }), lg = look.getContext('2d');
  painter.compose(lg, sunAt(sun), 1);
  lg.setTransform(px, 0, 0, px, 0, 0);
  drawLamp(lg, 0, { mood, ink: mood === 'dusk' ? '#0e0b14' : '#2a1c12' });
  const [d, l] = await Promise.all([toBlob(depthCanvas(g)), toBlob(layersCanvas(g))]);
  const depth = URL.createObjectURL(d), layers = URL.createObjectURL(l);
  painter.dispose();
  return { look, depth, layers, depthBytes: depthMap(g), width: g.w, height: g.h, release() { URL.revokeObjectURL(depth); URL.revokeObjectURL(layers); } };
}
