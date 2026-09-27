// Rampon: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited), trimmed of the headland and the sand's stipple and tide
// lines (decoration, not the scene's identity) and adapted to the scene
// contract: register-scaled boil rate, a quiet still, a calm reading zone,
// and reseed-on-activate in playful (the plate's own control).

import { stage, ink, hatch, wash, rng, N, clamp, lerp, TAU, boil, rgba, mix, ellipse, catmull, grainPattern, toPath } from '../../engine/index.js';
import { W, H, palmSway, birdX } from './model.js';

const PAPER = '#f3ebd9', BLUE = '#2a4596', INK = '#18214a';

function noiseWash(g, x, y, w, h, fn, res = 8) {
  const cw = Math.max(2, Math.round(w / res)), ch = Math.max(2, Math.round(h / res));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const cg = c.getContext('2d'), img = cg.createImageData(cw, ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const [r, gg, b, a] = fn(x + (i / (cw - 1)) * w, y + (j / (ch - 1)) * h), k = (j * cw + i) * 4;
    img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = clamp(a) * 255;
  }
  cg.putImageData(img, 0, 0);
  g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(c, x, y, w, h); g.restore();
}

// ── Background: paper, haze, sky, sun (cached per seed and theme) ─────────

function drawBackground(g, S, dark) {
  const paperCol = dark ? '#171a24' : PAPER, blue = dark ? '#8fa6e6' : BLUE;
  // paper texture: a plain wash stands in for the engine's paper() grain here, kept light
  g.fillStyle = paperCol; g.fillRect(0, 0, W, H);
  const { sun, horizon } = S;

  const hz = g.createRadialGradient(sun.x, sun.y, sun.r * 0.6, sun.x, sun.y, sun.r * 8);
  hz.addColorStop(0, rgba(S.warm, 0.34)); hz.addColorStop(0.35, rgba(S.warm, 0.12)); hz.addColorStop(1, rgba(S.warm, 0));
  g.fillStyle = hz; g.fillRect(0, 0, W, H);
  const band = g.createLinearGradient(0, horizon - 110, 0, horizon + 40);
  band.addColorStop(0, rgba(S.warm, 0)); band.addColorStop(0.72, rgba(S.warm, 0.16)); band.addColorStop(1, rgba(S.warm, 0));
  g.fillStyle = band; g.fillRect(0, horizon - 110, W, 150);

  const glow = (x, y) => Math.exp(-((x - sun.x) ** 2 + ((y - sun.y) * 1.7) ** 2) / (2 * (sun.r * 3.4) ** 2));
  const sky = [[0, 0], [W, 0], [W, horizon], [0, horizon]];
  hatch(g, sky, {
    angle: -0.025, spacing: 5.4, seg: [16, 64], gap: 0.5, width: 0.7, color: blue, alpha: 0.5, wobble: 0.8, seed: S.seed * 3 + 1,
    density: (x, y) => clamp((0.12 + 0.88 * Math.pow(1 - y / horizon, 1.4)) * S.skyTone + 0.25 * N(x * 0.003, y * 0.01, S.seed)) * (1 - 0.96 * glow(x, y)),
  });
  hatch(g, sky, {
    angle: -0.02, spacing: 3, seg: [20, 90], gap: 0.25, width: 0.6, color: blue, alpha: 0.5, wobble: 0.6, seed: S.seed * 3 + 2,
    density: (x, y) => clamp((N(x * 0.0017 + S.seed, y * 0.024, 2.2) - 0.16) * 3.4) * (1 - glow(x, y) * 0.85) * (y < horizon - 14 ? 1 : 0),
  });

  g.save();
  g.beginPath(); g.rect(0, 0, W, horizon); g.clip();
  const disk = ellipse(sun.x, sun.y, sun.r, sun.r, { n: 72 });
  wash(g, disk, { color: S.warm, alpha: 0.92 });
  hatch(g, disk, { angle: -0.8, spacing: 3, seg: [6, 18], width: 0.8, color: mix(S.warm, '#7a2414', 0.45), alpha: 0.3, seed: S.seed });
  g.clip(toPath(disk));
  const hr = rng(`haze:${S.seed}`);
  for (let i = 0; i < 4; i++) {
    const y = sun.y + sun.r * (0.1 + i * 0.27) + hr.range(-3, 3);
    ink(g, [[sun.x - sun.r - 8, y], [sun.x + sun.r + 8, y + hr.range(-1.5, 1.5)]], { width: 1 + i * 0.9, color: paperCol, alpha: 0.85, jitter: 0.6, seed: i + S.seed, taper: 20 });
  }
  g.restore();
  g.restore();
}

// ── Per frame: sea, shore, boat, palms, birds ──────────────────────────────

