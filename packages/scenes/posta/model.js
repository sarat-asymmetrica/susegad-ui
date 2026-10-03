// Posta: the sorting desk of the old post office in Fontainhas. The pure model.
//
// A vintage rosewood sorting desk beneath an oyster shell carepa window:
// wooden pigeonholes holding jute-tied letter bundles, a brass letter balance,
// an ink pad and rubber stamp, and a heritage crimson postbox with a brass flap.
// Pure: plain data out, 100% deterministic for a given seed, Node-safe.

import { rng, clamp, lerp, smoothstep, TAU } from '../../engine/index.js';

export const W = 1200;
export const H = 800;

/** Time at which warm register has fully settled. */
export const REST = 8.5;

export const CUBBIES_COUNT = 12;

export const DESK = {
  top: 470,
  front: 520,
  bottom: 800,
  blotter: { x: 380, y: 490, w: 440, h: 250 },
};

export const WINDOW = {
  x: 70,
  y: 45,
  w: 260,
  h: 275,
  rows: 4,
  cols: 3,
};

export const RACK = {
  x: 410,
  y: 65,
  w: 470,
  h: 275,
  rows: 3,
  cols: 4,
};

export const POSTBOX = {
  x: 940,
  y: 260,
  w: 190,
  h: 440,
  slot: { x: 975, y: 395, w: 120, h: 38 },
};

export const SCALE = {
  x: 230,
  y: 570,
  pivotY: 395,
  arm: 110,
  panRestY: 485,
  omega: 2.8,
  decay: 0.65,
};

export const STAMP = {
  x: 620,
  restY: 500,
  pressY: 556,
  inkPad: { x: 740, y: 535, w: 72, h: 48 },
};

export const DESTINATIONS = [
  'Panaji',
  'Margao',
  'Mapusa',
  'Vasco',
  'Ponda',
  'Pernem',
  'Bicholim',
  'Quepem',
  'Canacona',
  'Sanguem',
  'Mormugao',
  'Tiswadi',
];

/**
 * The light, as the day moves.
 *
 * By the time the last letter is sorted the sun has come round, so the beam off
 * the carepa panes has swung across the room to the right, narrowed, dropped
 * lower and gone from the apricot of morning to the deep gold of late
 * afternoon. Progress is not a counter here, it is the day.
 *
 * @param {number} progress 0 to 1
 * @returns {object} the beam polygon and the colour of the light
 */
export function sunbeamAt(progress = 0) {
  const p = clamp(progress, 0, 1);
  const swing = lerp(0, 150, p);
  const centre = lerp(800, 990, p);
  const half = lerp(250, 158, p);
  const drop = lerp(0, 44, p);

  return {
    polygon: [
      [WINDOW.x + 10, WINDOW.y + 40],
      [WINDOW.x + WINDOW.w - 10, WINDOW.y + 10],
      [centre + half, 752 + drop],
      [centre - half + swing, 800 + drop],
    ],
    // Morning apricot going to low gold.
    colour: ['rgba(255, 235, 175,', 'rgba(255, 206, 122,'],
    intensity: lerp(0.26, 0.19, p),
  };
}

/**
 * Somebody at the window.
 *
 * A post office is a place where people arrive. One comes up to the counter,
 * stands a moment while somebody looks for a letter, and goes. From inside the
 * room that is a head and shoulders against a bright pane of oyster shell, and
 * a shadow lying across the sorting desk. It is the only person in the scene,
 * and it turns a lit room into a room somebody is working in.
 *
 * One arrives every twenty six seconds and stays nine of them.
 */
export function customer(time = 0, progress = 0) {
  const PERIOD = 26;
  const VISIT = 9;
  const phase = ((time % PERIOD) + PERIOD) % PERIOD;
  const present = phase < VISIT;
  const u = present ? phase / VISIT : 0;

  // In, stand, go.
  const presence = present
    ? Math.min(smoothstep(0, 0.2, u), 1 - smoothstep(0.76, 1, u))
    : 0;

  return {
    present,
    presence,
    // They come up to the counter from the left and stop, head and shoulders
    // inside the opening of the carepa window rather than below it.
    x: lerp(WINDOW.x + 62, WINDOW.x + 172, smoothstep(0, 0.32, u)),
    y: WINDOW.y + WINDOW.h - 64,
    height: 148,
    // Somebody waiting shifts their weight.
    lean: Math.sin(time * 1.3) * 3,
    // As the day wears on they stand further into the room's light.
    shadowReach: lerp(0.82, 1.15, clamp(progress, 0, 1)),
  };
}

/**
 * Oscillating angle of the brass balance beam.
 * Returns angle in radians (positive = left pan tilts down).
 */
