// Palette from photographs: the pure part. Runs in Node.
//
// Given decoded pixels (RGBA, the shape of ImageData), find the colours of a
// place and turn them into a token set a page can read from: grounds, inks and
// accents, every text colour adjusted to WCAG 2.2 AA against every ground, in
// light and dark. This is what was done by hand for Casa Exemplo; the README
// shows how the two compare.
//
// Deterministic: the same pixels give the same palette, byte for byte.

import {
  rgbToOklab, oklabToOklch, oklchToCss, oklchToHex, roundOklch, fitContrast, contrast, gamutMap, deltaE, over,
} from './color.js';

/**
 * @typedef {{ data: ArrayLike<number>, width: number, height: number }} Pixels
 * @typedef {{ L: number, a: number, b: number }} Lab
 * @typedef {{ l: number, c: number, h: number }} Lch
 * @typedef {{ lab: Lab, lch: Lch, vivid: Lch, count: number, weight: number, hex: string }} Swatch
 */

/**
 * Sample each image on an even grid (so every image counts about equally)
 * and convert to OKLab. Transparent pixels are skipped.
 * @param {Pixels[]} images
 * @param {{ perImage?: number }} [opts]
 * @returns {Float64Array} L, a, b triples
 */
export function samplePixels(images, { perImage = 20000 } = {}) {
  const out = [];
  const cache = new Map();
  for (const img of images) {
    const { data, width, height } = img;
    const step = Math.max(1, Math.ceil(Math.sqrt((width * height) / perImage)));
    for (let y = step >> 1; y < height; y += step) {
      for (let x = step >> 1; x < width; x += step) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 128) continue;
        const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        let lab = cache.get(key);
        if (!lab) {
          lab = rgbToOklab({ r: data[i] / 255, g: data[i + 1] / 255, b: data[i + 2] / 255 });
          cache.set(key, lab);
        }
        out.push(lab.L, lab.a, lab.b);
      }
    }
  }
  return Float64Array.from(out);
}

/**
 * Median cut in OKLab, then a few Lloyd passes. The cut repeatedly splits the
 * box with the most population times spread, at the median of its widest axis.
 * @param {Float64Array} pts L, a, b triples
 * @param {number} [k] number of colours
 * @param {number} [iterations] Lloyd refinement passes (see `refine`)
 * @returns {Swatch[]} sorted by population, largest first
 */
export function medianCut(pts, k = 16, iterations = 4) {
  const n = pts.length / 3;
  if (n === 0) return [];
  const describe = ids => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const i of ids) for (let d = 0; d < 3; d++) {
      const v = pts[i * 3 + d];
      if (v < lo[d]) lo[d] = v;
      if (v > hi[d]) hi[d] = v;
    }
    const range = [0, 1, 2].map(d => hi[d] - lo[d]);
    const axis = range.indexOf(Math.max(...range));
    return { ids, axis, spread: range[axis], score: range[axis] * Math.sqrt(ids.length) };
  };
  const boxes = [describe(Array.from({ length: n }, (_, i) => i))];
  while (boxes.length < k) {
    let best = -1;
    for (let b = 0; b < boxes.length; b++) {
      if (boxes[b].ids.length < 2 || boxes[b].spread === 0) continue;
      if (best < 0 || boxes[b].score > boxes[best].score) best = b;
    }
    if (best < 0) break;
    const { ids, axis } = boxes[best];
    const sorted = [...ids].sort((p, q) => pts[p * 3 + axis] - pts[q * 3 + axis] || p - q);
    const mid = sorted.length >> 1;
    boxes.splice(best, 1, describe(sorted.slice(0, mid)), describe(sorted.slice(mid)));
  }
  const centres = boxes.map(({ ids }) => {
    let L = 0, a = 0, b = 0;
    for (const i of ids) { L += pts[i * 3]; a += pts[i * 3 + 1]; b += pts[i * 3 + 2]; }
    return [L / ids.length, a / ids.length, b / ids.length];
  });
  return refine(pts, centres, iterations);
}

/**
 * Lloyd iterations from given centres: assign every point to its nearest
 * centre and move the centre to the mean. Median cut alone gives boxes of equal
 * population; this gives each colour its true share. Each swatch also carries
 * `vivid`, the mean of its more saturated half, which is the colour a painter
 * would name (a plain mean greys a pigment out).
 * @param {Float64Array} pts
 * @param {number[][]} centres
 * @param {number} [iterations]
 * @returns {Swatch[]}
 */
