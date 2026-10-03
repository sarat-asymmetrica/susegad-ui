// depth-photo.2d.js: the 2D renderer for <sg-depth-photo>. No three, no WebGL.
// Used in quiet, under reduced motion, on lite devices, without WebGL, and
// when three fails to load. It draws the same frame as the live tier at rest,
// minus the water's motion and the camera's parallax: the graded photo, the
// dolly as a zoom toward the kept point, and the focus as a blend of three
// blur levels chosen per pixel by the circle of confusion (focus.core.js).
// Paint once per change; nothing runs between changes.

import { coc } from './story-shims.js';

const canFilter = (() => {
  try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; } catch { return false; }
})();

const make = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.max(1, w | 0), height: Math.max(1, h | 0) });

/** A blurred copy of `src`, radius r px: the canvas filter where it exists, a down-and-up scale where it doesn't.
 *  The filter leaves the edges see-through, so the sharp image goes underneath to fill them. */
function blurred(src, r) {
  const out = make(src.width, src.height), x = out.getContext('2d');
  if (r < 0.5) { x.drawImage(src, 0, 0); return out; }
  if (canFilter) { x.filter = `blur(${r}px)`; x.drawImage(src, 0, 0); x.filter = 'none'; x.globalCompositeOperation = 'destination-over'; x.drawImage(src, 0, 0); return out; }
  const k = Math.max(1, r / 1.5), sm = make(src.width / k, src.height / k);
  const s = sm.getContext('2d'); s.imageSmoothingQuality = 'high'; s.drawImage(src, 0, 0, sm.width, sm.height);
  x.imageSmoothingQuality = 'high'; x.drawImage(sm, 0, 0, out.width, out.height);
  return out;
}

/**
 * @param {HTMLCanvasElement} canvas the visible (or export) canvas
 * @param {{ look: HTMLImageElement|HTMLCanvasElement, depth: HTMLImageElement, ink?: number[], paper?: number[] }} src
 */
export function create2DRenderer(canvas, src) {
  const ctx = canvas.getContext('2d', { alpha: false });
  // the depth, once, as bytes
  const dw = src.depth.naturalWidth || src.depth.width, dh = src.depth.naturalHeight || src.depth.height;
  const dc = make(dw, dh), dctx = dc.getContext('2d', { willReadFrequently: true });
  dctx.drawImage(src.depth, 0, 0);
  const depth = dctx.getImageData(0, 0, dw, dh).data;
  let look = src.look, graded = null, levels = null, lastKey = '';
  const pa = (look.naturalWidth || look.width) / (look.naturalHeight || look.height);

  /** The photo graded like the live look (lifted blacks, eased highlights), at the working size. */
  function grade(H) {
    const W = Math.round(H * pa), c = make(W, H), x = c.getContext('2d');
    x.drawImage(look, 0, 0, W, H);
    const ink = src.ink ?? [0.1, 0.09, 0.12], paper = src.paper ?? [0.99, 0.975, 0.95];
    // mix(ink, paper, c) is c * (paper - ink) + ink: a multiply, then an add
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = `rgb(${paper.map((p, i) => Math.round((p - ink[i]) * 255)).join(',')})`; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'lighter';
    x.fillStyle = `rgb(${ink.map(v => Math.round(v * 255)).join(',')})`; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  /** Masks: how much of each blur level shows at each pixel, for this focus. */
  function masks(s, H) {
    const W = Math.round(H * pa), sharp = make(W, H), half = make(W, H);
    const a = { max: s.blur.max, band: s.blur.band, gain: s.blur.gain };
    const sd = new ImageData(dw, dh), hd = new ImageData(dw, dh);
    const top = s.blur.max * s.blur.gain;
    for (let i = 0, n = dw * dh; i < n; i++) {
      const f = top > 0 ? coc(depth[i * 4] / 255, s.focus, a) / top : 0;   // 0 sharp .. 1 fully blurred
      sd.data[i * 4 + 3] = Math.round(255 * Math.max(0, 1 - f * 2));    // sharp fades out by half blur
      hd.data[i * 4 + 3] = Math.round(255 * Math.max(0, 1 - Math.abs(f * 2 - 1))); // half peaks at half blur
    }
    const tmp = make(dw, dh), t = tmp.getContext('2d');
    t.putImageData(sd, 0, 0); sharp.getContext('2d').drawImage(tmp, 0, 0, W, H);
    t.putImageData(hd, 0, 0); half.getContext('2d').drawImage(tmp, 0, 0, W, H);
    return { sharp, half };
  }

  const masked = (img, mask) => {
    const c = make(img.width, img.height), x = c.getContext('2d');
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'destination-in'; x.drawImage(mask, 0, 0);
    return c;
  };

  return {
    kind: '2d', pa,
    resize(cssW, cssH, dpr = 1) {
      const k = Math.min(dpr, 2);
      canvas.width = Math.round(cssW * k); canvas.height = Math.round(cssH * k);
      lastKey = '';
    },
    setSource(img) { look = img; graded = null; levels = null; lastKey = ''; },
    setGrade() { graded = null; levels = null; lastKey = ''; },
    /** Draw a frameState(). Only focus, blur, dolly and the window matter here. */
    draw(s) {
      const W = canvas.width, H = canvas.height;
      const key = `${W}x${H}|${s.focus.toFixed(4)}|${s.blur.max}|${s.blur.gain}|${s.cam.z.toFixed(4)}|${s.cam.y.toFixed(4)}|${JSON.stringify(s.win)}`;
      if (key === lastKey) return;
      lastKey = key;
      // work at the size the canvas shows the photo at, capped
      const win = s.win, visH = (win.top - win.bottom) / (2 * s.tanY);
      const workH = Math.min(2048, Math.max(256, Math.round(H / visH)));
      if (!graded || graded.height !== workH) { graded = grade(workH); levels = null; }
      const rFull = s.blur.max * s.blur.gain * H * (graded.height / (H / visH));
      if (!levels || levels.r !== rFull) levels = { r: rFull, full: blurred(graded, rFull), half: blurred(graded, rFull / 2) };
      const m = masks(s, workH);
      const comp = make(graded.width, graded.height), cx = comp.getContext('2d');
      cx.drawImage(levels.full, 0, 0);
      cx.drawImage(masked(levels.half, m.half), 0, 0);
      cx.drawImage(masked(graded, m.sharp), 0, 0);
      // the window in photo pixels; the dolly zooms toward the window's centre
      const tanX = s.tanY * pa;
      const zoom = 1 / (1 + s.cam.z * -0.9);
      const cxT = (win.left + win.right) / 2, cyT = (win.top + win.bottom) / 2 + s.cam.y * 0.35;
      const hw = (win.right - win.left) / 2 * zoom, hh = (win.top - win.bottom) / 2 * zoom;
      const u0 = ((cxT - hw) / tanX + 1) / 2, v0 = (1 - (cyT + hh) / s.tanY) / 2;
      const uw = hw / tanX, vh = hh / s.tanY;
      ctx.drawImage(comp, u0 * comp.width, v0 * comp.height, uw * comp.width, vh * comp.height, 0, 0, W, H);
    },
    dispose() { canvas.width = canvas.height = 0; },
  };
}
