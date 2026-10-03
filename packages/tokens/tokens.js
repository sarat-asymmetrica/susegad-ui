// Susegad UI tokens: the JS mirror of tokens.css.
//
// This file is the source. `tools/build-css.mjs` writes tokens.css from it,
// and tokens.test.js parses tokens.css back and checks the two agree, so a
// hand edit to either one that is not carried to the other fails the tests.
//
// Everything here is plain data or a pure function, except `readToken`, which
// reads a live element's computed style and only works in a browser.

import {
  oklchToRgb, rgbToOklch, oklchToCss, oklchToHex, contrast, fitContrast, gamutMap,
  hexToOklch, parseOklch, toRgb, over, deltaE, roundOklch,
} from './color.js';

export {
  oklchToRgb, rgbToOklch, oklchToCss, oklchToHex, contrast, fitContrast, gamutMap,
  hexToOklch, parseOklch, toRgb, over, deltaE, roundOklch,
};

/**
 * A colour token: OKLCH as numbers, as a CSS string, and as an sRGB hex
 * fallback. `l` is given in percent to match how CSS writes it.
 * @typedef {{ l: number, c: number, h: number, css: string, hex: string }} Swatch
 */

/** @returns {Swatch} */
function c(lPct, ch, h) {
  const lch = { l: lPct / 100, c: ch, h };
  return { ...lch, css: oklchToCss(lch), hex: oklchToHex(lch) };
}

/** A themed swatch: one value per theme. */
const t = (light, dark) => ({ light, dark });

// ─── Palettes ──────────────────────────────────────────────────────────────
//
// Each palette has
//   pigments  named colours for drawing and decoration, the same in both
//             themes; never text unless a role says so
//   themed    the grounds and inks, one value per theme
//   roles     what components read; every text role meets WCAG 2.2 AA
//             (4.5:1) on surface, surface-raised and surface-sunk
//   alpha     the translucent roles, built from a themed colour plus an alpha

