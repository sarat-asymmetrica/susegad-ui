// Kantar: the canvas renderer.
//
// Draws the tiatr stage: proscenium arch with gold-fringed pelmet, footlights,
// orchestra pit silhouettes, three painted backdrops (church square, dusk beach,
// and balcão at night), heavy red velvet curtain with vertical folds and damped
// ripple wave on landing, and spotlight with singer silhouette.
//
// Pure canvas rendering: no text inside the canvas! Lyrics and scene titles are
// rendered into DOM elements and polite live regions for accessibility.

import {
  stage,
  wash,
  ink,
  hatch,
  ellipse,
  catmull,
  N,
  rng,
  lerp,
  clamp,
  TAU,
  boil,
} from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { drawCurtain, hemBreath } from '../../curtain/curtain.js';
import {
  W,
  H,
  OPEN,
  APRON,
  SCENES,
  SONGS,
  nextPhase,
  heroNext,
} from './model.js';

const INK_COLOR = '#1d2742';

// ── Backdrops (cached on offscreen canvases) ──────────────────────────────

/**
 * A painted flat: a scenic canvas shape, not a filled vector path.
 *
 * Three things stop it reading as a cut-out. The wash carries a top-to-bottom
 * falloff so the form has a top and a bottom. The right edge takes a shade,
 * because the lamps in this house hang on the left. And the outline is brushed
 * twice, a wide soft pass under a narrow dark one, the way a brush loaded with
 * colour leaves it.
 */
function flat(g, pts, color, seed, o = {}) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  }

  wash(g, pts, { color, alpha: 1 });

  g.save();
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
  g.clip();

  // The form: lit along the top, sitting down into its own shade at the ground.
  const form = g.createLinearGradient(0, y0, 0, y1);
  form.addColorStop(0, 'rgba(255,247,224,0.12)');
  form.addColorStop(0.5, 'rgba(255,247,224,0)');
  form.addColorStop(1, 'rgba(26,18,32,0.22)');
  g.fillStyle = form;
  g.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);

  // The shade down the right side, which is what gives a flat a face.
  const side = g.createLinearGradient(x1 - Math.max(18, (x1 - x0) * 0.35), 0, x1 + 2, 0);
  side.addColorStop(0, 'rgba(26,18,32,0)');
  side.addColorStop(1, 'rgba(26,18,32,0.20)');
  g.fillStyle = side;
  g.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);
  g.restore();

  const w = o.w ?? 1.4;
  ink(g, pts, {
    width: w * 2.2,
    color: INK_COLOR,
    alpha: 0.2,
    jitter: 1.6,
    freq: 0.06,
    pressure: 0.5,
    seed: seed + 7,
    closed: true,
  });
  ink(g, pts, {
    width: w,
    color: INK_COLOR,
    alpha: 0.72,
    jitter: 0.6,
    pressure: 0.35,
    seed,
    closed: true,
  });
}

/**
 * The shadow a painted flat drops forward onto the boards behind it.
 *
 * Every set is lit from the upper left, so every set throws its shadow to the
 * lower right. This one thing does more for the depth of a stage than any amount
 * of extra drawing on the flats themselves.
 */
function groundShadow(g, x0, y, x1, dx, depth, alpha = 0.26, color = '#241d2e') {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1, y);
  g.lineTo(x1 + dx, y + depth);
  g.lineTo(x0 + dx * 0.55, y + depth * 0.7);
  g.closePath();
  g.fill();
  g.restore();
}

/**
 * The finish on a painted backdrop cloth.
 *
 * A tiatr backdrop is a scenic canvas on a frame: it has a weave, a sag under
 * the pelmet, and the lamps reach the middle of it and leave the wings cool.
 * Without these three things the sets read as vector cutouts, which is exactly
 * what they are not.
 */
function clothFinish(g, seed) {
  const { x0, x1, y0, y1 } = OPEN;
  const face = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  hatch(g, face, { angle: 0.02, spacing: 7, width: 0.5, color: '#2a2416', alpha: 0.055, seed: seed + 60 });
  hatch(g, face, { angle: 1.55, spacing: 7, width: 0.5, color: '#2a2416', alpha: 0.04, seed: seed + 61 });

  const lamp = g.createRadialGradient(600, 440, 40, 600, 430, 540);
  lamp.addColorStop(0, 'rgba(255,236,196,0.15)');
  lamp.addColorStop(0.6, 'rgba(255,226,180,0.04)');
  lamp.addColorStop(1, 'rgba(28,24,48,0.20)');
  g.fillStyle = lamp;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);

  const sag = g.createLinearGradient(0, y0, 0, y0 + 76);
  sag.addColorStop(0, 'rgba(34,20,26,0.34)');
  sag.addColorStop(1, 'rgba(34,20,26,0)');
  g.fillStyle = sag;
  g.fillRect(x0, y0, x1 - x0, 76);
}

/**
 * A soft wash band, used to break a flat gradient into something painted.
 */
function washBand(g, pts, color, alpha, seed) {
  wash(g, pts, { color, alpha, grainy: true });
  hatch(g, pts, { angle: 0.9, spacing: 5, width: 0.6, color, alpha: alpha * 0.5, seed, seg: [6, 16] });
}