export function refine(pts, centres, iterations = 4) {
  const n = pts.length / 3, k = centres.length;
  const assign = new Int32Array(n);
  let cs = centres.map(c => [...c]);
  for (let it = 0; it <= iterations; it++) {
    for (let i = 0; i < n; i++) {
      const L = pts[i * 3], a = pts[i * 3 + 1], b = pts[i * 3 + 2];
      let best = 0, bd = Infinity;
      for (let j = 0; j < k; j++) {
        const c = cs[j], d = (L - c[0]) ** 2 + (a - c[1]) ** 2 + (b - c[2]) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
      assign[i] = best;
    }
    if (it === iterations) break;
    const sum = cs.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) { const s = sum[assign[i]]; s[0] += pts[i * 3]; s[1] += pts[i * 3 + 1]; s[2] += pts[i * 3 + 2]; s[3]++; }
    cs = cs.map((c, j) => (sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : c));
  }
  const members = cs.map(() => []);
  for (let i = 0; i < n; i++) members[assign[i]].push(i);
  const swatches = [];
  cs.forEach((c, j) => {
    const ids = members[j];
    if (!ids.length) return;
    const lab = { L: c[0], a: c[1], b: c[2] };
    const lch = oklabToOklch(lab);
    const byChroma = ids.map(i => [Math.hypot(pts[i * 3 + 1], pts[i * 3 + 2]), i]).sort((p, q) => q[0] - p[0] || p[1] - q[1]);
    const top = byChroma.slice(0, Math.max(1, byChroma.length >> 1));
    let vL = 0, va = 0, vb = 0;
    for (const [, i] of top) { vL += pts[i * 3]; va += pts[i * 3 + 1]; vb += pts[i * 3 + 2]; }
    const vivid = oklabToOklch({ L: vL / top.length, a: va / top.length, b: vb / top.length });
    swatches.push({ lab, lch, vivid, count: ids.length, weight: ids.length / n, hex: oklchToHex(lch) });
  });
  return swatches.sort((p, q) => q.count - p.count || p.lab.L - q.lab.L);
}

/** Weighted circular mean hue and mean chroma of a set of swatches. */
function meanHue(sw) {
  let a = 0, b = 0, w = 0, c = 0;
  for (const s of sw) { a += s.lab.a * s.count; b += s.lab.b * s.count; c += s.lch.c * s.count; w += s.count; }
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { h: (h + 360) % 360, c: w ? c / w : 0 };
}

const hueDist = (h1, h2) => { const d = Math.abs(h1 - h2) % 360; return d > 180 ? 360 - d : d; };
const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const R = roundOklch;

/** Where each semantic role's hue sits, and the hue used if a photo has none. */
export const roleHues = {
  danger: { range: [[0, 45], [340, 360]], fallback: 30 },
  warning: { range: [[45, 100]], fallback: 70 },
  success: { range: [[100, 175]], fallback: 140 },
  info: { range: [[175, 290]], fallback: 225 },
};
const inRange = (h, ranges) => ranges.some(([a, b]) => h >= a && h < b);

/** A plain name for a hue, for pigment names in the report. */
export function hueName(h, c) {
  if (c < 0.03) return 'neutral';
  const names = [[20, 'red'], [45, 'terracotta'], [70, 'ochre'], [100, 'gold'], [135, 'olive'], [170, 'green'], [210, 'teal'], [250, 'blue'], [290, 'indigo'], [330, 'violet'], [360, 'rose']];
  return names.find(([limit]) => h < limit)[1];
}

/**
 * The lightest (on a light ground) or darkest (on a dark ground) version of a
 * colour that still reads as text on every ground. Starting from a middle
 * lightness and fitting toward contrast keeps as much colour as AA allows;
 * a pigment that is already very dark would otherwise pass and stay muddy.
 */
function readable(lch, grounds, theme, target = 4.6) {
  return R(fitContrast({ ...lch, l: theme === 'light' ? 0.64 : 0.5 }, grounds, target));
}

/**
 * The whole pipeline: pixels in, a token set out.
 * @param {Pixels[]} images
 * @param {{ name?: string, k?: number, accents?: number, perImage?: number, groundHue?: number }} [opts]
 *   groundHue sets the paper's hue by hand (a designer warming a cool plaster, say)
 */
