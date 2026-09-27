// Colour maths for Susegad UI tokens. Pure: runs in Node and the browser.
//
// OKLab and OKLCH follow Björn Ottosson's definitions (the same ones CSS Color 4
// uses). Contrast is the WCAG 2.x ratio. Everything takes and returns plain
// objects: rgb as { r, g, b } in 0..1 (gamma encoded sRGB), OKLCH as
// { l, c, h } with l in 0..1, c roughly 0..0.4 and h in degrees.

const clamp01 = v => Math.min(1, Math.max(0, v));

/** sRGB gamma to linear light. */
export function toLinear(v) {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Linear light to sRGB gamma. */
export function fromLinear(v) {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

/**
 * sRGB (0..1, gamma encoded) to OKLab.
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {{ L: number, a: number, b: number }}
 */
export function rgbToOklab({ r, g, b }) {
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

/**
 * OKLab to sRGB (0..1, gamma encoded). Not clamped: values outside 0..1 mean
 * the colour is outside the sRGB gamut.
 */
export function oklabToRgb({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  };
}

export function oklabToOklch({ L, a, b }) {
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-6 ? 0 : h };
}

export function oklchToOklab({ l, c, h }) {
  const t = (h * Math.PI) / 180;
  return { L: l, a: c * Math.cos(t), b: c * Math.sin(t) };
}

/** OKLCH to sRGB, unclamped. Use `gamutMap` first when the result must be displayable. */
export function oklchToRgb(lch) {
  return oklabToRgb(oklchToOklab(lch));
}

export function rgbToOklch(rgb) {
  return oklabToOklch(rgbToOklab(rgb));
}

// Half an 8-bit step: a colour this close to the edge paints the same once
// clamped, so it counts as inside.
const EPS = 0.5 / 255;
export function inGamut({ r, g, b }) {
  return r >= -EPS && r <= 1 + EPS && g >= -EPS && g <= 1 + EPS && b >= -EPS && b <= 1 + EPS;
}

/**
 * Bring an OKLCH colour inside sRGB by lowering chroma at constant lightness
 * and hue (binary search). Lightness and hue are what the eye holds on to.
 */
export function gamutMap(lch) {
  const l = clamp01(lch.l);
  if (inGamut(oklchToRgb({ ...lch, l }))) return { ...lch, l };
  let lo = 0, hi = lch.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgb({ l, c: mid, h: lch.h }))) lo = mid; else hi = mid;
  }
  return { l, c: lo, h: lch.h };
}

export function hexToRgb(hex) {
  let s = hex.trim().replace(/^#/, '');
  if (s.length === 3 || s.length === 4) s = [...s].map(ch => ch + ch).join('');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) throw new TypeError(`Not a hex colour: ${hex}`);
  return {
    r: parseInt(s.slice(0, 2), 16) / 255,
    g: parseInt(s.slice(2, 4), 16) / 255,
    b: parseInt(s.slice(4, 6), 16) / 255,
  };
}

export function rgbToHex({ r, g, b }) {
  const h = v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export const hexToOklch = hex => rgbToOklch(hexToRgb(hex));
export const oklchToHex = lch => rgbToHex(oklchToRgb(gamutMap(lch)));

/**
 * Round OKLCH to the precision the tokens are written in: lightness to 0.01%,
 * chroma to 4 places, hue to 2. This is enough for every 8-bit hex to survive
 * a round trip.
 */
export function roundOklch({ l, c, h }) {
  const r = (v, p) => Math.round(v * 10 ** p) / 10 ** p;
  const cc = r(c, 4);
  return { l: r(l, 4), c: cc, h: cc === 0 ? 0 : r(h, 2) % 360 };
}

/** `oklch(95.23% 0.0141 88.4)` */
export function oklchToCss({ l, c, h }, alpha) {
  const n = v => String(+v.toFixed(4));
  const pct = String(+(l * 100).toFixed(2));
  const a = alpha === undefined || alpha === 1 ? '' : ` / ${String(+alpha.toFixed(3))}`;
  return `oklch(${pct}% ${n(c)} ${String(+h.toFixed(2))}${a})`;
}

/** Parse `oklch(L C H)` with L as a percentage or a number. Alpha is ignored. */
export function parseOklch(str) {
  const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.%]+\s*)?\)$/i.exec(str.trim());
  if (!m) throw new TypeError(`Not an oklch() colour: ${str}`);
  return { l: m[2] ? +m[1] / 100 : +m[1], c: +m[3], h: +m[4] };
}

/**
 * Normalise any colour the tokens use to sRGB (0..1): a hex string, an
 * `oklch()` string, { l, c, h } or { r, g, b }.
 */
export function toRgb(color) {
  if (typeof color === 'string') {
    const s = color.trim();
    if (s.startsWith('#')) return hexToRgb(s);
    if (/^oklch\(/i.test(s)) return oklchToRgb(gamutMap(parseOklch(s)));
    const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
    if (m) return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255 };
    throw new TypeError(`Unsupported colour: ${color}`);
  }
  if ('l' in color && 'h' in color) return oklchToRgb(gamutMap(color));
  if ('r' in color) return color;
  throw new TypeError('Unsupported colour object');
}

/** WCAG relative luminance. */
export function luminance(color) {
  const { r, g, b } = toRgb(color);
  return 0.2126 * toLinear(clamp01(r)) + 0.7152 * toLinear(clamp01(g)) + 0.0722 * toLinear(clamp01(b));
}

/**
 * WCAG 2.x contrast ratio between two colours, 1 to 21.
 * @returns {number}
 */
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Change an OKLCH colour's lightness as little as possible (chroma is lowered
 * only where the gamut demands it) so that it reaches `target` contrast
 * against every ground in `grounds`. It moves away from the grounds: darker on
 * light grounds, lighter on dark ones. Returns the colour unchanged if it
 * already passes.
 * @param {{ l: number, c: number, h: number }} lch
 * @param {Array<string|object>|string|object} grounds
 * @param {number} target
 */
export function fitContrast(lch, grounds, target = 4.5) {
  const list = Array.isArray(grounds) ? grounds : [grounds];
  const worst = x => Math.min(...list.map(g => contrast(x, g)));
  const start = gamutMap(lch);
  if (worst(start) >= target) return start;
  const lightGround = list.reduce((s, g) => s + luminance(g), 0) / list.length > 0.18;
  let lo = start.l, hi = lightGround ? 0 : 1;
  const at = l => gamutMap({ l, c: lch.c, h: lch.h });
  if (worst(at(hi)) < target) return at(hi);
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (worst(at(mid)) >= target) hi = mid; else lo = mid;
  }
  return at(hi);
}

/**
 * Composite a translucent colour over an opaque one, in sRGB, the way the
 * browser does. Used to check text on scrims and selection washes.
 */
export function over(top, alpha, bottom) {
  const t = toRgb(top), b = toRgb(bottom);
  return {
    r: t.r * alpha + b.r * (1 - alpha),
    g: t.g * alpha + b.g * (1 - alpha),
    b: t.b * alpha + b.b * (1 - alpha),
  };
}

/** Euclidean distance in OKLab, times 100 (so 1 is about a just noticeable difference). */
export function deltaE(a, b) {
  const A = rgbToOklab(toRgb(a)), B = rgbToOklab(toRgb(b));
  return 100 * Math.hypot(A.L - B.L, A.a - B.a, A.b - B.b);
}
