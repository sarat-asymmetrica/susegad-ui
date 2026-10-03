// Posta: the canvas renderer. Owns every side effect.
//
// quiet    a hairline elevation: the sorting desk, cubbies, window, postbox, and balance scale
// warm     ink and wash: golden sunbeam through carepa window, floating dust motes,
//          letter bundles sliding into cubbies as progress advances, damped flap and scale oscillations,
//          settles after 8.5 seconds (no further frames)
// playful  the same; interactive clicks open the postbox flap, tip the balance scale,
//          or press the rubber stamp onto the sorting manifest
//
// The architectural structure, walls, desk, window and postbox body are painted once into an offscreen cache.

import {
  stage,
  rng,
  clamp,
  lerp,
  TAU,
  smoothstep,
  hexToRgb,
  ink,
  hatch,
  wash,
  toPath,
  paper,
} from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { soundOn } from '../../sound/index.js';
import {
  W,
  H,
  REST,
  DESK,
  WINDOW,
  RACK,
  POSTBOX,
  SCALE,
  STAMP,
  scaleAngle,
  flapOpening,
  stampState,
} from './model.js';

const mixHex = (a, b, t) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return (
    '#' +
    A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join('')
  );
};

const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

export function createRenderer(host, { register = 'warm', scene, invalidate = () => {} } = {}) {
  // If host is a canvas, use its parent container
  const container = host.tagName === 'CANVAS' ? host.parentElement || host : host;
  const st = stage(container, { W, H });

  let reg = register;
  let colors = null;
  let lastKey = '';
  let epoch = -1;
  let flapPushes = [];
  let scalePushes = [];
  let stampPresses = [];
  let pendingAction = null;
  let kbTarget = 0; // 0: flap, 1: scale, 2: stamp
  let audioCtx = null;

  st.onresize = () => {
    lastKey = '';
    invalidate();
  };

  /**
   * The three sounds of the sorting room.
   *
   * Gated on the global sound switch, per decision 0015: nothing here plays when
   * the person has turned sound off. Each is shaped like the thing making it: the
   * postbox flap is a short wooden knock with a hard attack and almost no tail,
   * the balance pans are brass and ring for most of a second, and the rubber
   * stamp is a dull thud with a fast decay and a little body under it.
   */
  function playSound(type) {
    try {
      if (!soundOn()) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx ??= new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;

      const voices = {
        // [oscillator type, frequency, glide to, level, decay, noise floor]
        flap: ['triangle', 250, 80, 0.22, 0.14, 0.5],
        scale: ['sine', 900, 900, 0.13, 0.62, 0.35],
        stamp: ['square', 150, 42, 0.26, 0.12, 0.7],
      };
      const v = voices[type];
      if (!v) return;
      const [wave, f0, f1, level, decay, body] = v;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + decay);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + decay + 0.05);

      // A little noise underneath, so wood and rubber are wood and rubber and
      // not just pitched tones.
      const len = Math.ceil(audioCtx.sampleRate * decay);
      const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2 * level * body;
      }
      const noise = audioCtx.createBufferSource();
      const ng = audioCtx.createGain();
      const filt = audioCtx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = type === 'scale' ? 2600 : 900;
      filt.Q.value = 1.1;
      noise.buffer = buf;
      noise.connect(filt);
      filt.connect(ng);
      ng.connect(audioCtx.destination);
      ng.gain.value = 1;
      noise.start(now);
    } catch {
      // Audio is an optional progressive enhancement
    }
  }

  function palette() {
    return (colors ??= readColors(container, {
      paper: 'var(--sg-paper, light-dark(#f4efe6, #151926))',
      ink: 'var(--sg-ink, light-dark(#1d2538, #ebe5d8))',
      pencil: 'var(--sg-pencil, light-dark(#8d92a4, #6c695e))',
      crimson: 'var(--sg-posta-crimson, #9e2424)',
      rosewood: 'var(--sg-posta-rosewood, #522119)',
      teak: 'var(--sg-posta-teak, #7d4c28)',
      brass: 'var(--sg-posta-brass, #cca036)',
      carepa: 'var(--sg-posta-carepa, #f0ebdc)',
      mark: 'var(--sg-posta-mark, #58336d)',
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }

  const isDark = () => palette().dark !== '#000000';
  const hair = () => (1.1 * W) / (st.canvas.clientWidth || W);
  const INK = () => (isDark() ? '#141828' : '#1d2538');
  const night = (hex, k = 0.5) => (isDark() ? mixHex(hex, '#10132a', k) : hex);

  // ── cached architectural background ──────────────────────────────────────────
  function paintBackground(g, mode, seed) {
    const c = palette();
    const dark = isDark();
    const hw = hair();
    const hairline = mode === 'hair';
    const r = rng(`posta:bg:${seed}`);

    const L = (pts, closed = true, a = 1) => {
      g.strokeStyle = c.ink;
      g.globalAlpha = a;
      g.lineWidth = hw;
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p)));
      if (closed) g.closePath();
      g.stroke();
      g.globalAlpha = 1;
    };

    const P = (pts, closed = true) => {
      g.strokeStyle = c.pencil;
      g.lineWidth = hw * 0.8;
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p)));
      if (closed) g.closePath();
      g.stroke();
    };

    // 1. Paper and back wall
    if (hairline) {
      g.fillStyle = c.paper;
      g.fillRect(0, 0, W, H);
    } else {
      paper(g, W, H, {
        base: c.paper,
        seed: 41,
        mottle: 0.05,
        vignette: 0.06,
        fibers: 28,
        speck: dark ? '#000000' : '#3a2f22',
      });
      // Fontainhas warm lime wall wash
      const wall = rect(0, 0, W, DESK.top);
      wash(g, wall, {
        color: night('#eddcb5', 0.55),
        alpha: 0.65,
        grainy: false,
      });
      hatch(g, wall, {
        angle: 1.25,
        spacing: 12,
        seg: [20, 60],
        width: 0.5,
        color: '#6e5d42',
        alpha: 0.07,
        seed: 12,
      });
    }

    // 2. Carepa oyster shell window (upper-left)
    const win = WINDOW;
    const winBox = rect(win.x, win.y, win.x + win.w, win.y + win.h);
    if (hairline) {
      L(winBox);
      const pw = win.w / win.cols;
      const ph = win.h / win.rows;
      for (let i = 1; i < win.cols; i++) {
        L([[win.x + i * pw, win.y], [win.x + i * pw, win.y + win.h]], false);
      }
      for (let j = 1; j < win.rows; j++) {
        L([[win.x, win.y + j * ph], [win.x + win.w, win.y + j * ph]], false);
      }
    } else {
      // Deep wooden window surround
      wash(g, winBox, { color: night('#4a2e1d', 0.5), alpha: 0.95 });
      const paneW = (win.w - 24) / win.cols;
      const paneH = (win.h - 28) / win.rows;

      for (let row = 0; row < win.rows; row++) {
        for (let col = 0; col < win.cols; col++) {
          const px = win.x + 8 + col * (paneW + 4);
          const py = win.y + 8 + row * (paneH + 4);
          const pane = rect(px, py, px + paneW, py + paneH);

          // Translucent mother-of-pearl carepa pane with subtle iridescence
          const carepaTone = r.range(0.92, 1.08);
          const iri = g.createLinearGradient(px, py, px + paneW, py + paneH);
          iri.addColorStop(0, night(mixHex('#f9f5eb', '#e8ded0', r.range(0, 1)), 0.4 * carepaTone));
          iri.addColorStop(0.5, night(mixHex('#f2ebe3', '#e4efdd', r.range(0, 1)), 0.35 * carepaTone));
          iri.addColorStop(1, night(mixHex('#eedad0', '#dfe5df', r.range(0, 1)), 0.45 * carepaTone));
          g.fillStyle = iri;
          g.globalAlpha = 0.88;
          g.fill(toPath(pane));
          g.globalAlpha = 1;

          // Subtle shell growth arcs
          g.save();
          g.clip(toPath(pane));
          g.strokeStyle = 'rgba(215, 205, 185, 0.4)';
          g.lineWidth = 1;
          for (let k = 0; k < 4; k++) {
            g.beginPath();
            g.arc(px + paneW * 0.5, py + paneH * 1.3, paneH * (0.4 + k * 0.28), -Math.PI * 0.8, -Math.PI * 0.2);
            g.stroke();
          }
          g.restore();

          ink(g, pane, { width: 1.1, color: INK(), alpha: 0.65, closed: true, jitter: 0.3, seed: row * 10 + col });
        }
      }
      ink(g, winBox, { width: 2.2, color: INK(), alpha: 0.9, closed: true, jitter: 0.4, seed: 9 });
    }

    // 3. Pigeonhole cubbies rack (middle-right)
    const rk = RACK;
    const rkBox = rect(rk.x, rk.y, rk.x + rk.w, rk.y + rk.h);
    if (hairline) {
      L(rkBox);
      const cw = rk.w / rk.cols;
      const ch = rk.h / rk.rows;
      for (let i = 1; i < rk.cols; i++) {
        L([[rk.x + i * cw, rk.y], [rk.x + i * cw, rk.y + rk.h]], false);
      }
      for (let j = 1; j < rk.rows; j++) {
        L([[rk.x, rk.y + j * ch], [rk.x + rk.w, rk.y + j * ch]], false);
      }
    } else {
      // Teak outer rack casing
      wash(g, rkBox, { color: night(c.teak, 0.4), alpha: 0.95 });
      hatch(g, rkBox, { angle: 0.78, spacing: 5, width: 0.6, color: '#381f10', alpha: 0.25, seed: 15 });

      const colW = (rk.w - 18) / rk.cols;
      const rowH = (rk.h - 18) / rk.rows;

      for (let row = 0; row < rk.rows; row++) {
        for (let col = 0; col < rk.cols; col++) {
          const cx = rk.x + 9 + col * colW;
          const cy = rk.y + 9 + row * rowH;
          const cBox = rect(cx, cy, cx + colW - 3, cy + rowH - 3);

          // Deep cubby shadow
          wash(g, cBox, { color: night('#2b160a', 0.5), alpha: 0.85 });
          hatch(g, cBox, { angle: -0.6, spacing: 3.5, width: 0.5, color: '#160a04', alpha: 0.35, seed: row * 4 + col });
          ink(g, cBox, { width: 0.9, color: INK(), alpha: 0.7, closed: true, jitter: 0.2, seed: 20 + row * 4 + col });

          // Small brass label plate under each cubby
          const brassPlate = rect(cx + colW * 0.2, cy + rowH - 7, cx + colW * 0.8, cy + rowH - 2);
          wash(g, brassPlate, { color: night(c.brass, 0.3), alpha: 0.9 });
          ink(g, brassPlate, { width: 0.6, color: '#4a3205', alpha: 0.8, closed: true, jitter: 0.1, seed: 50 + col });
        }
      }
      ink(g, rkBox, { width: 2.0, color: INK(), alpha: 0.9, closed: true, jitter: 0.3, seed: 18 });
    }

    // 4. Crimson heritage postbox (right)
    const pb = POSTBOX;
    const crownR = pb.w * 0.5;
    const pbShape = [
      [pb.x, pb.y + crownR],
      [pb.x + crownR, pb.y],
      [pb.x + pb.w, pb.y + crownR],
      [pb.x + pb.w, pb.y + pb.h],
      [pb.x, pb.y + pb.h],
    ];

    if (hairline) {
      L(pbShape);
      L(rect(pb.slot.x, pb.slot.y, pb.slot.x + pb.slot.w, pb.slot.y + pb.slot.h));
    } else {
      wash(g, pbShape, { color: night(c.crimson, 0.4), alpha: 0.98 });
      hatch(g, pbShape, { angle: 0.3, spacing: 4.5, width: 0.6, color: '#4d0c0c', alpha: 0.3, seed: 33 });

      // Plinth and cast beading
      const plinth = rect(pb.x - 6, pb.y + pb.h - 18, pb.x + pb.w + 6, pb.y + pb.h);
      wash(g, plinth, { color: night('#591010', 0.5), alpha: 0.98 });
      ink(g, plinth, { width: 1.4, color: INK(), alpha: 0.85, closed: true, jitter: 0.2, seed: 34 });

      // Brass crest plaque
      const crest = rect(pb.x + 35, pb.y + 55, pb.x + pb.w - 35, pb.y + 85);
      wash(g, crest, { color: night(c.brass, 0.3), alpha: 0.95 });
      ink(g, crest, { width: 1.0, color: '#4a3406', alpha: 0.85, closed: true, jitter: 0.2, seed: 35 });

      // Mail slot aperture recess
      const slotBox = rect(pb.slot.x, pb.slot.y, pb.slot.x + pb.slot.w, pb.slot.y + pb.slot.h);
      wash(g, slotBox, { color: night('#1a0404', 0.6), alpha: 0.95 });
      ink(g, slotBox, { width: 1.2, color: INK(), alpha: 0.85, closed: true, jitter: 0.2, seed: 36 });
      ink(g, pbShape, { width: 2.2, color: INK(), alpha: 0.9, closed: true, jitter: 0.3, seed: 32 });
    }

    // 5. Rosewood sorting desk
    const dsk = DESK;
    const deskTop = rect(0, dsk.top, W, dsk.front);
    const deskFront = rect(0, dsk.front, W, dsk.bottom);

    if (hairline) {
      L(deskTop);
      L(deskFront);
      L(rect(dsk.blotter.x, dsk.blotter.y, dsk.blotter.x + dsk.blotter.w, dsk.blotter.y + dsk.blotter.h));
    } else {
      // Polished rosewood desk top
      wash(g, deskTop, { color: night(c.rosewood, 0.35), alpha: 0.97 });
      hatch(g, deskTop, { angle: 0.05, spacing: 3.2, width: 0.6, color: '#2d0e08', alpha: 0.35, seed: 45 });

      // Desk edge moulding lip and bevel
      const bevel = rect(0, dsk.top + 3, W, dsk.top + 7);
      wash(g, bevel, { color: night('#803628', 0.3), alpha: 0.85 });

      // Desk face and pedestal drawers
      wash(g, deskFront, { color: night('#38120b', 0.45), alpha: 0.98 });
      hatch(g, deskFront, { angle: 1.5, spacing: 6, width: 0.7, color: '#1a0703', alpha: 0.4, seed: 46 });

      ink(g, [[0, dsk.top], [W, dsk.top]], { width: 1.8, color: INK(), alpha: 0.85, jitter: 0.2, seed: 47, taper: 0 });
      ink(g, [[0, dsk.front], [W, dsk.front]], { width: 2.0, color: INK(), alpha: 0.9, jitter: 0.2, seed: 48, taper: 0 });

      // Center desk blotter (green leather pad)
      const bl = dsk.blotter;
      const blBox = rect(bl.x, bl.y, bl.x + bl.w, bl.y + bl.h);
      wash(g, blBox, { color: night('#2c4738', 0.4), alpha: 0.95 });
      hatch(g, blBox, { angle: -0.4, spacing: 4.0, width: 0.5, color: '#13241b', alpha: 0.3, seed: 49 });
      ink(g, blBox, { width: 1.3, color: INK(), alpha: 0.85, closed: true, jitter: 0.2, seed: 50 });

      // Sorting manifest sheet on blotter
      const mf = rect(430, 510, 660, 720);
      wash(g, mf, { color: night('#f6f1e3', 0.3), alpha: 0.96 });
      ink(g, mf, { width: 1.0, color: INK(), alpha: 0.8, closed: true, jitter: 0.2, seed: 51 });
      // Ruled ledger lines on manifest
      for (let yl = 535; yl < 700; yl += 16) {
        P([[445, yl], [645, yl]], false);
      }
    }

    // 6. Scale base and pillar
    const sc = SCALE;
    if (hairline) {
      L(rect(sc.x - 45, sc.y - 12, sc.x + 45, sc.y));
      L([[sc.x, sc.y - 12], [sc.x, sc.pivotY]], false);
    } else {
      const baseBox = rect(sc.x - 45, sc.y - 12, sc.x + 45, sc.y);
      wash(g, baseBox, { color: night(c.brass, 0.3), alpha: 0.95 });
      ink(g, baseBox, { width: 1.2, color: '#4a3406', alpha: 0.85, closed: true, jitter: 0.2, seed: 60 });

      const pillar = rect(sc.x - 5, sc.pivotY, sc.x + 5, sc.y - 12);
      wash(g, pillar, { color: night(c.brass, 0.3), alpha: 0.95 });
      ink(g, pillar, { width: 1.0, color: '#4a3406', alpha: 0.85, closed: true, jitter: 0.2, seed: 61 });

      // Dial plate at pivot
      g.fillStyle = night(c.brass, 0.3);
      g.beginPath();
      g.arc(sc.x, sc.pivotY, 14, 0, TAU);
      g.fill();
      g.strokeStyle = '#4a3406';
      g.lineWidth = 1.0;
      g.stroke();
    }

    // 7. Rubber stamp ink pad tin
    const ip = STAMP.inkPad;
    const ipBox = rect(ip.x, ip.y, ip.x + ip.w, ip.y + ip.h);
    if (hairline) {
      L(ipBox);
    } else {
      wash(g, ipBox, { color: night('#737780', 0.4), alpha: 0.9 });
      // Inked felt inside
      const felt = rect(ip.x + 4, ip.y + 4, ip.x + ip.w - 4, ip.y + ip.h - 4);
      wash(g, felt, { color: night(c.mark, 0.3), alpha: 0.92 });
      ink(g, ipBox, { width: 1.1, color: INK(), alpha: 0.8, closed: true, jitter: 0.2, seed: 70 });
    }
  }

  // ── dynamic letter bundles in cubbies and waiting on desk ────────────────────
  function drawBundles(g, modelData, mode) {
    const hairline = mode === 'hair';
    const c = palette();

    // 1. Bundles in sorted cubbies
    for (const cubby of modelData.rack.cubbies) {
      if (!cubby.sorted) continue;
      const bx = cubby.x + 6;
      const by = cubby.y + cubby.h - 18;
      const bw = cubby.w - 14;
      const bh = 14;

      if (hairline) {
        g.strokeStyle = c.ink;
        g.lineWidth = hair();
        g.strokeRect(bx, by, bw, bh);
        // cross tie
        g.beginPath();
        g.moveTo(bx + bw * 0.5, by);
        g.lineTo(bx + bw * 0.5, by + bh);
        g.stroke();
      } else {
        const bundleBox = rect(bx, by, bx + bw, by + bh);
        wash(g, bundleBox, { color: night('#f0ebd8', 0.35), alpha: 0.95 });
        ink(g, bundleBox, { width: 0.9, color: INK(), alpha: 0.85, closed: true, jitter: 0.2, seed: cubby.idx });

        // Jute cross-tie cord
        g.strokeStyle = '#6e4726';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(bx + bw * 0.5, by);
        g.lineTo(bx + bw * 0.5, by + bh);
        g.stroke();

        // Tiny knot in center
        g.fillStyle = '#543419';
        g.beginPath();
        g.arc(bx + bw * 0.5, by + bh * 0.5, 1.8, 0, TAU);
        g.fill();
      }
    }

    // 2. Waiting bundles on desk (unsorted)
    const waiting = modelData.waitingCount;
    if (waiting > 0) {
      const piles = Math.min(waiting, 6);
      for (let i = 0; i < piles; i++) {
        const px = 290 + (i % 2) * 44;
        const py = 640 - Math.floor(i / 2) * 16;
        const pw = 68;
        const ph = 14;
        const pBox = rect(px, py, px + pw, py + ph);

        if (hairline) {
          g.strokeStyle = c.ink;
          g.lineWidth = hair();
          g.strokeRect(px, py, pw, ph);
        } else {
          wash(g, pBox, { color: night('#eee5d0', 0.35), alpha: 0.95 });
          ink(g, pBox, { width: 0.8, color: INK(), alpha: 0.8, closed: true, jitter: 0.2, seed: 80 + i });
          // Jute twine
          g.strokeStyle = '#6e4726';
          g.lineWidth = 1.1;
          g.beginPath();
          g.moveTo(px + pw * 0.5, py);
          g.lineTo(px + pw * 0.5, py + ph);
          g.stroke();
        }
      }
    }
  }

  // ── dynamic balance scale ───────────────────────────────────────────────────
  function drawScale(g, modelData, mode) {
    const sc = modelData.scale;
    const hairline = mode === 'hair';
    const c = palette();
    const brassColor = night(c.brass, 0.3);

    const ca = Math.cos(sc.angle);
    const sa = Math.sin(sc.angle);
    const lx = sc.x - sc.arm * ca;
    const ly = sc.pivotY - sc.arm * sa;
    const rx = sc.x + sc.arm * ca;
    const ry = sc.pivotY + sc.arm * sa;

    if (hairline) {
      g.strokeStyle = c.ink;
      g.lineWidth = hair();
      // Beam
      g.beginPath();
      g.moveTo(lx, ly);
      g.lineTo(rx, ry);
      g.stroke();
      // Suspension rods and pans
      g.beginPath();
      g.moveTo(lx, ly);
      g.lineTo(lx, sc.leftPanY);
      g.moveTo(rx, ry);
      g.lineTo(rx, sc.rightPanY);
      g.stroke();
      g.strokeRect(lx - 25, sc.leftPanY, 50, 6);
      g.strokeRect(rx - 25, sc.rightPanY, 50, 6);
      return;
    }

    // Rotating balance beam
    g.strokeStyle = brassColor;
    g.lineWidth = 3.2;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(lx, ly);
    g.lineTo(rx, ry);
    g.stroke();
    ink(g, [[lx, ly], [rx, ry]], { width: 1.0, color: '#4a3406', alpha: 0.8, jitter: 0.1, seed: 88, taper: 0 });

    // Pivot pointer needle
    const nx = sc.x - sa * 22;
    const ny = sc.pivotY + ca * 22;
    g.strokeStyle = '#4a3406';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(sc.x, sc.pivotY);
    g.lineTo(nx, ny);
    g.stroke();

    // Suspension cords and pans
    for (const [x, py, isLeft] of [[lx, sc.leftPanY, true], [rx, sc.rightPanY, false]]) {
      g.strokeStyle = '#6e561e';
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(x, isLeft ? ly : ry);
      g.lineTo(x - 18, py);
      g.moveTo(x, isLeft ? ly : ry);
      g.lineTo(x + 18, py);
      g.stroke();

      // Pan dish
      const pan = rect(x - 26, py, x + 26, py + 6);
      wash(g, pan, { color: brassColor, alpha: 0.95 });
      ink(g, pan, { width: 1.1, color: '#4a3406', alpha: 0.85, closed: true, jitter: 0.2, seed: isLeft ? 90 : 91 });

      if (isLeft) {
        // Mail packet on left pan
        const env = rect(x - 16, py - 10, x + 16, py);
        wash(g, env, { color: night('#f6f0dd', 0.3), alpha: 0.95 });
        ink(g, env, { width: 0.8, color: INK(), alpha: 0.8, closed: true, jitter: 0.1, seed: 92 });
      } else {
        // Brass weights on right pan
        const w1 = rect(x - 12, py - 14, x - 2, py);
        const w2 = rect(x + 2, py - 9, x + 10, py);
        wash(g, w1, { color: brassColor, alpha: 0.95 });
        wash(g, w2, { color: brassColor, alpha: 0.95 });
        ink(g, w1, { width: 0.8, color: '#4a3406', alpha: 0.85, closed: true, jitter: 0.1, seed: 93 });
        ink(g, w2, { width: 0.8, color: '#4a3406', alpha: 0.85, closed: true, jitter: 0.1, seed: 94 });
      }
    }
  }

  // ── dynamic postbox flap ────────────────────────────────────────────────────
  function drawFlap(g, modelData, mode) {
    const sl = modelData.postbox.slot;
    const flap = modelData.postbox.flap;
    const hairline = mode === 'hair';
    const c = palette();
    const brassColor = night(c.brass, 0.3);

    // Flap lifts upward on top hinge
    const flapH = sl.h * (1.0 - flap * 0.75);
    const flapBox = rect(sl.x + 3, sl.y + 2, sl.x + sl.w - 3, sl.y + 2 + flapH);

    if (hairline) {
      g.strokeStyle = c.ink;
      g.lineWidth = hair();
      g.strokeRect(sl.x + 3, sl.y + 2, sl.x + sl.w - 6, flapH);
      return;
    }

    wash(g, flapBox, { color: brassColor, alpha: 0.98 });
    ink(g, flapBox, { width: 1.2, color: '#4a3406', alpha: 0.9, closed: true, jitter: 0.2, seed: 95 });

    // Raised brass handle lip at bottom of flap
    const lip = rect(sl.x + sl.w * 0.35, sl.y + flapH - 1, sl.x + sl.w * 0.65, sl.y + flapH + 3);
    wash(g, lip, { color: mixHex(brassColor, '#ffffff', 0.2), alpha: 0.95 });
    ink(g, lip, { width: 0.8, color: '#4a3406', alpha: 0.85, closed: true, jitter: 0.1, seed: 96 });
  }

  // ── dynamic rubber stamp and postmark impression ────────────────────────────
  function drawStamp(g, modelData, mode) {
    const stp = modelData.stamp;
    const hairline = mode === 'hair';
    const c = palette();

    // 1. Postmark impression on manifest
    if (modelData.manifest.stamped) {
      const cx = 530;
      const cy = 600;
      const markColor = hairline ? c.ink : night(c.mark, 0.2);

      g.save();
      g.strokeStyle = markColor;
      g.lineWidth = hairline ? hair() : 1.6;
      g.globalAlpha = hairline ? 0.7 : 0.85;

      // Outer and inner postmark rings
      g.beginPath();
      g.arc(cx, cy, 26, 0, TAU);
      g.stroke();

      g.beginPath();
      g.arc(cx, cy, 18, 0, TAU);
      g.stroke();

      // Postal cancellation wavy lines extending to the right
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.moveTo(cx + 34, cy + k * 7);
        g.quadraticCurveTo(cx + 54, cy + k * 7 - 3, cx + 74, cy + k * 7);
        g.quadraticCurveTo(cx + 94, cy + k * 7 + 3, cx + 114, cy + k * 7);
        g.stroke();
      }
      g.restore();
    }

    // 2. Rubber stamp handle and base
    const sx = stp.x;
    const sy = stp.y;

    if (hairline) {
      g.strokeStyle = c.ink;
      g.lineWidth = hair();
      g.beginPath();
      g.arc(sx, sy - 42, 14, 0, TAU);
      g.stroke();
      g.strokeRect(sx - 5, sy - 28, 10, 20);
      g.strokeRect(sx - 24, sy - 8, 48, 8);
      return;
    }

    // Wooden turned knob
    g.fillStyle = night(c.rosewood, 0.4);
    g.beginPath();
    g.arc(sx, sy - 42, 14, 0, TAU);
    g.fill();
    g.strokeStyle = '#38120b';
    g.lineWidth = 1.0;
    g.stroke();

    // Brass collar
    const collar = rect(sx - 5, sy - 28, sx + 5, sy - 8);
    wash(g, collar, { color: night(c.brass, 0.3), alpha: 0.95 });
    ink(g, collar, { width: 0.8, color: '#4a3406', alpha: 0.85, closed: true, jitter: 0.1, seed: 101 });

    // Mount and dark rubber base
    const mount = rect(sx - 24, sy - 8, sx + 24, sy - 2);
    wash(g, mount, { color: night(c.teak, 0.3), alpha: 0.95 });
    ink(g, mount, { width: 1.0, color: INK(), alpha: 0.85, closed: true, jitter: 0.1, seed: 102 });

    const rubber = rect(sx - 22, sy - 2, sx + 22, sy);
    g.fillStyle = '#1c1c1f';
    g.fillRect(sx - 22, sy - 2, 44, 2);
  }

  // ── dynamic sunbeam, dust motes and the one person who comes in ───────────
  function drawSunbeamAndMotes(g, modelData, mode) {
    if (mode === 'hair') return;

    // 1. Soft golden sunbeam, swinging and narrowing as the day wears on
    const beam = modelData.sunbeam;
    const poly = beam.polygon;
    if (poly.length === 4) {
      const p0 = poly[0];
      const p2 = poly[2];
      const grad = g.createLinearGradient(p0[0], p0[1], p2[0], p2[1]);
      const k = beam.intensity;
      grad.addColorStop(0, `${beam.colour[0]}${(k * 1.05).toFixed(3)})`);
      grad.addColorStop(0.5, `${beam.colour[1]}${(k * 0.55).toFixed(3)})`);
      grad.addColorStop(1, `${beam.colour[1]}0.015)`);

      g.save();
      g.fillStyle = grad;
      g.beginPath();
      poly.forEach((pt, i) => (i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1])));
      g.closePath();
      g.fill();
      g.restore();
    }

    // 2. Floating dust motes
    for (const m of modelData.motes) {
      if (m.alpha <= 0.02) continue;
      g.save();
      g.globalAlpha = m.alpha;
      g.fillStyle = '#fff4ce';
      g.beginPath();
      g.arc(m.x, m.y, m.r, 0, TAU);
      g.fill();
      g.restore();
    }

    // 3. Somebody at the window: head and shoulders against the bright pane, and
    //    the shadow they throw across the sorting desk.
    drawCustomer(g, modelData.customer, mode);
  }

  /**
   * The customer.
   *
   * Seen from inside the sorting room, all you get of somebody at the counter is
   * a head and shoulders dark against a pane of oyster shell, and a long shadow
   * lying across the desk. That is enough to know the room is being worked in.
   */
  function drawCustomer(g, cust, mode) {
    if (!cust || cust.presence <= 0.01 || mode === 'hair') return;
    const p = cust.presence;
    const h = cust.height;
    const x = cust.x;
    const y = cust.y;
    const reach = cust.shadowReach;

    // The shadow, thrown to the lower right across the desk. The light comes
    // through the window from the upper left, so the shadow goes the other way.
    g.save();
    g.globalAlpha = 0.22 * p;
    g.fillStyle = night('#2a1c10', 0.35);
    const sx = x + 290 * reach;
    const sy = y + 300 * reach;
    g.beginPath();
    g.ellipse(sx, sy, h * 0.5, h * 0.62, 0.2, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(sx + h * 0.1, sy - h * 0.6, h * 0.2, h * 0.24, 0.2, 0, TAU);
    g.fill();
    g.restore();

    // The person, dark against the pane. Only their top half is in the opening.
    g.save();
    g.globalAlpha = p;
    g.fillStyle = night('#241a12', 0.25);
    g.beginPath();
    g.ellipse(x + cust.lean, y, h * 0.19, h * 0.23, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(x - h * 0.36 + cust.lean, y + h * 0.5);
    g.quadraticCurveTo(x, y - h * 0.06, x + h * 0.36 + cust.lean, y + h * 0.5);
    g.closePath();
    g.fill();
    // A rim of the morning light down the shoulder nearest the window.
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(255,232,178,${0.4 * p})`;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - h * 0.34 + cust.lean, y + h * 0.42);
    g.quadraticCurveTo(x - h * 0.2, y - h * 0.02, x - h * 0.05, y + h * 0.06);
    g.stroke();
    g.restore();
  }

  // ── frame loop ─────────────────────────────────────────────────────────────
  return {
    render(d, frame) {
      const mode = reg === 'quiet' ? 'hair' : 'ink';
      const still = frame.still || reg === 'quiet';
      const t = frame.time;

      if (frame.epoch !== epoch) {
        epoch = frame.epoch;
        flapPushes = [];
        scalePushes = [];
        stampPresses = [];
      }

      // Handle interactive actions in playful
      if (reg === 'playful' && !still && pendingAction) {
        const act = pendingAction;
        pendingAction = null;
        if (act.type === 'flap') {
          flapPushes.push({ t, amp: 0.95 });
        } else if (act.type === 'scale') {
          scalePushes.push({ t, dir: act.dir ?? 1 });
        } else if (act.type === 'stamp') {
          stampPresses.push({ t });
        }
      }

      // Compute dynamic variables incorporating interactive impulses
      let dynamicAngle = d.scale.angle;
      let dynamicFlap = d.postbox.flap;
      let dynamicStamp = d.stamp;

      if (reg === 'playful' && !still) {
        if (d.params.flap === null) {
          dynamicFlap = flapOpening(t, flapPushes, null);
        }
        if (d.params.stamped === null) {
          dynamicStamp = stampState(t, stampPresses, null);
        }
        dynamicAngle = scaleAngle(t, scalePushes);
      }

      const activeModel = {
        ...d,
        scale: {
          ...d.scale,
          angle: dynamicAngle,
          leftPanY: SCALE.panRestY + Math.sin(dynamicAngle) * SCALE.arm,
          rightPanY: SCALE.panRestY - Math.sin(dynamicAngle) * SCALE.arm,
        },
        postbox: {
          ...d.postbox,
          flap: dynamicFlap,
        },
        stamp: {
          ...d.stamp,
          y: dynamicStamp.y,
          descent: dynamicStamp.descent,
          inkMark: dynamicStamp.inkMark,
        },
        manifest: {
          ...d.manifest,
          stamped: dynamicStamp.inkMark,
        },
      };

      const kb =
        frame.pointer?.keyboard && frame.pointer?.inside && reg === 'playful'
          ? `${frame.pointer.x | 0},${frame.pointer.y | 0}`
          : '';

      const key2 = `${mode}|${isDark()}|${d.seed}|${d.progress.toFixed(2)}|${dynamicFlap.toFixed(3)}|${dynamicAngle.toFixed(3)}|${dynamicStamp.y.toFixed(1)}|${st.canvas.width}|${kb}`;
      if (key2 === lastKey) return;
      lastKey = key2;

      const g = st.begin();

      // Blit cached background
      st.blit(
        st.cached(`posta:bg|${mode}|${isDark()}|${d.seed}`, gg =>
          paintBackground(gg, mode, d.seed)
        )
      );

      // Draw dynamic elements
      drawSunbeamAndMotes(g, activeModel, mode);
      drawBundles(g, activeModel, mode);
      drawScale(g, activeModel, mode);
      drawFlap(g, activeModel, mode);
      drawStamp(g, activeModel, mode);

      // Keyboard navigation indicator ring in playful
      if (kb && frame.pointer) {
        const p = frame.pointer;
        g.save();
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(20, 24, 40, 0.55)';
        g.beginPath();
        g.arc(p.x, p.y, 16, 0, TAU);
        g.stroke();
        g.lineWidth = 1.6;
        g.strokeStyle = '#fbf8ef';
        g.stroke();
        g.restore();
      }
    },

    setRegister(r) {
      reg = r;
      lastKey = '';
      invalidate();
    },

    restyle() {
      colors = null;
      st.memo.clear();
      lastKey = '';
      invalidate();
    },

    /**
     * Interactive trigger: clicking or pressing Enter/Space.
     * Hits postbox flap, scale pans, or rubber stamp.
     */
    activate(p) {
      if (reg !== 'playful') return;
      if (p) {
        // Pointer click detection
        if (Math.hypot(p.x - (POSTBOX.slot.x + 60), p.y - (POSTBOX.slot.y + 18)) < 85) {
          pendingAction = { type: 'flap' };
        } else if (Math.hypot(p.x - SCALE.x, p.y - SCALE.panRestY) < 140) {
          pendingAction = { type: 'scale', dir: p.x < SCALE.x ? 1 : -1 };
        } else if (Math.hypot(p.x - 560, p.y - 580) < 120) {
          pendingAction = { type: 'stamp' };
        } else {
          // Default: cycle through actions
          pendingAction = { type: ['flap', 'scale', 'stamp'][kbTarget % 3] };
          kbTarget++;
        }
      } else {
        // Keyboard activation
        pendingAction = { type: ['flap', 'scale', 'stamp'][kbTarget % 3] };
        kbTarget++;
      }
      if (pendingAction) playSound(pendingAction.type);
      invalidate();
    },

    destroy() {
      st.destroy();
    },
  };
}