export function scaleAngle(t, pushes = []) {
  let angle = 0;
  // Scripted gentle oscillation in the first few seconds
  if (t < REST) {
    const s = Math.max(0, t - 0.4);
    angle += 0.07 * Math.exp(-SCALE.decay * s) * Math.sin(SCALE.omega * s);
  }
  // Pushes from interactive taps in playful
  for (const p of pushes) {
    if (t < p.t) continue;
    const dt = t - p.t;
    angle += (p.dir ?? 1) * 0.09 * Math.exp(-SCALE.decay * dt) * Math.sin(3.2 * dt);
  }
  return angle;
}

/**
 * Brass letterbox flap opening (0 closed, 1 fully lifted).
 */
export function flapOpening(t, pushes = [], manual = null) {
  if (manual !== null && manual !== undefined) {
    return clamp(manual, 0, 1);
  }
  let v = 0;
  // Scripted mail arrival: lifts around 1.0s and snaps back by 2.0s
  if (t >= 0.9 && t < 2.0) {
    const u = (t - 0.9) / 1.1;
    v = Math.sin(u * Math.PI) * 0.85;
  } else if (t >= 2.0 && t < 5.0) {
    // Damped flap pendulum bounce
    const s = t - 2.0;
    v = 0.4 * Math.exp(-2.5 * s) * Math.max(0, Math.cos(9.0 * s));
  }
  // Interactive pushes
  for (const p of pushes) {
    if (t < p.t) continue;
    const dt = t - p.t;
    v += (p.amp ?? 0.8) * Math.exp(-2.4 * dt) * Math.max(0, Math.cos(8.5 * dt));
  }
  return clamp(v, 0, 1);
}

/**
 * Rubber stamp position and impression status.
 */
export function stampState(t, presses = [], manual = null) {
  if (manual !== null && manual !== undefined) {
    const descent = clamp(manual, 0, 1);
    return {
      descent,
      y: lerp(STAMP.restY, STAMP.pressY, descent),
      inkMark: descent >= 0.85,
    };
  }
  let descent = 0;
  let inkMark = false;

  // Scripted stamp descent: descends around 4.4s, strikes at 4.9s, returns by 5.6s
  if (t >= 4.4 && t < 5.6) {
    if (t < 4.9) {
      descent = smoothstep(4.4, 4.9, t);
    } else if (t < 5.15) {
      descent = 1.0;
    } else {
      descent = 1.0 - smoothstep(5.15, 5.6, t);
    }
  }
  if (t >= 4.9) {
    inkMark = true;
  }

  // Interactive presses
  for (const p of presses) {
    if (t < p.t) continue;
    const dt = t - p.t;
    if (dt < 1.0) {
      const d = dt < 0.35 ? smoothstep(0, 0.35, dt) : 1.0 - smoothstep(0.55, 1.0, dt);
      descent = Math.max(descent, d);
    }
    if (dt >= 0.35) {
      inkMark = true;
    }
  }

  return {
    descent: clamp(descent, 0, 1),
    y: lerp(STAMP.restY, STAMP.pressY, descent),
    inkMark,
  };
}

/**
 * Progress value (0 to 1) representing sorted bundles.
 */
export function sortingProgress(t, register, manual = null) {
  if (manual !== null && manual !== undefined) {
    return clamp(manual, 0, 1);
  }
  if (register === 'quiet') return 1;
  return smoothstep(1.5, 7.5, t);
}

/**
 * Seeded rack cubbies and letter bundles data.
 */
const cubbiesMemo = new Map();
export function makeRackData(seed = 1) {
  if (cubbiesMemo.has(seed)) return cubbiesMemo.get(seed);
  const r = rng(`posta:cubbies:${seed}`);
  const cubbies = [];
  const colW = (RACK.w - 18) / RACK.cols;
  const rowH = (RACK.h - 18) / RACK.rows;

  for (let row = 0; row < RACK.rows; row++) {
    for (let col = 0; col < RACK.cols; col++) {
      const idx = row * RACK.cols + col;
      const x = RACK.x + 9 + col * colW;
      const y = RACK.y + 9 + row * rowH;
      const destination = DESTINATIONS[idx % DESTINATIONS.length];
      const count = r.int(3, 7);
      const bundles = [];
      for (let b = 0; b < count; b++) {
        bundles.push({
          type: r() < 0.3 ? 'card' : r() < 0.7 ? 'envelope' : 'chit',
          tone: r.range(0.85, 1.05),
          tilt: r.range(-0.06, 0.06),
          width: r.range(colW * 0.72, colW * 0.88),
          height: r.range(14, 22),
          parAvion: r() < 0.35,
        });
      }
      cubbies.push({
        idx,
        col,
        row,
        x,
        y,
        w: colW,
        h: rowH,
        destination,
        bundles,
      });
    }
  }

  // Pre-seed 32 dust motes
  const motes = [];
  const mr = rng(`posta:motes:${seed}`);
  for (let i = 0; i < 32; i++) {
    motes.push({
      x0: mr.range(120, 950),
      y0: mr.range(80, 720),
      vx: mr.range(-6, 12),
      vy: mr.range(10, 28),
      r: mr.range(1.2, 2.7),
      phase: mr.range(0, TAU),
      wobbleFreq: mr.range(0.6, 1.6),
    });
  }

  const out = { cubbies, motes };
  if (cubbiesMemo.size > 8) cubbiesMemo.delete(cubbiesMemo.keys().next().value);
  cubbiesMemo.set(seed, out);
  return out;
}