export const palettes = {
  susegad: {
    label: 'Susegad',
    about: 'The sketchbook: monsoon-indigo ink on handmade cream paper, with the pigments the plates were drawn in.',
    source: 'asymmetrica-web/explorations/susegad (index.html and pieces/*.js)',
    pigments: {
      laterite: { ...c(56.24, 0.1283, 37.47), note: 'Chiro: the red stone Goa is built from' },
      indigo: { ...c(35.34, 0.0899, 266.89), note: 'Kairi and Neel: block-print indigo' },
      kokum: { ...c(39.5, 0.142, 356.54), note: 'Vel: the bougainvillea stroke, the colour of kokum' },
      mango: { ...c(79.05, 0.1312, 82.45), note: 'Mankurad and the gallery haldi' },
      paddy: { ...c(58.38, 0.1228, 134.51), note: 'Shet: rice at its lushest' },
      sea: { ...c(65.54, 0.0507, 224.04), note: 'Ghat: the sea under monsoon cloud' },
      inland: { ...c(90.81, 0.0169, 230.92), note: 'The inland-letter card the prompts are written on' },
    },
    themed: {
      paper: { ...t(c(94.67, 0.0127, 86.83), c(20.93, 0.0389, 269.55)), note: 'handmade cream; at night, monsoon sky' },
      'paper-raised': { ...t(c(97.05, 0.0098, 87.47), c(25.19, 0.0413, 269.26)), note: 'the mount a plate sits on' },
      'paper-deep': { ...t(c(91.2, 0.017, 84), c(17, 0.035, 270)), note: 'a sunk well: inputs, code, table stripes' },
      rule: { ...t(c(85.59, 0.0054, 83.48), c(32.63, 0.026, 271.71)), note: 'ink at 15% on paper, a pencil hairline' },
      'rule-strong': { ...t(c(58.15, 0.0348, 271.38), c(55, 0.02, 95)), note: '3:1 or more on every ground: control borders' },
      ink: { ...t(c(27.78, 0.0521, 267.56), c(92.25, 0.021, 88.72)), note: 'monsoon-indigo ink; 11.4:1 or more' },
      'ink-soft': { ...t(c(44.15, 0.048, 269.17), c(78.02, 0.0219, 88.75)), note: 'secondary text; 6:1 or more' },
      'ink-faint': { ...t(c(50.18, 0.0348, 271.38), c(63.91, 0.0178, 95.34)), note: 'captions and labels; 4.5:1 or more on every ground' },
    },
    roles: {
      surface: 'paper',
      'surface-raised': 'paper-raised',
      'surface-sunk': 'paper-deep',
      text: 'ink',
      'text-soft': 'ink-soft',
      'text-faint': 'ink-faint',
      rule: 'rule',
      'rule-strong': 'rule-strong',
      accent: { ...t(c(55.09, 0.1283, 37.47), c(70, 0.13, 40)), note: 'laterite: the primary act, as a fill' },
      'on-accent': { ...t(c(97.05, 0.0098, 87.47), c(20.93, 0.0389, 269.55)), note: 'text on an accent fill' },
      'accent-text': { ...t(c(51.46, 0.1283, 37.47), c(64.52, 0.1283, 37.47)), note: 'laterite as text: links, the active tab' },
      success: { ...t(c(49.06, 0.1228, 134.51), c(62.13, 0.1228, 134.51)), note: 'paddy green' },
      warning: { ...t(c(50.55, 0.1066, 75.03), c(79.05, 0.1312, 82.45)), note: 'haldi, darkened to read' },
      danger: { ...t(c(39.5, 0.142, 356.54), c(65.01, 0.14, 0)), note: 'kokum, far enough from laterite in hue to tell apart' },
      info: { ...t(c(49.71, 0.0507, 224.04), c(65.54, 0.0507, 224.04)), note: 'the monsoon sea' },
      focus: { ...t(c(50, 0.16, 262), c(72, 0.13, 250)), note: 'a clear indigo ring, 3:1 or more on every ground' },
      selection: { ...t(c(88, 0.085, 86), c(36, 0.07, 266)), note: 'a haldi highlighter; indigo wash at night' },
      pencil: { ...t(c(64, 0.028, 271.38), c(47, 0.018, 95.34)), note: 'drawing only: pencil strokes and construction lines, fainter than any text; never text' },
    },
    alpha: {
      scrim: { of: 'paper', light: 0.86, dark: 0.9, note: 'a paper wash behind text on scenes' },
      shadow: { of: 'ink', light: 0.45, dark: 0.6, darkOf: 'black', note: 'the lift shadow colour at full strength: ink by day, near-black at night (ink is light at night and would glow)' },
    },
  },

  casa: {
    label: 'Casa',
    about: 'A Goan house palette, sampled from its photographs and adjusted for WCAG by hand. Ported exactly: every light value is the original hex.',
    source: 'a villa redesign\'s tokens.css',
    pigments: {
      teak: { ...c(50.73, 0.0737, 75.04), note: 'price, the primary act (#7E5F32, 5.17:1 on paper)' },
      tile: { ...c(49, 0.1066, 50.79), note: 'peak season, careful, unconfirmed (#8F4C20, 5.73:1)' },
      pool: { ...c(51.9, 0.0831, 217.42), note: 'available, yours to take: the one true chroma (#1F7488, 4.72:1)' },
      moss: { ...c(44.84, 0.0418, 132.54), note: 'verified, confirmed (#4C5A42, 6.48:1)' },
      'pool-bright': { ...c(74.26, 0.0764, 210.99), note: 'decoration only, never text on paper (#6FB9C7)' },
      'teak-bright': { ...c(68.07, 0.08, 76.15), note: 'decoration only, never text on paper (#B5925F)' },
      laterite: { ...c(51.2, 0.1319, 35.75), note: 'the nameplate niche and the spiral stair (#A4452C)' },
      lime: { ...c(95.12, 0.011, 211.04), note: 'lime plaster in full sun (#E7F1F3)' },
      night: { ...c(20.08, 0.0124, 270.73), note: 'the one dark chapter (#14161C)' },
      'night-ink': { ...c(91.42, 0.0174, 84.59), note: 'ink for the night chapter (#E8E2D6)' },
    },
    themed: {
      paper: { ...t(c(95.55, 0.014, 88.68), c(20.08, 0.0124, 270.73)), note: 'lime plaster in shade, warmed (#F4F0E6); at night, the night chapter' },
      'paper-raised': { ...t(c(98.23, 0.0069, 88.64), c(24.5, 0.013, 268)), note: '#FBF9F4' },
      'paper-deep': { ...t(c(91.98, 0.0198, 87.52), c(16.5, 0.011, 270)), note: '#EAE4D6' },
      rule: { ...t(c(88.26, 0.0225, 89.81), c(31.98, 0.0063, 274.66)), note: '#DED8C8' },
      'rule-strong': { ...t(c(60.16, 0.0249, 78.12), c(53.22, 0.02, 80)), note: 'ink-faint deepened to 3:1 on every ground: control borders' },
      ink: { ...t(c(26.85, 0.0245, 69.16), c(91.42, 0.0174, 84.59)), note: "the architect's pen (#2E2419), 13.35:1 on paper" },
      'ink-soft': { ...t(c(49.1, 0.0296, 78.67), c(76, 0.02, 82)), note: '#6A5F4E, 5.49:1 on paper' },
      'ink-faint': { ...t(c(50.72, 0.0249, 78.12), c(63.46, 0.0249, 78.12)), note: 'the original #93897A is 3.03:1, labels only at 13px and up; deepened to 4.5:1 so it can carry any text. The original stays as the pigment --sg-casa-faint' },
    },
    roles: {
      surface: 'paper',
      'surface-raised': 'paper-raised',
      'surface-sunk': 'paper-deep',
      text: 'ink',
      'text-soft': 'ink-soft',
      'text-faint': 'ink-faint',
      rule: 'rule',
      'rule-strong': 'rule-strong',
      accent: { ...t(c(50.73, 0.0737, 75.04), c(68.07, 0.08, 76.15)), note: 'teak: price, the primary act' },
      'on-accent': { ...t(c(98.23, 0.0069, 88.64), c(20.08, 0.0124, 270.73)), note: 'paper on teak, 5.59:1; night on bright teak at night' },
      'accent-text': { ...t(c(50.73, 0.0737, 75.04), c(68.07, 0.08, 76.15)), note: 'teak as text' },
      success: { ...t(c(44.84, 0.0418, 132.54), c(62.25, 0.06, 132)), note: 'moss: verified, confirmed' },
      warning: { ...t(c(49, 0.1066, 50.79), c(63.7, 0.11, 51)), note: 'tile: peak season, careful, unconfirmed' },
      danger: { ...t(c(51.2, 0.1319, 35.75), c(64.15, 0.13, 36)), note: 'laterite; the house kept it for decoration, and at 4.78:1 on the deepest ground it also reads as text' },
      info: { ...t(c(49.97, 0.0831, 217.42), c(74.26, 0.0764, 210.99)), note: 'pool, deepened a touch: the original #1F7488 is 4.23:1 on paper-deep' },
      focus: { ...t(c(51.9, 0.0831, 217.42), c(74.26, 0.0764, 210.99)), note: 'pool' },
      selection: { ...t(c(91, 0.05, 211), c(36, 0.05, 215)), note: 'a pool-bright wash, light enough for ink-soft' },
      pencil: { ...t(c(63.46, 0.0249, 78.12), c(48, 0.02, 80)), note: "drawing only: the redesign's pencil (#93897A), for strokes that need no text contrast; never text" },
    },
    alpha: {
      scrim: { of: 'paper-raised', light: 0.9, dark: 0.9, note: 'a sunlit-plaster wash behind text on scenes; ink-soft stays AA over the darkest drawing' },
      shadow: { of: 'ink', light: 0.4, dark: 0.6, darkOf: 'black', note: 'the lift shadow colour at full strength: ink by day, near-black at night (ink is light at night and would glow)' },
    },
    /** The original hex values, kept so the tests can prove the port is exact. */
    original: {
      paper: '#F4F0E6', 'paper-raised': '#FBF9F4', 'paper-deep': '#EAE4D6', rule: '#DED8C8',
      ink: '#2E2419', 'ink-soft': '#6A5F4E', 'ink-faint': '#93897A',
      teak: '#7E5F32', tile: '#8F4C20', pool: '#1F7488', moss: '#4C5A42',
      'pool-bright': '#6FB9C7', 'teak-bright': '#B5925F', laterite: '#A4452C', lime: '#E7F1F3',
      night: '#14161C', 'night-ink': '#E8E2D6',
    },
  },

  azulejo: {
    label: 'Azulejo',
    about: 'The painted tiles of Goa\'s Portuguese-era houses and churches: a cream glaze, cobalt ink, and the lemon and leaf green of the majolica cousin. Dark is the same cobalt at night.',
    source: 'the azulejo and majolica tiles of Goa (a sister palette for the tile-band component)',
    pigments: {
      cobalt: { ...c(42.68, 0.1420, 260.56), note: "the blue of the brush: cobalt oxide under a clear glaze (#1B4A9B, 6.7:1 on cream)" },
      'cobalt-bright': { ...c(76.23, 0.1002, 262.12), note: "cobalt lifted for a night ground; decoration and dark-theme lines, never text on cream (#8FB2F2)" },
      lemon: { ...c(84.96, 0.1463, 90.49), note: "the yellow of majolica; decoration only, never text on cream (#F2C94C)" },
      leaf: { ...c(57.43, 0.1290, 138.24), note: "the green of the leaves in a majolica border; decoration (#4F8A3A)" },
      glaze: { ...c(97.87, 0.0136, 92.98), note: "the white of a glazed tile (#FBF8EE)" },
      wash: { ...c(86.44, 0.0422, 263.00), note: "a thin cobalt wash, the pale blue behind a motif (#C4D3EF)" },
    },
    themed: {
      paper: { ...t(c(96.10, 0.0205, 91.58), c(23.10, 0.0709, 266.88)), note: "cream plaster; at night, deep cobalt" },
      'paper-raised': { ...t(c(98.44, 0.0108, 95.16), c(29.09, 0.0990, 267.41)), note: "the glaze a card sits on" },
      'paper-deep': { ...t(c(92.51, 0.0276, 90.91), c(19.74, 0.0596, 266.58)), note: "a sunk well: inputs, code, table stripes" },
      rule: { ...t(c(86.57, 0.0303, 94.38), c(36.34, 0.0919, 268.66)), note: "a grout line" },
      'rule-strong': { ...t(c(59.08, 0.0412, 97.36), c(62.09, 0.0879, 269.38)), note: "3:1 or more on every ground: control borders" },
      ink: { ...t(c(29.39, 0.1014, 265.92), c(94.82, 0.0244, 94.07)), note: "cobalt-black ink on cream; cream on the night ground; 11.4:1 or more" },
      'ink-soft': { ...t(c(43.11, 0.0968, 269.51), c(84.45, 0.0386, 272.47)), note: "secondary text; 6.5:1 or more" },
      'ink-faint': { ...t(c(50.60, 0.0927, 271.57), c(73.13, 0.0654, 272.82)), note: "captions and labels; 4.5:1 or more on every ground" },
    },
    roles: {
      surface: 'paper',
      'surface-raised': 'paper-raised',
      'surface-sunk': 'paper-deep',
      text: 'ink',
      'text-soft': 'ink-soft',
      'text-faint': 'ink-faint',
      rule: 'rule',
      'rule-strong': 'rule-strong',
      accent: { ...t(c(42.68, 0.1420, 260.56), c(76.23, 0.1002, 262.12)), note: "cobalt: the primary act, as a fill" },
      'on-accent': { ...t(c(98.44, 0.0108, 95.16), c(23.10, 0.0709, 266.88)), note: "glaze on cobalt; night on bright cobalt at night" },
      'accent-text': { ...t(c(42.68, 0.1420, 260.56), c(76.23, 0.1002, 262.12)), note: "cobalt as text: links, the active tab" },
      success: { ...t(c(47.20, 0.1160, 142.13), c(76.57, 0.1189, 138.41)), note: "leaf green, darkened to read" },
      warning: { ...t(c(47.70, 0.0990, 79.41), c(84.96, 0.1463, 90.49)), note: "lemon, darkened to a mustard by day to read; lemon itself at night" },
      danger: { ...t(c(46.50, 0.1470, 24.94), c(77.22, 0.1079, 28.22)), note: "a terracotta red, which the tiles do not have, so it is a plain warning red" },
      info: { ...t(c(48.70, 0.1316, 255.91), c(76.23, 0.1002, 262.12)), note: "a lighter cobalt" },
      focus: { ...t(c(42.68, 0.1420, 260.56), c(84.96, 0.1463, 90.49)), note: "cobalt by day, lemon at night; 3:1 or more on every ground" },
      selection: { ...t(c(92.18, 0.0902, 96.83), c(39.23, 0.1198, 268.41)), note: "a lemon highlighter; cobalt wash at night" },
      pencil: { ...t(c(72.53, 0.0524, 271.37), c(51.69, 0.0953, 268.52)), note: "drawing only: pencil strokes and construction lines, fainter than any text; never text" },
    },
    alpha: {
      scrim: { of: 'paper-raised', light: 0.9, dark: 0.9, note: 'a glaze wash behind text on scenes' },
      shadow: { of: 'ink', light: 0.4, dark: 0.6, darkOf: 'black', note: 'the lift shadow colour at full strength: ink by day, near-black at night (ink is light at night and would glow)' },
    },
  },
};