function setChurch(g) {
  const { x0, x1, y0, y1 } = OPEN;
  const sky = g.createLinearGradient(0, y0, 0, y1);
  sky.addColorStop(0, '#8fb6d6');
  sky.addColorStop(1, '#e9e1c4');
  g.fillStyle = sky;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);

  // The church: twin towers, triangular pediment, blue door
  const cx = 600;
  const base = 560;

  flat(g, [[cx - 150, base], [cx - 150, 330], [cx + 150, 330], [cx + 150, base]], '#f4efe3', 1);
  flat(g, [[cx - 150, 330], [cx, 262], [cx + 150, 330]], '#f4efe3', 2);

  for (const s of [-1, 1]) {
    const tx = cx + s * 150;
    flat(g, [[tx - 36, base], [tx - 36, 250], [tx + 36, 250], [tx + 36, base]], '#f4efe3', 3 + s);
    const archTop = ellipse(tx, 250, 30, 34, { start: Math.PI, end: TAU, n: 12 }).slice(1, -1);
    flat(g, [[tx - 30, 250], ...archTop, [tx + 30, 250]], '#e8e0cf', 5 + s);
    const belfry = ellipse(tx, 278, 10, 10, { start: Math.PI, end: TAU, n: 8 }).slice(1, -1);
    flat(g, [[tx - 10, 300], [tx - 10, 278], ...belfry, [tx + 10, 278], [tx + 10, 300]], '#3a4a6e', 7 + s, { w: 1 });
  }

  const doorArch = ellipse(cx, 430, 34, 34, { start: Math.PI, end: TAU, n: 14 }).slice(1, -1);
  flat(g, [[cx - 34, base], [cx - 34, 430], ...doorArch, [cx + 34, 430], [cx + 34, base]], '#3d6fa8', 9);
  ink(g, [[cx, 262], [cx, 222]], { width: 3, color: INK_COLOR, jitter: 0.2, seed: 10, taper: 0 });
  ink(g, [[cx - 13, 236], [cx + 13, 236]], { width: 3, color: INK_COLOR, jitter: 0.2, seed: 11, taper: 0 });

  // A rose window over the door, and two arched lights beside it. A blank white
  // rectangle is the one thing that would read as a shape rather than a church.
  g.save();
  g.fillStyle = '#2b3f63';
  g.beginPath();
  g.arc(cx, 392, 30, 0, TAU);
  g.fill();
  wash(g, ellipse(cx, 392, 30, 30, { n: 20 }), { color: '#3d5c8c', alpha: 0.95 });
  g.strokeStyle = '#e8e0cd';
  g.lineWidth = 2.6;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    g.beginPath();
    g.moveTo(cx, 392);
    g.lineTo(cx + Math.cos(a) * 27, 392 + Math.sin(a) * 27);
    g.stroke();
  }
  ink(g, ellipse(cx, 392, 30, 30, { n: 20 }), { width: 2.4, color: INK_COLOR, alpha: 0.8, jitter: 0.3, seed: 19, closed: true });
  g.restore();

  for (const s of [-1, 1]) {
    const wx = cx + s * 96;
    const archTop = ellipse(wx, 396, 15, 17, { start: Math.PI, end: TAU, n: 10 }).slice(1, -1);
    flat(g, [[wx - 15, base], [wx - 15, 396], ...archTop, [wx + 15, 396], [wx + 15, base]], '#3b5578', 21 + s);
    hatch(g, [[wx - 15, 410], [wx + 15, 410], [wx + 15, base], [wx - 15, base]], {
      angle: 1.5,
      spacing: 4,
      width: 0.6,
      color: '#1d2c44',
      alpha: 0.45,
      seed: 23 + s,
    });
  }

  // Cornice and plinth: the two horizontal bands that stop a church reading tall.
  flat(g, [[cx - 162, 344], [cx + 162, 344], [cx + 162, 358], [cx - 162, 358]], '#ded5c0', 25, { w: 1.1 });
  flat(g, [[cx - 158, 534], [cx + 158, 534], [cx + 158, base], [cx - 158, base]], '#cfc4ab', 26, { w: 1.1 });

  // A bell in the left tower, and none in the right, which is how a village
  // church always is.
  g.fillStyle = '#b98a3e';
  g.beginPath();
  g.moveTo(cx - 156, 300);
  g.quadraticCurveTo(cx - 150, 278, cx - 144, 300);
  g.closePath();
  g.fill();

  // Village houses as stage wings, one ochre, one blue
  flat(g, [[x0, y1], [x0, 380], [x0 + 190, 380], [x0 + 190, y1]], '#e0a53c', 12);
  flat(g, [[x0 - 10, 384], [x0 + 95, 320], [x0 + 200, 384]], '#a8432b', 13);
  flat(g, [[x1 - 190, y1], [x1 - 190, 400], [x1, 400], [x1, y1]], '#6f9fc9', 14);
  flat(g, [[x1 - 200, 404], [x1 - 95, 344], [x1 + 10, 404]], '#a8432b', 15);

  for (const [x, y] of [[x0 + 50, 440], [x0 + 120, 440], [x1 - 140, 450], [x1 - 70, 450]]) {
    flat(g, [[x, y], [x + 30, y], [x + 30, y + 44], [x, y + 44]], '#f4efe3', x, { w: 1 });
  }

  // Stone cross on laterite plinth
  flat(g, [[430, base], [430, 520], [470, 520], [470, base]], '#f4efe3', 16);
  ink(g, [[450, 520], [450, 454]], { width: 4, color: INK_COLOR, jitter: 0.2, seed: 17, taper: 0 });
  ink(g, [[434, 474], [466, 474]], { width: 4, color: INK_COLOR, jitter: 0.2, seed: 18, taper: 0 });

  // Every flat drops a shadow forward onto the boards. One light, upper left.
  groundShadow(g, x0, y1, x0 + 190, 26, 52);
  groundShadow(g, x1 - 190, y1, x1, 26, 52);
  groundShadow(g, 430, base, 750, 34, 62, 0.3);
  groundShadow(g, 430, 560, 470, 20, 30, 0.22);

  // Broom-swept square: the strokes a stagehand leaves on a painted floor.
  washBand(g, [[450, 560], [750, 560], [790, y1], [410, y1]], '#cfc4a4', 0.3, 71);

  clothFinish(g, 1);
}