/**
 * Pure frame model.
 */
export function model({
  time = 0,
  seed = 1,
  register = 'warm',
  params = {},
  W: width = W,
  H: height = H,
} = {}) {
  const isQuiet = register === 'quiet';
  const isPlayful = register === 'playful';

  // In quiet or after REST, warm register settles
  const done = isQuiet || (!isPlayful && time >= REST);
  const t = isQuiet ? REST : time;

  const { cubbies: rackCubbies, motes: baseMotes } = makeRackData(seed);

  // Normalize params
  const progress = sortingProgress(t, register, params.progress);
  const flap = isQuiet ? 0 : flapOpening(t, [], params.flap);
  const stamp = isQuiet
    ? { descent: 0, y: STAMP.restY, inkMark: true }
    : stampState(t, [], params.stamped);
  const scale = isQuiet ? 0 : scaleAngle(done ? REST : t);

  // How many cubbies have received their sorted bundles
  const sortedCount = Math.round(progress * CUBBIES_COUNT);

  const cubbies = rackCubbies.map((c, i) => ({
    ...c,
    sorted: i < sortedCount,
  }));

  // Balance scale geometry
  const angle = scale;
  const leftPanY = SCALE.panRestY + Math.sin(angle) * SCALE.arm;
  const rightPanY = SCALE.panRestY - Math.sin(angle) * SCALE.arm;

  // Dust motes: gently drift in warm and playful; motionless in quiet
  const motes = baseMotes.map(m => {
    if (isQuiet) {
      return { x: m.x0, y: m.y0, r: m.r, alpha: 0 };
    }
    const mt = done ? REST : t;
    const x = ((m.x0 + m.vx * mt + Math.sin(mt * m.wobbleFreq + m.phase) * 14 - 100) % 1000 + 1000) % 1000 + 100;
    const y = ((m.y0 - m.vy * mt + Math.cos(mt * 0.7 + m.phase) * 10 - 50) % 700 + 700) % 700 + 50;

    // Check distance to central sunbeam line: (100, 60) to (1000, 750)
    const tLine = clamp(((x - 100) * 900 + (y - 60) * 690) / (900 * 900 + 690 * 690), 0, 1);
    const px = 100 + tLine * 900;
    const py = 60 + tLine * 690;
    const dist = Math.hypot(x - px, y - py);
    const beamWidth = lerp(80, 220, tLine);
    const inBeam = dist < beamWidth;
    const beamFactor = inBeam ? 1.0 - dist / beamWidth : 0;
    const alpha = (0.35 + 0.5 * Math.sin(mt * 1.5 + m.phase)) * beamFactor;

    return { x, y, r: m.r, alpha: clamp(alpha, 0, 0.95) };
  });

  return {
    seed,
    time: t,
    register,
    settled: done && !isPlayful,
    params: {
      progress: params.progress ?? null,
      flap: params.flap ?? null,
      stamped: params.stamped ?? null,
    },
    progress,
    dimensions: { W: width, H: height },
    desk: DESK,
    window: WINDOW,
    sunbeam: isQuiet
      ? { polygon: [], colour: ['rgba(255, 235, 175,', 'rgba(255, 206, 122,'], intensity: 0 }
      : sunbeamAt(progress),
    // The one person who ever comes into this room.
    customer: isQuiet
      ? { present: false, presence: 0, x: 0, y: 0, height: 0, lean: 0, shadowReach: 1 }
      : customer(t, progress),
    motes,
    rack: {
      ...RACK,
      cubbies,
      sortedCount,
    },
    scale: {
      x: SCALE.x,
      y: SCALE.y,
      pivotY: SCALE.pivotY,
      arm: SCALE.arm,
      angle,
      leftPanY,
      rightPanY,
    },
    postbox: {
      ...POSTBOX,
      flap,
    },
    stamp: {
      x: STAMP.x,
      y: stamp.y,
      descent: stamp.descent,
      inkMark: stamp.inkMark,
      inkPad: STAMP.inkPad,
    },
    manifest: {
      x: 430,
      y: 510,
      w: 230,
      h: 210,
      stamped: stamp.inkMark,
    },
    waitingCount: CUBBIES_COUNT - sortedCount,
  };
}