const shoreAt = (S, x, t) => S.shore + 5 + Math.sin(t * 0.45 + S.seed) * 7 + N(x * 0.005, t * 0.15, S.seed * 1.3) * 9;

function drawSea(g, S, t, bs, dark) {
  const blue = dark ? '#8fa6e6' : BLUE;
  const top = S.horizon, bot = S.shore + 22, nRows = 52;
  const sunUp = S.sun.y < S.horizon + S.sun.r * 0.35;
  g.save();
  const clip = new Path2D();
  clip.moveTo(-10, top - 2); clip.lineTo(W + 10, top - 2);
  for (let x = W + 10; x >= -10; x -= 12) clip.lineTo(x, shoreAt(S, x, t));
  clip.closePath();
  g.clip(clip);
  g.lineCap = 'round';
  for (let k = 0; k < nRows; k++) {
    const u = k / (nRows - 1), y0 = top + 1.2 + (bot - top) * Math.pow(u, 1.8);
    const rr = rng(`row:${S.seed}:${k}`), jr = rng(bs * 131 + k * 7 + S.seed * 17);
    const len = lerp(7, 66, Math.pow(u, 1.1)), gapBase = lerp(3, 26, u);
    const drift = t * lerp(2, 9, u) * (k % 2 ? 1 : -0.6);
    const span = W + 160, blueSegs = [], warmSegs = [];
    let x = -80 + rr() * len;
    while (x < W + 80) {
      const L = len * rr.range(0.5, 1.3);
      const xx = (((x + drift) % span) + span) % span - 80;
      const dens = 0.62 + 0.5 * N(xx * 0.004 + S.seed, y0 * 0.03, t * 0.05);
      const keep = rr() < clamp(dens);
      const spread = lerp(S.sun.r * 0.5, S.sun.r * 2.8, u) * (0.7 + 0.6 * rr());
      const glitter = sunUp && Math.abs(xx + L / 2 - S.sun.x) < spread;
      if (keep) {
        const yj = y0 + N(xx * 0.01, k * 0.37, t * 0.25) * lerp(0.4, 3, u) + (jr() - 0.5) * lerp(0.3, 1.2, u);
        const seg = [xx + (jr() - 0.5) * 1.2, yj, xx + L * (glitter ? 0.6 : 1) + (jr() - 0.5) * 1.5, yj + (jr() - 0.5) * lerp(0.3, 1.2, u), (jr() - 0.5) * lerp(0.4, 1.6, u)];
        (glitter && jr() < 0.8 ? warmSegs : blueSegs).push(seg);
      }
      x += L + gapBase * rr.range(0.4, 1.5);
    }
    const stroke = (arr, color, alpha, w) => {
      if (!arr.length) return;
      g.strokeStyle = color; g.globalAlpha = alpha; g.lineWidth = w;
      g.beginPath();
      for (const [x1, y1, x2, y2, b] of arr) { g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + b, x2, y2); }
      g.stroke();
    };
    stroke(blueSegs, blue, lerp(0.55, 0.85, u), lerp(0.55, 1.35, u));
    stroke(warmSegs, S.warm, 0.9, lerp(0.8, 1.8, u));
  }
  g.restore();
  g.globalAlpha = 1;
  ink(g, [[-10, top + 0.5], [W + 10, top + 0.5]], { width: 0.9, color: blue, alpha: 0.55, jitter: 0.4, seed: bs, taper: 0 });
}

function drawShore(g, S, t, bs, dark) {
  const blue = dark ? '#8fa6e6' : BLUE;
  const line = [];
  for (let x = -10; x <= W + 10; x += 8) line.push([x, shoreAt(S, x, t)]);
  ink(g, line, { width: 1.3, color: blue, alpha: 0.8, jitter: 1, seed: bs, taper: 0 });
}