function setBeach(g) {
  const { x0, x1, y0, y1 } = OPEN;
  const sky = g.createLinearGradient(0, y0, 0, 430);
  sky.addColorStop(0, '#5a5f8f');
  sky.addColorStop(0.6, '#d98a6a');
  sky.addColorStop(1, '#f2c48a');
  g.fillStyle = sky;
  g.fillRect(x0, y0, x1 - x0, 430 - y0);

  // Setting sun
  g.fillStyle = '#f7d9a0';
  g.beginPath();
  g.arc(640, 420, 44, Math.PI, TAU);
  g.fill();

  // Arabian sea
  const sea = g.createLinearGradient(0, 430, 0, 500);
  sea.addColorStop(0, '#6d7fa8');
  sea.addColorStop(1, '#3e5a7a');
  g.fillStyle = sea;
  g.fillRect(x0, 428, x1 - x0, 76);

  // Gentle wave crests
  for (let k = 0; k < 7; k++) {
    ink(g, [[x0 + 40 + k * 120, 446 + (k % 3) * 16], [x0 + 110 + k * 120, 446 + (k % 3) * 16]], {
      width: 1.4,
      color: '#f7d9a0',
      alpha: 0.6,
      jitter: 0.4,
      seed: 20 + k,
      taper: 10,
    });
  }

  // Sandy shore with subtle hatching
  flat(g, [[x0, 500], [x1, 494], [x1, y1], [x0, y1]], '#e3c28b', 21);
  hatch(g, [[x0, 500], [x1, 494], [x1, y1], [x0, y1]], {
    angle: 0.1,
    spacing: 6,
    color: '#8a6a3a',
    alpha: 0.25,
    seed: 22,
    width: 0.7,
  });

  // Rampon fishing canoe on the sand
  const boat = [[470, 540], [760, 540], [730, 568], [500, 568]];
  flat(g, boat, '#7a4a2a', 23);
  ink(g, [[480, 546], [750, 546]], { width: 1.2, color: '#f0e0c0', alpha: 0.6, jitter: 0.3, seed: 24, taper: 6 });
  ink(g, [[520, 536], [560, 506], [700, 506], [720, 536]], { width: 2, color: INK_COLOR, alpha: 0.8, jitter: 0.3, seed: 25, taper: 0 });

  // Coconut palms framing the wings
  for (const [px, lean, palmSeed] of [[x0 + 60, 0.16, 1], [x1 - 70, -0.2, 2]]) {
    const top = [px + lean * 300, 250];
    ink(g, catmull([[px, y1], [px + lean * 120, 440], top], 8), {
      width: 12,
      color: '#4a3a2a',
      jitter: 0.6,
      seed: palmSeed + 30,
      taper: 20,
    });
    const r = rng(`beachpalm${palmSeed}`);
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i / 7 - 0.5) * 3.6;
      const len = r.range(90, 130);
      const pts = [];
      for (let s = 0; s <= 8; s++) {
        const u = s / 8;
        pts.push([top[0] + Math.cos(a) * len * u, top[1] + Math.sin(a) * len * u + u * u * 50]);
      }
      ink(g, pts, { width: 9, color: '#2f4a2a', jitter: 0.5, seed: palmSeed * 10 + i, taper: 30 });
    }
  }

  // Wet sand where the tide just went out, a dry band above it.
  washBand(g, [[x0, 494], [x1, 488], [x1, 512], [x0, 518]], '#8d7a5e', 0.22, 63);
  hatch(g, [[x0, 496], [x1, 490]], { angle: 0.05, spacing: 3, width: 0.7, color: '#f6e6c8', alpha: 0.4, seed: 64 });

  groundShadow(g, 500, 568, 730, 26, 34);
  groundShadow(g, x0 + 52, y1, x0 + 68, 18, 44, 0.2);
  groundShadow(g, x1 - 78, y1, x1 - 62, 18, 44, 0.2);

  clothFinish(g, 2);
}

