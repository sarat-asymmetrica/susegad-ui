// Bake and reflow for colour: the prepared cache, and the arithmetic over it.
//
//   bake(palette)        once: every role's OKLCH axes (L, C, H), light and
//                        dark, plus the translucent roles and the pigments.
//                        Plain JSON; commit it, ship it, read it in CI.
//   recolor(cache, opts) per use: dark or light, a register, a gamut, a
//                        retint. Arithmetic only. No DOM, no parsing, no
//                        palette lookups; runs in Node.
//
// This does not replace tokens.js. It names the shape tokens.js already has
// (colours prepared once, recomposed by arithmetic) and makes it a thing a
// build can hold. With no options `recolor` gives exactly the colours
// `resolveRoles` gives for the shipped palettes (bake.test.js proves it role
// by role). The palette-from-photo tool is a bake source too: `bake` takes
// its result as readily as it takes a shipped palette.

import { palettes, registers, defaultRegister, textRoles, surfaceRoles } from './tokens.js';
import { oklchToCss, oklchToHex, oklchToRgb, gamutMap, contrast, fitContrast, deltaE, oklchToOklab, oklabToOklch, inGamut, oklabToRgb, rgbToHex } from './color.js';

export const CACHE_KIND = 'sg.color.cache';
export const CACHE_VERSION = 1;

/** The themed names a translucent role is `of`, as the roles that carry them. */
const ROLE_OF = {
  paper: 'surface', 'paper-raised': 'surface-raised', 'paper-deep': 'surface-sunk',
  ink: 'text', 'ink-soft': 'text-soft', 'ink-faint': 'text-faint',
  rule: 'rule', 'rule-strong': 'rule-strong',
};
const roleOf = name => ROLE_OF[name] ?? name;

/** The photo tool's role names, as the roles components read. */
const PHOTO_ROLE = { ...ROLE_OF };
const PHOTO_ROLES = ['accent', 'on-accent', 'accent-text', 'success', 'warning', 'danger', 'info', 'focus', 'selection'];
/** paletteToCss's scrim and shadow, as data. */
const PHOTO_ALPHA = {
  scrim: { of: 'surface-raised', darkOf: 'surface', light: 0.9, dark: 0.9 },
  shadow: { of: 'text', darkOf: 'black', light: 0.4, dark: 0.6 },
};

const axes = ({ l, c, h }) => ({ l, c, h });

/**
 * Prepare a palette for recolouring.
 * @param {string|object} palette a shipped palette's name ('casa'), a shipped
 *   palette object (`palettes.casa`), or a `paletteFromPixels` result
 * @param {{ name?: string }} [opts]
 * @returns {{ kind: string, version: number, name: string,
 *   roles: Record<string, { light: {l:number,c:number,h:number}, dark: {l:number,c:number,h:number} }>,
 *   alpha: Record<string, { of: string, darkOf?: string, light: number, dark: number }>,
 *   pigments: Record<string, {l:number,c:number,h:number}> }}
 */
export function bake(palette, { name } = {}) {
  let p = palette, label = name;
  if (typeof palette === 'string') {
    p = palettes[palette];
    if (!p) throw new RangeError(`No palette named ${palette}`);
    label ??= palette;
  }
  if (p && p.themed && p.roles) return bakeShipped(p, label ?? p.label ?? 'palette');
  if (p && p.light && p.dark) return bakePhoto(p, label ?? p.name ?? 'photo');
  throw new TypeError('bake wants a palette name, a palette from tokens.js, or a paletteFromPixels result');
}

function bakeShipped(p, name) {
  const roles = {};
  for (const [role, v] of Object.entries(p.roles)) {
    const t = typeof v === 'string' ? p.themed[v] : v;
    roles[role] = { light: axes(t.light), dark: axes(t.dark) };
  }
  const alpha = {};
  for (const [role, v] of Object.entries(p.alpha)) {
    alpha[role] = { of: roleOf(v.of), ...(v.darkOf ? { darkOf: roleOf(v.darkOf) } : {}), light: v.light, dark: v.dark };
  }
  return { kind: CACHE_KIND, version: CACHE_VERSION, name, roles, alpha, pigments: Object.fromEntries(Object.entries(p.pigments).map(([k, v]) => [k, axes(v)])) };
}

function bakePhoto(p, name) {
  const roles = {};
  for (const [from, role] of Object.entries(PHOTO_ROLE)) roles[role] = { light: axes(p.light[from]), dark: axes(p.dark[from]) };
  for (const role of PHOTO_ROLES) roles[role] = { light: axes(p.light[role]), dark: axes(p.dark[role]) };
  const pigments = Object.fromEntries((p.pigments ?? []).map(g => [g.name, axes(g)]));
  return { kind: CACHE_KIND, version: CACHE_VERSION, name, roles, alpha: structuredClone(PHOTO_ALPHA), pigments };
}

