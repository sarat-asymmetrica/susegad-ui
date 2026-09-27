// paper.js: grain tiles and handmade paper. Canvas edge.
import { TAU, lerp } from './math.js';
import { rng } from './rng.js';
import { makeNoise } from './noise.js';
import { hexToRgb, rgba } from './color.js';

const tileCache = new Map();
function tile(key, make) { if (!tileCache.has(key)) tileCache.set(key, make()); return tileCache.get(key); }

function grainTile(color, lo, hi, size = 128) {
  return tile(`g:${color}:${lo}:${hi}`, () => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), img = g.createImageData(size, size), [R, G, B] = hexToRgb(color), r = rng(size + lo * 7 + hi);
    for (let i = 0; i < size * size; i++) {
      img.data[i * 4] = R; img.data[i * 4 + 1] = G; img.data[i * 4 + 2] = B;
      img.data[i * 4 + 3] = Math.round(255 * lerp(lo, hi, Math.pow(r(), 1.6)));
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

/** A pattern whose pixels are `color` at uneven opacity: graphite and pigment texture.
 *  The tile is mapped 1:1 to device pixels whatever the transform.
 *  @param {CanvasRenderingContext2D} g @param {string} color @returns {CanvasPattern} */
export function grainPattern(g, color, { lo = 0.35, hi = 1 } = {}) {
  const pat = g.createPattern(grainTile(color, lo, hi), 'repeat');
  const m = g.getTransform();
  pat.setTransform(new DOMMatrix([1 / m.a, 0, 0, 1 / m.d, 0, 0]));
  return pat;
}

/**
 * Paint handmade paper into g (logical units W×H): base colour, cloudy
 * mottling, fine grain, a few fibres, a soft vignette. Paint it once into a
 * cached layer, never per frame.
 * @param {CanvasRenderingContext2D} g @param {number} W @param {number} H
 */
export function paper(g, W, H, {
  base = '#f1ece1', seed = 1, mottle = 0.07, grain = 0.09, fibers = 70,
  fiber = '#6b5a3e', vignette = 0.10, speck = '#3a2f22',
} = {}) {
  g.save();
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // cloudy mottling from a tiny noise canvas, smoothly upscaled
  const nz = makeNoise(seed), mw = 64, mh = Math.max(2, Math.round((64 * H) / W));
  const m = document.createElement('canvas'); m.width = mw; m.height = mh;
  const mg = m.getContext('2d'), img = mg.createImageData(mw, mh);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const v = nz.fbm(x * 0.09, y * 0.09, 0.5, 3), i = (y * mw + x) * 4, light = v > 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 255 : 40;
    img.data[i + 3] = Math.min(255, Math.abs(v) * mottle * 255 * 3.2);
  }
  mg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(m, 0, 0, W, H);
  // grain
  g.globalAlpha = grain; g.fillStyle = grainPattern(g, speck, { lo: 0, hi: 0.9 }); g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  // fibres
  const r = rng(seed + 91);
  g.lineCap = 'round';
  for (let i = 0; i < fibers; i++) {
    const x = r() * W, y = r() * H, a = r() * TAU, len = r.range(4, 22), bend = r.range(-6, 6);
    g.strokeStyle = rgba(fiber, r.range(0.04, 0.13)); g.lineWidth = r.range(0.35, 0.9);
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len / 2 - Math.sin(a) * bend, y + Math.sin(a) * len / 2 + Math.cos(a) * bend, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  // vignette
  if (vignette > 0) {
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    vg.addColorStop(0, 'rgba(60,40,20,0)'); vg.addColorStop(1, `rgba(60,40,20,${vignette})`);
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  g.restore();
}