function setBalcao(g) {
  const { x0, x1, y0, y1 } = OPEN;
  g.fillStyle = '#1e2440';
  g.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Starry night sky
  const r = rng('balcao-stars');
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255,244,214,${r.range(0.3, 0.9)})`;
    g.beginPath();
    g.arc(r.range(x0, x1), r.range(y0, 330), r.range(0.6, 1.5), 0, TAU);
    g.fill();
  }

  // Goan house front: red laterite wall, white pilasters, balcão stone seats
  flat(g, [[x0 + 80, y1], [x0 + 80, 300], [x1 - 80, 300], [x1 - 80, y1]], '#b5523a', 40);
  flat(g, [[x0 + 50, 306], [600, 240], [x1 - 50, 306]], '#7a2e22', 41);
  hatch(g, [[x0 + 50, 306], [600, 240], [x1 - 50, 306]], {
    angle: 1.5,
    spacing: 5,
    color: '#2a0f0a',
    alpha: 0.4,
    seed: 42,
    width: 0.8,
    seg: [4, 9],
    gap: 0.2,
  });

  for (const x of [x0 + 80, 420, 780, x1 - 110]) {
    flat(g, [[x, y1], [x, 300], [x + 30, 300], [x + 30, y1]], '#f1ebdd', x);
  }

  const doorArch = ellipse(600, 380, 80, 70, { start: Math.PI, end: TAU, n: 16 }).slice(1, -1);
  flat(g, [[520, y1], [520, 380], ...doorArch, [680, 380], [680, y1]], '#3a2a1e', 43);

  // Warm glowing interior light in doorway
  const dg = g.createRadialGradient(600, 470, 10, 600, 470, 110);
  dg.addColorStop(0, 'rgba(255,200,120,0.85)');
  dg.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = dg;
  g.fillRect(500, 360, 200, 250);

  // Balcão masonry seats
  for (const s of [-1, 1]) {
    const bx = 600 + s * 200;
    flat(g, [[bx - 90, y1], [bx - 90, 540], [bx + 90, 540], [bx + 90, y1]], '#f1ebdd', 44 + s);
    flat(g, [[bx - 96, 540], [bx + 96, 540], [bx + 96, 528], [bx - 96, 528]], '#d9cdb4', 46 + s, { w: 1 });
  }

  // Brass lamp hanging from the eaves
  ink(g, [[600, 272], [600, 312]], { width: 1.2, color: INK_COLOR, jitter: 0.2, seed: 48, taper: 0 });
  wash(g, ellipse(600, 322, 12, 14), { color: '#f2c060', alpha: 1 });

  // The lamp lays a pool of warm light across the balcão stones.
  const pool = g.createRadialGradient(600, 540, 12, 600, 560, 330);
  pool.addColorStop(0, 'rgba(255,208,130,0.22)');
  pool.addColorStop(1, 'rgba(255,208,130,0)');
  g.fillStyle = pool;
  g.fillRect(x0, 380, x1 - x0, y1 - 380);

  groundShadow(g, x0 + 80, 620, x1 - 80, 30, 58, 0.22);
  groundShadow(g, 504, 660, 696, 20, 26, 0.2);

  clothFinish(g, 3);
}

const SET_PAINTERS = [setChurch, setBeach, setBalcao];

// ── The Auditorium & Proscenium ───────────────────────────────────────────

function house(g, dark = false) {
  const { x0, x1, y0 } = OPEN;

  // Dark auditorium surround (opaque over the whole canvas, so a paper grain under it was 50 ms of paint nobody saw)
  g.fillStyle = dark ? '#0c080e' : '#231a24';
  g.fillRect(0, 0, W, H);

  // Proscenium frame: painted pillars and arch
  const frame = [
    [x0 - 60, APRON + 10],
    [x0 - 60, y0 - 70],
    [x1 + 60, y0 - 70],
    [x1 + 60, APRON + 10],
    [x1, APRON + 10],
    [x1, y0],
    [x0, y0],
    [x0, APRON + 10],
  ];
  wash(g, frame, { color: '#c9a560', alpha: 1, grainy: false });
  hatch(g, frame, { angle: 0.8, spacing: 4, color: '#5a3a14', alpha: 0.35, seed: 3, width: 0.7 });
  ink(g, frame, { width: 1.6, color: INK_COLOR, jitter: 0.5, seed: 4, closed: true });

  // Center arch ornamental sunburst crest (no canvas text!)
  wash(g, ellipse(600, y0 - 32, 26, 16, { n: 16 }), { color: '#e8a33a', alpha: 0.95 });
  hatch(g, ellipse(600, y0 - 32, 26, 16, { n: 16 }), { angle: 0.5, spacing: 3, color: '#5a3a14', alpha: 0.4, seed: 7, width: 0.7 });
  ink(g, ellipse(600, y0 - 32, 26, 16, { n: 16 }), { width: 1.4, color: '#5a3a14', jitter: 0.2, seed: 8, closed: true });

  // Festive marigold garland along the proscenium arch
  const r = rng('garland');
  for (let x = x0 - 40; x < x1 + 50; x += 18) {
    const y = y0 - 58 + Math.sin((x - x0) * 0.035) * 4;
    wash(g, ellipse(x, y, 6, 6, { n: 10 }), {
      color: r.pick(['#e8a33a', '#d9612e', '#f2d27a']),
      alpha: 0.95,
    });
  }

  // Wooden stage floor boards in perspective
  const floor = [
    [x0 - 60, APRON + 10],
    [x1 + 60, APRON + 10],
    [x1 + 110, APRON + 40],
    [x0 - 110, APRON + 40],
  ];
  wash(g, floor, { color: '#7a4e2c', alpha: 1 });
  for (let k = 0; k < 20; k++) {
    const xa = lerp(x0 - 60, x1 + 60, k / 19);
    const xb = lerp(x0 - 110, x1 + 110, k / 19);
    ink(g, [[xa, APRON + 10], [xb, APRON + 40]], {
      width: 0.8,
      color: '#3a2212',
      alpha: 0.7,
      jitter: 0.3,
      seed: 50 + k,
      taper: 0,
    });
  }

  // Orchestra pit: musician silhouettes, trumpet bell, cymbal
  g.fillStyle = dark ? '#080509' : '#140e16';
  g.fillRect(0, APRON + 40, W, H - APRON - 40);

  const heads = [
    [300, 736],
    [380, 728],
    [470, 742],
    [760, 732],
    [850, 740],
    [930, 730],
  ];
  heads.forEach(([hx, hy]) => {
    g.fillStyle = '#2c222e';
    g.beginPath();
    g.arc(hx, hy, 20, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(hx, hy + 44, 36, 26, 0, Math.PI, TAU);
    g.fill();
  });

  // Brass trumpet bell and cymbal
  g.fillStyle = '#b98a3e';
  g.beginPath();
  g.moveTo(400, 716);
  g.lineTo(440, 700);
  g.lineTo(446, 718);
  g.fill();
  g.beginPath();
  g.ellipse(452, 708, 10, 14, -0.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(880, 706, 26, 5, -0.1, 0, TAU);
  g.fill();
}

// ── Velvet Curtain, Pelmet, Footlights & Singer ───────────────────────────

function curtain(g, data, t) {
  drawCurtain(g, OPEN, {
    drop: data.curtain,
    t,
    hem: (x, bottom) => bottom + data.rippleAmp * Math.sin((x - OPEN.x0) * 0.03 - Math.max(0, data.landed) * 9) + hemBreath(x, t),
  });
}

function pelmet(g, b) {
  const { x0, x1, y0 } = OPEN;
  const pts = [[x0, y0 - 2], [x1, y0 - 2]];
  for (let x = x1; x >= x0; x -= 6) {
    pts.push([x, y0 + 36 + 12 * Math.abs(Math.sin(((x - x0) / (x1 - x0)) * Math.PI * 5))]);
  }
  wash(g, pts, { color: '#7c1420', alpha: 1 });
  ink(g, pts.slice(2), { width: 4, color: '#d8a93e', jitter: 0.4, seed: b, taper: 0 });
}

function footlights(g, data, t) {
  const warm = (0.7 + 0.3 * (1 - (data.song >= 0 ? 0.6 : 0))) * (1 + data.flicker);
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 11; k++) {
    const x = lerp(OPEN.x0 + 30, OPEN.x1 - 30, k / 10);
    const y = APRON + 14;
    const f = warm * (0.85 + 0.15 * N(t * 2 + k, 3));
    const gr = g.createRadialGradient(x, y, 1, x, y - 30, 90);
    gr.addColorStop(0, `rgba(255,214,140,${0.3 * f})`);
    gr.addColorStop(1, 'rgba(255,214,140,0)');
    g.fillStyle = gr;
    g.fillRect(x - 90, y - 120, 180, 150);
  }
  g.restore();
}

/**
 * The mic stand, and the mark on the boards where she stands.
 *
 * The stand is on the stage in every phase, not only while she is singing. An
 * empty stand under a work light is the whole image of a stage between songs,
 * and it is what the warm register leaves you looking at once the curtain is up.
 */
function micStand(g, x, feet, h, on) {
  if (on <= 0.001) return;
  g.save();
  g.globalAlpha = on;

  // The chalk spike and the tape cross on the boards.
  g.strokeStyle = 'rgba(226,214,186,0.4)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(x - 9, feet + 12);
  g.lineTo(x + 9, feet + 12);
  g.moveTo(x, feet + 5);
  g.lineTo(x, feet + 19);
  g.stroke();

  ink(g, [[x + 38, feet], [x + 38, feet - h * 0.72], [x + 30, feet - h * 0.8]], {
    width: 2.4,
    color: '#1a1216',
    alpha: on,
    jitter: 0.2,
    seed: 3,
    taper: 0,
  });
  // The capsule and the tripod feet, so it reads as a mic stand and not a pole.
  g.fillStyle = '#1a1216';
  g.beginPath();
  g.ellipse(x + 29, feet - h * 0.81, 5.5, 3.6, -0.5, 0, TAU);
  g.fill();
  ink(g, [[x + 38, feet - 4], [x + 20, feet + 6]], { width: 1.6, color: '#1a1216', alpha: on, jitter: 0.15, seed: 4, taper: 3 });
  ink(g, [[x + 38, feet - 4], [x + 56, feet + 6]], { width: 1.6, color: '#1a1216', alpha: on, jitter: 0.15, seed: 5, taper: 3 });
  ink(g, [[x + 38, feet - 4], [x + 40, feet + 12]], { width: 1.6, color: '#1a1216', alpha: on, jitter: 0.15, seed: 6, taper: 3 });

  // A pool of work light from the bars, so an empty stage still has a centre.
  const pool = g.createRadialGradient(x + 38, feet - 4, 6, x + 38, feet - 10, 190);
  pool.addColorStop(0, 'rgba(255,214,152,0.16)');
  pool.addColorStop(0.5, 'rgba(255,206,140,0.05)');
  pool.addColorStop(1, 'rgba(255,206,140,0)');
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = pool;
  g.fillRect(x - 170, feet - 200, 400, 220);
  g.restore();
}

/**
 * The singer.
 *
 * She is a gown rather than a statue. The hem swings a beat behind the body,
 * the hips shift on the pulse, and on the refrain the free arm goes out toward
 * the house and the head comes back on the held note. Every value is a pure
 * function of the performance clock, so the same moment always draws the same
 * woman, and every value is zero when the spotlight is off, so quiet and warm
 * are exactly as still as they were.
 */
function singer(g, x, feet, h, t, on, perf) {
  if (on <= 0.001) return;
  const p = perf || {};
  const k = h / 240;
  const swing = (p.hem || 0) * 1.7;
  const lean = (p.lean || 0) * 2;
  const hip = p.hip || 0;
  const waist = 15 + (p.chest || 0) * 26;
  const HEM_W = 54;

  // Model units: dy is height above the feet, dx is offset from her centre.
  const P = (dx, dy) => [x + (dx + hip * (1 - dy / 175) + lean * (1 - dy / 250)) * k, feet - dy * k];

  const path = new Path2D();
  const hemY = 6;
  path.moveTo(...P(-HEM_W + swing, hemY));
  for (let i = 1; i <= 10; i++) {
    const u = i / 10;
    // The hem is a shallow arc, deepest in the middle where the cloth hangs.
    path.lineTo(...P(lerp(-HEM_W, HEM_W, u) + swing, hemY + Math.sin(u * Math.PI) * 9));
  }
  path.lineTo(...P(32 - swing * 0.6, 72));
  path.lineTo(...P(waist, 152));
  path.lineTo(...P(26, 190));
  path.lineTo(...P(17, 202));
  path.lineTo(...P(0, 206));
  path.lineTo(...P(-17, 202));
  path.lineTo(...P(-26, 190));
  path.lineTo(...P(-waist, 152));
  path.lineTo(...P(-32 + swing * 0.6, 72));
  path.closePath();

  const head = P(0, 219);
  const tilt = p.tilt || 0;
  path.ellipse(head[0], head[1], 12 * k, 15 * k, tilt, 0, TAU);
  path.ellipse(
    head[0] - 11 * k * Math.cos(tilt),
    head[1] - 12 * k * Math.sin(tilt),
    6 * k,
    5 * k,
    tilt,
    0,
    TAU
  );

  // Soft shadow cast onto the curtain behind
  g.save();
  g.globalAlpha = 0.28 * on;
  if (g.filter !== undefined) g.filter = 'blur(6px)';
  g.translate(x, feet);
  g.scale(1.25, 1.2);
  g.translate(-x - 30, -feet + 26);
  g.fillStyle = '#2a0508';
  g.fill(path);
  g.restore();

  // The mic stand itself is drawn in every phase, so the singer does not draw it.

  // Singer silhouette with warm rim lighting
  g.save();
  g.globalAlpha = on;
  g.fillStyle = '#1c1420';
  g.fill(path);
  g.clip(path);
  g.globalCompositeOperation = 'lighter';
  const rim = g.createRadialGradient(x + 20, feet - h * 0.7, 10, x + 20, feet - h * 0.7, h * 0.9);
  rim.addColorStop(0, 'rgba(255,200,140,0.25)');
  rim.addColorStop(1, 'rgba(255,200,140,0)');
  g.fillStyle = rim;
  g.fillRect(x - h, feet - h * 1.2, h * 2, h * 1.3);
  g.restore();

  // The free arm, out of the gown and toward the house on the refrain.
  const a = p.armOut || 0;
  const shoulder = P(-25, 184);
  const rest = P(-50, 112);
  const out = P(-98, 212);
  const elbow = [
    lerp(lerp(shoulder[0], rest[0], 0.55), lerp(shoulder[0], out[0], 0.4) - 13 * k, a),
    lerp(lerp(shoulder[1], rest[1], 0.5) + 9 * k, shoulder[1] + 5 * k, a),
  ];
  const hand = [lerp(rest[0], out[0], a), lerp(rest[1], out[1], a)];

  g.save();
  g.globalAlpha = on;
  g.strokeStyle = '#1c1420';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 11 * k;
  g.beginPath();
  g.moveTo(shoulder[0], shoulder[1]);
  g.lineTo(elbow[0], elbow[1]);
  g.stroke();
  g.lineWidth = 7.5 * k;
  g.beginPath();
  g.moveTo(elbow[0], elbow[1]);
  g.lineTo(hand[0], hand[1]);
  g.stroke();
  g.restore();

  // The edge of the gown catching the beam, and a bangle at the wrist.
  g.save();
  g.globalAlpha = on * 0.8;
  ink(g, [P(-HEM_W + swing, hemY), P(-32 + swing * 0.6, 72)], {
    width: 1.6,
    color: '#ffcf8a',
    jitter: 0.3,
    seed: boil(t, 6),
    taper: 10,
  });
  g.restore();

  g.fillStyle = `rgba(255,230,170,${0.8 * on})`;
  g.beginPath();
  g.arc(x + 30, feet - h * 0.8, 3, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(hand[0], hand[1], 3.4 * k, 0, TAU);
  g.fill();
}
/**
 * Dust in the air of a tiatr house: the haze a hall full of footlights and
 * powder leaves behind, and the only reason a beam of light is ever visible.
 */
const HAZE = (() => {
  const r = rng('kantar-haze');
  return Array.from({ length: 26 }, () => ({
    u: r(),
    v: r() * 2 - 1,
    rr: 0.55 + r() * 0.95,
    drift: r() * TAU,
  }));
})();

/**
 * The follow spot.
 *
 * It is aimed from the singer's lagged position, so it trails her the way a spot
 * operator's hand trails a dancer. The lamp is visible up in the bars, and there
 * is haze in the air for the beam to land on.
 */
function spotlight(g, on, x = 600, t = 0) {
  if (on <= 0.001) return;
  const top = 40;
  const poolY = 470;
  const spread = 150;

  g.save();
  // The lamp in the bars.
  g.fillStyle = '#15111a';
  g.fillRect(x - 15, 6, 30, 24);
  g.beginPath();
  g.ellipse(x, 32, 14, 9, 0, 0, TAU);
  g.fill();

  g.globalCompositeOperation = 'lighter';

  // The cone, narrowing from the lamp.
  const cone = g.createLinearGradient(0, top, 0, poolY);
  cone.addColorStop(0, `rgba(255,245,210,${0.2 * on})`);
  cone.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(x - 14, top);
  g.lineTo(x - spread, poolY);
  g.lineTo(x + spread, poolY);
  g.lineTo(x + 14, top);
  g.closePath();
  g.fill();

  // The pool where she is standing.
  const sp = g.createRadialGradient(x, poolY, 20, x, poolY, 200);
  sp.addColorStop(0, `rgba(255,236,190,${0.42 * on})`);
  sp.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = sp;
  g.fillRect(x - 200, poolY - 200, 400, 400);

  // Haze inside the beam only, brightest where the cone is tightest.
  for (const m of HAZE) {
    const w = lerp(14, spread, m.u);
    const px = x + m.v * w;
    const py = lerp(top, poolY, m.u) + Math.sin(t * 0.35 + m.drift) * 5;
    const fade = Math.sin(m.u * Math.PI) * (1 - Math.abs(m.v) * 0.7);
    g.fillStyle = `rgba(255,246,218,${0.22 * on * fade})`;
    g.beginPath();
    g.arc(px, py, m.rr, 0, TAU);
    g.fill();
  }
  g.restore();
}

// ── The house, seen from the back of the auditorium ────────────────────────

/**
 * The front row, seen from behind.
 *
 * Without this the scene is a painting of a stage with nobody in the room to
 * watch it. Each head is on its own phase, because an audience is never in
 * unison, and each one takes a thin rim of stage light along the top.
 */
const FRONT_ROW = [
  { x: 58, y: 818, r: 46, hat: 0, phase: 0.0 },
  { x: 206, y: 806, r: 40, hat: 1, phase: 0.7 },
  { x: 372, y: 824, r: 50, hat: 0, phase: 1.5 },
  { x: 560, y: 800, r: 38, hat: 2, phase: 2.4 },
  { x: 762, y: 820, r: 48, hat: 0, phase: 3.2 },
  { x: 946, y: 808, r: 42, hat: 1, phase: 4.1 },
  { x: 1124, y: 822, r: 46, hat: 0, phase: 4.9 },
];

function audience(g, perf, on) {
  if (on <= 0.001) return;
  const beat = perf.beat || 0;
  const bob = perf.bob || 0;
  const clap = perf.clap || 0;

  FRONT_ROW.forEach((h, i) => {
    const y = h.y + Math.sin((beat + h.phase) * Math.PI) * bob;
    g.save();
    g.fillStyle = '#0b0810';
    g.beginPath();
    g.ellipse(h.x, y, h.r, h.r * 1.02, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(h.x, y + h.r * 1.9, h.r * 1.75, h.r * 1.1, 0, Math.PI, TAU);
    g.fill();
    if (h.hat === 1) {
      g.beginPath();
      g.ellipse(h.x, y - h.r * 0.55, h.r * 1.32, h.r * 0.26, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(h.x, y - h.r * 0.88, h.r * 0.54, h.r * 0.4, 0, 0, TAU);
      g.fill();
    }

    // The rim of stage light along the top of the head.
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(255,206,138,${0.4 * on})`;
    g.lineWidth = 2.4;
    g.beginPath();
    g.ellipse(h.x, y, h.r, h.r * 1.02, 0, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();

    // A hand going up on the refrain, from one seat only.
    if (h.hat === 2 && clap > 0.02) {
      g.fillStyle = `rgba(255,224,176,${0.45 * on * clap})`;
      const hx = h.x + (i % 2 ? 1 : -1) * (h.r + 14);
      g.beginPath();
      g.ellipse(hx, y - h.r * (0.5 + 1.6 * clap), 7, 9.5, 0, 0, TAU);
      g.fill();
    }
    g.restore();
  });
}

