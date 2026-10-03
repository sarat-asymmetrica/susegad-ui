// Prahar: raga hours. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/prahar.js (read
// only; never edited). The day's sky as keyframes mixed in OKLab, the eight
// watches with one common choice of raga for each, the ruler's geometry, and
// the hour for any moment are plain functions here; render.js paints them.
// The raga-to-hour mapping is one common reckoning. Traditions differ.

import { rng, clamp, lerp, ease } from '../../engine/index.js';

export const W = 1200, H = 780;
export const HORIZON = 432, RIVER_BOT = 492, LAND_BOT = 668;
export const RULER = { x0: 60, x1: 1140, y: 716 };
/** The plate's evening: Yaman, 18:24. Every register's still is this hour unless `hour` is set. */
export const STILL_HOUR = 18.4;
/** Seconds into the scene that the still stands for; with seed 1 the playful day starts at 04:36, as the plate did. */
export const STILL_TIME = 41.4;

/**
 * How each register lives through the day. `day` is the seconds for 24
 * hours; `ripples` and `twinkle` are the small motions; `scrub` lets the
 * pointer and the keys move the hour. quiet is a still.
 */
export const LOOKS = {
  quiet: { day: 0, ripples: false, twinkle: false, scrub: false },
  warm: { day: 144, ripples: true, twinkle: true, scrub: false },
  playful: { day: 72, ripples: true, twinkle: true, scrub: true },
};

// ── Colour: OKLCH keyframes blended in OKLab ────────────────────────────────

const toGam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
/** OKLCH (h in degrees) → OKLab. */
export const lchToLab = ([L, C, h]) => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
/** OKLab → sRGB 0..255 (Björn Ottosson's matrices), clamped. */
export function labToRgb([L, a, b]) {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map(v => Math.round(clamp(toGam(clamp(v))) * 255));
}

/** The day as keyframes: hour, zenith and horizon (OKLCH), light 0..1, warmth 0..1. */
export const KEYS = [
  [0, [0.17, 0.035, 268], [0.25, 0.045, 275], 0.04, 0],
  [4, [0.19, 0.04, 268], [0.28, 0.05, 285], 0.06, 0],
  [5.3, [0.30, 0.06, 275], [0.55, 0.08, 345], 0.22, 0.35],
  [6.2, [0.50, 0.08, 255], [0.80, 0.11, 55], 0.55, 0.95],
  [7.5, [0.66, 0.09, 240], [0.88, 0.06, 85], 0.8, 0.4],
  [10, [0.70, 0.10, 238], [0.90, 0.04, 215], 0.95, 0.08],
  [13, [0.68, 0.11, 240], [0.92, 0.03, 210], 1, 0],
  [16, [0.66, 0.10, 240], [0.88, 0.05, 80], 0.9, 0.3],
  [17.8, [0.55, 0.09, 250], [0.78, 0.13, 50], 0.66, 1],
  [18.6, [0.40, 0.08, 275], [0.60, 0.12, 20], 0.34, 0.8],
  [19.5, [0.27, 0.06, 275], [0.38, 0.07, 300], 0.12, 0.2],
  [21, [0.19, 0.045, 270], [0.27, 0.05, 278], 0.05, 0],
  [24, [0.17, 0.035, 268], [0.25, 0.045, 275], 0.04, 0],
].map(([h, z, hz, light, warm]) => ({ h, z: lchToLab(z), hz: lchToLab(hz), light, warm }));

export const wrapHour = hour => { const r = hour % 24; return r < 0 ? r + 24 : r; };

/** Sky and light at an hour (0..24): zenith and horizon as [r, g, b], light and warmth 0..1. */
export function skyAt(hour) {
  hour = wrapHour(hour);
  let i = 0;
  while (i < KEYS.length - 2 && hour > KEYS[i + 1].h) i++;
  const a = KEYS[i], b = KEYS[i + 1], u = ease.inOutSine(clamp((hour - a.h) / (b.h - a.h)));
  const mixLab = (p, q) => p.map((v, k) => lerp(v, q[k], u));
  return { zenith: labToRgb(mixLab(a.z, b.z)), horizon: labToRgb(mixLab(a.hz, b.hz)), light: lerp(a.light, b.light, u), warm: lerp(a.warm, b.warm, u) };
}

/** The eight watches, from 6 in the morning, with one common choice of raga for each. */
export const WATCHES = [
  { from: 6, raga: 'Bhairav', deva: 'भैरव', when: 'dawn' },
  { from: 9, raga: 'Todi', deva: 'तोडी', when: 'morning' },
  { from: 12, raga: 'Sarang', deva: 'सारंग', when: 'midday' },
  { from: 15, raga: 'Multani', deva: 'मुलतानी', when: 'afternoon' },
  { from: 18, raga: 'Yaman', deva: 'यमन', when: 'evening' },
  { from: 21, raga: 'Bageshri', deva: 'बागेश्री', when: 'night' },
  { from: 0, raga: 'Malkauns', deva: 'मालकौंस', when: 'midnight' },
  { from: 3, raga: 'Lalit', deva: 'ललित', when: 'before dawn' },
];
export const watchAt = hour => WATCHES.find(w => wrapHour(hour - w.from) < 3);

// ── The ruler ─────────────────────────────────────────────────────────────

/** The ruler runs from 06:00 at its left end round to 06:00 again. */
export const rulerX = hour => RULER.x0 + (wrapHour(hour - 6) / 24) * (RULER.x1 - RULER.x0);
export const hourAtX = x => (6 + clamp((x - RULER.x0) / (RULER.x1 - RULER.x0)) * 24) % 24;
/** Units along the ruler per hour. */
export const UNITS_PER_HOUR = (RULER.x1 - RULER.x0) / 24;
/** 19:10, to the ten minutes. */
export const fmt = hour => { hour = wrapHour(hour); const h = Math.floor(hour), m = Math.floor((hour - h) * 60); return `${String(h).padStart(2, '0')}:${String(Math.floor(m / 10) * 10).padStart(2, '0')}`; };
/** "Evening, Yaman, 19:10": what the status says when the page sets the hour. */
export const say = hour => { const w = watchAt(hour); return `${w.when[0].toUpperCase()}${w.when.slice(1)}, ${w.raga}, ${fmt(hour)}`; };

/** A seed other than 1 starts the day at another hour. */
export const offsetOf = seed => (seed === 1 ? 0 : rng(`prahar:${seed}`)() * 24);

/** The hour at a moment of the scene's clock, for a register. Pure. */
export function hourAt(time, register = 'warm', seed = 1) {
  const look = LOOKS[register] || LOOKS.warm;
  const day = look.day || LOOKS.playful.day;
  return wrapHour(STILL_HOUR + ((time - STILL_TIME) / day) * 24 + offsetOf(seed));
}

/**
 * The per-frame description. With `hour` set the page's own clock drives the
 * light: time stands still and the scene settles until the attribute changes.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const held = params.hour != null;
  const hour = held ? wrapHour(params.hour) : hourAt(time, register, seed);
  return { time, seed, register, look, held, hour, sky: skyAt(hour), watch: watchAt(hour), settled: held };
}