// Casa's own faint ink survives as a pigment, for 13px-and-up labels on
// decoration where the designer wanted it.
palettes.casa.pigments['casa-faint'] = { ...c(63.46, 0.0249, 78.12), note: 'the original ink-faint (#93897A): 3.03:1, large text and decoration only' };
palettes.casa.original['casa-faint'] = '#93897A';

export const themes = ['light', 'dark'];

/** Text roles and the grounds each must meet 4.5:1 on. */
export const textRoles = ['text', 'text-soft', 'text-faint', 'accent-text', 'success', 'warning', 'danger', 'info'];
export const surfaceRoles = ['surface', 'surface-raised', 'surface-sunk'];

/** Black, for a shadow that must stay a shadow at night. */
const BLACK = c(0, 0, 0);

/**
 * The colour under a translucent role in one theme: the themed swatch it is `of`, or, in the
 * dark theme, `darkOf` when set ('black', or another themed swatch's name).
 * @returns {Swatch}
 */
export function alphaBase(p, v, theme) {
  const name = theme === 'dark' && v.darkOf ? v.darkOf : v.of;
  return name === 'black' ? BLACK : p.themed[name][theme];
}

/**
 * Every opaque role of a palette as sRGB hex, for one theme. Canvas code reads
 * these: a 2D context cannot parse light-dark() or var(), and OKLCH strings
 * only in newer browsers.
 *   const { pencil, text } = roleHex('casa', 'light'); // '#93897A', '#2E2419'
 * @param {keyof typeof palettes} name
 * @param {'light'|'dark'} theme
 * @returns {Record<string, string>}
 */
