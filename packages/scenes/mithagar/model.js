// Mithagar: The Ribandar Salt Pans at Dawn. The pure half.
//
// A geometric grid of Goan salt pans (mithagars) along the Mandovi river:
// clay bunds (dikes), a wooden sluice gate (manos), shallow brine pools
// reflecting the sky, crystalline salt crusts, and pyramidal salt heaps
// raked at pan corners.
//
// Pure JavaScript: plain data out, deterministic for any seed, Node-safe.

import { rng, clamp, smoothstep, lerp, mix, TAU, sunAt, shadowLength, radialFront } from '../../engine/index.js';

export const W = 1200;
export const H = 800;
export const HORIZON_Y = 220;
export const PAN_ROWS = 3;
export const PAN_COLS = 4;

/** Goa is at about 15 degrees north: the sun climbs high but never overhead. */
export const LATITUDE_DEG = 15;

/** Perspective row boundaries (near rows are taller). */
const ROW_Y = [
  { y0: 272, y1: 396 },
  { y0: 412, y1: 568 },
  { y0: 586, y1: 762 },
];

/** Column boundaries with slight perspective divergence. */
const COL_X = [
  { x0: 64, x1: 304 },
  { x0: 326, x1: 582 },
  { x0: 604, x1: 864 },
  { x0: 886, x1: 1136 },
];

/**
 * The ground the drying front crosses. `speed` is the diagonal plus the edge
 * width, so the front has fully passed every pan by progress 1. `softness` is
 * the width of the leading edge, kept to a tenth of the diagonal so no pan
 * reads nonzero at progress 0.
 */
const FIELD = (() => {
  const originX = COL_X[0].x0;
  const originY = ROW_Y[0].y0;
  const diagonal = Math.hypot(COL_X[PAN_COLS - 1].x1 - originX, ROW_Y[PAN_ROWS - 1].y1 - originY);
  const softness = diagonal * 0.1;
  return { originX, originY, diagonal, softness, speed: diagonal + softness };
})();

/** The wooden sluice gate (manos) on the tidal feeder canal. */
export const SLUICE = {
  x: 230,
  y: 226,
  w: 110,
  h: 46,
  leftPier: { x0: 230, x1: 252, y0: 226, y1: 272 },
  rightPier: { x0: 318, x1: 340, y0: 226, y1: 272 },
  planks: [
    { x0: 252, x1: 318, y0: 236, y1: 244 },
    { x0: 252, x1: 318, y0: 245, y1: 253 },
    { x0: 252, x1: 318, y0: 254, y1: 262 },
  ],
  lever: { x: 282, y0: 212, y1: 264 },
};

/** Register looks: motion flag and speed. */
export const LOOKS = {
  quiet: { motion: false, pace: 0 },
  warm: { motion: true, pace: 0.8 },
  playful: { motion: true, pace: 1.0 },
};

/**
 * Geometric pan layout: computes 12 pans across 3 rows and 4 columns
 * with perspective foreshortening and organic bund jitter for a seed.
 */