function drawBoat(g, S, t, bs, dark) {
  const B = S.boat, jr = rng(bs * 19 + S.seed), inkC = dark ? '#e4e6ef' : INK, paperC = dark ? '#171a24' : PAPER;
  const bob = Math.sin(t * 1.25 + B.phase) * 2.2 * B.s, roll = Math.sin(t * 0.9 + B.phase * 2) * 0.03;
  g.save();
  g.strokeStyle = inkC; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const y = B.y + bob + (6 + i * 3.4) * B.s, len = (130 - i * 14) * B.s * (0.55 + jr() * 0.5);
    const cx = B.x + N(i * 0.7, t * 0.8, S.seed) * 7 * B.s;
    g.globalAlpha = 0.5 - i * 0.06; g.lineWidth = 1.3 * B.s;
    g.beginPath();
    let x = cx - len / 2;
    while (x < cx + len / 2) { const l = jr.range(6, 20) * B.s; g.moveTo(x, y + (jr() - 0.5)); g.lineTo(Math.min(cx + len / 2, x + l), y + (jr() - 0.5)); x += l + jr.range(3, 9) * B.s; }
    g.stroke();
  }
  g.restore();

  g.save();
  g.translate(B.x, B.y + bob); g.rotate(roll); g.scale(B.s * B.dir, B.s);
  const L = 150;
  const float = ellipse(12, -17, 54, 3.3, { n: 40 });
  g.fillStyle = paperC; g.fill(toPath(float));
  hatch(g, float, { angle: -0.3, spacing: 1.8, seg: [4, 10], width: 0.8, color: inkC, alpha: 0.8, seed: 3 });
  ink(g, float, { width: 1, color: inkC, closed: true, jitter: 0.5, seed: bs + 1 });
  const hull = catmull([
    [-L / 2 - 12, -19], [-L / 2 + 8, -9], [0, -8], [L / 2 - 10, -9], [L / 2 + 8, -16],
    [L / 2 - 14, 1], [0, 7], [-L / 2 + 16, 1],
  ], 8, true);
  g.fillStyle = paperC; g.fill(toPath(hull));
  hatch(g, hull, { angle: -0.95, spacing: 2.2, seg: [6, 16], width: 0.8, color: inkC, alpha: 0.78, seed: 5 + (bs % 3) });
  ink(g, [[-L / 2 + 6, -7], [0, -5.6], [L / 2 - 8, -7]], { width: 2.2, color: paperC, alpha: 0.85, jitter: 0.5, seed: bs + 9, taper: 10 });
  ink(g, hull, { width: 1.4, color: inkC, closed: true, jitter: 0.7, seed: bs + 2 });
  const nr = rng(bs * 3 + 1);
  g.strokeStyle = inkC; g.lineWidth = 0.6; g.globalAlpha = 0.75; g.beginPath();
  g.moveTo(-34, -10);
  for (let i = 0; i < 46; i++) { const u = (i % 23) / 23, x = lerp(-34, 22, u) + nr.range(-3, 3), hump = Math.sin(u * Math.PI) * 11; g.lineTo(x, -9 - nr() * hump); }
  g.stroke(); g.globalAlpha = 1;
  ink(g, [[36, -8], [70, -58]], { width: 1.5, color: inkC, jitter: 0.4, seed: bs + 4, taper: 4 });
  g.restore();
}

function ribbon(g, pts, w0, w1, color, seed) {
  const n = pts.length, Lft = [], Rgt = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const s = i / (n - 1), w = (lerp(w0, w1, s) / 2) * (1 + 0.1 * N(i * 0.35, seed, 0.5));
    const off = N(i * 0.2, seed * 1.7, 3) * 1.1;
    const x = pts[i][0] - ty * off, y = pts[i][1] + tx * off;
    Lft.push([x - ty * w, y + tx * w]); Rgt.push([x + ty * w, y - tx * w]);
  }
  g.fillStyle = grainPattern(g, color, { lo: 0.62, hi: 1 });
  g.beginPath();
  Lft.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p)));
  for (let i = n - 1; i >= 0; i--) g.lineTo(...Rgt[i]);
  g.closePath(); g.fill();
  return { L: Lft, R: Rgt };
}