const wrapHue = h => ((h % 360) + 360) % 360;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** The rows a theme's floors are checked against. */
const FLOORS = [
  ...textRoles.map(role => ({ role, on: surfaceRoles, min: 4.5 })),
  { role: 'rule-strong', on: surfaceRoles, min: 3 },
  { role: 'focus', on: surfaceRoles, min: 3 },
  { role: 'on-accent', on: ['accent'], min: 4.5 },
];

/**
 * Every floor a recoloured theme misses: text roles under 4.5:1 on any ground,
 * control borders and the focus ring under 3:1, on-accent under 4.5:1 on the
 * accent. An empty list means the theme is readable.
 * @param {Record<string, { l: number, c: number, h: number }>} roles from `recolor(...).roles`
 * @returns {{ role: string, on: string, ratio: number, min: number }[]}
 */
export function checkFloors(roles) {
  const out = [];
  for (const { role, on, min } of FLOORS) {
    if (!roles[role]) continue;
    for (const ground of on) {
      if (!roles[ground]) continue;
      const ratio = contrast(roles[role], roles[ground]);
      if (ratio < min) out.push({ role, on: ground, ratio: +ratio.toFixed(2), min });
    }
  }
  return out;
}

/**
 * Recompose a baked palette. Arithmetic over the cache and nothing else.
 *
 * With no options this is today's tokens: the same L, C and H, the same CSS
 * strings and hex. The options move the whole palette together; `floors` then
 * pulls any text colour that fell under its contrast floor back to it, moving
 * lightness as little as possible (a colour nobody hand-picked stays gated).
 *
 * `register` is carried, and picks the `glass` the register asks for. It is
 * inert for colour: colour is register-independent in tokens today, so no role
 * changes with it, and nothing should rely on it to.
 *
 * @param {ReturnType<typeof bake>} cache
 * @param {{ register?: 'quiet'|'warm'|'playful', dark?: boolean, gamut?: 'none'|'srgb',
 *   hueShift?: number, chromaScale?: number, lightShift?: number, floors?: boolean }} [opts]
 *   gamut 'none' leaves colours as authored (the browser maps them, as it does
 *   for tokens.css); 'srgb' lowers chroma until each fits, for canvas.
 * @returns {{ name: string, theme: 'light'|'dark', register: string, glass: { blur: number, tint: number },
 *   roles: Record<string, { l: number, c: number, h: number, css: string, hex: string, alpha?: number }>,
 *   violations: ReturnType<typeof checkFloors> }}
 */
export function recolor(cache, { register = defaultRegister, dark = false, gamut = 'none', hueShift = 0, chromaScale = 1, lightShift = 0, floors = true } = {}) {
  if (cache?.kind !== CACHE_KIND) throw new TypeError('recolor wants a cache from bake()');
  if (!registers[register]) throw new RangeError(`No register named ${register}`);
  if (!(chromaScale >= 0)) throw new RangeError('chromaScale is 0 or more');
  if (!Number.isFinite(hueShift) || !Number.isFinite(lightShift)) throw new RangeError('hueShift and lightShift are numbers');
  if (gamut !== 'none' && gamut !== 'srgb') throw new RangeError(`gamut is 'none' or 'srgb', not ${gamut}`);
  const theme = dark ? 'dark' : 'light';
  // Identity options return the baked numbers untouched, so no float drifts.
  const move = ({ l, c, h }) => {
    const cc = chromaScale === 1 ? c : Math.max(0, c * chromaScale);
    return { l: lightShift === 0 ? l : clamp(l + lightShift, 0, 1), c: cc, h: hueShift === 0 || cc === 0 ? h : wrapHue(h + hueShift) };
  };
  const fin = (lch, a) => {
    const m = gamut === 'srgb' ? gamutMap(lch) : lch;
    return { l: m.l, c: m.c, h: m.h, css: oklchToCss(m, a), hex: oklchToHex(lch), ...(a == null ? {} : { alpha: a }) };
  };
  const roles = {};
  const lch = {};
  for (const [role, v] of Object.entries(cache.roles)) lch[role] = move(v[theme]);

  if (floors) {
    for (const { role, on, min } of FLOORS) {
      if (!lch[role] || on.some(g => !lch[g])) continue;
      const grounds = on.map(g => lch[g]);
      if (grounds.every(g => contrast(lch[role], g) >= min)) continue;
      lch[role] = fitContrast(lch[role], grounds, min);
    }
  }
  for (const [role, v] of Object.entries(lch)) roles[role] = fin(v);
  for (const [role, v] of Object.entries(cache.alpha)) {
    const of = theme === 'dark' && v.darkOf ? v.darkOf : v.of;
    const base = of === 'black' ? { l: 0, c: 0, h: 0 } : lch[of];
    roles[role] = fin(base, v[theme]);
  }
  const r = registers[register];
  return { name: cache.name, theme, register, glass: { ...r.glass }, roles, violations: checkFloors(lch) };
}