export function roleHex(name, theme) {
  return Object.fromEntries(Object.entries(resolveRoles(name, theme)).filter(([, v]) => v.alpha == null).map(([k, v]) => [k, v.hex]));
}

/**
 * Resolve a palette's roles for one theme to swatches, including the alpha
 * roles as { swatch, alpha }.
 * @param {keyof typeof palettes} name
 * @param {'light'|'dark'} theme
 */
export function resolveRoles(name, theme) {
  const p = palettes[name];
  /** @type {Record<string, Swatch & { alpha?: number }>} */
  const out = {};
  for (const [role, v] of Object.entries(p.roles)) {
    out[role] = typeof v === 'string' ? p.themed[v][theme] : v[theme];
  }
  for (const [role, v] of Object.entries(p.alpha)) {
    out[role] = { ...alphaBase(p, v, theme), alpha: v[theme] };
  }
  return out;
}

// ─── Type ──────────────────────────────────────────────────────────────────

const devanagariSystem = ["'Kohinoor Devanagari'", "'Devanagari Sangam MN'", "'Noto Sans Devanagari'", "'Nirmala UI'", 'Mangal'];
const kannadaSystem = ["'Kannada Sangam MN'", 'Tunga'];

export const type = {
  // Order matters: the browser falls back per character, so each stack lists
  // the Latin system face before the Indic system faces (Nirmala UI and
  // Kohinoor also carry Latin and would otherwise take it over).
  families: {
    // Castoro for Latin; the Tiro faces are its Devanagari and Kannada
    // companions (same foundry, same calligraphic serif logic).
    display: ["'Castoro'", "'Tiro Devanagari Marathi'", "'Tiro Kannada'", "'Castoro Fallback'", "'Iowan Old Style'", 'Georgia', "'Noto Serif Devanagari'", "'Noto Serif Kannada'", ...devanagariSystem, ...kannadaSystem, 'serif'],
    // Mukta covers Latin and Devanagari in one family; Noto Sans Kannada
    // matches its colour for Kannada.
    body: ["'Mukta'", "'Noto Sans Kannada'", "'Mukta Fallback'", "'Segoe UI'", 'system-ui', ...devanagariSystem, ...kannadaSystem, 'sans-serif'],
    // Kalam is a hand for Latin and Devanagari. Kannada has no hand face we
    // trust yet, so it falls through to the body faces.
    hand: ["'Kalam'", "'Kalam Fallback'", "'Segoe Print'", "'Bradley Hand'", "'Noto Sans Kannada'", ...devanagariSystem, ...kannadaSystem, 'cursive'],
    mono: ['ui-monospace', "'Cascadia Mono'", "'SF Mono'", 'Menlo', 'Consolas', "'Noto Sans Mono'", ...devanagariSystem, ...kannadaSystem, 'monospace'],
  },
  /**
   * The self-hosted faces the stacks name first, declared in fonts.css (next
   * to tokens.css; built by tools/build-fonts.py). Link it in the page head.
   * Each web face is followed by its metric-matched "<Family> Fallback", so
   * text does not jump when the face arrives; the stacks read well without it.
   */
  fontFaces: 'fonts.css',
  weights: { light: 300, regular: 400, medium: 500, bold: 600 },
  leading: { tight: 1.12, snug: 1.3, body: 1.6, loose: 1.8 },
  /** Indic scripts carry matras above and below the line; give them room. */
  leadingIndic: { tight: 1.3, snug: 1.45, body: 1.75, loose: 1.9 },
  indicLangs: ['hi', 'mr', 'kok', 'kn', 'sa', 'ne'],
  measure: '62ch',
  measureNarrow: '42ch',
  /** Fluid scale: from `min` at a 360px viewport to `max` at 1280px. */
  scale: { minViewport: 360, maxViewport: 1280, minBase: 1, maxBase: 1.125, minRatio: 1.18, maxRatio: 1.25, steps: [-1, 0, 1, 2, 3, 4, 5] },
};

