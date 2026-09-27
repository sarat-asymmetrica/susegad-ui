// Tollem's edge: a shader paints the water, a 2D canvas on top inks the coping and
// flowers, and paints it all when WebGL is missing, lost or too slow.

import { stage, glSurface, rng, clamp, lerp, TAU, ink, grainPattern, rgba, hexToRgb } from '../../engine/index.js';
import { model, flowerShape, rectDistance, clearMemo, W, H, TILE, COPING, RING_C, MAX_TOUCH, MAX_FLOWERS, MAX_CALM } from './model.js';

const frag = prec => `precision ${prec} float;
uniform vec2 uRes;
uniform float uT, uWaveT, uCausticT, uSwell, uCaustic, uSeed, uDark;
uniform vec4 uTouch[${MAX_TOUCH}], uFlower[${MAX_FLOWERS}], uCalm[${MAX_CALM}];
uniform vec3 uTile, uTile2, uGrout, uInk, uDeep;
const vec2 WH = vec2(${W}.0, ${H}.0);

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.0), f.x), f.y);
}
// 1 inside a calm rect (text sits there), fading to 0 by 90 units out
float calmAt(vec2 p) {
  float c = 0.0;
  for (int i = 0; i < ${MAX_CALM}; i++) {
    vec4 r = uCalm[i];
    vec2 q = abs(p - r.xy - r.zw * 0.5) - r.zw * 0.5;
    if (r.z > 0.0) c = max(c, 1.0 - smoothstep(0.0, 90.0, length(max(q, 0.0)) + min(max(q.x, q.y), 0.0)));
  }
  return c;
}
// the surface: x = height, yz = slope
vec3 wave(vec2 p, vec2 d, float k, float w, float a) { float ph = dot(p, d) * k + uWaveT * w; return vec3(a * sin(ph), a * k * cos(ph) * d); }
vec3 surface(vec2 p, float calm, out vec3 ring) {
  ring = vec3(0.0);
  vec3 s = (wave(p, vec2(0.83, 0.55), 0.011, 0.55, 2.2) + wave(p, vec2(-0.47, 0.88), 0.017, 0.8, 1.3) + wave(p, vec2(0.99, -0.12), 0.029, 1.15, 0.6)) * uSwell;
  // each touch: a damped wave packet travelling outward, fading with age
  for (int i = 0; i < ${MAX_TOUCH}; i++) {
    vec4 tc = uTouch[i];
    float age = uT - tc.z;
    if (tc.w <= 0.0 || age < 0.0 || age > 7.0) continue;
    vec2 d = p - tc.xy;
    float r = length(d) + 0.001, u = r - ${RING_C}.0 * age, sig = 26.0 + 30.0 * age, k = 6.2832 / (46.0 + 16.0 * age);
    float env = tc.w * 2.8 * exp(-age * 0.62 - u * u / (sig * sig)) * inversesqrt(1.0 + r / 50.0);
    ring += vec3(env * sin(k * u), env * (k * cos(k * u) - 2.0 * u / (sig * sig) * sin(k * u)) * d / r);
  }
  ring *= 1.0 - 0.75 * calm;
  return s * (1.0 - 0.7 * calm) + ring;
}
// iterated sine folding: the bright net is where the folds bunch up
float caustic(vec2 uv, float t) {
  vec2 p = uv * 6.2832 - 250.0, i = p;
  float c = 1.0;
  for (int n = 0; n < 5; n++) {
    float tt = t * (1.0 - 3.5 / float(n + 1));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
  }
  return pow(abs(1.17 - pow(c / 5.0, 1.4)), 8.0);
}
// five petals, for a flower's shadow
float flowerSd(vec2 q, float rot) {
  float c = cos(rot), s = sin(rot);
  q = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
  return length(q) - 64.0 * (0.42 + 0.58 * pow(0.5 + 0.5 * cos(5.0 * (atan(q.y, q.x) - 0.62)), 1.3));
}
// the frangipani overhead: a whorl of long leaves at the end of a branch
float treeShade(vec2 p) {
  float sw = 0.035 * sin(uWaveT * 0.43) + 0.015 * sin(uWaveT * 1.07 + 1.0), s = 0.0;
  vec2 q = p - vec2(1165.0, -40.0) - vec2(sin(uWaveT * 0.31), cos(uWaveT * 0.27)) * 5.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i), a = 1.72 + fi * 0.235 + sw * (1.0 + fi * 0.15), len = 250.0 - abs(fi - 3.0) * 26.0;
    vec2 dir = vec2(cos(a), sin(a));
    float u = (dot(q, dir) - 40.0) / len, w = 40.0 * pow(sin(3.1416 * clamp(u, 0.0, 1.0)), 0.7) * (0.65 + 0.35 * u);
    s = max(s, 1.0 - smoothstep(-11.0, 11.0, max(abs(dot(q, vec2(-dir.y, dir.x))) - w, max(-u, u - 1.0) * len)));
  }
  vec2 bd = normalize(vec2(1.0, -0.35));
  return max(s, (1.0 - smoothstep(-14.0, 14.0, abs(dot(q, vec2(-bd.y, bd.x))) - 9.0)) * step(-20.0, dot(q, bd)));
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * WH;
  float calm = calmAt(p);
  vec3 ring, s = surface(p, calm, ring);
  // refraction: the floor is seen through the tilted surface, deeper to the right
  vec2 fp = p - s.yz * 34.0 * mix(0.85, 1.25, p.x / WH.x);

  // tiles, and grout drawn as wavering ink
  vec2 cell = floor(fp / ${TILE}.0), f = fract(fp / ${TILE}.0), g = min(f, 1.0 - f) * ${TILE}.0;
  float wob = (vnoise(fp * 0.09 + uSeed) - 0.5) * 1.1 + (vnoise(fp * 0.3) - 0.5) * 0.4, gd = min(g.x, g.y) + wob;
  vec3 tile = mix(uTile, uTile2, smoothstep(0.55, 0.95, hash(cell + uSeed))) * (0.955 + 0.07 * hash(cell * 1.7 + uSeed + 3.1)) * (0.97 + 0.06 * vnoise(fp * 0.05 + cell));
  vec3 col = mix(uGrout, tile, smoothstep(1.7, 2.9, gd));
  col = mix(col, uInk, (1.0 - smoothstep(0.35, 1.05, abs(gd - 2.65))) * (0.55 + 0.45 * vnoise(fp * 0.045 + 7.0)) * 0.42);

  // light from above: the net, split slightly by colour, warped so it never repeats
  vec2 cw = fp + s.yz * 40.0;
  cw += vec2(sin(cw.y * 0.0053 + 1.3) + sin(cw.x * 0.0031), sin(cw.x * 0.0047 + 0.4) + sin(cw.y * 0.0029 + 2.0)) * 36.0;
  vec2 cuv = cw / 390.0, ch = vec2(0.0035, 0.0022);
  vec3 cau = clamp(vec3(caustic(cuv + ch, uCausticT), caustic(cuv, uCausticT), caustic(cuv - ch, uCausticT)), 0.0, 1.6);
  // painted, not photographed: soft steps; crests focus the light
  cau = mix(cau, floor(cau * 4.0 + 0.5) / 4.0, 0.45) * clamp(1.0 + s.x * 0.2, 0.4, 1.8) * uCaustic;
  // under text the net flattens to an even glow, so words sit on quiet water
  cau = mix(cau, vec3(0.22 * uCaustic), 0.72 * calm);

  // shadows on the floor: the coping, the tree, the flowers, and a bright meniscus round each flower
  float shade = max(1.0 - smoothstep(70.0, 96.0, fp.y + wob * 3.0), treeShade(fp) * 0.85), halo = 0.0;
  for (int i = 0; i < ${MAX_FLOWERS}; i++) {
    vec4 fl = uFlower[i];
    if (fl.w < 0.0) continue;
    float blur = 5.0 + 34.0 * fl.w, fsd = flowerSd(fp - fl.xy - vec2(10.0, 16.0) - vec2(90.0, 130.0) * fl.w, fl.z);
    shade = max(shade, (1.0 - smoothstep(-blur, blur, fsd)) * (0.8 - 0.45 * fl.w));
    halo = max(halo, exp(-pow((fsd - 7.0) / 7.0, 2.0)) * (1.0 - fl.w) * 0.55);
  }
  vec3 warm = vec3(1.0, 0.96, 0.84);
  float lit = 1.0 - shade;
  col *= vec3(0.84 - 0.36 * shade + s.x * 0.035 * lit) + (cau * 0.95 + halo) * warm * lit;
  // water absorbs red first: deeper is bluer
  col *= mix(vec3(1.0), uDeep, 0.35 + 0.5 * smoothstep(0.0, WH.x, p.x));
  // ring crests catch the sky on one side and shade on the other
  float hl = dot(ring.yz, vec2(-0.6, -0.8));
  col = (col + warm * smoothstep(0.012, 0.07, hl) * 0.4) * (1.0 - smoothstep(0.012, 0.07, -hl) * 0.14);
  // paper: fixed speck, soft blotches, a gentle vignette
  vec2 v = p / WH - 0.5;
  col *= (1.0 + (hash(floor(gl_FragCoord.xy)) - 0.5) * 0.07 + (vnoise(p * 0.012 + 3.0) - 0.5) * 0.06) * (1.0 - dot(v, v) * 0.32);
  // dark theme: the same pool after the sun has gone behind the house
  gl_FragColor = vec4(clamp(mix(col, col * vec3(0.66, 0.74, 0.86), uDark), 0.0, 1.0), 1.0);
}`;