function drawPalm(g, S, P, t, bs, wind, inkC, paperC) {
  const sway = palmSway(P, t, S, wind);
  const trunk = [];
  for (let i = 0; i <= 24; i++) {
    const s = i / 24;
    trunk.push([P.x + P.lean * P.h * Math.pow(s, 1.3) + sway * P.h * s * s * 0.6 + Math.sin(s * Math.PI) * P.bend * P.h, P.y - P.h * s]);
  }
  const edges = ribbon(g, trunk, P.w, P.w * 0.55, inkC, P.id);
  ink(g, edges.L, { width: 1.1, color: inkC, jitter: 0.5, seed: bs + P.id, taper: 0 });
  ink(g, edges.R, { width: 1.1, color: inkC, jitter: 0.5, seed: bs + P.id + 5, taper: 0 });

  const [cx, cy] = trunk[trunk.length - 1];
  const leaves = new Path2D();
  const jr = rng(bs * 23 + P.id);
  for (const f of P.fronds) {
    const a = f.a + sway * 1.4, len = f.len, bendW = S.windDir * (wind === 0 ? 0 : 0.35);
    const at = u => [cx + Math.cos(a) * len * u + bendW * len * u * u, cy + Math.sin(a) * len * u + len * f.droop * u * u];
    const tan = u => { const tx = Math.cos(a) * len + 2 * bendW * len * u, ty = Math.sin(a) * len + 2 * len * f.droop * u; const l = Math.hypot(tx, ty) || 1; return [tx / l, ty / l]; };
    const spine = [];
    for (let u = 0; u <= 1.0001; u += 1 / 14) spine.push(at(u));
    ink(g, spine, { width: 3.4 * P.k, color: inkC, seed: bs + f.i * 3 + P.id, taper: 40 * P.k, jitter: 0.6 });
    for (let u = 0.1; u <= 0.98; u += 0.05) {
      const [x, y] = at(u), [tx, ty] = tan(u);
      const Ll = len * 0.21 * (1 - 0.55 * u) * (0.85 + 0.3 * jr());
      for (const sd of [-1, 1]) {
        const ang = 1.05 * sd + (jr() - 0.5) * 0.12, ca = Math.cos(ang), sa = Math.sin(ang);
        let dx = tx * ca - ty * sa, dy = tx * sa + ty * ca;
        dy += 0.9; dx += S.windDir * 0.35 * wind;
        const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const ex = x + dx * Ll, ey = y + dy * Ll, bend = (jr() - 0.5) * 3;
        leaves.moveTo(x, y); leaves.quadraticCurveTo((x + ex) / 2 - dy * bend, (y + ey) / 2 + dx * bend, ex, ey);
      }
    }
  }
  g.strokeStyle = inkC; g.lineWidth = 1.35 * P.k; g.lineCap = 'round';
  g.stroke(leaves);
  const nr = rng(`nuts:${P.id}`);
  for (let i = 0; i < P.nuts; i++) {
    const x = cx + nr.range(-11, 11) * P.k, y = cy + nr.range(3, 12) * P.k, rr = nr.range(5.5, 7.5) * P.k;
    g.fillStyle = grainPattern(g, inkC, { lo: 0.7, hi: 1 }); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    g.fillStyle = rgba(paperC, 0.35); g.beginPath(); g.arc(x - rr * 0.35, y - rr * 0.35, rr * 0.3, 0, TAU); g.fill();
  }
}

function drawBirds(g, birds, t, inkC) {
  g.save();
  g.strokeStyle = inkC; g.lineWidth = 1.1; g.lineCap = 'round'; g.globalAlpha = 0.8;
  for (const b of birds) {
    const x = birdX(b, t), y = b.y + Math.sin(t * 0.4 + b.ph) * 5, f = Math.sin(t * b.flap + b.ph);
    const span = b.s, lift = b.s * (0.2 + 0.4 * f);
    g.beginPath();
    g.moveTo(x - span, y - lift);
    g.quadraticCurveTo(x - span * 0.45, y - lift * 0.1 - b.s * 0.18, x, y + b.s * 0.12);
    g.quadraticCurveTo(x + span * 0.45, y - lift * 0.1 - b.s * 0.18, x + span, y - lift);
    g.stroke();
  }
  g.restore();
}

// ── The renderer ──────────────────────────────────────────────────────────

export function createRenderer(host, { register = 'warm', seed = 1, invalidate = null, scene: sceneEl = null } = {}) {
  const st = stage(host, { W, H });
  let reg = register;
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const readTheme = () => { const v = (sceneEl ?? host.getRootNode().host ?? host).closest('[data-theme]')?.getAttribute('data-theme'); return v === 'dark' || (v !== 'light' && mq.matches) ? 'dark' : 'light'; };
  let dark = readTheme() === 'dark';

  function render(data, frame) {
    const g = st.begin(), t = frame.still ? 0 : data.time, S = data.S;
    const nowDark = readTheme() === 'dark';
    if (nowDark !== dark) { dark = nowDark; st.memo.clear(); }
    const bg = st.cached(`bg:${S.seed}|${dark}`, gg => drawBackground(gg, S, dark));
    const inkC = dark ? '#e4e6ef' : INK, paperC = dark ? '#171a24' : PAPER;
    // quiet, or a register with no boil (still): one frame, no per-frame wobble
    const bs = data.look.fps > 0 && !frame.still ? boil(t, data.look.fps) : 0;
    st.blit(bg);
    drawSea(g, S, t, bs, dark);
    drawShore(g, S, t, bs, dark);
    drawBirds(g, data.birds, t, inkC);
    drawBoat(g, S, t, bs, dark);
    for (const P of S.palms) drawPalm(g, S, P, t, bs, data.look.wind, inkC, paperC);
  }

  return {
    render,
    setRegister(r) { reg = r; },
    restyle() { st.memo.clear(); },
    /** Enter, Space or a click in playful: draw a new evening (the plate's own reseed control). */
    activate() { sceneEl?.reseed(); },
    destroy() { st.destroy(); },
  };
}