const layoutCache = new Map();
export function panLayout(seed = 1, width = W, height = H) {
  const key = `${seed}:${width}:${height}`;
  if (layoutCache.has(key)) return layoutCache.get(key);

  const r = rng(`mithagar:layout:${seed}`);

  const rowY = ROW_Y;
  const colX = COL_X;

  const pans = [];
  let id = 0;

  for (let row = 0; row < PAN_ROWS; row++) {
    const ry = rowY[row];
    for (let col = 0; col < PAN_COLS; col++) {
      const cx = colX[col];

      // Subtle organic deviation so bunds look hand-formed from mud
      const jx0 = cx.x0 + r.range(-2.5, 2.5);
      const jx1 = cx.x1 + r.range(-2.5, 2.5);
      const jy0 = ry.y0 + r.range(-2, 2);
      const jy1 = ry.y1 + r.range(-2, 2);

      const polygon = [
        [jx0, jy0],
        [jx1, jy0],
        [jx1, jy1],
        [jx0, jy1],
      ];

      pans.push({
        id: id++,
        row,
        col,
        x0: jx0,
        y0: jy0,
        x1: jx1,
        y1: jy1,
        w: jx1 - jx0,
        h: jy1 - jy0,
        center: [(jx0 + jx1) / 2, (jy0 + jy1) / 2],
        polygon,
      });
    }
  }

  // Bund lines (intersections and dividers)
  const bunds = {
    horizontal: [
      { y0: 252, y1: 272, x0: 50, x1: 1150 }, // Top feeder bund
      { y0: 396, y1: 412, x0: 50, x1: 1150 }, // Mid 1 bund
      { y0: 568, y1: 586, x0: 50, x1: 1150 }, // Mid 2 bund
      { y0: 762, y1: 782, x0: 50, x1: 1150 }, // Bottom foreground bund
    ],
    vertical: [
      { x0: 44, x1: 64, y0: 252, y1: 782 },   // Left edge bund
      { x0: 304, x1: 326, y0: 252, y1: 782 }, // Divider 1
      { x0: 582, x1: 604, y0: 252, y1: 782 }, // Divider 2
      { x0: 864, x1: 886, y0: 252, y1: 782 }, // Divider 3
      { x0: 1136, x1: 1156, y0: 252, y1: 782 },// Right edge bund
    ],
  };

  const result = { pans, bunds, width, height };
  if (layoutCache.size > 16) layoutCache.delete(layoutCache.keys().next().value);
  layoutCache.set(key, result);
  return result;
}

/**
 * Sluice gate model: returns piers, timbers, and tidal water channel.
 */
export function sluiceGate(seed = 1) {
  const r = rng(`mithagar:sluice:${seed}`);
  return {
    ...SLUICE,
    waterFlow: r.range(0.3, 0.7),
  };
}

/**
 * Evaporation and crystallization state:
 * - recede: brine recession from bund borders (0 at p=0, up to 15px at p=1).
 * - crustThickness: white crystalline rim growth along edges (0 at p=0, up to 18px at p=1).
 * - crustCoverage: crystal density and clustering (0 to 1).
 * - heapScale: scale multiplier for pyramidal salt heaps (0 at p=0, up to 1 at p=1).
 */
export function crystallization(progress = 0) {
  const p = clamp(progress, 0, 1);

  // Water begins receding smoothly
  const recede = p * 15;

  // Salt crust nucleates along clay borders as brine saturates
  const crustThickness = smoothstep(0.06, 0.94, p) * 18;
  const crustCoverage = smoothstep(0.04, 0.85, p);

  // Pyramidal salt heaps are raked into corner heaps as harvesting progresses
  const heapScale = smoothstep(0.12, 1.0, p);

  return {
    progress: p,
    recede,
    crustThickness,
    crustCoverage,
    heapScale,
  };
}

/**
 * Where in the sky a pan's water shows.
 *
 * Across a wide flat field you see the water at a grazing angle, so it carries
 * the low band of the sky, and the band rises as the pans come closer to you.
 * Each pan therefore shows its own slice of one continuous sky: violet at the
 * far edge of the field, the apricot of the horizon at the near edge. Sampling
 * it per pan is what stops twelve pans reading as one picture tiled twelve times.
 *
 * @param {number} y height in the field
 * @returns {number} the matching height in the sky
 */
export function reflectY(y) {
  const depth = clamp((y - HORIZON_Y) / (H - HORIZON_Y), 0, 1);
  return HORIZON_Y * (0.3 + 0.7 * depth);
}

/**
 * The colour of the sky at a height. A three stop ramp, zenith to horizon.
 */
export function skyAt(sky, y) {
  const u = clamp(y / HORIZON_Y, 0, 1);
  return u < 0.55 ? mix(sky.zenith, sky.mid, u / 0.55) : mix(sky.mid, sky.horizon, (u - 0.55) / 0.45);
}