/** The `clamp()` for one step of the fluid scale. */
export function fluidStep(step, s = type.scale) {
  const r4 = v => +v.toFixed(4);
  const min = s.minBase * s.minRatio ** step;
  const max = s.maxBase * s.maxRatio ** step;
  const vMin = s.minViewport / 16, vMax = s.maxViewport / 16;
  const slope = (max - min) / (vMax - vMin);
  const intercept = min - slope * vMin;
  return { min: r4(min), max: r4(max), css: `clamp(${r4(min)}rem, ${r4(intercept)}rem + ${r4(slope * 100)}vw, ${r4(max)}rem)` };
}

type.steps = Object.fromEntries(type.scale.steps.map(n => [n, fluidStep(n)]));

// ─── Space, radii, lines ───────────────────────────────────────────────────

/** The Casa rhythm: 4, 8, 16, 24, 40, 64, 96, 144 px, written in rem. */
export const space = { 1: '0.25rem', 2: '0.5rem', 3: '1rem', 4: '1.5rem', 5: '2.5rem', 6: '4rem', 7: '6rem', 8: '9rem' };
export const radius = { 0: '0', 1: '2px', 2: '4px', 3: '8px', 4: '14px', pill: '999px' };
export const line = { hairline: '1px', hairlineRetina: '0.5px', 'rule-width': '1px', stroke: '1.5px', 'stroke-bold': '2px', 'focus-width': '2px', 'focus-offset': '2px' };
export const layout = { content: '1180px' };