/**
 * The pit, in the same time as the singer: a bow that travels, a cymbal that
 * shivers on the off beat, and a conductor's arm that comes down on one.
 */
function pitMoves(g, perf, on) {
  if (on <= 0.001) return;
  const beat = perf.beat || 0;
  const drive = perf.pitDrive || 0;
  if (drive <= 0.001) return;

  ink(g, [[518, 708], [518 + Math.sin(beat * Math.PI) * 28 * drive, 701]], {
    width: 1.6,
    color: '#c8a25a',
    alpha: 0.5 * on,
    jitter: 0.2,
    seed: 3,
    taper: 4,
  });

  const shiver = Math.max(0, (perf.pit || 0) - 0.8) * 5 * drive;
  g.save();
  g.globalAlpha = 0.5 + 0.4 * shiver;
  g.fillStyle = '#b98a3e';
  g.beginPath();
  g.ellipse(880, 706, 26 + shiver * 3, 5 + shiver, -0.1, 0, TAU);
  g.fill();
  g.restore();

  ink(g, [[640, 702], [640 + Math.sin(beat * Math.PI) * 18 * drive, 662]], {
    width: 2.2,
    color: '#3a3040',
    alpha: 0.85 * on,
    jitter: 0.2,
    seed: 5,
    taper: 3,
  });
}