// 2D: coping, flowers, and the whole pool when there is no shader

function drawCoping(g) {
  const r = rng('coping');
  g.fillStyle = '#b8653d'; g.fillRect(0, 0, W, COPING);
  g.globalAlpha = 0.5; g.fillStyle = grainPattern(g, '#6e3119', { lo: 0, hi: 0.8 }); g.fillRect(0, 0, W, COPING);
  g.globalAlpha = 1;
  // laterite is full of pits
  for (let i = 0; i < 520; i++) {
    const rx = r.range(0.8, 3.6);
    g.fillStyle = r() < 0.8 ? rgba('#5e2a16', r.range(0.25, 0.6)) : rgba('#e3a070', r.range(0.3, 0.6));
    g.beginPath(); g.ellipse(r() * W, r() * (COPING - 8), rx, rx * r.range(0.5, 0.9), r() * TAU, 0, TAU); g.fill();
  }
  // sun on the top face, and the wet lip where the water laps
  const sun = g.createLinearGradient(0, 0, 0, COPING);
  [[0, 'rgba(255,226,180,0.22)'], [0.75, 'rgba(255,226,180,0)'], [0.86, 'rgba(70,30,14,0.22)'], [1, 'rgba(60,24,10,0.55)']].forEach(s => sun.addColorStop(...s));
  g.fillStyle = sun; g.fillRect(0, 0, W, COPING);
  for (let x = r.range(40, 120); x < W; x += r.range(170, 230)) ink(g, [[x, 2], [x + r.range(-2, 2), COPING - 8]], { width: 1.6, color: '#3e1c0e', alpha: 0.7, seed: x, jitter: 0.6 });
  for (const [y, width, color, alpha, seed, jitter] of [[COPING - 8, 1.4, '#3e1c0e', 0.55, 3, 0.8], [COPING, 2.2, '#26140b', 0.85, 5, 1], [COPING + 3, 1.1, '#ffffff', 0.35, 6, 1.4]]) {
    ink(g, [[-10, y], [W + 10, y]], { width, color, alpha, seed, jitter, taper: 0 });
  }
}