/**
 * A ramp between two roles of a baked palette: the ends are the roles' own
 * colours and the stops between follow the constrained-projection path: the
 * straight line between them in OKLab, walked stop by stop, with any stop that
 * falls outside sRGB projected onto the gamut boundary in OKLCh (chroma lowered
 * at constant lightness and hue, via `gamutMap`) and the path re-straightened
 * segment-wise between projections. So the path is piecewise-straight and
 * continuous: straight wherever the gamut allows it, and bent only where it
 * does not. Every stop, endpoints included, is in sRGB — the ends themselves
 * are projected if the baked role sits outside (the display path already
 * mapped them; the ramp now says so in its own numbers). That replaces the old
 * straight line's 0.55% out-of-gamut excursions over random in-gamut pairs.
 *
 * Guarantee (asserted in bake.test.js): 100% of stops in gamut, the path
 * continuous (each stop reachable from its neighbours with no jump beyond the
 * endpoints' own distance), straight except where gamut forces a bend.
 * Arithmetic over the cache.
 * @param {ReturnType<typeof bake>} cache
 * @param {{ from?: string, to?: string, steps?: number, dark?: boolean }} [opts]
 * @returns {{ l: number, c: number, h: number }[]} `steps` stops, ends included
 */
export function ramp(cache, { from = 'surface', to = 'text', steps = 9, dark = false } = {}) {
  const theme = dark ? 'dark' : 'light';
  const a = cache.roles[from]?.[theme], b = cache.roles[to]?.[theme];
  if (!a || !b) throw new RangeError(`No role ${cache.roles[from] ? to : from} in the cache`);
  if (!Number.isInteger(steps) || steps < 2) throw new RangeError('A ramp needs at least two stops');
  const A = oklchToOklab(gamutMap(a)), B = oklchToOklab(gamutMap(b));
  // Segment-wise projection: walk the straight line; where a stop leaves sRGB,
  // project it onto the boundary (constant L and h, minimal chroma via
  // `gamutMap`) and re-straighten the remaining path from that anchor, so the
  // path is piecewise-straight and continuous: each bend happens once, where
  // the gamut forces it, not stop by stop.
  const out = [axes(gamutMap(a))];
  let anchor = A;
  for (let k = 1; k < steps - 1; k++) {
    const t = k / (steps - 1);
    // position along the straight line, measured from the last anchor so the
    // remaining path re-straightens after a projection
    const raw = { L: anchor.L + (B.L - anchor.L) * t, a: anchor.a + (B.a - anchor.a) * t, b: anchor.b + (B.b - anchor.b) * t };
    if (inGamut(oklabToRgb(raw))) {
      out.push(oklabToOklch(raw));
    } else {
      const mapped = oklchToOklab(gamutMap(oklabToOklch(raw)));
      out.push(oklabToOklch(mapped));
      anchor = mapped;
    }
  }
  out.push(axes(gamutMap(b)));
  return out;
}

/**
 * How even a ramp is. The perceptual step between neighbours is their OKLab
 * distance (x100, 1 is about a just noticeable difference); a flat profile
 * means the derivative along the ramp is constant, so no step bunches up and
 * none leaps. `ratio` is the biggest step over the smallest.
 * @param {{ l: number, c: number, h: number }[]} stops
 * @returns {{ steps: number[], mean: number, ratio: number, spread: number }} `spread` is the
 *   largest departure from the mean step, as a fraction of it
 */
export function flatness(stops) {
  const steps = [];
  for (let i = 1; i < stops.length; i++) steps.push(deltaE(stops[i - 1], stops[i]));
  const mean = steps.reduce((s, x) => s + x, 0) / steps.length;
  const lo = Math.min(...steps), hi = Math.max(...steps);
  // A ramp between two equal colours has no steps at all, which is perfectly even.
  if (!(mean > 0)) return { steps, mean: 0, ratio: 1, spread: 0 };
  return { steps, mean, ratio: lo > 0 ? hi / lo : Infinity, spread: Math.max(...steps.map(s => Math.abs(s - mean))) / mean };
}

/** Whether a ramp's steps are even to within `tolerance` of their mean (0.15 is 15%). */
export const isFlat = (stops, tolerance = 0.15) => flatness(stops).spread <= tolerance;

/**
 * Every ramp the cache can make between its roles, checked for evenness: each
 * ordered pair of the ground, ink, accent and status roles, in both themes.
 * An empty `uneven` list means every generated ramp is flat to `tolerance`.
 * palette-from-photo runs this on the cache it writes.
 * @param {ReturnType<typeof bake>} cache
 * @param {{ steps?: number, tolerance?: number, roles?: string[] }} [opts]
 * @returns {{ checked: number, worst: { from: string, to: string, dark: boolean, spread: number } | null,
 *   uneven: { from: string, to: string, dark: boolean, spread: number }[] }}
 */