// ─── Utilities ─────────────────────────────────────────────────────────────

/**
 * The few classes every component and recipe may rely on. Each is a selector
 * and its declarations; build-css writes them after the tokens.
 *
 *   <span class="sg-vh">3 of 8 files uploaded</span>       read, never seen
 *   <a class="sg-vh sg-vh-focusable" href="#main">Skip to the booking form</a>
 */
export const utilities = {
  // Visually hidden: still in the accessibility tree and read aloud. The
  // clip-path collapses what shows; 1px and no wrapping keep screen readers
  // from reading it one word per line.
  '.sg-vh': {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: '0',
    border: '0',
    overflow: 'hidden',
    'clip-path': 'inset(50%)',
    'white-space': 'nowrap',
  },
  // Shown again while it has keyboard focus, for skip links and the like.
  '.sg-vh-focusable:focus-visible': {
    width: 'auto',
    height: 'auto',
    margin: '0',
    padding: 'var(--sg-space-2) var(--sg-space-3)',
    overflow: 'visible',
    'clip-path': 'none',
    'white-space': 'normal',
    'z-index': '100',
    background: 'var(--sg-surface-raised)',
    color: 'var(--sg-text)',
    outline: 'var(--sg-focus-width) solid var(--sg-focus)',
    'outline-offset': 'var(--sg-focus-offset)',
  },
};

