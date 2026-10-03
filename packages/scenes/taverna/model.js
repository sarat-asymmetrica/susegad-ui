// Taverna: Rain on Bottle Glass. The pure half.
//
// A village taverna window on a rainy monsoon night: wooden bars and sill,
// dark green glass bottles, an earthen ceramic jug, a hanging slate blackboard.
// Outside: rain sweeps down a cobblestone alley under an old streetlamp.
// On the glass: condensation mist and meandering rain rivulets.
// Pure: plain data out, Node-safe, deterministic.

import { rng, clamp, smoothstep, lerp, TAU } from '../../engine/index.js';

export const W = 1200;
export const H = 800;
export const REST = 10.0;

export const WINDOW = {
  x0: 80,
  y0: 50,
  x1: 1120,
  y1: 560,
  frame: 28,
  bars: [288, 496, 704, 912],
  crossbar: { y: 300, h: 20 },
  sill: { y: 560, h: 240, bevel: 40 },
};

export const STREETLAMP = {
  x: 410,
  y: 195,
  r: 22,
  glowR: 190,
};

export const BULB = {
  x: 760,
  cordY: 135,
  bulbY: 155,
  r: 16,
  glowR: 170,
};

export const BOTTLES = [
  {
    id: 'bottle-tall',
    name: 'Tall feni bottle',
    x: 210,
    y: 380,
    w: 66,
    h: 210,
    neckW: 20,
    neckH: 65,
    glass: 'green',
    tone: 0.85,
    chimeFreq: 587.33,
  },
  {
    id: 'bottle-flagon',
    name: 'Olive glass flagon',
    x: 295,
    y: 435,
    w: 78,
    h: 155,
    neckW: 24,
    neckH: 45,
    glass: 'olive',
    tone: 0.75,
    chimeFreq: 659.25,
  },
  {
    id: 'bottle-amber',
    name: 'Amber wine bottle',
    x: 885,
    y: 395,
    w: 68,
    h: 195,
    neckW: 22,
    neckH: 60,
    glass: 'amber',
    tone: 0.8,
    chimeFreq: 440.0,
  },
];

export const JUG = {
  id: 'jug',
  name: 'Ceramic martaban jug',
  x: 740,
  y: 430,
  w: 104,
  h: 160,
  neckW: 48,
  neckH: 35,
  chimeFreq: 329.63,
};

export const BLACKBOARD = {
  id: 'blackboard',
  name: 'Slate blackboard',
  x: 980,
  y: 90,
  w: 130,
  h: 180,
  frame: 10,
  peg: { x: 1045, y: 55 },
};

/**
 * Generate alley layout and cobblestones deterministically from seed.
 * Memoised by seed.
 */
const layoutMemo = new Map();
export function weather(seed = 1) {
  if (layoutMemo.has(seed)) return layoutMemo.get(seed);
  const r = rng(`taverna:${seed}`);

  // Cobblestone rows seen through the window
  const cobbles = [];
  const startY = 320, endY = 560;
  let row = 0;
  for (let cy = startY; cy < endY; cy += 24, row++) {
    const shift = (row % 2) * 22;
    for (let cx = WINDOW.x0 - 40 + shift; cx < WINDOW.x1 + 40; cx += 44) {
      cobbles.push({
        x: cx + r.range(-4, 4),
        y: cy + r.range(-3, 3),
        w: r.range(36, 42),
        h: r.range(18, 22),
        tone: r.range(0.4, 0.9),
      });
    }
  }

  // Puddles in the alley reflecting the streetlamp
  const puddles = [
    { x: 390 + r.range(-20, 20), y: 490 + r.range(-15, 15), rx: 110, ry: 20 },
    { x: 620 + r.range(-30, 30), y: 520 + r.range(-10, 10), rx: 80, ry: 15 },
  ];

  // Rivulet tracks on the window glass (14 meandering paths)
  const tracks = [];
  const panes = [
    [WINDOW.x0 + WINDOW.frame, WINDOW.bars[0]],
    [WINDOW.bars[0], WINDOW.bars[1]],
    [WINDOW.bars[1], WINDOW.bars[2]],
    [WINDOW.bars[2], WINDOW.bars[3]],
    [WINDOW.bars[3], WINDOW.x1 - WINDOW.frame],
  ];

  for (let i = 0; i < 14; i++) {
    const pane = panes[i % panes.length];
    const x0 = r.range(pane[0] + 20, pane[1] - 20);
    tracks.push({
      id: `riv-${i}`,
      x0,
      y0: r.range(90, 130),
      yEnd: WINDOW.sill.y - 12,
      wobbleFreq: r.range(0.016, 0.028),
      wobbleAmp: r.range(5, 12),
      speed: r.range(38, 65),
      startDelay: (i * 0.73) % 4.2,
      radius: r.range(2.8, 4.4),
      tailLen: r.range(70, 140),
    });
  }

  // Outside rain streak emitters (60 streaks)
  const streaks = [];
  for (let i = 0; i < 60; i++) {
    streaks.push({
      x0: r.range(WINDOW.x0 - 80, WINDOW.x1 + 60),
      y0: r.range(WINDOW.y0, WINDOW.y1),
      speed: r.range(750, 1050),
      len: r.range(26, 48),
      alpha: r.range(0.2, 0.55),
    });
  }

  const out = { cobbles, puddles, tracks, streaks };
  if (layoutMemo.size > 8) layoutMemo.delete(layoutMemo.keys().next().value);
  layoutMemo.set(seed, out);
  return out;
}