export function paletteFromPixels(images, { name = 'photo', k = 16, accents = 5, perImage = 20000, groundHue } = {}) {
  const pts = samplePixels(images, { perImage });
  const total = pts.length / 3;
  const swatches = medianCut(pts, k);

  // Chromatic pixels get their own cut, so a small bright thing (a pool, a
  // painted door, a red stair) is not swallowed by the walls.
  const chroma = [];
  for (let i = 0; i < pts.length; i += 3) {
    if (Math.hypot(pts[i + 1], pts[i + 2]) >= 0.05 && pts[i] > 0.25 && pts[i] < 0.9) chroma.push(pts[i], pts[i + 1], pts[i + 2]);
  }
  const chromatic = medianCut(Float64Array.from(chroma), 16).map(s => ({ ...s, weight: s.count / total }));

  // ── grounds: hue and chroma from the light neutrals; lightness from the reading contract
  let lights = swatches.filter(s => s.lab.L >= 0.72 && s.lch.c <= 0.06);
  if (!lights.length) lights = [...swatches].sort((p, q) => q.lab.L - p.lab.L).slice(0, 2);
  const lightL = lights.reduce((s, x) => s + x.lab.L * x.count, 0) / lights.reduce((s, x) => s + x.count, 0);
  // The paper takes the hue of the most common light surface. A mean across
  // warm and cool lights (sunlit lime against shaded bone) lands on a green
  // that is in neither.
  const gl = meanHue([lights.reduce((a, b) => (b.count > a.count ? b : a))]);
  const gh = groundHue ?? gl.h;
  const gc = clampNum(gl.c * 0.6, 0.004, 0.016);
  const paperL = clampNum(lightL + 0.1, 0.95, 0.97);
  const light = {
    paper: R({ l: paperL, c: gc, h: gh }),
    'paper-raised': R({ l: Math.min(0.985, paperL + 0.027), c: gc * 0.5, h: gh }),
    'paper-deep': R({ l: paperL - 0.036, c: Math.min(0.022, gc * 1.4), h: gh }),
    rule: R({ l: paperL - 0.073, c: Math.min(0.025, gc * 1.6), h: gh }),
  };

  // ── inks: the hue of the photo's shadows, pushed to reading contrast
  let darks = swatches.filter(s => s.lab.L < 0.45);
  if (!darks.length) darks = [...swatches].sort((p, q) => p.lab.L - q.lab.L).slice(0, 2);
  const dk = meanHue(darks);
  const ic = clampNum(dk.c * 0.8, 0.012, 0.035);
  const G = [light.paper, light['paper-raised'], light['paper-deep']];
  light.ink = R(fitContrast({ l: 0.3, c: ic, h: dk.h }, G, 12));
  light['ink-soft'] = R(fitContrast({ l: 0.55, c: ic * 1.15, h: dk.h }, G, 6));
  light['ink-faint'] = R(fitContrast({ l: 0.65, c: ic, h: dk.h }, G, 4.6));
  light['rule-strong'] = R(fitContrast({ l: 0.7, c: ic, h: dk.h }, G, 3.1));

  // ── dark: a night ground in the shadows' hue, lit by the light ground
  const nc = clampNum(dk.c * 0.5, 0.008, 0.02);
  const dark = {
    paper: R({ l: 0.205, c: nc, h: dk.h }),
    'paper-raised': R({ l: 0.25, c: nc, h: dk.h }),
    'paper-deep': R({ l: 0.17, c: nc, h: dk.h }),
    rule: R({ l: 0.33, c: nc, h: dk.h }),
  };
  const D = [dark.paper, dark['paper-raised'], dark['paper-deep']];
  dark.ink = R(fitContrast({ l: 0.9, c: Math.min(0.02, gc * 1.3), h: gh }, D, 12));
  dark['ink-soft'] = R(fitContrast({ l: 0.72, c: Math.min(0.022, gc * 1.4), h: gh }, D, 6.5));
  dark['ink-faint'] = R(fitContrast({ l: 0.6, c: Math.min(0.025, gc * 1.6), h: gh }, D, 4.6));
  dark['rule-strong'] = R(fitContrast({ l: 0.45, c: Math.min(0.025, gc * 1.6), h: gh }, D, 3.1));

  // ── accents: the most vivid, most present colours, at least 35° apart
  const ranked = chromatic
    .map(s => ({ ...s, lch: s.vivid }))
    .filter(s => s.lch.c >= 0.04)
    .map(s => ({ ...s, score: s.lch.c * Math.sqrt(s.weight) }))
    .sort((p, q) => q.score - p.score || p.lch.h - q.lch.h);
  const picked = [];
  for (const s of ranked) {
    if (picked.length >= accents) break;
    if (picked.every(p => hueDist(p.lch.h, s.lch.h) >= 35)) picked.push(s);
  }
  // A hue sweep catches what is small but distinct: a red stair, a painted
  // niche. 15° bins; a bin must hold 0.3% of all pixels to count.
  if (picked.length < accents) {
    const bins = Array.from({ length: 24 }, () => []);
    for (let i = 0; i < chroma.length; i += 3) {
      const c = Math.hypot(chroma[i + 1], chroma[i + 2]);
      if (c < 0.06) continue;
      const h = ((Math.atan2(chroma[i + 2], chroma[i + 1]) * 180) / Math.PI + 360) % 360;
      bins[Math.floor(h / 15) % 24].push([c, i]);
    }
    const minor = [];
    for (const b of bins) {
      if (b.length / total < 0.003) continue;
      b.sort((p, q) => q[0] - p[0] || p[1] - q[1]);
      const top = b.slice(0, Math.max(1, b.length >> 1));
      let L = 0, A = 0, B = 0;
      for (const [, i] of top) { L += chroma[i]; A += chroma[i + 1]; B += chroma[i + 2]; }
      const lch = oklabToOklch({ L: L / top.length, a: A / top.length, b: B / top.length });
      minor.push({ lch, weight: b.length / total, score: lch.c * Math.sqrt(b.length / total) });
    }
    minor.sort((p, q) => q.score - p.score || p.lch.h - q.lch.h);
    for (const s of minor) {
      if (picked.length >= accents) break;
      if (picked.every(p => hueDist(p.lch.h, s.lch.h) >= 35)) picked.push(s);
    }
  }
  const pigments = picked.map((s, i) => ({ name: `pigment-${i + 1}`, family: hueName(s.lch.h, s.lch.c), ...R(gamutMap(s.lch)), weight: +s.weight.toFixed(4) }));
  const typicalC = picked.length ? clampNum(picked.map(p => p.lch.c).sort((a, b) => a - b)[picked.length >> 1], 0.06, 0.13) : 0.09;

  const primary = picked[0] ? picked[0].lch : { l: 0.52, c: typicalC, h: roleHues.info.fallback };
  const from = {};
  for (const [role, { range, fallback }] of Object.entries(roleHues)) {
    const cand = picked.find((p, i) => i > 0 && inRange(p.lch.h, range)) ?? picked.find(p => inRange(p.lch.h, range));
    from[role] = cand ? { lch: cand.lch, source: pigments[picked.indexOf(cand)].name } : { lch: { l: 0.55, c: typicalC, h: fallback }, source: 'synthesised' };
  }

  for (const [theme, T, Gs] of [['light', light, G], ['dark', dark, D]]) {
    const onAccent = theme === 'light' ? T['paper-raised'] : T.paper;
    T.accent = R(fitContrast({ ...primary, l: theme === 'light' ? 0.64 : 0.5 }, [onAccent], 4.7));
    T['on-accent'] = onAccent;
    T['accent-text'] = readable(primary, Gs, theme);
    for (const role of Object.keys(roleHues)) T[role] = readable(from[role].lch, Gs, theme);
    T.focus = R(fitContrast({ ...from.info.lch, l: 0.6, c: Math.max(from.info.lch.c, 0.1) }, Gs, 3.2));
    // A wash in the accent's hue, pushed away from ink-soft until it reads on it.
    const wash = theme === 'light' ? { l: 0.88, c: 0.06, h: primary.h } : { l: 0.36, c: 0.05, h: primary.h };
    T.selection = R(fitContrast(wash, [T['ink-soft']], 4.6));
  }

  const result = {
    name,
    images: images.length,
    samples: total,
    swatches: swatches.map(s => ({ hex: s.hex, oklch: oklchToCss(R(s.lch)), weight: +s.weight.toFixed(4) })),
    pigments: pigments.map(p => ({ ...p, css: oklchToCss(p), hex: oklchToHex(p) })),
    sources: Object.fromEntries(Object.entries(from).map(([k, v]) => [k, v.source])),
    light,
    dark,
  };
  result.contrast = contrastReport(result);
  return result;
}