/**
 * How far along the drying front a given pan is.
 *
 * The salt takes the field from the far corner outward, so the pans dry in a
 * moving front and the progress slider is something you watch cross the ground.
 * Order comes from real distance from the corner, not a hand-weighted index.
 *
 * @param {{center: [number, number]}} pan the pan, with its centre
 * @param {number} progress 0..1 across the whole drying
 * @returns {number} 0 wet, 1 dry
 */
export function panDrying(pan, progress) {
  return radialFront(progress, pan.center[0], pan.center[1], {
    originX: FIELD.originX,
    originY: FIELD.originY,
    speed: FIELD.speed,
    softness: FIELD.softness,
  });
}

/**
 * The salt raker's pose and shadow for a time of day.
 *
 * One person, one long rake, bent over a pan the whole day. Her shadow is the
 * clock: its length comes from the engine's sun (`h / tan(elevation)`), held
 * at a body length and a half, so it is longest at either end of the day and
 * shortest at noon. It falls away from the sun, judged by `sunX` against the
 * middle of the frame.
 */
export function raker(time = 0, progress = 0, timeOfDay = 0, seed = 1, sunX = W / 2) {
  const t = clamp(timeOfDay, 0, 1);
  const stroke = Math.sin(time * 1.15 + seed * 0.7);
  const pull = Math.sin(time * 1.15 + seed * 0.7 - 0.55);
  const height = 72;

  const sun = sunAt(t, { latitudeDeg: LATITUDE_DEG });

  // Away from the sun, never toward it, and set by where the sun actually is.
  const shadowDir = sunX >= W / 2 ? -1 : 1;

  return {
    x: 386 + Math.sin(time * 0.19 + seed) * 30 + progress * 22,
    y: 706,
    height,
    // In bodies, the unit the renderer multiplies by.
    shadow: shadowLength(height, sun.elevationDeg, { max: 1.5 }) / height,
    sunElevationDeg: sun.elevationDeg,
    shadowDir,
    bend: 0.72 + 0.1 * pull,
    rakeX: stroke * 40,
    rakeY: pull * 8,
    stroke,
  };
}

/**
 * Sky and lighting colors for time of day:
 * timeOfDay: 0 = dawn, 0.5 = noon, 1 = dusk.
 *
 * The disc is placed from the engine's `sunAt`, the same call `raker()` uses,
 * so disc and shadow move together. The pigment ramps are hand-chosen: they
 * are about Ribandar's light, not the sun's position.
 */
export function skyAtmosphere(timeOfDay = 0, time = 0, seed = 1) {
  const t = clamp(timeOfDay, 0, 1);

  // Dawn (t = 0): slate-violet zenith to apricot and soft gold horizon
  // Noon (t = 0.5): deep cerulean zenith to bright bleached cyan horizon
  // Dusk (t = 1.0): dark indigo zenith to rich crimson and burnt amber horizon

  let zenith, mid, horizon;

  if (t <= 0.5) {
    const u = t / 0.5; // 0 (dawn) -> 1 (noon)
    zenith = u < 0.5 ? '#26294a' : '#2a5b84';
    mid = u < 0.5 ? '#6f5774' : '#5792ba';
    horizon = u < 0.5 ? '#e29762' : '#d2e8f6';
  } else {
    const u = (t - 0.5) / 0.5; // 0 (noon) -> 1 (dusk)
    zenith = u < 0.5 ? '#214364' : '#181530';
    mid = u < 0.5 ? '#7b4c60' : '#813247';
    horizon = u < 0.5 ? '#dd7947' : '#d0572e';
  }

  const sun = sunAt(t, { latitudeDeg: LATITUDE_DEG });
  const elevation = sun.above;
  const sunY = lerp(HORIZON_Y - 8, 72, elevation);
  // Bearing relative to noon, spread over 780 (dawn, east, right) to 420 (dusk).
  const noonAz = sunAt(0.5, { latitudeDeg: LATITUDE_DEG }).azimuthDeg;
  const arc = Math.abs(sunAt(0, { latitudeDeg: LATITUDE_DEG }).azimuthDeg - noonAz);
  const sunX = lerp(780, 420, (sun.azimuthDeg - noonAz + arc) / (2 * arc));
  const sunRadius = lerp(24, 32, elevation);
  const sunGlow = lerp(0.9, 0.4, elevation);

  // Distant palms along far bank
  const r = rng(`mithagar:palms:${seed}`);
  const palmClusters = Array.from({ length: 18 }, (_, i) => ({
    x: r.range(20, W - 20),
    y: HORIZON_Y - r.range(2, 8),
    height: r.range(22, 44),
    lean: r.range(-0.18, 0.18),
    fronds: r.int(5, 7),
  }));

  return {
    timeOfDay: t,
    zenith,
    mid,
    horizon,
    sun: { x: sunX, y: sunY, radius: sunRadius, glow: sunGlow, elevationDeg: sun.elevationDeg, azimuthDeg: sun.azimuthDeg },
    palms: palmClusters,
  };
}