/**
 * The person going past.
 *
 * A taverna on a monsoon night is not an empty window with rain on it. Somebody
 * crosses the alley under a covered lamp, and for a few seconds their light comes
 * through the glass and lays the bars across the sill and up the bottles. That
 * crossing is the whole reason the window is there.
 *
 * One goes past every twenty two seconds, walking left to right. The lantern
 * swings while they walk and hangs still while they do not.
 */
export function passerby(time = 0, { rain = 0.6, lamp = 0.85 } = {}) {
  const PERIOD = 22;
  const WALK = 7.5;
  const phase = ((time % PERIOD) + PERIOD) % PERIOD;
  const walking = phase < WALK;
  const u = walking ? phase / WALK : 0;

  // A soft entry and exit, so nobody fades in at the edge of the frame.
  const ends = smoothstep(0, 0.08, u) * (1 - smoothstep(0.92, 1, u));
  const visible = walking ? ends * clamp(rain * 0.5 + 0.5, 0, 1) * clamp(lamp, 0, 1) : 0;
  const swing = walking ? Math.sin(time * 4.2) * 0.16 : 0;

  return {
    walking,
    x: lerp(-110, W + 110, u),
    feet: 556,
    height: 168,
    swing,
    visible,
    // The lantern hangs from a hand at about waist height and swings with it.
    lampX: lerp(-110, W + 110, u) + 26,
    lampY: 556 - 104,
    glow: visible,
  };
}

/**
 * Pure model function.
 * @param {object} opts
 * @param {number} [opts.time] Current animation time in seconds
 * @param {number} [opts.seed] Random seed
 * @param {'quiet'|'warm'|'playful'} [opts.register]
 * @param {object} [opts.params] Scene parameters: rain, lamp, steamer
 * @param {number} [opts.W] Viewport width
 * @param {number} [opts.H] Viewport height
 * @param {Array} [opts.chimes] Acoustic chimes
 * @param {Array} [opts.wipes] Condensation wipes
 */