/** Scrim opacity: enough for ink-soft to stay AA over pure black or pure white. */
const SCRIM = 0.9;

const TEXT = ['ink', 'ink-soft', 'ink-faint', 'accent-text', 'success', 'warning', 'danger', 'info'];
const GROUNDS = ['paper', 'paper-raised', 'paper-deep'];

/** Contrast of every text colour on every ground, plus the special pairs. */
export function contrastReport(p) {
  const out = {};
  for (const theme of ['light', 'dark']) {
    const T = p[theme];
    const rows = {};
    for (const role of TEXT) rows[role] = Object.fromEntries(GROUNDS.map(g => [g, +contrast(T[role], T[g]).toFixed(2)]));
    rows['on-accent'] = { accent: +contrast(T['on-accent'], T.accent).toFixed(2) };
    rows['rule-strong'] = Object.fromEntries(GROUNDS.map(g => [g, +contrast(T['rule-strong'], T[g]).toFixed(2)]));
    rows.focus = Object.fromEntries(GROUNDS.map(g => [g, +contrast(T.focus, T[g]).toFixed(2)]));
    rows.selection = { ink: +contrast(T.ink, T.selection).toFixed(2), 'ink-soft': +contrast(T['ink-soft'], T.selection).toFixed(2) };
    // The scrim sits over a drawing we do not control: check it over pure black and pure white.
    const wash = theme === 'light' ? T['paper-raised'] : T.paper;
    rows.scrim = {};
    for (const role of ['ink', 'ink-soft']) for (const under of ['#000000', '#FFFFFF']) {
      rows.scrim[`${role} over ${under}`] = +contrast(T[role], over(wash, SCRIM, under)).toFixed(2);
    }
    out[theme] = rows;
  }
  return out;
}