// ─── Motion ────────────────────────────────────────────────────────────────

/**
 * A damped spring sampled into a CSS `linear()` easing.
 * @param {number} damping ratio ζ, below 1 overshoots
 * @param {number} [points]
 */
export function springEasing(damping, points = 28) {
  const w = 6.4 / damping; // settles to within about 0.2% by t = 1
  const wd = w * Math.sqrt(1 - damping * damping);
  const x = t => 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t));
  const vals = [];
  for (let i = 0; i <= points; i++) vals.push(i === points ? 1 : +x(i / points).toFixed(3));
  return `linear(${vals.join(', ')})`;
}

/** Peak overshoot of a spring with damping ratio ζ, as a fraction. */
export const springOvershoot = damping => Math.exp((-damping * Math.PI) / Math.sqrt(1 - damping * damping));

export const motion = {
  /** Durations in milliseconds, for the warm register (the default). */
  durations: { instant: 70, quick: 140, calm: 280, slow: 560, ambient: 9000, fade: 180 },
  easings: {
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
    // The pen lands, gathers speed along the stroke, and lifts softly.
    ink: 'cubic-bezier(0.45, 0.05, 0.25, 1)',
    spring: springEasing(0.72),
  },
  /** Used where `linear()` is not supported. */
  springFallback: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
  /** Under prefers-reduced-motion: movement is instant, opacity may still fade. */
  reduced: { instant: 0.01, quick: 0.01, calm: 0.01, slow: 0.01, ambient: 0, fade: 150 },
};

// ─── Teental: staggering by the sixteen-beat cycle ─────────────────────────
//
// A generic ease staggers a list by a flat multiple of the index. Teental
// (Wave 5, ported from the sketchbook's `teental.js`) staggers it by a
// sixteen-beat rhythmic cycle instead: four sections of four, with a heavy
// first beat (sam) and a three-beat silence (khali) in the third section.
// Nothing enters on a khali beat, the way the tabla's bass drum falls silent
// there. `--sg-tala-beat` is the CSS duration of one beat, for a list staggered
// in pure CSS (`animation-delay: calc(var(--sg-tala-beat) * <n>)`); `talaDelay`
// is the same arithmetic in JS, for a WAAPI or class-toggling stagger, and
// caps the wait so a long list never keeps its last item waiting.

export const tala = {
  beats: 16,
  /** Beats that stay quiet: no entrance lands here, as the bass drum rests through them. */
  khali: [8, 9, 10],
  /** One beat, in milliseconds. Fast enough that a full go-round still reads as one gesture. */
  beatMs: 130,
  /** No entrance waits longer than this, however long the list. */
  maxDelayMs: 600,
};

/** The beats of a `beats`-long cycle that are not in `khali`, in order. */
export function talaBeats(beats = tala.beats, khali = tala.khali) {
  const out = [];
  for (let i = 0; i < beats; i++) if (!khali.includes(i)) out.push(i);
  return out;
}

/**
 * The stagger delay, in milliseconds, for the `index`-th item in a list
 * entering on the teental cycle: items land only on the beats outside
 * `khali`, cycling round again once they run out, and the result is capped
 * at `tala.maxDelayMs` so the last item of a long list is never kept waiting
 * past it. Pure; the same result for the same arguments every time.
 * @param {number} index 0-based position in the list
 * @param {{ beats?: number, khali?: number[], beat?: number }} [opts]
 */