export function model({
  time = 0,
  seed = 1,
  register = 'warm',
  params = {},
  W: viewportW = W,
  H: viewportH = H,
  chimes = [],
  wipes = [],
} = {}) {
  const rainParam = typeof params?.rain === 'number' ? clamp(params.rain, 0, 1) : 0.6;
  const lampParam = typeof params?.lamp === 'number' ? clamp(params.lamp, 0, 1) : 0.85;
  const steamerParam = typeof params?.steamer === 'number' ? clamp(params.steamer, 0, 1) : 0.5;

  const isQuiet = register === 'quiet';
  const isPlayful = register === 'playful';
  const settled = isQuiet || (!isPlayful && time >= REST);
  const t = settled && !isPlayful ? REST : time;

  const w = weather(seed);

  // Somebody crossing the alley under a covered lamp.
  const walker = isQuiet
    ? { walking: false, x: 0, feet: 0, height: 0, swing: 0, visible: 0, lampX: 0, lampY: 0, glow: 0 }
    : passerby(t, { rain: rainParam, lamp: lampParam });

  // Filament bulb glow and flicker
  const flicker = isQuiet ? 0 : 0.05 * Math.sin(t * 3.7 + seed * 2.1) + 0.02 * Math.sin(t * 8.9 + seed);
  const lampIntensity = lampParam * (1.0 + flicker);

  // Outside rain streaks
  const rainStreaks = [];
  const streakCount = Math.round(w.streaks.length * (0.25 + 0.75 * rainParam));
  const slant = 0.22; // rain angle
  const winH = WINDOW.y1 - WINDOW.y0;

  for (let i = 0; i < streakCount; i++) {
    const s = w.streaks[i];
    let y, x;
    if (isQuiet) {
      y = s.y0;
      x = s.x0 + (y - WINDOW.y0) * slant;
    } else {
      const travel = (s.y0 - WINDOW.y0 + t * s.speed * (0.6 + 0.4 * rainParam)) % (winH + 60);
      y = WINDOW.y0 + travel;
      x = s.x0 + travel * slant;
    }

    // Streetlamp cone lighting boost
    const dx = x - STREETLAMP.x;
    const dy = y - STREETLAMP.y;
    const distToLamp = Math.hypot(dx, dy);
    const lampFactor = Math.max(0, 1 - distToLamp / STREETLAMP.glowR);
    const alpha = (s.alpha + lampFactor * 0.45) * rainParam;

    rainStreaks.push({
      x1: x,
      y1: y,
      x2: x + s.len * slant,
      y2: y + s.len,
      alpha: Math.min(1, alpha),
      bright: lampFactor > 0.35,
    });
  }

  // Meandering rivulets on window glass
  const rivulets = [];
  for (let i = 0; i < w.tracks.length; i++) {
    const tr = w.tracks[i];
    let headY, headX;

    if (isQuiet) {
      // Resting drop at settled position
      headY = tr.y0 + (tr.yEnd - tr.y0) * 0.62;
      headX = tr.x0 + Math.sin((headY - tr.y0) * tr.wobbleFreq + seed) * tr.wobbleAmp;
    } else {
      const elapsed = Math.max(0, t - tr.startDelay);
      const ease = isPlayful ? 1 : 1 - smoothstep(REST - 2.5, REST, t);
      const effectiveSpeed = tr.speed * (0.5 + 0.7 * rainParam) * ease;
      const progress = elapsed * effectiveSpeed;
      // Slip-stick motion: drops gather water and dart forward
      const slip = Math.sin(elapsed * 3.4 + i) * 6;
      const totalY = progress + (progress > 10 ? slip : 0);
      headY = Math.min(tr.yEnd, tr.y0 + totalY);
      headX = tr.x0 + Math.sin((headY - tr.y0) * tr.wobbleFreq + seed * 1.7 + i) * tr.wobbleAmp;
    }

    // Discretized trail points for the wet path behind the drop
    const trail = [];
    const step = 8;
    for (let py = tr.y0; py <= headY; py += step) {
      const px = tr.x0 + Math.sin((py - tr.y0) * tr.wobbleFreq + seed * 1.7 + i) * tr.wobbleAmp;
      trail.push([px, py]);
    }
    if (trail.length === 0 || trail[trail.length - 1][1] < headY) {
      trail.push([headX, headY]);
    }

    rivulets.push({
      id: tr.id,
      x: headX,
      y: headY,
      r: tr.radius,
      trail,
      active: headY > tr.y0 + 2,
    });
  }

  // Acoustic chimes (active rings)
  const activeChimes = [];
  for (const c of chimes) {
    const age = t - c.t0;
    if (age >= 0 && age < 2.2) {
      const radius = age * 260;
      const decay = Math.exp(-age * 2.8);
      activeChimes.push({
        x: c.x,
        y: c.y,
        r: radius,
        alpha: decay * 0.8,
        freq: c.freq,
        bottleId: c.bottleId,
      });
    }
  }

  return {
    seed,
    time: t,
    register,
    params: {
      rain: rainParam,
      lamp: lampParam,
      steamer: steamerParam,
    },
    W: viewportW,
    H: viewportH,
    window: WINDOW,
    outside: {
      streetlamp: STREETLAMP,
      cobbles: w.cobbles,
      puddles: w.puddles,
    },
    lamp: {
      bulb: BULB,
      intensity: lampIntensity,
    },
    stillLife: {
      bottles: BOTTLES,
      jug: JUG,
      blackboard: BLACKBOARD,
    },
    rainStreaks,
    rivulets,
    condensation: {
      density: steamerParam,
      fogAlpha: 0.38 * steamerParam,
    },
    chimes: activeChimes,
    wipes,
    passerby: walker,
    settled,
  };
}