const paths = new WeakMap();
function pathOf(pts) {
  if (!paths.has(pts)) { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); paths.set(pts, p); }
  return paths.get(pts);
}

// the first flower (and the progress flower) keep the original plate's shape for the seed
const shapes = new Map();
function shapeFor(seed, id) {
  const key = id === 0 || id === 'progress' ? seed : `${seed}:${id}`;
  if (shapes.size > 32) shapes.clear();
  if (!shapes.has(key)) shapes.set(key, flowerShape(key));
  return shapes.get(key);
}

function drawFlower(g, f, shape, c, seed, t) {
  const s = 1 + 0.8 * f.h + Math.sin(t * 9) * 0.02 * f.bob;
  g.save();
  g.globalAlpha = f.alpha;
  g.translate(f.x, f.y); g.rotate(f.rot); g.scale(s, s);
  if (f.h < 0.05) {
    // the water pulls up round a floating flower: a dark line under the petals
    g.save(); g.scale(1.08, 1.08); g.fillStyle = 'rgba(30,70,78,0.16)';
    for (const p of shape.petals) g.fill(pathOf(p.pts));
    g.restore();
  }
  shape.petals.forEach((p, i) => {
    const path = pathOf(p.pts), gr = g.createLinearGradient(0, 0, Math.cos(p.a0) * p.len, Math.sin(p.a0) * p.len);
    [[0, c.heart], [0.28, c.heart], [0.5, c.mid], [0.8, c.petal]].forEach(s => gr.addColorStop(...s));
    g.fillStyle = gr; g.fill(path);
    // the underside's shade along one edge of each petal
    g.save(); g.clip(path); g.fillStyle = 'rgba(120,96,62,0.12)';
    g.beginPath(); g.ellipse(Math.cos(p.a0 + 0.45) * 38, Math.sin(p.a0 + 0.45) * 38, 30, 10, p.a0, 0, TAU); g.fill();
    g.restore();
    ink(g, p.pts, { width: 1.25, color: c.flink, alpha: 0.9, seed: seed * 7 + i, closed: true, jitter: 0.5, step: 1.5 });
    ink(g, p.vein, { width: 0.7, color: c.flink, alpha: 0.28, seed: i + 3, jitter: 0.3, taper: 6 });
  });
  g.fillStyle = rgba('#b87512', 0.55); g.beginPath(); g.arc(0, 0, 3.2, 0, TAU); g.fill();
  g.restore();
}