/** The lowest text contrast in a report, and where it is (the 3:1 rows are left out). */
export function worstContrast(report) {
  let worst = { ratio: Infinity };
  for (const [theme, rows] of Object.entries(report)) for (const [role, cols] of Object.entries(rows)) {
    if (role === 'rule-strong' || role === 'focus') continue;
    for (const [ground, ratio] of Object.entries(cols)) if (ratio < worst.ratio) worst = { ratio, theme, role, ground };
  }
  return worst;
}

/**
 * The palette as a CSS block in the same shape as tokens.css, so it can sit
 * beside the built-in palettes as `data-palette="<name>"`.
 */
export function paletteToCss(p) {
  const ld = key => `light-dark(${oklchToCss(p.light[key])}, ${oklchToCss(p.dark[key])})`;
  const lines = [];
  lines.push(`/* Palette "${p.name}", made by palette-from-photo from ${p.images} photograph${p.images === 1 ? '' : 's'}.`);
  lines.push('   Every text colour meets WCAG 2.2 AA (4.5:1) on paper, paper-raised and paper-deep, light and dark. */');
  lines.push(`[data-palette="${p.name}"] {`);
  lines.push("  /* pigments: the photographs' own colours, for decoration */");
  for (const g of p.pigments) lines.push(`  --sg-${g.name}: ${g.css}; /* ${g.family}, ${(g.weight * 100).toFixed(1)}% of pixels */`);
  lines.push('', '  /* grounds and inks */');
  for (const k of ['paper', 'paper-raised', 'paper-deep', 'rule', 'rule-strong', 'ink', 'ink-soft', 'ink-faint']) lines.push(`  --sg-${k}: ${ld(k)};`);
  lines.push('', '  /* roles */');
  const alias = { surface: 'paper', 'surface-raised': 'paper-raised', 'surface-sunk': 'paper-deep', text: 'ink', 'text-soft': 'ink-soft', 'text-faint': 'ink-faint' };
  for (const [k, v] of Object.entries(alias)) lines.push(`  --sg-${k}: var(--sg-${v});`);
  for (const k of ['accent', 'on-accent', 'accent-text', 'success', 'warning', 'danger', 'info', 'focus', 'selection']) {
    const src = p.sources[k] ? ` /* from ${p.sources[k]} */` : '';
    lines.push(`  --sg-${k}: ${ld(k)};${src}`);
  }
  lines.push(`  --sg-scrim: light-dark(${oklchToCss(p.light['paper-raised'], SCRIM)}, ${oklchToCss(p.dark.paper, SCRIM)});`);
  lines.push(`  --sg-shadow: light-dark(${oklchToCss(p.light.ink, 0.4)}, oklch(0% 0 0 / 0.6));`);
  lines.push('  --sg-lift: 0 1px 0 color-mix(in oklch, var(--sg-shadow) 12%, transparent), 0 22px 44px -28px var(--sg-shadow);');
  lines.push('}');
  return lines.join('\n') + '\n';
}

/**
 * How far an extracted palette is from a reference (a hand-made one), role by
 * role, as OKLab distance × 100.
 * @param {object} p a paletteFromPixels result
 * @param {Record<string, string>} reference role -> hex, light theme
 * @param {Record<string, string>} [map] reference role -> extracted role
 */
export function compareToReference(p, reference, map = {}) {
  const rows = [];
  for (const [role, hex] of Object.entries(reference)) {
    const mine = p.light[map[role] ?? role];
    if (!mine) continue;
    const extracted = oklchToHex(mine);
    rows.push({ role, reference: hex, extracted, as: map[role] ?? role, deltaE: +deltaE(hex, extracted).toFixed(1) });
  }
  return rows;
}