export function checkRamps(cache, { steps = 9, tolerance = 0.15, roles = ['surface', 'surface-raised', 'surface-sunk', 'text', 'text-soft', 'text-faint', 'accent', 'accent-text', 'success', 'warning', 'danger', 'info'] } = {}) {
  const have = roles.filter(r => cache.roles[r]);
  let checked = 0, worst = null;
  const uneven = [];
  for (const dark of [false, true]) for (const from of have) for (const to of have) {
    if (from === to) continue;
    const spread = flatness(ramp(cache, { from, to, steps, dark })).spread;
    checked++;
    const row = { from, to, dark, spread };
    if (!worst || spread > worst.spread) worst = row;
    if (spread > tolerance) uneven.push(row);
  }
  return { checked, worst, uneven };
}

// ── M4: the JND audit and the 8-bit dither ──────────────────────────────────

/** A 4x4 Bayer matrix, normalised to (k + 0.5) / 16 so it is unbiased. */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map(row => row.map(k => (k + 0.5) / 16));

/** The 8-bit hex a ramp stop rounds to, at or below half a step of precision. */
const stopHex = stop => rgbToHex(oklchToRgb(gamutMap(stop)));

/**
 * Adjacent-stop ΔE along a ramp: the JND audit, as gate data. `worst` is the
 * largest adjacent step; a gate asserts `worst <= threshold` unless it accepts
 * the ramp's `flagged` state. Uniform stops (a ramp between equal colours)
 * have steps of 0 and are never flagged by the audit itself.
 * @param {{ l: number, c: number, h: number }[]} stops a `ramp` result
 * @returns {{ steps: number[], worst: number, mean: number }}
 */
export function jndAudit(stops) {
  const steps = [];
  for (let i = 1; i < stops.length; i++) steps.push(deltaE(stops[i - 1], stops[i]));
  const mean = steps.length ? steps.reduce((s, x) => s + x, 0) / steps.length : 0;
  return { steps, worst: steps.length ? Math.max(...steps) : 0, mean };
}

/**
 * Whether the gate's declared threshold holds: every adjacent stop no more
 * than `threshold` ΔE apart. This is the assertion a gate makes; `jndAudit`
 * is the evidence it reads.
 * @param {{ l: number, c: number, h: number }[]} stops
 * @param {number} threshold
 */
export const jndHolds = (stops, threshold) => jndAudit(stops).worst <= threshold;

/**
 * Ordered (Bayer 4x4) dither along a ramp in ramp space, for the sub-15-dE
 * lumpiness of 8-bit: where consecutive stops round to the same hex, the
 * dither offsets each stop's lightness by ±(half an 8-bit step of ramp-space
 * travel) against the Bayer threshold pattern, so the rendered gradient is
 * monotone in perceived lightness instead of stepping in lumps.
 *
 * Opt-in: with `dither: false` (the default) `rampDither` returns the stops
 * unchanged wherever no lump exists, and where lumps exist it returns the
 * original stops plus a report, so no existing caller's output moves until it
 * asks. `dither: true` returns the dithered stops.
 * @param {{ l: number, c: number, h: number }[]} stops a `ramp` result
 * @param {{ dither?: boolean }} [opts]
 * @returns {{ stops: {l:number,c:number,h:number}[], lumps: number, dithered: boolean }}
 *   `lumps` is the count of adjacent pairs that round to the same 8-bit hex
 */
export function rampDither(stops, { dither = false } = {}) {
  const hexes = stops.map(stopHex);
  const lumps = [];
  for (let i = 1; i < stops.length; i++) if (hexes[i] === hexes[i - 1]) lumps.push(i);
  if (!lumps.length) return { stops, lumps: 0, dithered: false };
  if (!dither) return { stops, lumps: lumps.length, dithered: false };
  // Dither in ramp space: offset lightness by the Bayer pattern scaled to the
  // local per-step lightness travel, so an 8-bit rounding plateau becomes a
  // monotone climb once rendered.
  const out = stops.map(s => ({ ...s }));
  for (let i = 0; i < stops.length; i++) {
    const prev = stops[Math.max(0, i - 1)], next = stops[Math.min(stops.length - 1, i + 1)];
    const span = Math.abs(next.l - prev.l) / 2 || 0.5 / 255;
    const threshold = BAYER4[i % 4][(Math.floor(i / 4)) % 4] - 0.5; // -0.5..0.5
    out[i].l = Math.min(1, Math.max(0, stops[i].l + threshold * span));
  }
  return { stops: out, lumps: lumps.length, dithered: true };
}