export function talaDelay(index, { beats = tala.beats, khali = tala.khali, beat = tala.beatMs } = {}) {
  const active = talaBeats(beats, khali);
  const slot = active[((index % active.length) + active.length) % active.length];
  const round = Math.floor(index / active.length);
  const raw = (round * beats + slot) * beat;
  return Math.min(raw, tala.maxDelayMs);
}

// ─── Sound ─────────────────────────────────────────────────────────────────

/** Names of the synth patches. The patches themselves arrive with the sound layer. */
export const sound = { tick: 'tick', confirm: 'confirm', complete: 'complete', error: 'error' };

// ─── The register ──────────────────────────────────────────────────────────

export const registers = {
  quiet: {
    about: 'Only the motion state requires, transitions under 200ms, no ornament, hairline rules.',
    ornament: 0, motionScale: 0.6, wobble: 0, sound: 'confirmations',
    durations: { instant: 50, quick: 100, calm: 160, slow: 190, ambient: 0, fade: 120 },
    spring: null, // no overshoot: the spring easing becomes ease-out
    glass: { blur: 0, tint: 100 }, // words over a drawing sit on an opaque plate
  },
  warm: {
    about: 'Slow ambient motion, one living thing per screen, hand-drawn detail visible up close.',
    ornament: 1, motionScale: 1, wobble: 0.6, sound: 'soft',
    durations: { ...motion.durations },
    spring: 0.72,
    glass: { blur: 14, tint: 74 }, // frosted: the drawing shows through, blurred (blur in px, tint as % of the raised paper)
  },
  playful: {
    about: 'Fully interactive, overshoot and spring allowed, motifs and colour.',
    ornament: 2, motionScale: 1.2, wobble: 1.4, sound: 'full',
    durations: { instant: 80, quick: 170, calm: 340, slow: 700, ambient: 7000, fade: 200 },
    spring: 0.48,
    glass: { blur: 18, tint: 66 },
  },
};
export const defaultRegister = 'warm';

for (const r of Object.values(registers)) {
  r.easeSpring = r.spring ? springEasing(r.spring) : motion.easings.out;
  r.overshoot = r.spring ? +springOvershoot(r.spring).toFixed(3) : 0;
}

// ─── Browser only ──────────────────────────────────────────────────────────

/**
 * Read a token's computed value on an element. Browser only; the only
 * function here that touches the DOM.
 * @param {Element} el
 * @param {string} name with or without the leading `--sg-`
 */
export function readToken(el, name) {
  const prop = name.startsWith('--') ? name : `--sg-${name}`;
  const view = el.ownerDocument.defaultView;
  return view.getComputedStyle(el).getPropertyValue(prop).trim();
}

let probeCtx = null;

/**
 * Resolve a colour token on an element to sRGB, the way the browser paints it:
 * light-dark(), color-mix() and var() are resolved against the element, and
 * the colour is drawn into a 1×1 canvas so any serialisation works. Browser
 * only. Returns 0..1 channels plus alpha, and the opaque hex.
 * @param {Element} el
 * @param {string} name
 * @returns {{ r: number, g: number, b: number, a: number, hex: string }}
 */
export function readColor(el, name) {
  const doc = el.ownerDocument;
  const probe = doc.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;color:var(${name.startsWith('--') ? name : `--sg-${name}`})`;
  el.appendChild(probe);
  const value = doc.defaultView.getComputedStyle(probe).color;
  probe.remove();
  if (!probeCtx) {
    const cv = doc.createElement('canvas');
    cv.width = cv.height = 1;
    probeCtx = cv.getContext('2d', { willReadFrequently: true });
  }
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillStyle = '#000';
  probeCtx.fillStyle = value;
  probeCtx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probeCtx.getImageData(0, 0, 1, 1).data;
  const h = v => v.toString(16).padStart(2, '0');
  // Canvas pixels are premultiplied-then-unpremultiplied; for alpha < 1 the
  // channels are the colour itself, which is what compositing needs.
  return { r: r / 255, g: g / 255, b: b / 255, a: a / 255, hex: `#${h(r)}${h(g)}${h(b)}`.toUpperCase() };
}
