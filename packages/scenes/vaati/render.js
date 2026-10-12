// Vaati: the canvas renderer. Owns every side effect.
//
// quiet    a hairline still of the finished bowl, no wash
// warm     ink and wash on handmade paper: pieces arrive one at a time, then sauce, cheese
//          and basil; then the bowl rests (settled, no frames)
// playful  flat poster colour with a bold ink outline, faster and bouncier; a click, Enter
//          or Space tosses the pieces up and they land again
//
// Everything that does not move is painted once: the bowl into a cached layer, and every
// piece, flake and leaf into a small sprite at device resolution the first time it appears.
// A frame is one blit, the sauce, and a dozen sprites.

import { stage, clamp, lerp, TAU, smoothstep, hexToRgb, ink, hatch, wash, toPath, paper } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, BOWL, swirlPoint, settleGate } from './model.js';

const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };
const U = BOWL.R / 246;
const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };

export function createRenderer(host, { register, scene, invalidate }) {
  const st = stage(host, { W, H });
  let reg = register, colors = null, sprites = new Map(), shadows = new Map(), lastKey = '', epoch = -1, tossN = 0, lastTime = 0, lastData = null;
  const gate = settleGate();
  st.onresize = () => { sprites = new Map(); shadows = new Map(); lastKey = ''; invalidate(); };

  function palette() {
    return (colors ??= readColors(host, {
      paper: 'var(--sg-vaati-ground, var(--sg-paper, light-dark(#f1ede4, #151a2b)))',
      ink: 'var(--sg-ink, light-dark(#1d2742, #ebe5d6))',
      pencil: 'var(--sg-pencil, light-dark(#8e93a6, #8a8678))',
      line: 'light-dark(var(--sg-ink, #1d2742), #1a1210)',
      pasta: 'var(--sg-vaati-pasta, var(--sg-turmeric, var(--sg-mango, #e4b24c)))',
      tomato: 'var(--sg-vaati-tomato, var(--sg-tomato, var(--sg-laterite, #b3563a)))',
      basil: 'var(--sg-vaati-basil, var(--sg-curry-leaf, var(--sg-paddy, #5b8b3b)))',
      bowl: 'var(--sg-vaati-bowl, var(--sg-coral, var(--sg-sea, #6f98a8)))',
      glaze: 'var(--sg-vaati-glaze, var(--sg-cream, #f6efdc))',
      cheese: 'var(--sg-vaati-cheese, #f2d36a)',
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }
  const isDark = () => palette().dark !== '#000000';
  const modeOf = () => (reg === 'quiet' ? 'hair' : reg === 'warm' ? 'ink' : 'poster');
  const hair = () => (1.1 * W) / (st.canvas.clientWidth || W);

  /** What each role in a shape is painted with, for pasta, basil and cheese. */
  function tones(what, mode) {
    const c = palette();
    if (what === 'basil') { const b = mode === 'poster' ? mixHex(c.basil, '#7cc03a', 0.18) : c.basil; return { body: b, dome: mixHex(b, '#e8f5a0', 0.25), shade: mixHex(b, '#0c2a12', 0.42), light: mixHex(b, '#f4ffb0', 0.5), fold: mixHex(b, '#0c2a12', 0.6), ink: c.line, hole: b }; }
    if (what === 'flake') { const f = c.cheese; return { body: f, dome: f, shade: mixHex(f, '#c4902a', 0.5), light: '#fff4c4', fold: mixHex(f, '#9a6a14', 0.6), ink: c.line, hole: f }; }
    const p = mode === 'poster' ? mixHex(c.pasta, '#ffd23a', 0.3) : c.pasta;
    return { body: p, dome: mixHex(p, '#fff1b8', 0.3), shade: mixHex(p, '#b5521b', 0.5), light: '#fff7d6', fold: mixHex(p, '#7a3a10', 0.62), ink: c.line, hole: mixHex(p, '#4a2308', 0.62) };
  }

  /** Paint one shape at the origin in the style of the mode. */
  function drawShape(g, sh, T, mode, seed, outline = 3.4) {
    const c = palette();
    let blank = mode === 'hair'; // quiet has no wash, but a piece still hides what lies under it
    for (const L of sh.layers) {
      if (L.k === 'fill') {
        if (mode === 'hair') { if (blank) { g.fillStyle = c.paper; g.fill(toPath(sh.body)); blank = false; } continue; }
        if (mode === 'poster') { g.save(); g.fillStyle = T[L.role]; if (L.role === 'light') g.globalAlpha = 0.78; g.fill(toPath(L.pts)); g.restore(); }
        else {
          wash(g, L.pts, { color: T[L.role], alpha: L.role === 'light' ? 0.5 : L.role === 'shade' ? 0.82 : 0.93 });
          if (L.role === 'shade') hatch(g, L.pts, { angle: 0.9, spacing: 2.8, seg: [6, 14], width: 0.7, color: T.fold, alpha: 0.4, seed });
        }
        continue;
      }
      if (mode === 'hair' && L.role !== 'ink') continue; // quiet keeps the outline and the one defining stroke; folds and veins are warm's work
      const col = L.role === 'ink' ? T.ink : mode === 'hair' ? c.pencil : T.fold;
      L.paths.forEach((pts, j) => {
        if (mode === 'hair') { g.strokeStyle = col; g.lineWidth = hair() * 0.8; g.lineJoin = 'round'; g.stroke(toPath(pts, !!L.closed)); }
        else if (mode === 'poster') { g.strokeStyle = col; g.lineWidth = L.w * 1.15 * Math.max(0.8, U * 1.2); g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = L.role === 'ink' ? 0.85 : 0.9; g.stroke(toPath(pts, !!L.closed)); g.globalAlpha = 1; }
        else ink(g, pts, { width: L.w * 0.85, color: col, alpha: 0.85, jitter: 0.45, taper: 3, seed: seed * 31 + j, closed: !!L.closed, step: 1.5 });
      });
    }
    if (mode === 'hair') { g.strokeStyle = c.ink; g.lineWidth = hair(); g.lineJoin = 'round'; g.stroke(toPath(sh.body)); }
    else if (mode === 'poster') { g.strokeStyle = T.ink; g.lineWidth = outline; g.lineJoin = 'round'; g.stroke(toPath(sh.body)); }
    else ink(g, sh.body, { width: 2, color: T.ink, alpha: 0.9, closed: true, jitter: 0.55, seed, step: 1.5 });
  }

  /** A shape painted once into a small canvas at device resolution (a little more, for pieces that are nearer while they fly). */
  function sprite(key, sh, what, mode, seed) {
    const k = `${key}|${mode}|${isDark()}`;
    if (sprites.has(k)) return sprites.get(k);
    const K = st.px * 1.3, pad = 10, r = sh.r + pad, cv = document.createElement('canvas');
    cv.width = Math.ceil(2 * r * K); cv.height = cv.width;
    const g = cv.getContext('2d');
    g.setTransform(K, 0, 0, K, (cv.width / 2), (cv.height / 2));
    g.scale(1, 1);
    drawShape(g, sh, tones(what, mode), mode, seed, what === 'flake' ? 2.4 : 3.4);
    const out = { cv, r: cv.width / K / 2, path: toPath(sh.body) };
    sprites.set(k, out);
    return out;
  }

  // ── the bowl, painted once per mode and theme ───────────────────────────
  function drawBowl(g, mode) {
    const c = palette(), dark = isDark(), { x: cx, y: cy, R, lip, floor } = BOWL;
    const glaze = dark ? mixHex(c.glaze, '#1a1c2e', 0.12) : c.glaze, rim = dark ? mixHex(c.bowl, '#10142a', 0.1) : c.bowl;
    if (mode === 'ink') paper(g, W, H, { base: c.paper, seed: 9, vignette: dark ? 0.04 : 0.07, fibers: 40, speck: dark ? '#000000' : '#3a2f22' });
    else { g.fillStyle = c.paper; g.fillRect(0, 0, W, H); }
    const ring = (r0, r1) => { const p = new Path2D(); p.arc(cx, cy, r0, 0, TAU); p.arc(cx, cy, r1, 0, TAU, true); return p; };
    if (mode === 'hair') {
      g.strokeStyle = c.ink; g.lineWidth = hair();
      for (const r of [R, lip, floor]) { circ(g, cx, cy, r); g.stroke(); }
      g.strokeStyle = c.pencil; g.beginPath(); g.arc(cx, cy, (R + lip) / 2, Math.PI * 1.06, Math.PI * 1.36); g.stroke();
      return;
    }
    if (mode === 'poster') {
      g.fillStyle = dark ? 'rgba(0,0,0,0.34)' : 'rgba(40,24,16,0.16)'; circ(g, cx + 9, cy + 13, R + 3); g.fill();
      g.fillStyle = rim; circ(g, cx, cy, R); g.fill();
      const wall = g.createRadialGradient(cx + 14, cy + 18, floor * 0.7, cx, cy, lip);
      wall.addColorStop(0, glaze); wall.addColorStop(1, mixHex(glaze, '#8a5a38', 0.3));
      g.fillStyle = wall; circ(g, cx, cy, lip); g.fill();
      g.fillStyle = mixHex(glaze, '#ffffff', 0.35); circ(g, cx, cy, floor); g.fill();
      g.lineJoin = 'round'; g.strokeStyle = c.line;
      g.lineWidth = 6; circ(g, cx, cy, R); g.stroke();
      g.lineWidth = 4; circ(g, cx, cy, lip); g.stroke();
      g.lineWidth = 2.4; g.globalAlpha = 0.45; circ(g, cx, cy, floor); g.stroke(); g.globalAlpha = 1;
      // painted dots round the rim, and a glaze highlight
      g.fillStyle = glaze;
      for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; circ(g, cx + Math.cos(a) * (R + lip) / 2, cy + Math.sin(a) * (R + lip) / 2, 3.4); g.fill(); }
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.arc(cx, cy, (R + lip) / 2 + 9, Math.PI * 1.08, Math.PI * 1.3); g.stroke();
      return;
    }
    // warm: washes with a hatched shade and wobbly ink
    const circle = r => Array.from({ length: 96 }, (_, i) => [cx + Math.cos((i / 96) * TAU) * r, cy + Math.sin((i / 96) * TAU) * r]);
    g.fillStyle = 'rgba(40,24,16,0.1)'; circ(g, cx + 8, cy + 11, R + 3); g.fill();
    wash(g, ring(R, lip), { color: rim, alpha: 0.78 });
    hatch(g, ring(R, lip), { angle: -0.7, spacing: 3.2, seg: [10, 26], width: 0.8, color: mixHex(rim, '#101830', 0.55), alpha: 0.5, seed: 5, bounds: { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R }, density: (x, y) => smoothstep(cx - R * 0.5, cx + R * 0.9, x) * smoothstep(cy - R * 0.5, cy + R * 0.9, y) });
    wash(g, ring(lip, floor), { color: mixHex(glaze, '#8a5a38', 0.22), alpha: 0.7 });
    wash(g, toPath(circle(floor)), { color: glaze, alpha: 0.85 });
    hatch(g, ring(lip, floor), { angle: 0.6, spacing: 3.4, seg: [8, 20], width: 0.7, color: '#6a4426', alpha: 0.3, seed: 6, bounds: { x: cx - lip, y: cy - lip, w: 2 * lip, h: 2 * lip }, density: (x, y) => 1 - smoothstep(cx - lip, cx + lip * 0.4, x) * 0.7 });
    for (const [r, w, s] of [[R, 2.2, 1], [lip, 1.7, 2], [floor, 1.1, 3]]) ink(g, circle(r), { width: w, color: dark ? c.ink : c.line, alpha: 0.9, closed: true, jitter: 0.8, seed: s, step: 3 });
    ink(g, Array.from({ length: 14 }, (_, i) => { const a = Math.PI * 1.08 + (i / 13) * Math.PI * 0.22, r = (R + lip) / 2 + 8; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }), { width: 4, color: '#ffffff', alpha: 0.55, taper: 8, seed: 4 });
  }

  // ── the sauce: a pool beneath the pieces, a poured ribbon over them ──────
  const sauceColor = kind => { const c = palette(); return kind === 'pesto' ? mixHex(mixHex(c.basil, '#d7d36a', 0.15), '#0c2a12', 0.15) : kind === 'cream' ? '#f4e4c1' : c.tomato; };
  function poolPath(reach, D) {
    const pts = [], r0 = reach * (BOWL.floor + 16), [w0, w1] = D.wobble;
    for (let i = 0; i < 72; i++) { const a = (i / 72) * TAU; pts.push([BOWL.x + Math.cos(a) * r0 * (1 + 0.03 * Math.sin(3 * a + w0) + 0.02 * Math.sin(5 * a + w1)), BOWL.y + Math.sin(a) * r0 * (1 + 0.03 * Math.sin(3 * a + w0) + 0.02 * Math.sin(5 * a + w1))]); }
    return pts;
  }
  function pool(g, S, D, mode) {
    if (S.pool <= 0.005) return;
    const c = palette(), col = sauceColor(S.kind), dk = mixHex(col, '#1a0806', 0.5), pts = poolPath(S.pool, D), path = toPath(pts);
    if (mode === 'hair') {
      g.strokeStyle = col; g.lineWidth = hair(); g.stroke(path);
      g.globalAlpha = 0.5; for (const k of [0.9, 0.8]) g.stroke(toPath(pts.map(([x, y]) => [BOWL.x + (x - BOWL.x) * k, BOWL.y + (y - BOWL.y) * k]))); g.globalAlpha = 1;
      return;
    }
    g.save();
    g.fillStyle = col; g.globalAlpha = mode === 'poster' ? 1 : 0.9; g.fill(path);
    g.globalAlpha = 1; g.clip(path);
    if (mode === 'ink') {
      g.drawImage(st.cached(`saucetex|${S.kind}|${isDark()}`, gg => hatch(gg, [[0, 0], [W, 0], [W, H], [0, H]], { angle: -0.8, spacing: 3.2, seg: [8, 22], width: 0.8, color: dk, alpha: 0.4, seed: 8, density: (x, y) => smoothstep(BOWL.x - 160, BOWL.x + 220, x) * 0.8 + 0.1 })), 0, 0, W, H);
    } else { // glossy: a few bright dabs that follow the pool
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 4.5; g.lineCap = 'round';
      for (let i = 0; i < 7; i++) { const a = D.swirl + i * 0.93, d = (42 + (i * 37) % 80) * S.pool; g.beginPath(); g.arc(BOWL.x, BOWL.y, d, a, a + 0.28); g.stroke(); }
    }
    g.restore();
    g.strokeStyle = mode === 'poster' ? c.line : dk; g.lineWidth = mode === 'poster' ? 3.4 : 1.4; g.lineJoin = 'round'; g.stroke(path);
  }
  /** The poured line: thin, tapering to a dribble at its head, each stretch sinking into the pool soon after it is laid. */
  function ribbon(g, S, D, mode) {
    if (S.ribbon <= 0.004) return;
    const c = palette(), col = sauceColor(S.kind), M = 96, n = Math.max(2, Math.floor(S.ribbon * M)), pts = [];
    for (let i = 0; i < n; i++) pts.push(swirlPoint(i / (M - 1), D.swirl, D.wobble));
    if (mode === 'hair') { g.strokeStyle = col; g.lineWidth = hair() * 1.2; g.stroke(toPath(pts, false)); return; }
    const top = S.kind === 'cream' ? mixHex(col, '#ffffff', 0.4) : mixHex(col, S.kind === 'pesto' ? '#9ad04a' : '#ff5a2e', 0.22), wMax = mode === 'poster' ? 10 : 7.5, floor = 0.2;
    // how far each point has been laid, as a fraction of the whole line, tells its age; S.fade is the 0.4 s a stretch takes to be absorbed
    const alpha = i => floor + (1 - floor) * (1 - smoothstep(0, S.fade, S.ribbon - i / (M - 1)));
    const half = i => { const u = i / (M - 1), head = Math.min(1, (n - 1 - i) / 20); return (wMax * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.1))) * (0.12 + 0.88 * head * head)) / 2; };
    g.save(); g.fillStyle = top;
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1], b = pts[i], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl, w0 = half(i - 1), w1 = half(i);
      g.globalAlpha = alpha(i);
      g.beginPath(); g.moveTo(a[0] + nx * w0, a[1] + ny * w0); g.lineTo(b[0] + nx * w1, b[1] + ny * w1); g.lineTo(b[0] - nx * w1 - tx / tl * 0.6, b[1] - ny * w1 - ty / tl * 0.6); g.lineTo(a[0] - nx * w0, a[1] - ny * w0); g.closePath(); g.fill();
    }
    g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.lineWidth = mode === 'poster' ? 1.8 : 1.3;
    for (let i = 1; i < n; i++) { g.globalAlpha = 0.55 * alpha(i) * Math.min(1, half(i) / 1.6); g.beginPath(); g.moveTo(pts[i - 1][0] - 1, pts[i - 1][1] - 1.4); g.lineTo(pts[i][0] - 1, pts[i][1] - 1.4); g.stroke(); }
    g.restore();
    if (S.stream && n > 3) { // the pour itself, seen from above: a small bright drop where the sauce lands
      const [x, y] = pts[n - 1];
      g.fillStyle = top; circ(g, x, y, 4.5); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)'; circ(g, x - 1.4, y - 1.6, 1.4); g.fill();
    }
  }

  // ── pieces, flakes and leaves ───────────────────────────────────────────
  const dropShadow = (g, sp, p, mode, q, soft) => {
    if (mode === 'hair' || q < 0.5) return;
    const z = p.z ?? 0;
    g.save();
    const ss = soft ? 1 : 1 + (p.s - 1) * 0.35;
    g.translate(p.x + (soft ? 1.5 + z * 6 : 4 + z * 22), p.y + (soft ? 2 + z * 9 : 6 + z * 30)); g.rotate(p.a); g.scale(ss, ss);
    g.fillStyle = mode === 'poster' ? 'rgba(26,16,10,0.26)' : 'rgba(40,24,16,0.17)'; g.globalAlpha = (p.alpha ?? 1) * (soft ? Math.pow(1 - z, 3) : 1 - 0.45 * z);
    g.fill(sp.path);
    g.restore();
  };
  const put = (g, sp, p, mode) => {
    g.save(); g.translate(p.x, p.y); g.rotate(p.a);
    const m = mode === 'hair' ? 0.84 : 1; // quiet draws each piece a little smaller, so each stands apart with paper between
    g.scale(m * p.s * (1 + (p.sq ?? 0) * 0.12), m * p.s * (1 - (p.sq ?? 0) * 0.12)); g.globalAlpha = p.alpha ?? 1;
    g.drawImage(sp.cv, -sp.r, -sp.r, sp.r * 2, sp.r * 2);
    g.restore();
  };

  function frameDraw(d, frame) {
    const g = st.begin(), mode = modeOf(), q = frame.quality ?? 1, D = d.deal;
    st.blit(st.cached(`bowl|${mode}|${isDark()}`, gg => drawBowl(gg, mode)), g);
    if (d.sauce) pool(g, d.sauce, D, mode);
    const P = d.pieces, sps = D.items.map((it, i) => sprite(`p|${D.kind}|${D.seed}|${i}`, it.shape, 'pasta', mode, it.i + 1));
    const flying = p => p.vis && p.z > 0.04;
    for (const p of P) if (p.vis && !flying(p)) dropShadow(g, sps[p.i], p, mode, q);
    for (const p of P) if (p.vis && !flying(p)) put(g, sps[p.i], p, mode);
    if (d.sauce) ribbon(g, d.sauce, D, mode);
    // quiet: nine flecks, not fifty-four
    for (const f of d.flakes) if (f.vis && (mode !== 'hair' || f.i % 6 === 0)) { const sp = sprite(`f|${D.seed}|${f.i % 3}`, D.flakes[f.i].shape, 'flake', mode, f.i + 1); dropShadow(g, sp, f, mode, q, true); put(g, sp, f, mode); }
    for (const l of d.leaves) if (l.vis) { const sp = sprite(`l|${D.seed}|${l.i}`, D.leaves[l.i].shape, 'basil', mode, l.i + 7); dropShadow(g, sp, l, mode, q); put(g, sp, l, mode); }
    for (const p of P) if (flying(p)) { dropShadow(g, sps[p.i], p, mode, q); put(g, sps[p.i], p, mode); } // in the air: nearest the camera, over everything
  }

  /** The settle signal: an event, once per run, when the garnish has landed; never under `progress`. Also a data attribute for a page that came late. */
  function announce(d, frame) {
    if (frame.epoch !== epoch) {
      if (epoch >= 0 && tossN > 0) { tossN = 0; scene?.set({ tossAt: null, tossN: 0 }); }
      epoch = frame.epoch; scene?.removeAttribute?.('data-settled');
    }
    if (!gate({ done: d.done, progressSet: d.progressSet, epoch: frame.epoch })) return;
    scene?.setAttribute?.('data-settled', '');
    const el = scene;
    queueMicrotask(() => el?.dispatchEvent?.(new CustomEvent('sg-scene-settled', { bubbles: true, composed: true, detail: { seed: d.seed, pieces: d.params.pieces } })));
  }

  return {
    render(d, frame) {
      lastTime = frame.time; lastData = d;
      announce(d, frame);
      const key = d.settled ? `${d.seed}|${modeOf()}|${isDark()}|${st.canvas.width}|${d.params.pieces}${d.params.sauce}${d.params.topping}${d.params.garnish}|${d.fill.toFixed(4)}` : '';
      if (key && key === lastKey) return; // nothing changed: keep the last frame
      lastKey = key;
      frameDraw(d, frame);
    },
    setRegister(r) { reg = r; lastKey = ''; invalidate(); },
    restyle() { colors = null; sprites = new Map(); st.memo.clear(); lastKey = ''; invalidate(); },
    /** Click, Enter or Space in playful: toss the pieces up; the model carries the toss from here, so the loop wakes and runs it. */
    activate() {
      if (reg !== 'playful' || lastData?.progressSet) return;
      scene?.set({ tossAt: lastTime, tossN: ++tossN });
    },
    destroy() { st.destroy(); sprites = new Map(); },
  };
}
