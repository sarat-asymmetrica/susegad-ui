// Taverna: the canvas renderer. Owns every side effect.
//
// quiet:   crisp ink elevation: window bars, sill, dark bottles, jug, blackboard at rest.
// warm:    ink and wash: streetlamp in rainy alley, glowing filament bulb, rain streaks,
//          meandering rivulets on glass, settling gracefully.
// playful: interactive: click bottles to generate acoustic rings and chimes,
//          drag to wipe condensation from the glass.
//
// Architectural background and still life are painted into cached layers.

import { stage, rng, clamp, lerp, smoothstep, TAU, ink, hatch, wash, toPath, paper } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { soundOn } from '../../sound/index.js';
import { W, H, REST, WINDOW, BOTTLES, JUG, BLACKBOARD, STREETLAMP, BULB, model } from './model.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export function createRenderer(canvasOrHost, { register = 'warm', theme, palette: customPalette, seed = 1, invalidate, scene } = {}) {
  const isCanvas = canvasOrHost?.tagName === 'CANVAS';
  const host = isCanvas ? canvasOrHost.parentElement || canvasOrHost : canvasOrHost;

  const st = isCanvas
    ? {
        canvas: canvasOrHost,
        ctx: canvasOrHost.getContext('2d'),
        W,
        H,
        px: 1,
        memo: new Map(),
        begin() {
          const g = canvasOrHost.getContext('2d');
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
          return g;
        },
        layer(draw) {
          const c = document.createElement('canvas');
          c.width = W;
          c.height = H;
          const g = c.getContext('2d');
          draw?.(g, this);
          return c;
        },
        cached(key, draw) {
          if (!this.memo.has(key)) this.memo.set(key, this.layer(draw));
          return this.memo.get(key);
        },
        blit(layer, g = this.ctx) {
          g.drawImage(layer, 0, 0, W, H);
        },
        destroy() {
          this.memo.clear();
        },
      }
    : stage(host, { W, H });

  let reg = register;
  let colors = null;
  let lastKey = '';
  let chimes = [];
  let wipes = [];
  let currentWipe = null;
  let audioCtx = null;

  if (st.onresize !== undefined) {
    st.onresize = () => {
      lastKey = '';
      invalidate?.();
    };
  }

  function palette() {
    return (colors ??= (customPalette || readColors(host?.isConnected ? host : document.body || document.documentElement, {
      paper: 'var(--sg-paper, light-dark(#f2ede3, #131722))',
      ink: 'var(--sg-ink, light-dark(#1b2438, #ebe5d8))',
      pencil: 'var(--sg-pencil, light-dark(#7e859b, #757062))',
      wood: 'var(--sg-taverna-wood, light-dark(#2e1d13, #1c110b))',
      sill: 'var(--sg-taverna-sill, light-dark(#3d281a, #23160e))',
      bottleGreen: 'var(--sg-taverna-bottle, #183d28)',
      bottleOlive: 'var(--sg-taverna-olive, #2d4520)',
      bottleAmber: 'var(--sg-taverna-amber, #5a3818)',
      clay: 'var(--sg-taverna-clay, #8f4c28)',
      slate: 'var(--sg-taverna-slate, light-dark(#2c3440, #191f28))',
      streetlamp: 'var(--sg-taverna-street, #f2a83b)',
      filament: 'var(--sg-taverna-filament, #ffb443)',
      cobble: 'var(--sg-taverna-cobble, light-dark(#3e4758, #181e2b))',
      rain: 'var(--sg-taverna-rain, light-dark(#9fb4cc, #657b95))',
      dark: 'light-dark(#000000, #ffffff)',
    })));
  }

  const isDark = () => palette().dark !== '#000000';
  const hair = () => (1.1 * W) / (st.canvas.clientWidth || W);

  /**
   * A bottle being struck.
   *
   * Gated on the global sound switch, per decision 0015: nothing plays here when
   * the person has turned sound off. The timbre is a struck glass rather than a
   * tone: a hard attack, three partials falling away at different rates, and a
   * long quiet tail. A single sine with a ramp reads as a test tone, which is
   * what it is.
   */
  function playChimeAudio(freq = 520) {
    try {
      if (!soundOn()) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx ??= new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;

      // The fundamental and two partials, the upper ones dying away first.
      const partials = [
        [1, 0.16, 1.1],
        [2.76, 0.07, 0.6],
        [5.4, 0.03, 0.32],
      ];
      for (const [mult, level, decay] of partials) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * mult, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(level, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + decay + 0.05);
      }
    } catch {
      // Audio is an optional progressive enhancement
    }
  }

  // ── Background alley & streetlamp (painted once) ──────────────────────────
  function drawAlleyBackground(g, mode, d) {
    const c = palette();
    const dark = isDark();
    const hairline = mode === 'hair';
    const hw = hair();

    if (hairline) {
      g.fillStyle = c.paper;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = c.pencil;
      g.lineWidth = hw * 0.7;
      // Cobblestone elevation lines
      for (const cb of d.outside.cobbles) {
        g.beginPath();
        g.roundRect(cb.x, cb.y, cb.w, cb.h, 6);
        g.stroke();
      }
      // Streetlamp elevation
      const sl = d.outside.streetlamp;
      g.strokeStyle = c.ink;
      g.lineWidth = hw;
      g.beginPath();
      g.arc(sl.x, sl.y, sl.r, 0, TAU);
      g.stroke();
      g.beginPath();
      g.moveTo(sl.x - 35, sl.y - 15);
      g.lineTo(sl.x, sl.y - 30);
      g.lineTo(sl.x + 35, sl.y - 15);
      g.stroke();
      return;
    }

    // Handmade paper substrate
    paper(g, W, H, {
      base: dark ? '#10141e' : c.paper,
      seed: 9,
      mottle: 0.05,
      vignette: 0.08,
      fibers: 25,
      speck: dark ? '#000000' : '#3a2f22',
    });

    // Dark night monsoon sky seen through the window
    const winRect = rect(WINDOW.x0, WINDOW.y0, WINDOW.x1, WINDOW.y1);
    const nightSky = g.createLinearGradient(0, WINDOW.y0, 0, WINDOW.y1);
    nightSky.addColorStop(0, dark ? '#0a0d14' : '#141a28');
    nightSky.addColorStop(0.65, dark ? '#121724' : '#1c2538');
    nightSky.addColorStop(1, dark ? '#1a2233' : '#28344c');
    g.save();
    g.fillStyle = nightSky;
    g.fill(toPath(winRect));

    // Wet cobblestones on the street
    for (const cb of d.outside.cobbles) {
      const stonePath = rect(cb.x, cb.y, cb.x + cb.w, cb.y + cb.h);
      const stoneColor = dark ? '#1e2638' : '#333f54';
      wash(g, stonePath, { color: stoneColor, alpha: cb.tone * 0.65 });
      hatch(g, stonePath, {
        angle: 0.4,
        spacing: 3.5,
        width: 0.6,
        color: '#0d121c',
        alpha: 0.25,
        seed: cb.x,
      });
    }

    // Rain puddles reflecting light
    for (const p of d.outside.puddles) {
      g.save();
      g.beginPath();
      g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU);
      const puddleGrad = g.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.rx);
      puddleGrad.addColorStop(0, 'rgba(242, 168, 59, 0.35)');
      puddleGrad.addColorStop(0.7, 'rgba(30, 45, 65, 0.55)');
      puddleGrad.addColorStop(1, 'rgba(15, 25, 40, 0)');
      g.fillStyle = puddleGrad;
      g.fill();
      g.restore();
    }

    // Streetlamp fixture on stone wall across the alley
    const sl = d.outside.streetlamp;
    // Lantern glow
    const lampGlow = g.createRadialGradient(sl.x, sl.y, 10, sl.x, sl.y, sl.glowR);
    lampGlow.addColorStop(0, 'rgba(255, 205, 110, 0.7)');
    lampGlow.addColorStop(0.35, 'rgba(242, 168, 59, 0.32)');
    lampGlow.addColorStop(0.7, 'rgba(215, 130, 40, 0.12)');
    lampGlow.addColorStop(1, 'rgba(200, 110, 30, 0)');
    g.fillStyle = lampGlow;
    g.beginPath();
    g.arc(sl.x, sl.y, sl.glowR, 0, TAU);
    g.fill();

    // Cast-iron lamp bracket and housing
    const bracket = [
      [sl.x - 45, sl.y + 40],
      [sl.x - 20, sl.y + 10],
      [sl.x, sl.y - 25],
      [sl.x + 20, sl.y + 10],
      [sl.x + 45, sl.y + 40],
    ];
    ink(g, bracket, { width: 3.2, color: '#161a22', alpha: 0.9, closed: false, seed: 12 });
    g.fillStyle = '#ffecb3';
    g.beginPath();
    g.arc(sl.x, sl.y, sl.r * 0.7, 0, TAU);
    g.fill();

    g.restore();
  }

  // ── Window frame, wooden bars & sill (painted once) ───────────────────────
  function drawWindowFrame(g, mode) {
    const c = palette();
    const dark = isDark();
    const hairline = mode === 'hair';
    const hw = hair();

    const frameRect = rect(WINDOW.x0, WINDOW.y0, WINDOW.x1, WINDOW.y1);
    const sillRect = rect(0, WINDOW.sill.y, W, H);

    if (hairline) {
      g.strokeStyle = c.ink;
      g.lineWidth = hw * 1.4;
      g.stroke(toPath(frameRect));
      g.stroke(toPath(sillRect));

      // Vertical bars
      for (const bx of WINDOW.bars) {
        g.stroke(toPath(rect(bx - 10, WINDOW.y0, bx + 10, WINDOW.y1)));
      }
      // Crossbar
      g.stroke(toPath(rect(WINDOW.x0, WINDOW.crossbar.y - 10, WINDOW.x1, WINDOW.crossbar.y + 10)));
      // Sill bevel lines
      g.strokeStyle = c.pencil;
      g.lineWidth = hw * 0.8;
      g.beginPath();
      g.moveTo(0, WINDOW.sill.y + WINDOW.sill.bevel);
      g.lineTo(W, WINDOW.sill.y + WINDOW.sill.bevel);
      g.stroke();
      return;
    }

    // Outer wall surround
    const wallLeft = rect(0, 0, WINDOW.x0, H);
    const wallRight = rect(WINDOW.x1, 0, W, H);
    const wallTop = rect(WINDOW.x0, 0, WINDOW.x1, WINDOW.y0);
    wash(g, wallLeft, { color: dark ? '#151a24' : '#d8cfbe', alpha: 0.98 });
    wash(g, wallRight, { color: dark ? '#151a24' : '#d8cfbe', alpha: 0.98 });
    wash(g, wallTop, { color: dark ? '#151a24' : '#d8cfbe', alpha: 0.98 });

    // Dark teak wooden window frame
    wash(g, frameRect, { color: dark ? '#18120c' : c.wood, alpha: 0.95 });
    hatch(g, frameRect, { angle: 0, spacing: 5, width: 0.8, color: '#120b06', alpha: 0.4, seed: 15 });

    // Cut out inner glass window panes
    g.save();
    g.clearRect(WINDOW.x0 + WINDOW.frame, WINDOW.y0 + WINDOW.frame, (WINDOW.x1 - WINDOW.x0) - 2 * WINDOW.frame, (WINDOW.y1 - WINDOW.y0) - 2 * WINDOW.frame);
    g.restore();

    // Heavy vertical wooden bars
    for (const bx of WINDOW.bars) {
      const barRect = rect(bx - 12, WINDOW.y0, bx + 12, WINDOW.y1);
      wash(g, barRect, { color: dark ? '#201610' : '#3a2417', alpha: 0.95 });
      hatch(g, barRect, { angle: 1.57, spacing: 4, width: 0.7, color: '#160d07', alpha: 0.35, seed: bx });
      ink(g, [[bx - 12, WINDOW.y0], [bx - 12, WINDOW.y1]], { width: 1.5, color: '#160d07', alpha: 0.85, seed: bx });
      ink(g, [[bx + 12, WINDOW.y0], [bx + 12, WINDOW.y1]], { width: 1.5, color: '#160d07', alpha: 0.85, seed: bx + 1 });
    }

    // Horizontal wooden crossbar
    const crossRect = rect(WINDOW.x0, WINDOW.crossbar.y - 10, WINDOW.x1, WINDOW.crossbar.y + 10);
    wash(g, crossRect, { color: dark ? '#241a12' : '#422a1b', alpha: 0.95 });
    hatch(g, crossRect, { angle: 0, spacing: 4, width: 0.7, color: '#160d07', alpha: 0.35, seed: 33 });
    ink(g, [[WINDOW.x0, WINDOW.crossbar.y - 10], [WINDOW.x1, WINDOW.crossbar.y - 10]], { width: 1.4, color: '#160d07', alpha: 0.8, seed: 34 });
    ink(g, [[WINDOW.x0, WINDOW.crossbar.y + 10], [WINDOW.x1, WINDOW.crossbar.y + 10]], { width: 1.4, color: '#160d07', alpha: 0.8, seed: 35 });

    // Deep timber sill at the bottom
    wash(g, sillRect, { color: dark ? '#1e140d' : c.sill, alpha: 0.98 });
    // Bevel wash: top plane catching room light
    const bevelRect = rect(0, WINDOW.sill.y, W, WINDOW.sill.y + WINDOW.sill.bevel);
    wash(g, bevelRect, { color: dark ? '#2a1d13' : '#4d3322', alpha: 0.92 });
    hatch(g, sillRect, { angle: 0.05, spacing: 6, width: 0.9, color: '#140c06', alpha: 0.35, seed: 44 });
    ink(g, [[0, WINDOW.sill.y], [W, WINDOW.sill.y]], { width: 2.2, color: '#140c06', alpha: 0.9, seed: 45 });
    ink(g, [[0, WINDOW.sill.y + WINDOW.sill.bevel], [W, WINDOW.sill.y + WINDOW.sill.bevel]], { width: 1.8, color: '#140c06', alpha: 0.75, seed: 46 });
  }

  // ── Still life on window sill (bottles, jug, blackboard) ───────────────────
  function drawStillLife(g, mode, d) {
    const c = palette();
    const dark = isDark();
    const hairline = mode === 'hair';
    const hw = hair();

    // 1. Hanging slate blackboard
    const bb = d.stillLife.blackboard;
    const bbRect = rect(bb.x, bb.y, bb.x + bb.w, bb.y + bb.h);
    const bbInner = rect(bb.x + bb.frame, bb.y + bb.frame, bb.x + bb.w - bb.frame, bb.y + bb.h - bb.frame);

    if (hairline) {
      g.strokeStyle = c.ink;
      g.lineWidth = hw;
      g.stroke(toPath(bbRect));
      g.stroke(toPath(bbInner));
      g.beginPath();
      g.moveTo(bb.peg.x, bb.peg.y);
      g.lineTo(bb.x + 15, bb.y);
      g.moveTo(bb.peg.x, bb.peg.y);
      g.lineTo(bb.x + bb.w - 15, bb.y);
      g.stroke();
    } else {
      // Cord
      ink(g, [[bb.peg.x, bb.peg.y], [bb.x + 15, bb.y]], { width: 1.8, color: '#a08b70', alpha: 0.9, seed: 50 });
      ink(g, [[bb.peg.x, bb.peg.y], [bb.x + bb.w - 15, bb.y]], { width: 1.8, color: '#a08b70', alpha: 0.9, seed: 51 });
      // Peg
      g.fillStyle = '#221a14';
      g.beginPath();
      g.arc(bb.peg.x, bb.peg.y, 4.5, 0, TAU);
      g.fill();

      // Wooden mitered frame
      wash(g, bbRect, { color: dark ? '#2a1a10' : '#4a2f1b', alpha: 0.95 });
      hatch(g, bbRect, { angle: 0.7, spacing: 4, width: 0.7, color: '#160c05', alpha: 0.35, seed: 52 });
      ink(g, bbRect, { width: 1.6, color: '#160c05', alpha: 0.85, closed: true, seed: 53 });

      // Charcoal slate surface
      wash(g, bbInner, { color: dark ? '#181f28' : c.slate, alpha: 0.98 });
      hatch(g, bbInner, { angle: -0.3, spacing: 3, width: 0.5, color: '#0d1218', alpha: 0.25, seed: 54 });
    }

    // 2. Ceramic Martaban Jug
    const jug = d.stillLife.jug;
    const jx = jug.x, jy = jug.y, jw = jug.w, jh = jug.h;
    const jugBody = [
      [jx - jw * 0.45, jy + jh],
      [jx - jw * 0.5, jy + jh * 0.55],
      [jx - jw * 0.32, jy + jh * 0.22],
      [jx - jw * 0.22, jy + jh * 0.1],
      [jx - jw * 0.26, jy],
      [jx + jw * 0.26, jy],
      [jx + jw * 0.22, jy + jh * 0.1],
      [jx + jw * 0.35, jy + jh * 0.22],
      [jx + jw * 0.5, jy + jh * 0.55],
      [jx + jw * 0.45, jy + jh],
    ];

    const jugHandle = [
      [jx + jw * 0.24, jy + jh * 0.18],
      [jx + jw * 0.58, jy + jh * 0.28],
      [jx + jw * 0.6, jy + jh * 0.5],
      [jx + jw * 0.35, jy + jh * 0.62],
    ];

    if (hairline) {
      g.strokeStyle = c.ink;
      g.lineWidth = hw * 1.2;
      g.stroke(toPath(jugBody, true));
      ink(g, jugHandle, { width: hw * 1.1, color: c.ink, closed: false, seed: 60 });
      // Shading lines
      hatch(g, jugBody, { angle: 1.5, spacing: 3.8, width: hw * 0.6, color: c.pencil, alpha: 0.5, seed: 61 });
    } else {
      // Cast shadow on sill
      g.save();
      g.fillStyle = 'rgba(10, 6, 3, 0.4)';
      g.beginPath();
      g.ellipse(jx, jy + jh - 4, jw * 0.55, 12, 0, 0, TAU);
      g.fill();
      g.restore();

      // Handle
      ink(g, jugHandle, { width: 9, color: dark ? '#522915' : c.clay, alpha: 0.95, closed: false, seed: 62 });
      ink(g, jugHandle, { width: 1.2, color: '#2b1208', alpha: 0.8, closed: false, seed: 63 });

      // Jug body wash
      wash(g, jugBody, { color: dark ? '#582b17' : c.clay, alpha: 0.95 });
      // Upper ochre glaze
      const upperGlaze = [
        [jx - jw * 0.3, jy + jh * 0.3],
        [jx - jw * 0.26, jy],
        [jx + jw * 0.26, jy],
        [jx + jw * 0.32, jy + jh * 0.3],
      ];
      wash(g, upperGlaze, { color: '#c9914c', alpha: 0.8 });

      // Curved belly shadow hatching
      hatch(g, jugBody, {
        angle: 1.45,
        spacing: 3.5,
        width: 0.8,
        color: '#2b1208',
        alpha: 0.38,
        seed: 64,
        density: (x) => smoothstep(jx - jw * 0.1, jx + jw * 0.5, x),
      });
      ink(g, jugBody, { width: 1.8, color: '#220e06', alpha: 0.9, closed: true, seed: 65 });
    }

    // 3. Dark Green and Amber Wine Bottles
    for (const b of d.stillLife.bottles) {
      const bx = b.x, by = b.y, bw = b.w, bh = b.h;
      const nw = b.neckW, nh = b.neckH;

      const bottlePts = [
        [bx - bw * 0.48, by + bh],
        [bx - bw * 0.5, by + nh + 12],
        [bx - nw * 0.5, by + nh],
        [bx - nw * 0.5, by + 10],
        [bx - nw * 0.6, by + 6],
        [bx - nw * 0.6, by],
        [bx + nw * 0.6, by],
        [bx + nw * 0.6, by + 6],
        [bx + nw * 0.5, by + 10],
        [bx + nw * 0.5, by + nh],
        [bx + bw * 0.5, by + nh + 12],
        [bx + bw * 0.48, by + bh],
      ];

      if (hairline) {
        g.strokeStyle = c.ink;
        g.lineWidth = hw * 1.2;
        g.stroke(toPath(bottlePts, true));
        // Cork
        g.stroke(toPath(rect(bx - nw * 0.4, by - 12, bx + nw * 0.4, by)));
        // Vertical curvature hatching
        hatch(g, bottlePts, { angle: 1.57, spacing: 3.2, width: hw * 0.6, color: c.pencil, alpha: 0.45, seed: b.x });
      } else {
        // Cast shadow on sill
        g.save();
        g.fillStyle = 'rgba(8, 5, 2, 0.45)';
        g.beginPath();
        g.ellipse(bx, by + bh - 3, bw * 0.52, 9, 0, 0, TAU);
        g.fill();
        g.restore();

        // Bottle body wash
        const bottleColor = b.glass === 'green' ? c.bottleGreen : b.glass === 'olive' ? c.bottleOlive : c.bottleAmber;
        wash(g, bottlePts, { color: bottleColor, alpha: 0.95 });

        // Glass cylindrical shadow on right side
        hatch(g, bottlePts, {
          angle: 1.57,
          spacing: 3.0,
          width: 0.75,
          color: '#08120b',
          alpha: 0.42,
          seed: bx,
          density: (x) => smoothstep(bx - bw * 0.1, bx + bw * 0.45, x),
        });

        // Caustic slit highlights
        // Left reflection
        const slitLeft = [
          [bx - bw * 0.38, by + bh - 8],
          [bx - bw * 0.38, by + nh + 15],
          [bx - nw * 0.35, by + nh],
          [bx - nw * 0.35, by + 6],
        ];
        ink(g, slitLeft, { width: 2.2, color: 'rgba(255, 255, 240, 0.55)', closed: false, seed: bx + 1 });
        // Right ambient caustic reflection
        const slitRight = [
          [bx + bw * 0.35, by + bh - 10],
          [bx + bw * 0.35, by + nh + 18],
        ];
        ink(g, slitRight, { width: 1.4, color: 'rgba(255, 220, 160, 0.35)', closed: false, seed: bx + 2 });

        // Cork stopper
        const corkRect = rect(bx - nw * 0.42, by - 14, bx + nw * 0.42, by + 2);
        wash(g, corkRect, { color: '#ab8358', alpha: 0.92 });
        ink(g, corkRect, { width: 1.2, color: '#3b2512', closed: true, seed: bx + 3 });

        // Outer glass contour
        ink(g, bottlePts, { width: 1.6, color: '#09140c', alpha: 0.9, closed: true, seed: bx + 4 });
      }
    }
  }

  // ── Dynamic elements (rain, rivulets, bulb, chimes, wipes) ─────────────────
  /**
   * Somebody going past under a covered lantern, seen through the glass.
   * Clipped to the window opening, because they are outside.
   */
  function drawPasserby(g, d, mode) {
    const p = d.passerby;
    if (!p || p.glow <= 0.01 || mode === 'hair') return;
    const h = p.height;
    const x = p.x;
    const fy = p.feet;
    const swing = p.swing;

    g.save();
    g.beginPath();
    g.rect(WINDOW.x0 + WINDOW.frame, WINDOW.y0 + WINDOW.frame, WINDOW.x1 - WINDOW.x0 - 2 * WINDOW.frame, WINDOW.y1 - WINDOW.y0 - 2 * WINDOW.frame);
    g.clip();

    // The lantern and the pool of light it throws on the wet stones. This is the
    // nearest and brightest thing in the alley, so it is not a small dot.
    g.globalCompositeOperation = 'lighter';
    const glow = g.createRadialGradient(p.lampX, p.lampY, 4, p.lampX, p.lampY, 250);
    glow.addColorStop(0, `rgba(255,232,180,${0.8 * p.glow})`);
    glow.addColorStop(0.28, `rgba(255,204,124,${0.34 * p.glow})`);
    glow.addColorStop(1, 'rgba(255,180,90,0)');
    g.fillStyle = glow;
    g.fillRect(p.lampX - 260, p.lampY - 260, 520, 520);

    g.globalCompositeOperation = 'source-over';
    const inkCol = '#0e1018';

    // Legs, coat, head. A silhouette with the lamp above and to the right of it.
    g.fillStyle = inkCol;
    g.beginPath();
    g.moveTo(x - 16, fy);
    g.lineTo(x - 13, fy - h * 0.46);
    g.lineTo(x + 13, fy - h * 0.46);
    g.lineTo(x + 16, fy);
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(x, fy - h * 0.62, 17, 26, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(x + swing * 12, fy - h * 0.86, 9.5, 0, TAU);
    g.fill();

    // The arm up to the lantern hoop.
    g.strokeStyle = inkCol;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x + 8, fy - h * 0.66);
    g.lineTo(p.lampX, p.lampY - 14);
    g.stroke();

    // A warm rim down the lantern side of the coat, and the lamp itself.
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(255,216,150,${0.6 * p.glow})`;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(x + 16, fy - 6);
    g.lineTo(x + 13, fy - h * 0.46);
    g.lineTo(x + 17, fy - h * 0.62);
    g.stroke();
    // The lantern itself: a little glass box with a hoop, not a bare dot.
    g.fillStyle = `rgba(255,244,214,${0.95 * p.glow})`;
    g.beginPath();
    g.arc(p.lampX, p.lampY, 8, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = `rgba(40,32,20,${0.85 * p.glow})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(p.lampX, p.lampY, 11, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(p.lampX, p.lampY - 11, 4, Math.PI, TAU);
    g.stroke();
    g.restore();
  }

  /**
   * The shadow the passing lamp throws through the bars, across the sill and up
   * the bottles. The bars sweep apart either side of the lamp and close again
   * behind it, which is what shadows of this kind do.
   */
  function drawBarShadows(g, d, mode) {
    const p = d.passerby;
    if (!p || p.glow <= 0.01 || mode === 'hair') return;
    const top = 372;
    const spans = [WINDOW.x0 + WINDOW.frame, ...WINDOW.bars, WINDOW.x1 - WINDOW.frame];

    // First the light itself, so there is something for the bars to interrupt.
    // A dark room cannot be made darker by multiplying, so the contrast has to be
    // built by lighting the panes and then laying the shadow over them.
    g.save();
    g.globalCompositeOperation = 'lighter';
    const spill = g.createRadialGradient(p.lampX, 700, 20, p.lampX, 720, 420);
    spill.addColorStop(0, `rgba(255,216,156,${0.34 * p.glow})`);
    spill.addColorStop(0.5, `rgba(255,202,128,${0.12 * p.glow})`);
    spill.addColorStop(1, 'rgba(255,196,120,0)');
    g.fillStyle = spill;
    g.fillRect(p.lampX - 440, top, 880, H - top);
    g.restore();

    // Then the bars, thrown across it. They open away from the lamp and close
    // again behind it, which is what shadows of this kind do.
    g.save();
    for (const bx of spans) {
      const shift = Math.max(-1, Math.min(1, (p.lampX - bx) / 420)) * 150;
      const sx = bx + shift;
      // About the width the bar actually throws, with a hard core rather than a
      // soft wash, because a bar twenty eight pixels wide does not cast a
      // hundred pixel gradient.
      const w = WINDOW.frame * 0.95;
      const grad = g.createLinearGradient(sx - w, 0, sx + w, 0);
      grad.addColorStop(0, 'rgba(8,6,14,0)');
      grad.addColorStop(0.3, `rgba(8,6,14,${0.75 * p.glow})`);
      grad.addColorStop(0.7, `rgba(8,6,14,${0.75 * p.glow})`);
      grad.addColorStop(1, 'rgba(8,6,14,0)');
      g.fillStyle = grad;
      g.fillRect(sx - w, top, w * 2, H - top);
    }
    g.restore();
  }

  function drawDynamic(g, d, mode, still) {
    const c = palette();
    const hw = hair();
    const hairline = mode === 'hair';

    // 0. Somebody going past outside, before the rain falls in front of them.
    drawPasserby(g, d, mode);

    // 1. Outside Rain Streaks (passing through window)
    if (!hairline && d.rainStreaks.length > 0) {
      g.save();
      // Clip to window opening so rain only falls through the glass
      g.beginPath();
      g.rect(WINDOW.x0 + WINDOW.frame, WINDOW.y0 + WINDOW.frame, (WINDOW.x1 - WINDOW.x0) - 2 * WINDOW.frame, (WINDOW.y1 - WINDOW.y0) - 2 * WINDOW.frame);
      g.clip();

      for (const s of d.rainStreaks) {
        g.strokeStyle = s.bright ? 'rgba(255, 235, 175, 0.75)' : 'rgba(175, 195, 220, 0.4)';
        g.lineWidth = s.bright ? 1.6 : 1.1;
        g.beginPath();
        g.moveTo(s.x1, s.y1);
        g.lineTo(s.x2, s.y2);
        g.stroke();
      }
      g.restore();
    }

    // 2. Condensation Mist Layer on Window Glass
    if (!hairline && d.condensation.fogAlpha > 0.02) {
      g.save();
      // Clip to window glass
      g.beginPath();
      g.rect(WINDOW.x0 + WINDOW.frame, WINDOW.y0 + WINDOW.frame, (WINDOW.x1 - WINDOW.x0) - 2 * WINDOW.frame, (WINDOW.y1 - WINDOW.y0) - 2 * WINDOW.frame);
      g.clip();

      // Render condensation mist
      g.fillStyle = `rgba(225, 235, 245, ${d.condensation.fogAlpha.toFixed(3)})`;
      g.fillRect(WINDOW.x0, WINDOW.y0, WINDOW.x1 - WINDOW.x0, WINDOW.y1 - WINDOW.y0);

      // Wiped condensation paths (clear areas where finger wiped)
      if (wipes.length > 0) {
        g.save();
        g.globalCompositeOperation = 'destination-out';
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.lineWidth = 38;
        for (const wp of wipes) {
          if (wp.points.length < 2) continue;
          g.beginPath();
          wp.points.forEach((pt, i) => (i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1])));
          g.stroke();
        }
        g.restore();
      }

      g.restore();
    }

    // 3. Meandering Rivulets on Glass
    for (const riv of d.rivulets) {
      if (hairline) {
        g.strokeStyle = c.pencil;
        g.lineWidth = hw * 0.7;
        g.beginPath();
        riv.trail.forEach((pt, i) => (i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1])));
        g.stroke();
        g.strokeStyle = c.ink;
        g.beginPath();
        g.arc(riv.x, riv.y, riv.r, 0, TAU);
        g.stroke();
      } else {
        // Wet trail line
        if (riv.trail.length > 1) {
          g.save();
          g.strokeStyle = 'rgba(165, 195, 225, 0.45)';
          g.lineWidth = riv.r * 0.75;
          g.lineCap = 'round';
          g.lineJoin = 'round';
          g.beginPath();
          riv.trail.forEach((pt, i) => (i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1])));
          g.stroke();
          g.restore();
        }

        // Droplet head: clear water bead with highlight
        g.save();
        g.fillStyle = 'rgba(180, 210, 235, 0.55)';
        g.beginPath();
        g.arc(riv.x, riv.y, riv.r, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(40, 60, 80, 0.5)';
        g.lineWidth = 0.9;
        g.stroke();

        // Droplet specular glint
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(riv.x - riv.r * 0.35, riv.y - riv.r * 0.35, riv.r * 0.32, 0, TAU);
        g.fill();
        g.restore();
      }
    }

    // 4. Hanging Filament Bulb
    const bulb = d.lamp.bulb;
    if (hairline) {
      g.strokeStyle = c.ink;
      g.lineWidth = hw * 1.2;
      // Cord
      g.beginPath();
      g.moveTo(bulb.x, 0);
      g.lineTo(bulb.x, bulb.cordY);
      g.stroke();
      // Socket & bulb
      g.stroke(toPath(rect(bulb.x - 7, bulb.cordY, bulb.x + 7, bulb.bulbY - 10)));
      g.beginPath();
      g.arc(bulb.x, bulb.bulbY, bulb.r, 0, TAU);
      g.stroke();
      // Filament loop
      g.beginPath();
      g.arc(bulb.x, bulb.bulbY + 2, 6, Math.PI, 0);
      g.stroke();
    } else {
      // Warm halo wash illuminating the room
      const haloR = bulb.glowR * (0.9 + 0.1 * d.lamp.intensity);
      const haloGrad = g.createRadialGradient(bulb.x, bulb.bulbY, 8, bulb.x, bulb.bulbY, haloR);
      haloGrad.addColorStop(0, `rgba(255, 195, 80, ${(0.65 * d.lamp.intensity).toFixed(3)})`);
      haloGrad.addColorStop(0.35, `rgba(240, 160, 50, ${(0.28 * d.lamp.intensity).toFixed(3)})`);
      haloGrad.addColorStop(0.7, `rgba(220, 120, 30, ${(0.1 * d.lamp.intensity).toFixed(3)})`);
      haloGrad.addColorStop(1, 'rgba(200, 100, 20, 0)');
      g.save();
      g.fillStyle = haloGrad;
      g.beginPath();
      g.arc(bulb.x, bulb.bulbY, haloR, 0, TAU);
      g.fill();
      g.restore();

      // Twisted cord
      ink(g, [[bulb.x, 0], [bulb.x, bulb.cordY]], { width: 3.2, color: '#161412', alpha: 0.95, closed: false, seed: 70 });

      // Brass socket
      const sockRect = rect(bulb.x - 7, bulb.cordY, bulb.x + 7, bulb.bulbY - 8);
      wash(g, sockRect, { color: '#c9983d', alpha: 0.95 });
      ink(g, sockRect, { width: 1.2, color: '#3d2b0e', closed: true, seed: 71 });

      // Glass bulb envelope
      g.save();
      g.fillStyle = 'rgba(255, 245, 210, 0.45)';
      g.beginPath();
      g.arc(bulb.x, bulb.bulbY, bulb.r, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(80, 50, 20, 0.4)';
      g.lineWidth = 1.2;
      g.stroke();

      // Glowing coiled tungsten filament
      g.strokeStyle = '#fff8e0';
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(bulb.x, bulb.bulbY + 2, 6, Math.PI, 0);
      g.stroke();
      g.strokeStyle = '#ffb020';
      g.lineWidth = 4.2;
      g.stroke();
      g.restore();
    }

    // 5. Bottle Acoustic Chime Waves (Playful)
    for (const ch of d.chimes) {
      g.save();
      g.strokeStyle = `rgba(255, 210, 110, ${ch.alpha.toFixed(3)})`;
      g.lineWidth = 2.2;
      g.beginPath();
      g.arc(ch.x, ch.y, ch.r, 0, TAU);
      g.stroke();

      g.strokeStyle = `rgba(255, 240, 180, ${(ch.alpha * 0.6).toFixed(3)})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(ch.x, ch.y, ch.r * 0.72, 0, TAU);
      g.stroke();
      g.restore();
    }

    // 6. Distant monsoon lightning flash outside
    if (!hairline && !still) {
      const t = d.time;
      const flash = smoothstep(0.96, 1.0, Math.sin(t * 0.8)) * smoothstep(0.8, 1.0, Math.sin(t * 5.3));
      if (flash > 0.02) {
        g.save();
        g.beginPath();
        g.rect(WINDOW.x0 + WINDOW.frame, WINDOW.y0 + WINDOW.frame, (WINDOW.x1 - WINDOW.x0) - 2 * WINDOW.frame, (WINDOW.y1 - WINDOW.y0) - 2 * WINDOW.frame);
        g.clip();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(190, 215, 255, ${(flash * 0.35 * d.params.rain).toFixed(3)})`;
        g.fillRect(WINDOW.x0, WINDOW.y0, WINDOW.x1 - WINDOW.x0, WINDOW.y1 - WINDOW.y0);
        g.restore();
      }
    }
  }

  // ── Renderer interface ───────────────────────────────────────────────────
  return {
    render(data, frame) {
      const mode = reg === 'quiet' ? 'hair' : 'ink';
      const still = frame?.still || reg === 'quiet';
      const t = frame?.time ?? 0;

      // Handle playful wipe interaction
      if (reg === 'playful' && !still && frame?.pointer?.down && frame?.pointer?.inside) {
        const pt = [frame.pointer.x, frame.pointer.y];
        if (!currentWipe) {
          currentWipe = { points: [pt], t0: t };
          wipes.push(currentWipe);
        } else {
          currentWipe.points.push(pt);
        }
      } else {
        currentWipe = null;
      }

      // Re-run model with active chimes and wipes
      const d = model({
        time: t,
        seed,
        register: reg,
        params: data?.params ?? {},
        W,
        H,
        chimes,
        wipes,
      });

      // Cull expired chimes
      if (chimes.length > 0) {
        chimes = chimes.filter(c => t - c.t0 < 2.2);
      }

      const kb = frame?.pointer?.keyboard && frame?.pointer?.inside && reg === 'playful'
        ? `${frame.pointer.x | 0},${frame.pointer.y | 0}`
        : '';
      const key = `${mode}|${isDark()}|${d.seed}|${d.params.rain}|${d.params.lamp}|${d.params.steamer}|${d.settled}|${t.toFixed(2)}|${wipes.length}|${chimes.length}|${kb}`;
      if (key === lastKey && d.settled) return;
      lastKey = key;

      const g = st.begin();

      // Blit cached background alley & streetlamp
      st.blit(st.cached(`alley|${mode}|${isDark()}|${d.seed}`, gg => drawAlleyBackground(gg, mode, d)));

      // Draw dynamic rain streaks outside through the window
      drawDynamic(g, d, mode, still);

      // Blit cached window frame, bars & wooden sill
      st.blit(st.cached(`window|${mode}|${isDark()}|${d.seed}`, gg => drawWindowFrame(gg, mode)));

      // Blit cached still life on window sill
      st.blit(st.cached(`stillLife|${mode}|${isDark()}|${d.seed}`, gg => drawStillLife(gg, mode, d)));

      // The passing lamp laying the bars across the sill and up the bottles
      drawBarShadows(g, d, mode);

      // Keyboard focus indicator
      if (kb) {
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
      invalidate?.();
    },

    restyle() {
      colors = null;
      st.memo.clear();
      lastKey = '';
      invalidate?.();
    },

    /**
     * Click, Enter or Space in playful register:
     * Chime the clicked bottle (or nearest bottle on keyboard), or wipe window.
     */
    activate(p) {
      if (reg !== 'playful') return;

      const targetX = p ? p.x : W / 2;
      const targetY = p ? p.y : H / 2;

      // Check hit on bottles or jug
      let hitItem = null;
      let minDist = Infinity;

      for (const item of [...BOTTLES, JUG]) {
        const hx = item.x;
        const hy = item.y + item.h / 2;
        const dist = Math.hypot(targetX - hx, targetY - hy);
        if (p?.keyboard) {
          if (dist < minDist) {
            minDist = dist;
            hitItem = item;
          }
        } else {
          const withinX = Math.abs(targetX - item.x) <= item.w * 0.6;
          const withinY = targetY >= item.y && targetY <= item.y + item.h + 20;
          if (withinX && withinY) {
            hitItem = item;
            break;
          }
        }
      }

      if (hitItem) {
        const chime = {
          x: hitItem.x,
          y: hitItem.y + hitItem.h * 0.4,
          t0: performance.now() / 1000,
          bottleId: hitItem.id,
          freq: hitItem.chimeFreq || 520,
        };
        chimes.push(chime);
        playChimeAudio(hitItem.chimeFreq);
        invalidate?.();
      } else if (targetY < WINDOW.sill.y) {
        // Wipe a spot of condensation on glass
        wipes.push({
          points: [
            [targetX - 20, targetY - 15],
            [targetX + 15, targetY + 10],
            [targetX + 5, targetY - 20],
          ],
          t0: performance.now() / 1000,
        });
        invalidate?.();
      }
    },

    destroy() {
      st.destroy();
      try {
        audioCtx?.close();
      } catch {
        // safe cleanup
      }
    },
  };
}
