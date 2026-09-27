// treatments.js: a WebGL shader pass over a playing <video>, in our four
// looks (decision: Sound and AV, the charter). Draws onto a canvas placed
// over the (visually hidden but still playing, so its audio and decoding
// keep going) video element. Falls back to the plain video when WebGL is
// missing, lost, or the frame times say the GPU can't keep up: A4/A6, and
// the charter's "fallbacks everywhere".
//
// The fragment shader does its own colour and halftone maths (GLSL can't
// import treatments.core.js), written to match it; treatments.core.js is
// the tested, documented source of truth for both, and the 2D fallback
// path (canvas 2D, no WebGL) calls it directly.

import { createGL } from '../engine/index.js';
import { oklchToRgb, TREATMENTS, isTreatment, halftoneCell, halftoneRadius, luma as lumaOf, duotoneMix } from './treatments.core.js';

const VERT = 'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; vUv.y = 1.0 - vUv.y; gl_Position = vec4(aPos, 0.0, 1.0); }';

const FRAG = prec => `precision ${prec} float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform int uType; // 0 ink, 1 halftone, 2 duotone, 3 riso
uniform vec3 uInk, uPaper, uColorA, uColorB;
uniform float uCell, uAngle, uSeed;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec2 rotate(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x + s * p.y, -s * p.x + c * p.y); }

float dotAt(vec2 px, float cell, float angle, float tone) {
  vec2 r = rotate(px, angle);
  vec2 cellPos = mod(r, cell) - cell * 0.5;
  float radius = min(cell * 0.5 * 0.98, (cell * 0.5) * sqrt(max(0.0, 1.0 - tone)));
  return 1.0 - smoothstep(radius - 1.0, radius + 1.0, length(cellPos));
}

void main() {
  vec3 src = texture2D(uTex, vUv).rgb;
  vec3 outc;
  if (uType == 0) {
    // ink: a two-tone wash with a soft threshold, like a pencil study
    float l = luma(src);
    float t = smoothstep(0.32, 0.68, l);
    outc = mix(uInk, uPaper, t);
  } else if (uType == 1) {
    // halftone: a rotated dot grid, one tone, dot size carries the value
    float l = luma(src);
    float d = dotAt(gl_FragCoord.xy, uCell, uAngle, l);
    outc = mix(uPaper, uInk, d);
  } else if (uType == 2) {
    // duotone: two tokens' colours, mixed by luma
    outc = mix(uColorA, uColorB, luma(src));
  } else {
    // riso: three inks (uInk, uColorA, uColorB), each sampled with its own
    // small offset, combined the way overprinted risograph plates darken
    vec2 px = 1.0 / uRes;
    float a = luma(texture2D(uTex, vUv + px * vec2(sin(uSeed), cos(uSeed * 1.3))).rgb);
    float b = luma(texture2D(uTex, vUv + px * vec2(sin(uSeed * 2.1 + 1.0), cos(uSeed * 1.7 + 2.0))).rgb);
    float c = luma(src);
    outc = uPaper - (uPaper - uInk) * (1.0 - a) - (uPaper - uColorA) * (1.0 - b) * 0.7 - (uPaper - uColorB) * (1.0 - c) * 0.5;
    outc = clamp(outc, 0.0, 1.0);
  }
  gl_FragColor = vec4(outc, 1.0);
}`;

/** [r,g,b] (0..255) to a GLSL vec3 (0..1). */
const norm = rgb => rgb.map(v => v / 255);

/**
 * @typedef {{ type: 'ink'|'halftone'|'duotone'|'riso', ink?: number[], paper?: number[],
 *   colorA?: number[], colorB?: number[], cell?: number, angle?: number, governor?: { level: number } }} TreatmentOptions
 *   Colours are [r,g,b] 0..255 (from `oklchToRgb`, or `readColors`/`roleHex` resolved to hex then parsed).
 */

/**
 * Mount a video treatment on `canvas`, drawing from `video` every animation
 * frame while `active()` is true. Returns `{ ok, ready, setType, setColors, destroy }`.
 * `ok` is false when WebGL isn't available: the caller should show the plain
 * video and hide the canvas. `ready` is false until the first real frame has
 * actually been drawn: a freshly created WebGL canvas is opaque black (this
 * engine's contexts have no alpha channel), so the caller should keep
 * showing the plain video (or a poster) until `onReady` fires, rather than
 * reveal that black canvas the moment WebGL is merely available.
 * @param {HTMLVideoElement} video @param {HTMLCanvasElement} canvas
 * @param {TreatmentOptions} opts @param {() => boolean} active
 * @param {() => void} [onReady] called once, right before the first real draw
 */