// ── Main Renderer Factory ─────────────────────────────────────────────────

/**
 * Creates the Kantar canvas renderer under Scene Contract v2.
 *
 * @param {HTMLElement|HTMLCanvasElement} canvasOrHost
 * @param {object} [options={}]
 * @returns {object} Renderer interface
 */
export function createRenderer(canvasOrHost, options = {}) {
  let st;
  const isDirectCanvas = typeof HTMLCanvasElement !== 'undefined' && canvasOrHost instanceof HTMLCanvasElement;

  if (isDirectCanvas) {
    const canvas = canvasOrHost;
    const ctx = canvas.getContext('2d');
    const memo = new Map();
    st = {
      el: canvas.parentElement || canvas,
      canvas,
      ctx,
      W,
      H,
      px: (canvas.width || W) / W,
      memo,
      begin() {
        ctx.setTransform(this.px, 0, 0, this.px, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        return ctx;
      },
      cached(key, draw) {
        if (!memo.has(key)) {
          const c = document.createElement('canvas');
          c.width = canvas.width || W;
          c.height = canvas.height || H;
          const g = c.getContext('2d');
          g.setTransform(this.px, 0, 0, this.px, 0, 0);
          draw(g, this);
          memo.set(key, c);
        }
        return memo.get(key);
      },
      blit(layer, g = ctx) {
        g.drawImage(layer, 0, 0, W, H);
      },
      destroy() {
        memo.clear();
      },
    };
  } else {
    st = stage(canvasOrHost, { W, H });
  }

  const host = canvasOrHost;
  let colors = null;
  let lastKey = '';
  let currentTime = 0;
  let currentRegister = options.register || 'warm';

  // Live accessibility region in DOM for screen readers and subtitles
  let liveRegion = null;
  if (typeof document !== 'undefined') {
    liveRegion = document.createElement('div');
    liveRegion.className = 'vh';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('role', 'status');
    if (host.appendChild && !isDirectCanvas) {
      host.appendChild(liveRegion);
    }
  }

  function palette() {
    return (colors ??= readColors(host, {
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }
  const isDark = () => palette().dark !== '#000000';

  // Interactive skip on click or Enter in playful
  function skipToNext() {
    if (currentRegister !== 'playful') return;
    const el = options.scene;
    if (el?.params?.hero) {
      // The hero never plays by itself: a click strikes one act, and a click during an act moves it on.
      const { cue, acts } = el.params;
      const next = cue == null ? null : heroNext(currentTime - cue);
      if (next === null) el.set({ cue: currentTime, acts: (acts ?? 0) + 1 });
      else if (typeof options.advance === 'function') options.advance(cue + next - currentTime);
      return;
    }
    const next = nextPhase(currentTime);
    if (typeof options.advance === 'function') {
      options.advance(next - currentTime);
    }
    if (typeof options.invalidate === 'function') {
      options.invalidate();
    }
  }

  const onPointerDown = () => skipToNext();
  // Inside <sg-scene> a click reaches activate() (below); a pointerdown as well would skip two phases per click.
  if (isDirectCanvas) st.canvas.addEventListener('pointerdown', onPointerDown);
  st.canvas.style.cursor = currentRegister === 'playful' ? 'pointer' : 'default';

  // The first paint is the house and the first set, about 100 ms together. Inside <sg-scene> they are painted
  // one slice at a time, each followed by a 1x1 read so the rasteriser works inside its own slice, and
  // sg-ready waits for them; until then render() draws nothing. A bare canvas still paints at once.
  const layerKeys = () => {
    const dark = isDark();
    return [[`house|${dark}`, gg => house(gg, dark)], [`set0|${dark}`, gg => SET_PAINTERS[0](gg)]];
  };
  let destroyed = false;
  let warmed = !options.scene;
  const warming = warmed ? Promise.resolve() : (async () => {
    const yieldMain = () => new Promise(r => setTimeout(r, 0));
    for (const [key, draw] of layerKeys()) {
      await yieldMain();
      if (destroyed) return;
      st.cached(key, draw).getContext('2d').getImageData(0, 0, 1, 1);
    }
    warmed = true;
    if (typeof options.invalidate === 'function') options.invalidate();
  })();

  function render(data, frame = {}) {
    if (!warmed) return;
    currentTime = frame.time ?? data.time;
    currentRegister = frame.register ?? data.register;
    st.canvas.style.cursor = currentRegister === 'playful' ? 'pointer' : 'default';

    const t = currentTime;
    const dark = isDark();
    const b = boil(t, 6);
    const perf = data.performance || {};

    // Skip redundant frames when settled
    const key = `${data.curtain.toFixed(3)}|${data.set}|${data.spot.toFixed(2)}|${dark}|${data.settled ? 'settled' : b}`;
    if (key === lastKey && data.settled) return;
    lastKey = key;

    const g = st.begin();

    // 1. Auditorium, Proscenium Arch & Orchestra Pit (cached)
    st.blit(st.cached(`house|${dark}`, gg => house(gg, dark)));

    // 2. Painted Backdrop (cached per set)
    const setIdx = clamp(data.set, 0, SET_PAINTERS.length - 1);
    st.blit(st.cached(`set${setIdx}|${dark}`, gg => SET_PAINTERS[setIdx](gg)));

    // 3. Velvet Curtain
    curtain(g, data, t);

    // 4. Gold-fringed Pelmet
    pelmet(g, b);

    // 5. Footlights, breathing with the beat
    footlights(g, data, t);

    // 6. The pit, in the same time as everything else
    pitMoves(g, perf, 1);

    // 7. The empty stand, waiting, whether or not anyone is at it
    micStand(g, 600, APRON + 16, 250, data.curtain > 0.99 ? 0 : 1);

    // 8. Spotlight, aimed from the singer's lagged position, with haze in it
    const spotX = 600 + (perf.hem || 0) * 1.2 * (250 / 240);
    spotlight(g, data.spot, spotX, t);

    // 9. The singer
    if (data.singer) {
      singer(g, 600, APRON + 16, 250, t, data.spot, perf);
    }

    // 10. The front row, nearest the camera, catching the light off the stage
    audience(g, perf, data.curtain > 0.99 ? 0 : 1);

    // 10. Accessible DOM text update (lyrics and scene announcements)
    if (liveRegion) {
      let announcedText = data.sceneTitle;
      if (data.song >= 0 && data.songText) {
        announcedText = `Kantar: ${data.songText}`;
      }
      if (liveRegion.textContent !== announcedText) {
        liveRegion.textContent = announcedText;
      }
    }
  }

  return {
    render,
    ready: warming,
    setRegister(register) {
      currentRegister = register;
      st.canvas.style.cursor = register === 'playful' ? 'pointer' : 'default';
      lastKey = '';
    },
    restyle() {
      colors = null;
      st.memo.clear();
      lastKey = '';
    },
    activate() {
      skipToNext();
    },
    destroy() {
      destroyed = true;
      st.canvas.removeEventListener('pointerdown', onPointerDown);
      liveRegion?.remove();
      st.destroy();
    },
  };
}