/**
 * Pyramidal salt heaps (mithacho rashi):
 * Each pan has raked pyramidal heaps placed near pan corners and along bunds.
 * Each pyramid has four triangular facets: sunlit and shaded sides.
 */
export function saltHeaps(pans, progress = 0, seed = 1, rakes = []) {
  const p = clamp(progress, 0, 1);
  const crys = crystallization(p);
  const r = rng(`mithagar:heaps:${seed}`);

  const heaps = [];

  pans.forEach(pan => {
    // Determine corner location based on pan position
    const isOdd = (pan.row + pan.col) % 2 === 1;
    const cornerX = isOdd ? pan.x0 + pan.w * 0.84 : pan.x0 + pan.w * 0.18;
    const cornerY = pan.y1 - pan.h * 0.22;

    // Perspective sizing based on row
    const rowScale = pan.row === 0 ? 0.55 : pan.row === 1 ? 0.78 : 1.0;
    const maxBaseW = (48 + r.range(-4, 6)) * rowScale;
    const maxBaseH = (22 + r.range(-2, 3)) * rowScale;
    const maxH = (42 + r.range(-3, 5)) * rowScale;

    const baseW = maxBaseW * crys.heapScale;
    const baseH = maxBaseH * crys.heapScale;
    const height = maxH * crys.heapScale;

    const rx = baseW / 2;
    const ry = baseH / 2;
    const apex = [cornerX, cornerY - height];

    const isRaked = rakes.includes(pan.id) || rakes.includes(`heap_${pan.id}`);

    // Pyramid four base vertices
    const north = [cornerX, cornerY - ry];
    const south = [cornerX, cornerY + ry];
    const west = [cornerX - rx, cornerY];
    const east = [cornerX + rx, cornerY];

    heaps.push({
      id: pan.id,
      panId: pan.id,
      x: cornerX,
      y: cornerY,
      baseW,
      baseH,
      height,
      apex,
      north,
      south,
      west,
      east,
      facets: {
        sunny: [apex, south, east],
        shaded: [apex, north, west],
        front: [apex, west, south],
        back: [apex, east, north],
      },
      raked: isRaked,
      rakeRings: [
        { rx: rx * 1.32, ry: ry * 1.32 },
        { rx: rx * 1.68, ry: ry * 1.68 },
        { rx: rx * 2.05, ry: ry * 2.05 },
      ],
    });
  });

  return heaps;
}

/**
 * Sandpiper waders (little stints) foraging on the bunds in playful register:
 * Deterministic running, alert pauses, and pecking dips into the clay edge.
 */