export function createTreatment(video, canvas, opts, active, onReady) {
  const state = {
    type: isTreatment(opts.type) ? opts.type : 'ink',
    ink: opts.ink ?? [29, 39, 66],
    paper: opts.paper ?? [247, 244, 235],
    colorA: opts.colorA ?? opts.ink ?? [29, 39, 66],
    colorB: opts.colorB ?? opts.paper ?? [247, 244, 235],
    cell: opts.cell ?? 10,
    angle: opts.angle ?? Math.PI / 4,
  };
  const gl = createGL(canvas, { frag: FRAG, vert: VERT, label: 'sg-player treatment' });
  if (!gl) return { ok: false, setType() {}, setColors() {}, destroy() {} };

  const { gl: ctx } = gl;
  const tex = ctx.createTexture();
  ctx.bindTexture(ctx.TEXTURE_2D, tex);
  for (const [p, v] of [[ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE], [ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE], [ctx.TEXTURE_MIN_FILTER, ctx.LINEAR], [ctx.TEXTURE_MAG_FILTER, ctx.LINEAR]]) ctx.texParameteri(ctx.TEXTURE_2D, p, v);

  let raf = 0, destroyed = false, ready = false;
  const typeIndex = { ink: 0, halftone: 1, duotone: 2, riso: 3 };

  function resize() {
    const w = video.videoWidth || canvas.clientWidth || 1, h = video.videoHeight || canvas.clientHeight || 1;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  function frame() {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (!active() || video.readyState < 2) return;
    resize();
    ctx.viewport(0, 0, canvas.width, canvas.height);
    ctx.bindTexture(ctx.TEXTURE_2D, tex);
    try { ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, video); } catch { return; } // a cross-origin frame: nothing we can draw
    ctx.activeTexture(ctx.TEXTURE0);
    gl.set('uTex', 0);
    gl.set('uRes', canvas.width, canvas.height);
    gl.set('uType', typeIndex[state.type] ?? 0);
    gl.set('uInk', ...norm(state.ink));
    gl.set('uPaper', ...norm(state.paper));
    gl.set('uColorA', ...norm(state.colorA));
    gl.set('uColorB', ...norm(state.colorB));
    gl.set('uCell', state.cell);
    gl.set('uAngle', state.angle);
    gl.set('uSeed', performance.now() / 1000);
    if (!ready) { ready = true; onReady?.(); }
    gl.draw();
  }
  raf = requestAnimationFrame(frame);

  return {
    ok: true,
    get ready() { return ready; },
    setType(type) { if (isTreatment(type)) state.type = type; },
    setColors(patch) { Object.assign(state, patch); },
    destroy() { destroyed = true; cancelAnimationFrame(raf); gl.release(); ctx.deleteTexture(tex); },
  };
}

export { TREATMENTS, isTreatment, oklchToRgb };

/**
 * The 2D-canvas halftone fallback for one still frame (used by the still
 * poster and by environments with no WebGL worth animating): paints
 * `source` (a video or canvas) through `treatments.core.js`'s own maths, so
 * a no-WebGL still looks like the same family as the animated look.
 * @param {CanvasRenderingContext2D} g @param {CanvasImageSource} source @param {number} w @param {number} h
 * @param {TreatmentOptions} opts
 */
export function drawTreatmentStill(g, source, w, h, opts = {}) {
  const type = isTreatment(opts.type) ? opts.type : 'ink';
  const ink = opts.ink ?? [29, 39, 66], paper = opts.paper ?? [247, 244, 235];
  const colorA = opts.colorA ?? ink, colorB = opts.colorB ?? paper;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const og = off.getContext('2d', { willReadFrequently: true });
  og.drawImage(source, 0, 0, w, h);
  const img = og.getImageData(0, 0, w, h), out = g.createImageData(w, h);
  const cell = opts.cell ?? 10, angle = opts.angle ?? Math.PI / 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const l = lumaOf(img.data[i] / 255, img.data[i + 1] / 255, img.data[i + 2] / 255);
    let rgb;
    if (type === 'duotone') rgb = duotoneMix(l, colorA, colorB);
    else if (type === 'halftone') {
      const c = halftoneCell(x, y, cell, angle);
      rgb = c.dist <= halftoneRadius(l, cell) ? ink : paper;
    } else rgb = l > 0.5 ? paper : ink; // ink and riso stills both collapse to the two-tone wash
    out.data.set([...rgb, 255], i);
  }
  g.putImageData(out, 0, 0);
}