function drawFloor(g, pal, seed) {
  const r = rng(`floor:${seed}`), top = COPING - (COPING % TILE);
  g.fillStyle = pal.grout; g.fillRect(0, 0, W, H);
  for (let y = top - TILE; y < H; y += TILE) for (let x = 0; x < W; x += TILE) {
    g.fillStyle = r() < 0.2 ? pal.tile2 : pal.tile; g.globalAlpha = 0.9 + r() * 0.1;
    g.fillRect(x + 2.2, y + 2.2, TILE - 4.4, TILE - 4.4);
  }
  g.globalAlpha = 1;
  const line = { width: 0.9, color: pal.ink, alpha: 0.38, jitter: 0.7, taper: 0 };
  for (let x = 0; x <= W; x += TILE) ink(g, [[x, 0], [x, H]], { ...line, seed: x });
  for (let y = top; y <= H; y += TILE) ink(g, [[0, y], [W, y]], { ...line, seed: y + 99 });
  // the shader's light: the floor at 84% under open water, bluer where deeper, blotched where the net is not
  g.save();
  g.globalCompositeOperation = 'multiply';
  const deep = g.createLinearGradient(0, 0, W, 0), mixW = k => `rgb(${hexToRgb(pal.deep).map(v => Math.round(lerp(255, v, k) * 0.84))})`;
  deep.addColorStop(0, mixW(0.35)); deep.addColorStop(1, mixW(0.85));
  g.fillStyle = deep; g.fillRect(0, 0, W, H);
  g.filter = 'blur(18px)';
  for (let i = 0; i < 38; i++) {
    g.fillStyle = `rgba(60,110,120,${r.range(0.12, 0.26)})`;
    g.beginPath(); g.ellipse(r() * W, COPING + r() * (H - COPING), r.range(40, 110), r.range(18, 40), r() * TAU, 0, TAU); g.fill();
  }
  g.restore();
  const sh = g.createLinearGradient(0, COPING, 0, COPING + 30);
  sh.addColorStop(0, 'rgba(20,50,60,0.35)'); sh.addColorStop(1, 'rgba(20,50,60,0)');
  g.fillStyle = sh; g.fillRect(0, COPING, W, 30);
  // the tree's shade in the corner
  g.save(); g.filter = 'blur(12px)'; g.fillStyle = 'rgba(20,55,60,0.42)';
  for (let i = 0; i < 7; i++) {
    const a = 1.72 + i * 0.235, len = 250 - Math.abs(i - 3) * 26;
    g.beginPath(); g.ellipse(1165 + Math.cos(a) * (40 + len / 2), -40 + Math.sin(a) * (40 + len / 2), len / 2, 30, a, 0, TAU); g.fill();
  }
  g.restore();
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, 'rgba(20,40,50,0)'); v.addColorStop(1, 'rgba(20,40,50,0.14)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}

/** The shader's folded-sine net on the CPU (four folds instead of five). */
function causticCPU(x, y, t) {
  const px = x * TAU - 250, py = y * TAU - 250;
  let ix = px, iy = py, c = 1;
  for (let n = 0; n < 4; n++) {
    const tt = t * (1 - 3.5 / (n + 1)), nx = px + Math.cos(tt - ix) + Math.sin(tt + iy);
    iy = py + Math.sin(tt - iy) + Math.cos(tt + ix); ix = nx;
    c += 1 / Math.hypot(px / (Math.sin(ix + tt) / 0.005), py / (Math.cos(iy + tt) / 0.005));
  }
  return Math.abs(1.17 - (c / 4) ** 1.4) ** 8;
}

// The renderer

/** Input comes from <sg-scene>: frame.pointer (arrow keys set `keyboard`) and
 *  activate(p) on a click, Enter or Space. They become touches for the model. */
export function createRenderer(host, opts = {}) {
  let motion = opts.motion || 'ambient';
  const st = stage(host, { W, H, maxDpr: 2 });
  // Both canvases share one grid cell, water under ink. Neither is positioned,
  // so the element's reading layer stays above them.
  host.style.display = 'grid';
  let glc = document.createElement('canvas');
  glc.style.cssText = 'grid-area:1/1;width:100%;height:100%;pointer-events:none';
  glc.hidden = true;
  st.canvas.style.gridArea = '1/1';
  host.insertBefore(glc, st.canvas);

  const gov = { level: 1 }, touches = [];
  let S = null, slow = 0, wall = 0, tooSlow = false, dark = 0, last = null, lastTime = 0, lastProgress = null, lastEpoch;
  let ptr = { x: W / 2, y: H / 2 }, wasDown = false, pressed = false, lastRing = { t: -1e3 };

  // renderer="2d" paints in 2D; "webgl" keeps the shader even when frames are slow
  const useGL = () => last?.data.params?.renderer !== '2d' && !tooSlow;
  function surface() {
    // a released surface lost its context for good, so start on a fresh canvas
    if (S === false) { const c = glc.cloneNode(); glc.replaceWith(c); glc = c; }
    // while its context is lost the surface does not draw, and the 2D painting covers it
    S = glSurface(glc, { frag, governor: gov, label: 'tollem', onlost: () => redraw(), onrestored: () => redraw() });
    S.size(st.canvas.width, st.canvas.height);
  }
  st.onresize = () => { if (S) S.size(st.canvas.width, st.canvas.height); redraw(); };

  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  function readTheme() {
    const t = (opts.scene?.closest?.('[data-theme]') ?? document.documentElement).getAttribute('data-theme');
    dark = +(t === 'dark' || (t !== 'light' && darkMQ.matches));
  }
  readTheme();

  // 2D: each flower's blurred shadow, painted once per shape and size
  const SH = 100, sprites = new Map();
  function shadowSprite(shape, key) {
    const k = `${key}:${st.px}`;
    if (!sprites.has(k)) {
      if (sprites.size > 16) sprites.clear();
      const c = document.createElement('canvas'), px = st.px, sg = c.getContext('2d');
      c.width = c.height = Math.ceil(SH * 2 * px);
      sg.setTransform(px, 0, 0, px, SH * px, SH * px);
      sg.filter = `blur(${Math.round(6 * px)}px)`;
      sg.fillStyle = '#1f4a52';
      for (const p of shape.petals) sg.fill(pathOf(p.pts));
      sprites.set(k, c);
    }
    return sprites.get(k);
  }

  // 2D caustics: 120 × 80 pixels, 12 times a second, stretched
  const CW = 120, CH = 80, cauC = document.createElement('canvas');
  cauC.width = CW; cauC.height = CH;
  let cauKey = '';
  function cpuCaustics(d) {
    const u = d.uniforms, key = `${Math.floor((u.uCausticT / 0.34) * 12)}|${u.uCaustic}|${JSON.stringify(d.calm)}`;
    if (key === cauKey) return cauC;
    cauKey = key;
    const cg = cauC.getContext('2d'), img = cg.createImageData(CW, CH);
    for (let i = 0; i < CW * CH; i++) {
      const lx = ((i % CW) + 0.5) * (W / CW), ly = (Math.floor(i / CW) + 0.5) * (H / CH);
      let c = Math.min(1.4, causticCPU((lx + (Math.sin(ly * 0.0053 + 1.3) + Math.sin(lx * 0.0031)) * 36) / 390, (ly + (Math.sin(lx * 0.0047 + 0.4) + Math.sin(ly * 0.0029 + 2)) * 36) / 390, u.uCausticT));
      let calm = 0;
      for (const r of d.calm) calm = Math.max(calm, 1 - clamp(rectDistance(lx, ly, r) / 90));
      c = lerp(lerp(c, Math.round(c * 4) / 4, 0.45) * u.uCaustic, 0.22 * u.uCaustic, 0.72 * calm);
      img.data.set([255, 244, 212, c * 330], i * 4);
    }
    cg.putImageData(img, 0, 0);
    return cauC;
  }

  // input
  const interactive = () => motion === 'full' && last?.data.params?.touch !== false;
  function addTouch(x, y, amp) {
    if (!interactive() || y < COPING) return false;
    touches.push(lastRing = { x, y, t: lastTime, amp });
    if (touches.length > MAX_TOUCH * 3) touches.shift();
    return true;
  }
  // a firm ring on press, soft ones trailing a moving pointer
  function followPointer(p) {
    if (p && interactive() && !p.keyboard && p.inside) {
      if (p.down && !wasDown) pressed = addTouch(p.x, p.y, 1);
      else if (lastTime - lastRing.t > 0.22 && Math.hypot(p.x - lastRing.x, p.y - lastRing.y) > 36) addTouch(p.x, p.y, p.down ? 0.7 : 0.35);
    }
    if (p?.keyboard) ptr = p;
    wasDown = !!p?.down;
  }

  function drawReticle(g) {
    const x = clamp(ptr.x, 30, W - 30), y = clamp(ptr.y, COPING + 30, H - 30);
    const marks = [Array.from({ length: 48 }, (_, i) => [x + Math.cos((i / 48) * TAU) * 26, y + Math.sin((i / 48) * TAU) * 26]),
      ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [[x + dx * 33, y + dy * 33], [x + dx * 47, y + dy * 47]])];
    // a light halo under the ink, so it reads on bright and shaded water
    for (const [width, color, alpha] of [[7, '#fffaf0', 0.7], [2.6, '#12323a', 0.95]]) marks.forEach((m, i) => ink(g, m, { width, color, alpha, seed: width + i, jitter: 0.3, closed: !i, taper: 0 }));
    g.fillStyle = '#12323a'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
  }

  // drawing
  function draw(d, t, quality) {
    const u = d.uniforms;
    if (!useGL()) { if (S) S.release(), S = false; } else if (!S) surface();
    // follow the governor, down to 30% resolution
    if (quality != null) gov.level = clamp(Math.round(quality * 20) / 20, 0.3, 1);
    const gl = S && S.draw((w, h) => {
      S.set('uRes', w, h); S.set('uDark', dark);
      for (const n of ['uT', 'uWaveT', 'uCausticT', 'uSwell', 'uCaustic', 'uSeed', 'uTouch', 'uFlower', 'uCalm', 'uTile', 'uTile2', 'uGrout', 'uInk', 'uDeep']) S.set(n, u[n]);
    });
    if (glc.hidden === !!gl) glc.hidden = !gl;
    // for tools: webgl, 2d, or slow (the governor gave up on the shader)
    const water = gl ? 'webgl' : tooSlow ? 'slow' : '2d';
    if (host.dataset.water !== water) host.dataset.water = water;

    const g = st.begin();
    g.clearRect(0, 0, W, H);
    if (gl) st.blit(st.cached('coping', drawCoping));
    else {
      st.blit(st.cached(`floor:${d.seed}:${d.palette}`, gg => { drawFloor(gg, d.colors, d.seed); drawCoping(gg); }));
      g.globalCompositeOperation = 'screen';
      g.drawImage(cpuCaustics(d), 0, (COPING / H) * CH, CW, CH * (1 - COPING / H), 0, COPING, W, H - COPING);
      g.globalCompositeOperation = 'source-over';
      // rings, as light on the water
      g.lineWidth = 2.2;
      for (const tc of d.rings) for (let k = 0, age = t - tc.t; k < 3 && age >= 0 && age <= 4; k++) {
        const rr = RING_C * age - k * 18;
        if (rr <= 2) continue;
        g.strokeStyle = `rgba(255,250,232,${0.5 * tc.amp * Math.exp(-age * 0.9) * (1 - k * 0.3)})`;
        g.beginPath(); g.arc(tc.x, tc.y, rr, 0, TAU); g.stroke();
      }
      for (const f of d.flowers) {
        const k = 1 + 0.8 * f.h;
        g.save();
        g.globalAlpha = (0.34 - 0.18 * f.h) * f.alpha;
        g.translate(f.x + 10 + 90 * f.h, f.y + 16 + 130 * f.h); g.rotate(f.rot); g.scale(k, k);
        g.drawImage(shadowSprite(shapeFor(d.seed, f.id), `${d.seed}:${f.id}`), -SH, -SH, SH * 2, SH * 2);
        g.restore();
      }
    }
    if (dark) {
      // the 2D layers follow the shader into shade; flowers dim, not blue
      g.globalCompositeOperation = gl ? 'source-atop' : 'multiply';
      g.fillStyle = gl ? 'rgba(12,24,40,0.3)' : 'rgb(168,189,219)';
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
    g.filter = dark ? 'brightness(.74)' : 'none';
    // a flower still in the air passes over those afloat
    for (const f of [...d.flowers].sort((a, b) => a.h - b.h)) drawFlower(g, f, shapeFor(d.seed, f.id), d.colors, d.seed, t);
    g.filter = 'none';
    if (ptr.keyboard && ptr.inside && interactive()) drawReticle(g);
  }

  const withTouches = input => (touches.length ? { ...input, touches } : input);
  function redraw() {
    if (!last) return;
    const input = withTouches(last.input);
    draw(input.touches || input.calm ? model(input) : last.data, input.time, last.quality);
  }

  return {
    render(data, frame = {}) {
      const t = data.time, now = performance.now();
      // replay or reseed: forget the old run's touches; a seek back drops the future ones
      if (frame.epoch !== lastEpoch) { touches.length = 0; lastEpoch = frame.epoch; }
      while (touches.at(-1)?.t > t) touches.pop();
      lastTime = t;
      if (frame.motion) motion = frame.motion;
      last = { data, quality: frame.quality, input: { time: t, seed: data.seed, register: data.register, params: data.params, calm: frame.calm?.length ? frame.calm : undefined } };
      if (!frame.still) followPointer(frame.pointer);
      // progress moved: one small ring where the flower now is
      if (data.progress != null && lastProgress != null && data.progress !== lastProgress) touches.push({ ...data.flowers[0], t, amp: 0.45 });
      lastProgress = data.progress;
      // The governor's last step: 4 s of frames over 90 ms at the lowest resolution,
      // or over 180 ms at any (a GPU drawing on the CPU), and the water goes 2D.
      if (S?.ok && data.params?.renderer !== 'webgl' && frame.dt > 0 && wall) {
        const ms = now - wall;
        slow = ms > (gov.level <= 0.3 ? 90 : 180) ? slow + ms : 0;
        if (slow > 4000) tooSlow = true;
      }
      wall = frame.dt > 0 ? now : 0;
      const input = frame.still ? last.input : withTouches(last.input);
      draw(input.touches || input.calm ? model(input) : data, t, frame.quality);
    },
    /** A click, Enter or Space. A press already answered from frame.pointer is
     *  skipped; a click too quick for any frame to see still counts. */
    activate(p) {
      if (!p || (!p.keyboard && pressed)) { pressed = false; return; }
      if (p.keyboard) ptr = p;
      if (addTouch(p.keyboard ? clamp(p.x, 30, W - 30) : p.x, p.keyboard ? clamp(p.y, COPING + 30, H - 30) : p.y, 1)) { redraw(); opts.invalidate?.(); }
    },
    setRegister(register, m) { motion = m || motion; if (last) last.input.register = register; },
    restyle() { readTheme(); redraw(); },
    resize() { st.onresize(); },
    destroy() { S?.release?.(); glc.remove(); st.destroy(); sprites.clear(); clearMemo(); },
  };
}
