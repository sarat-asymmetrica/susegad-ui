// Themb: the renderer. Ported from the sketchbook plate (read only, never
// edited): the fragment program (the leaf's velvet, bloom and inked veins, the
// other leaves in the dark below, the beads as signed distance fields joined
// by a smooth minimum and drawn as lenses), the 2D leaf and beads for when
// WebGL is missing, and the rain, streaks and splashes are the plate's own.
// The port adds the engine's glSurface (resolution by the governor, context
// loss handed to the 2D painting, a released context on destroy), the
// `renderer` param and the governor's last step to 2D like Tollem, evening
// rain for dark pages, the calm zone (no rain over the page's words), and the
// hand: the pointer or the keyboard hand tilts the leaf in playful, and Enter
// or Space pours the cup or sets a bead down.

import { stage, glSurface, rng, clamp, ease, TAU, ink } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, MAXB, LC, TIPA, LL, CUP, SIG, TIPD, STILL_TIME, leafR, leafAt, leafTime, areaOf, inCalm, clearMemo } from './model.js';

const f1 = v => (Number.isInteger(v) ? `${v}.0` : `${v}`);

// ── The fragment program (the plate's own, plus evening for dark pages) ─────

const frag = prec => `
precision ${prec} float;
uniform vec2 uRes;
uniform float uT;
uniform float uDark;
uniform vec2 uTilt;
uniform int uN;
uniform vec4 uB[${MAXB}];   // x, y, r, opacity
uniform vec4 uWb[${MAXB}];  // wobble, axis cos, axis sin, -
uniform vec4 uBox;         // bounds of all the water, grown by the shadow and blend
const vec2 WH = vec2(${f1(W)}, ${f1(H)});
const vec2 LC = vec2(${f1(LC[0])}, ${f1(LC[1])});
const float TIPA = ${f1(TIPA)}, LL = ${f1(LL)}, CUP = ${f1(CUP)}, SIG = ${f1(SIG)}, TIPD = ${f1(TIPD)};
const float PI = 3.14159265;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wrapA(float a) { return mod(a + PI, 2.0 * PI) - PI; }

float leafR(float a) {
  float b = abs(a), c = cos(a * 0.5);
  float notch = 1.0 - 0.8 * exp(-pow((PI - b) / 0.2, 2.0));
  return LL * (0.58 + 0.18 * c * c * c * c + 0.26 * exp(-b / 0.2)) * notch * (1.0 + 0.012 * sin(a * 9.0 + 1.3));
}
float leafSdAt(vec2 p, vec2 c, float tip, float s) {
  vec2 q = (p - c) / s;
  return (length(q) - leafR(wrapA(atan(q.y, q.x) - tip))) * 0.9 * s;
}
// The leaf blade: velvet green, bloom, radiating veins in ink.
vec3 leafCol(vec2 p, float px) {
  vec2 q = p - LC;
  float len = length(q);
  float a = wrapA(atan(q.y, q.x) - TIPA);
  float rho = len / leafR(a);
  vec2 rdir = q / max(len, 0.001);
  float tw = max(0.0, cos(a)), sr = clamp((rho - 0.35) / 0.65, 0.0, 1.0);
  vec2 gr = CUP * q / (SIG * SIG) * exp(-len * len / (2.0 * SIG * SIG)) - uTilt
          - rdir * TIPD * tw * tw * tw * 2.0 * sr / (0.65 * leafR(a));
  vec3 n = normalize(vec3(-gr * 3.5, 1.0));
  float dif = dot(n, normalize(vec3(-0.45, -0.6, 0.66)));
  float m = vnoise(p * 0.012) * 0.6 + vnoise(p * 0.05) * 0.4;
  vec3 col = mix(vec3(0.20, 0.36, 0.18), vec3(0.40, 0.58, 0.28), clamp(dif * 1.1 - 0.05 + (m - 0.5) * 0.25, 0.0, 1.0));
  col = mix(col, vec3(0.62, 0.72, 0.64), 0.12 + 0.12 * smoothstep(0.4, 0.8, vnoise(p * 0.02 + 5.0)));
  col *= 0.94 + 0.08 * vnoise(vec2(a * 22.0, rho * 9.0));
  float vein = 0.0, edge = 0.0;
  float fade = 1.0 - smoothstep(0.82, 0.97, rho);
  float vw = vnoise(p * 0.06) - 0.5;
  for (int m2 = 0; m2 < 7; m2++) {
    float fm = float(m2);
    float mag = m2 == 0 ? 0.0 : (m2 <= 4 ? 0.47 * fm : (m2 == 5 ? 2.42 : 2.84));
    float bend = m2 >= 1 && m2 <= 4 ? 0.34 : (m2 >= 5 ? -0.08 : 0.0);
    float w = mix(6.5, 1.1, rho) * (m2 == 0 ? 1.35 : (m2 >= 5 ? 0.85 : 0.8));
    for (int sg = 0; sg < 2; sg++) {
      if (m2 == 0 && sg == 1) continue;
      float sgn = sg == 0 ? 1.0 : -1.0;
      float th = sgn * (mag - bend * rho * rho);
      float d = abs(wrapA(a - th)) * len + vw * (0.8 - 0.25 * fm * sgn);
      vein = max(vein, 1.0 - smoothstep(w * 0.5 - px, w * 0.5 + px, d));
      edge = max(edge, 1.0 - smoothstep(0.2, 0.2 + px + 0.7, abs(d - w * 0.5 - 0.7)));
    }
  }
  float sa = a * 7.6 + rho * 1.8 * sign(a);
  float sd = abs(fract(sa) - 0.5) / 7.6 * len;
  float sec = (1.0 - smoothstep(0.5, 0.5 + px + 0.6, sd)) * smoothstep(0.22, 0.4, rho) * 0.45;
  col = mix(col, vec3(0.72, 0.79, 0.5), max(vein * fade * (0.9 - 0.3 * rho), sec * fade * 0.6));
  col = mix(col, vec3(0.1, 0.18, 0.11), edge * fade * 0.45);
  col = mix(col, vec3(0.28, 0.33, 0.16), 1.0 - smoothstep(6.0, 10.0, len));
  return col;
}

vec3 background(vec2 p, float px) {
  vec3 col = mix(vec3(0.07, 0.11, 0.09), vec3(0.12, 0.17, 0.13), vnoise(p * 0.006));
  vec2 rp = mat2(0.8, -0.6, 0.6, 0.8) * p;
  col += vec3(0.03, 0.045, 0.04) * smoothstep(0.45, 0.85, vnoise(rp * 0.011) * 0.6 + vnoise(rp * 0.037) * 0.4);
  float o1 = leafSdAt(p, vec2(80.0, 760.0), -0.9, 0.62);
  float o2 = leafSdAt(p, vec2(1180.0, 90.0), 2.5, 0.55);
  float o3 = leafSdAt(p, vec2(1140.0, 830.0), -2.2, 0.45);
  float o = min(o1, min(o2, o3));
  col = mix(col, vec3(0.13, 0.22, 0.12) * (0.8 + 0.3 * vnoise(p * 0.02)), 1.0 - smoothstep(-6.0, 6.0, o));
  col = mix(col, vec3(0.04, 0.07, 0.05), (1.0 - smoothstep(0.4, 2.0 + px, abs(o))) * 0.7);
  float sh = leafSdAt(p - vec2(22.0, 30.0) - uTilt * 160.0, LC, TIPA, 1.0);
  col *= 1.0 - 0.45 * (1.0 - smoothstep(-24.0, 24.0, sh));
  return col;
}

vec4 water(vec2 p, out float op, out float sh) {
  const float k = 5.0;
  float m = 1e4, sum = 0.0, rad = 0.0;
  vec2 g = vec2(0.0);
  op = 0.0; sh = 1e4;
  vec2 ps = p - vec2(5.0, 8.0);
  for (int i = 0; i < ${MAXB}; i++) {
    if (i >= uN) break;
    vec4 b = uB[i]; vec4 wb = uWb[i];
    vec2 q = p - b.xy;
    vec2 ax = wb.yz, ay = vec2(-ax.y, ax.x);
    float s = 1.0 + wb.x;
    float d = length(vec2(dot(q, ax) / s, dot(q, ay) * s)) - b.z;
    vec2 qs = ps - b.xy;
    sh = min(sh, length(qs) - b.z * 0.92 + (1.0 - b.w) * 40.0);
    vec2 dir = q / max(length(q), 0.001);
    if (d < m) {
      float c = exp(-(m - d) / k);
      sum = sum * c + 1.0; rad = rad * c + b.z; op = op * c + b.w; g = g * c + dir;
      m = d;
    } else {
      float w = exp(-(d - m) / k);
      sum += w; rad += w * b.z; op += w * b.w; g += w * dir;
    }
  }
  if (sum <= 0.0) { op = 0.0; return vec4(1e4, 0.0, 0.0, 1.0); }
  op /= sum;
  return vec4(m - k * log(sum), normalize(g + vec2(1e-5)), rad / sum);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * WH;
  float px = WH.x / uRes.x;
  float ls = leafSdAt(p, LC, TIPA, 1.0);
  vec3 col = ls < 3.0 ? leafCol(p, px) : vec3(0.0);
  if (ls > -3.0) col = mix(col, background(p, px), smoothstep(-px, px, ls));
  float ew = 1.3 + 0.6 * vnoise(p * 0.03);
  col = mix(col, vec3(0.62, 0.72, 0.5), (1.0 - smoothstep(0.0, 2.2, abs(ls + 3.2))) * 0.35);
  col = mix(col, vec3(0.06, 0.11, 0.07), 1.0 - smoothstep(ew - px, ew + px, abs(ls)));

  if (uN > 0 && p.x > uBox.x && p.y > uBox.y && p.x < uBox.z && p.y < uBox.w) {
    float op, sh;
    vec4 wv = water(p, op, sh);
    col *= 1.0 - 0.4 * (1.0 - smoothstep(-4.0, 8.0, sh));
    float f = wv.x;
    if (f < px) {
      float R = wv.w, sIn = max(-f, 0.0);
      float flatR = min(R, 24.0);
      vec2 nxy = wv.yz * max(0.0, 1.0 - sIn / flatR) * 0.98;
      float nz = sqrt(max(0.0, 1.0 - dot(nxy, nxy)));
      vec3 n = vec3(nxy, nz);
      vec3 refr = leafCol(p - nxy * R * 0.6, px);
      float lsR = leafSdAt(p - nxy * R * 0.6, LC, TIPA, 1.0);
      refr = mix(refr, background(p, px), smoothstep(-1.0, 1.0, lsR));
      vec3 bc = refr * 1.08 + vec3(0.02, 0.03, 0.03);
      float rim = pow(1.0 - nz, 1.3);
      bc = mix(bc, mix(vec3(0.08, 0.12, 0.1), vec3(0.76, 0.82, 0.82), smoothstep(0.1, -0.6, dot(nxy, vec2(0.6, 0.8)))), rim * 0.85);
      bc += vec3(0.9, 0.95, 0.75) * smoothstep(0.35, 0.85, dot(normalize(nxy + 1e-4), vec2(0.6, 0.8))) * smoothstep(0.1, 0.5, length(nxy)) * (1.0 - rim) * 0.35;
      vec3 L = normalize(vec3(-0.45, -0.6, 0.66));
      float sp = max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0);
      bc += vec3(1.0, 1.0, 0.96) * (smoothstep(0.985, 0.992, sp) * 0.9 + pow(sp, 30.0) * 0.25);
      bc = mix(bc, vec3(0.05, 0.09, 0.07), (1.0 - smoothstep(0.0, 1.6, -f)) * 0.55);
      col = mix(col, bc, (1.0 - smoothstep(-px, px, f)) * op);
    }
  }

  float grain = hash(floor(gl_FragCoord.xy)) - 0.5;
  col *= 1.0 + grain * 0.08 + (vnoise(p * 0.01 + 9.0) - 0.5) * 0.08;
  vec2 v = p / WH - 0.5;
  col *= 1.0 - dot(v, v) * 0.45;
  // evening rain on a dark page: the same leaf, cooler and lower, the beads still catching the sky
  col = mix(col, col * vec3(0.52, 0.58, 0.78) + vec3(0.0, 0.01, 0.03), uDark);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// ── 2D drawing: rain, splashes, and the no-WebGL leaf (the plate's own) ──────

function drawRain(g, sim, t, calm, quality) {
  const r = rng(Math.floor(t * 30));
  const n = Math.round(sim.rain * 70 * Math.max(0.4, quality));
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = r() * (W + 200) - 100, y = r() * H, len = r.range(18, 40), a = r.range(0.08, 0.2), lw = r.range(0.6, 1.2);
    if (calm.length && (inCalm(x, y, calm, 24) || inCalm(x - len * 0.28, y - len, calm, 24))) continue;
    g.strokeStyle = `rgba(220,232,228,${a})`; g.lineWidth = lw;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - len * 0.28, y - len); g.stroke();
  }
  // the drops about to land: a streak closing on its mark
  for (const d of sim.incoming) {
    const u = clamp((sim.t - d.t0) / (d.at - d.t0));
    const x = d.x - (1 - u) * 40 * -d.wind * 3, y = d.y - (1 - u) * 110;
    g.strokeStyle = 'rgba(236,244,240,0.55)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 12 * d.wind * 3 * -1, y - 30); g.stroke();
  }
  // splashes: a ring and a crown of droplets thrown out and falling back
  for (const s of sim.splashes) {
    const age = sim.t - s.t, u = age / 0.6;
    if (u < 0 || u > 1) continue;
    const sr = rng(s.seed);
    g.strokeStyle = `rgba(230,240,236,${0.5 * (1 - u)})`; g.lineWidth = 1;
    g.beginPath(); g.arc(s.x, s.y, s.r + 30 * ease.outCubic(u), 0, TAU); g.stroke();
    const k = 6 + Math.round(s.r / 2);
    for (let i = 0; i < k; i++) {
      const a = sr() * TAU, sp = sr.range(26, 60) * (0.6 + s.r / 12), lift = Math.sin(Math.PI * Math.min(1, u * 1.3)) * sr.range(6, 16);
      const x = s.x + Math.cos(a) * sp * ease.outCubic(u), y = s.y + Math.sin(a) * sp * ease.outCubic(u) - lift;
      g.fillStyle = `rgba(240,246,242,${0.85 * (1 - u)})`;
      g.beginPath(); g.arc(x, y, sr.range(1, 2.4) * (1 - u * 0.5), 0, TAU); g.fill();
      g.fillStyle = `rgba(20,34,26,${0.5 * (1 - u)})`;
      g.beginPath(); g.arc(x + 0.6, y + 0.8, 0.6, 0, TAU); g.fill();
    }
  }
  g.restore();
}

function leafOutline(scale = 1, c = LC, tip = TIPA) {
  const pts = [];
  for (let i = 0; i < 240; i++) {
    const a = -Math.PI + (i / 240) * TAU, rr = leafR(a) * scale;
    pts.push([c[0] + Math.cos(a + tip) * rr, c[1] + Math.sin(a + tip) * rr]);
  }
  return pts;
}

/** The leaf for the no-WebGL path, painted once. */
function drawLeaf2D(g) {
  g.fillStyle = '#16211b'; g.fillRect(0, 0, W, H);
  for (const [c, tip, s] of [[[80, 760], -0.9, 0.62], [[1180, 90], 2.5, 0.55], [[1140, 830], -2.2, 0.45]]) {
    const o = leafOutline(s, c, tip);
    g.fillStyle = '#213a20'; g.beginPath(); o.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.fill();
  }
  const out = leafOutline();
  const path = new Path2D(); out.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y))); path.closePath();
  g.save(); g.translate(22, 30); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fill(path); g.restore();
  const gr = g.createRadialGradient(LC[0] - 60, LC[1] - 80, 20, LC[0], LC[1], LL);
  gr.addColorStop(0, '#6a9a4a'); gr.addColorStop(0.35, '#4f7f3a'); gr.addColorStop(1, '#335a2a');
  g.fillStyle = gr; g.fill(path);
  g.save(); g.clip(path);
  const mags = [0, 0.47, 0.94, 1.41, 1.88, 2.42, 2.84], bends = [0, 0.34, 0.34, 0.34, 0.34, -0.08, -0.08];
  mags.forEach((mag, m) => {
    for (const sgn of m ? [1, -1] : [1]) {
      const pts = [];
      for (let k = 0; k <= 20; k++) {
        const rho = (k / 20) * 0.95, a = sgn * (mag - bends[m] * rho * rho), d = rho * leafR(a);
        pts.push([LC[0] + Math.cos(a + TIPA) * d, LC[1] + Math.sin(a + TIPA) * d]);
      }
      ink(g, pts, { width: m ? 3 : 4.5, color: '#b7c68a', alpha: 0.75, seed: m * 3 + sgn, taper: 60 });
      ink(g, pts.map(([x, y]) => [x + 1.6, y + 1.6]), { width: 0.9, color: '#16281a', alpha: 0.5, seed: m * 5 + sgn, taper: 40 });
    }
  });
  g.restore();
  ink(g, out, { width: 2, color: '#0f1c12', alpha: 0.85, closed: true, seed: 4 });
}

function drawBeads2D(g, sim) {
  for (const b of sim.beads) {
    const op = b.fall >= 0 ? 1 - b.fall : 1, rr = b.r * (b.fall >= 0 ? 1 - b.fall * 0.4 : 1);
    g.save(); g.globalAlpha = op;
    g.fillStyle = 'rgba(8,16,10,0.35)'; g.beginPath(); g.arc(b.x + 4, b.y + 6, rr, 0, TAU); g.fill();
    const gr = g.createRadialGradient(b.x - rr * 0.3, b.y - rr * 0.35, rr * 0.1, b.x, b.y, rr);
    gr.addColorStop(0, 'rgba(150,190,130,0.9)'); gr.addColorStop(0.7, 'rgba(90,130,80,0.9)'); gr.addColorStop(0.92, 'rgba(190,206,200,0.95)'); gr.addColorStop(1, 'rgba(30,44,36,0.95)');
    g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, rr, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,250,0.95)'; g.beginPath(); g.ellipse(b.x - rr * 0.38, b.y - rr * 0.42, rr * 0.2, rr * 0.13, -0.6, 0, TAU); g.fill();
    g.restore();
  }
}

// ── The renderer ──────────────────────────────────────────────────────────

export function createRenderer(host, opts = {}) {
  const { invalidate = () => {} } = opts;
  const st = stage(host, { W, H });
  host.style.display = 'grid';
  let glc = document.createElement('canvas');
  glc.style.cssText = 'grid-area:1/1;width:100%;height:100%;pointer-events:none';
  glc.hidden = true;
  st.canvas.style.gridArea = '1/1';
  host.insertBefore(glc, st.canvas);

  const gov = { level: 1 }, inputs = [];
  const bBuf = new Float32Array(MAXB * 4), wBuf = new Float32Array(MAXB * 4);
  let S = null, slow = 0, wall = 0, tooSlow = false, colors = null, lastEpoch, lastTilt = null, last = null, pressed = false, wasDown = false;
  let ptr = { x: LC[0], y: LC[1], keyboard: false, inside: false };

  const palette = () => (colors ??= readColors(host, { dark: 'light-dark(#000000, #ffffff)', ink: 'var(--sg-ink, light-dark(#1d2742, #ebe5d6))' }));
  const isDark = () => palette().dark !== '#000000';

  // renderer="2d" paints in 2D; "webgl" keeps the shader even when frames are slow
  const useGL = params => params?.renderer !== '2d' && !(tooSlow && params?.renderer !== 'webgl');
  function surface() {
    // a released surface lost its context for good, so start on a fresh canvas
    if (S === false) { const c = glc.cloneNode(); glc.replaceWith(c); glc = c; }
    S = glSurface(glc, { frag, governor: gov, label: 'themb', onlost: () => redraw(), onrestored: () => redraw() });
    S.size(st.canvas.width, st.canvas.height);
  }
  st.onresize = () => { if (S) S.size(st.canvas.width, st.canvas.height); redraw(); };

  /** The tilt a hand asks for: toward the pointer, stronger the further it is from the join. */
  function wantTilt(p) {
    if (!p || !p.inside) return null;
    const dx = p.x - LC[0], dy = p.y - LC[1], d = Math.hypot(dx, dy) || 1;
    const mag = 0.17 * clamp(d / 260);
    return [+((dx / d) * mag).toFixed(3), +((dy / d) * mag).toFixed(3)];
  }

  function draw(data, frame, sim) {
    const t = sim.t, calm = frame.calm || [], quality = frame.quality ?? 1, dark = isDark();
    if (!useGL(data.params)) { if (S) S.release(), S = false; } else if (!S) surface();
    gov.level = clamp(Math.round(quality * 20) / 20, 0.3, 1);
    const drewGL = S && S.draw((w, h) => {
      bBuf.fill(0); wBuf.fill(0);
      const n = Math.min(MAXB, sim.beads.length);
      let x0 = 1e4, y0 = 1e4, x1 = -1e4, y1 = -1e4;
      for (let i = 0; i < n; i++) {
        const b = sim.beads[i], fall = b.fall >= 0 ? b.fall : 0, rr = b.r * 1.4 + 20;
        bBuf.set([b.x, b.y, b.r * (1 - fall * 0.4), 1 - ease.inQuad(fall)], i * 4);
        wBuf.set([b.wob * Math.sin(b.wph), Math.cos(b.wax), Math.sin(b.wax), 0], i * 4);
        x0 = Math.min(x0, b.x - rr); y0 = Math.min(y0, b.y - rr); x1 = Math.max(x1, b.x + rr); y1 = Math.max(y1, b.y + rr);
      }
      S.set('uRes', w, h); S.set('uT', t); S.set('uDark', dark ? 1 : 0);
      S.set('uTilt', sim.tilt[0], sim.tilt[1]); S.set('uN', n);
      S.set('uB', bBuf); S.set('uWb', wBuf); S.set('uBox', x0, y0, x1, y1);
    });
    if (glc.hidden === !!drewGL) glc.hidden = !drewGL;
    // for tools: webgl, 2d, or slow (the governor gave up on the shader)
    const leaf = drewGL ? 'webgl' : tooSlow ? 'slow' : '2d';
    if (host.dataset.leaf !== leaf) host.dataset.leaf = leaf;
    host.dataset.phase = sim.phase;
    host.dataset.beads = String(sim.beads.filter(b => b.fall < 0).length);
    host.dataset.water = String(Math.round(areaOf(sim.beads)));

    const g = st.begin();
    g.clearRect(0, 0, W, H);
    if (!drewGL) {
      st.blit(st.cached('leaf', drawLeaf2D));
      drawBeads2D(g, sim);
      if (dark) { g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(133,148,199)'; g.fillRect(0, 0, W, H); g.restore(); }
    }
    if (!frame.still) drawRain(g, sim, t, calm, quality);
    // the keyboard hand: a small ring, so a sighted keyboard user sees which way the leaf will tip
    if (ptr.keyboard && ptr.inside && data.look.touch) {
      for (const [width, color, alpha] of [[5, '#f2f6ee', 0.6], [2, palette().ink === '#ebe5d6' ? '#0f1c12' : palette().ink, 0.95]]) {
        ink(g, Array.from({ length: 36 }, (_, i) => [ptr.x + Math.cos((i / 36) * TAU) * 16, ptr.y + Math.sin((i / 36) * TAU) * 16]), { width, color, alpha, closed: true, jitter: 0.2, seed: 5 });
      }
    }
  }

  function simFor(data, frame) {
    // every register's still is the plate's own: the leaf just after a full shower
    if (frame.still) return leafAt({ seed: data.seed, register: 'quiet', time: STILL_TIME, inputs: [], calm: frame.calm || [] });
    return leafAt({ seed: data.seed, register: data.register, time: data.time, inputs, calm: frame.calm || [] });
  }
  function redraw() { if (last) draw(last.data, last.frame, simFor(last.data, last.frame)); }

  return {
    render(data, frame = {}) {
      const now = performance.now();
      if (frame.epoch !== lastEpoch) { inputs.length = 0; lastTilt = null; lastEpoch = frame.epoch; }
      // the hand: in playful, the pointer (or the keyboard hand) tilts the leaf toward itself
      const p = frame.pointer;
      if (!frame.still && data.look.touch) {
        const tilt = wantTilt(p);
        if (String(tilt) !== String(lastTilt)) { inputs.push({ t: leafTime(data.time, data.register), tilt }); lastTilt = tilt; }
        if (p?.keyboard) ptr = p; else if (p) ptr = { ...ptr, keyboard: false };
        // a click sets a bead down where it lands
        if (p && p.down && !wasDown && !p.keyboard && p.inside && leafSdCheck(p)) { inputs.push({ t: leafTime(data.time, data.register), act: 'drop', x: p.x, y: p.y, r: 9 }); pressed = true; }
        wasDown = !!p?.down;
      }
      // the governor's last step, as Tollem's: 4 s of frames over 90 ms at the lowest resolution,
      // or over 180 ms at any (a GPU drawing on the CPU), and the leaf goes 2D
      if (S?.ok && data.params?.renderer !== 'webgl' && frame.dt > 0 && wall) {
        const ms = now - wall;
        slow = ms > (gov.level <= 0.3 ? 90 : 180) ? slow + ms : 0;
        if (slow > 4000) tooSlow = true;
      }
      wall = frame.dt > 0 ? now : 0;
      last = { data, frame };
      draw(data, frame, simFor(data, frame));
    },
    /** Enter or Space (or a click that no frame saw): pour the cup if it holds water, else set a bead down at the hand. */
    activate(p) {
      if (!last || !last.data.look.touch) return;
      if (!p?.keyboard && pressed) { pressed = false; return; }
      const t = leafTime(last.data.time, last.data.register), sim = simFor(last.data, last.frame);
      // Enter or Space (a click was already answered at its press): pour the cup if it holds water
      if (areaOf(sim.beads) > 900 && sim.phase !== 'dip') inputs.push({ t, act: 'pour' });
      else { const at = p?.inside ? p : { x: LC[0] + 60, y: LC[1] - 40 }; inputs.push({ t, act: 'drop', x: at.x, y: at.y, r: 9 }); }
      invalidate();
    },
    setRegister() { inputs.length = 0; lastTilt = null; },
    restyle() { colors = null; redraw(); },
    resize() { st.onresize(); },
    destroy() { S?.release?.(); glc.remove(); st.destroy(); clearMemo(); },
  };
}

const leafSdCheck = p => Math.hypot(p.x - LC[0], p.y - LC[1]) < LL * 0.9;