export function sandpiperBehaviors(time = 0, seed = 1, count = 4) {
  const birds = [];
  const r = rng(`mithagar:birds:${seed}`);

  // Fixed bund walking segments
  const bundTracks = [
    { x0: 100, x1: 460, y: 404, dir: 1 },
    { x0: 620, x1: 980, y: 577, dir: -1 },
    { x0: 315, x1: 315, y0: 430, y1: 670, vertical: true, dir: 1 },
    { x0: 875, x1: 875, y0: 290, y1: 520, vertical: true, dir: -1 },
  ];

  for (let i = 0; i < count; i++) {
    const track = bundTracks[i % bundTracks.length];
    const phaseOffset = i * 1.83 + r.range(0.2, 0.8);
    const loopTime = 6.0;
    const cycle = ((time + phaseOffset) % loopTime) / loopTime;

    let x, y, facing, state, legAngle, peckAngle;

    if (track.vertical) {
      // Moves up and down on vertical bund
      const span = track.y1 - track.y0;
      const tNorm = 0.5 + 0.5 * Math.sin((time + phaseOffset) * 0.8);
      x = track.x0;
      y = track.y0 + span * tNorm;
      facing = Math.cos((time + phaseOffset) * 0.8) >= 0 ? 1 : -1;
    } else {
      // Moves left and right on horizontal bund
      const span = track.x1 - track.x0;
      const tNorm = 0.5 + 0.5 * Math.sin((time + phaseOffset) * 0.7);
      x = track.x0 + span * tNorm;
      y = track.y;
      facing = Math.cos((time + phaseOffset) * 0.7) >= 0 ? 1 : -1;
    }

    if (cycle < 0.42) {
      // Running along the bund
      state = 'run';
      legAngle = Math.sin(time * 24 + i) * 0.55;
      peckAngle = 0;
    } else if (cycle < 0.65) {
      // Standing alert, soft tail bob
      state = 'stand';
      legAngle = 0;
      peckAngle = Math.sin(time * 6 + i) * 0.08;
    } else if (cycle < 0.92) {
      // Dipping head down to peck at brine edge
      state = 'peck';
      legAngle = 0.05;
      peckAngle = 0.65 + Math.sin(time * 16 + i) * 0.28;
    } else {
      // Paused before turning
      state = 'pause';
      legAngle = 0;
      peckAngle = 0.04;
    }

    birds.push({
      id: i,
      x,
      y,
      facing,
      state,
      legAngle,
      peckAngle,
      scale: 0.85,
    });
  }

  return birds;
}

/**
 * Pure frame model:
 * Computes landscape, crystallization, heaps, lighting, and register dynamics.
 */
export function model({
  time = 0,
  seed = 1,
  register = 'warm',
  params = {},
  W: width = W,
  H: height = H,
} = {}) {
  const reg = ['quiet', 'warm', 'playful'].includes(register) ? register : 'warm';
  const progress = params.progress != null ? clamp(Number(params.progress), 0, 1) : 0.65;
  const timeOfDay = params.timeOfDay != null ? clamp(Number(params.timeOfDay), 0, 1) : 0;

  const layout = panLayout(seed, width, height);
  const crys = crystallization(progress);
  const sky = skyAtmosphere(timeOfDay, time, seed);
  const sluice = sluiceGate(seed);
  const heaps = saltHeaps(layout.pans, progress, seed, params.rakes || []);

  const birds = reg === 'playful'
    ? sandpiperBehaviors(time, seed, 4)
    : reg === 'warm'
      ? sandpiperBehaviors(time, seed, 1)
      : [];

  const ripples = {
    amp: reg === 'quiet' ? 0 : reg === 'playful' ? 2.0 : 1.2,
    phase: reg === 'quiet' ? 0 : time * 1.8,
  };

  const shimmer = {
    amp: reg === 'quiet' ? 0 : reg === 'playful' ? 1.5 : 0.9,
    phase: reg === 'quiet' ? 0 : time * 3.2,
  };

  // One person working the pans, and the shadow that says what hour it is.
  const worker = raker(time, progress, timeOfDay, seed, sky.sun.x);

  return {
    time,
    seed,
    register: reg,
    progress,
    timeOfDay,
    settled: reg === 'quiet',
    W: width,
    H: height,
    layout,
    crys,
    sky,
    sluice,
    heaps,
    sandpipers: birds,
    ripples,
    shimmer,
    raker: worker,
    look: LOOKS[reg],
  };
}
