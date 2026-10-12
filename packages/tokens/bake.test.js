import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { palettes, resolveRoles, registers, textRoles, surfaceRoles } from './tokens.js';
import { inGamut, oklchToRgb, deltaE, oklchToCss, oklchToHex, contrast, rgbToOklab, oklabToOklch, oklchToOklab, oklabToRgb } from './color.js';
import { paletteFromPixels } from './palette.js';
import { bake, recolor, checkFloors, ramp, flatness, isFlat, checkRamps, jndAudit, jndHolds, rampDither, CACHE_KIND } from './bake.js';

const here = dirname(fileURLToPath(import.meta.url));
const names = Object.keys(palettes);
const lch = ({ l, c, h }) => ({ l, c, h });

// ── the cache is data ───────────────────────────────────────────────────────

test('a baked cache is plain JSON: it survives a round trip and holds no functions', () => {
  for (const name of names) {
    const cache = bake(name);
    assert.equal(cache.kind, CACHE_KIND);
    assert.equal(cache.name, name);
    assert.deepEqual(JSON.parse(JSON.stringify(cache)), cache);
    assert.ok(cache.roles.surface && cache.roles.text && cache.roles.accent, `${name} lacks a core role`);
    assert.ok(cache.alpha.scrim && cache.alpha.shadow);
    for (const v of Object.values(cache.roles)) for (const theme of ['light', 'dark']) {
      assert.deepEqual(Object.keys(v[theme]).sort(), ['c', 'h', 'l']);
    }
  }
});

test('bake accepts a name or the palette object, and refuses anything else', () => {
  assert.deepEqual(bake('casa'), bake(palettes.casa, { name: 'casa' }));
  assert.throws(() => bake('nope'), RangeError);
  assert.throws(() => bake({}), TypeError);
  assert.throws(() => recolor({}), TypeError);
});

// ── recolor with no options is today's tokens ───────────────────────────────

test('recolor() gives exactly the colours resolveRoles gives, role by role, all palettes, both themes', () => {
  let rows = 0, worstL = 0, worstE = 0;
  for (const name of names) {
    const cache = JSON.parse(JSON.stringify(bake(name))); // through JSON, as a CI cache would be
    for (const theme of ['light', 'dark']) {
      const want = resolveRoles(name, theme);
      const got = recolor(cache, { dark: theme === 'dark' });
      assert.deepEqual(Object.keys(got.roles).sort(), Object.keys(want).sort(), `${name} ${theme}: same role set`);
      for (const [role, w] of Object.entries(want)) {
        const g = got.roles[role];
        const d = Math.max(Math.abs(g.l - w.l), Math.abs(g.c - w.c), Math.abs(g.h - w.h));
        worstL = Math.max(worstL, d);
        worstE = Math.max(worstE, deltaE(g, w));
        assert.ok(d <= 1e-12, `${name} ${theme} ${role}: axes differ by ${d}`);
        assert.equal(g.hex, w.hex, `${name} ${theme} ${role}: hex`);
        assert.equal(g.css, oklchToCss(w, w.alpha), `${name} ${theme} ${role}: css`);
        assert.equal(g.alpha, w.alpha, `${name} ${theme} ${role}: alpha`);
        rows++;
      }
    }
  }
  assert.ok(rows >= 4 * 2 * 20, `only ${rows} rows compared`);
  // The stated delta: identical axes (<= 1e-12), identical hex, deltaE 0.
  assert.ok(worstE < 1e-9, `worst deltaE ${worstE}`);
  console.log(`recolor vs resolveRoles: ${rows} role-theme rows over ${names.length} palettes; worst axis delta ${worstL}, worst deltaE ${worstE}`);
});

test('recolor is pure: it does not touch the cache, and the same options give the same answer', () => {
  const cache = bake('azulejo');
  const frozen = structuredClone(cache);
  const deepFreeze = o => { Object.values(o).forEach(v => typeof v === 'object' && v && deepFreeze(v)); return Object.freeze(o); };
  deepFreeze(cache);
  const opts = { dark: true, hueShift: 40, chromaScale: 0.8, lightShift: 0.03 };
  assert.deepEqual(recolor(cache, opts), recolor(cache, opts));
  assert.deepEqual(cache, frozen);
});

test('register is carried with its glass; colour does not move with it', () => {
  const cache = bake('casa');
  const base = recolor(cache).roles;
  for (const r of Object.keys(registers)) {
    const out = recolor(cache, { register: r });
    assert.equal(out.register, r);
    assert.deepEqual(out.glass, registers[r].glass);
    assert.deepEqual(out.roles, base);
  }
  assert.throws(() => recolor(cache, { register: 'loud' }), RangeError);
  assert.throws(() => recolor(cache, { gamut: 'p3' }), RangeError);
});

test('gamut srgb brings every colour inside sRGB; none leaves them as authored', () => {
  // A palette with a deliberately loud pigment role.
  const cache = bake('susegad');
  cache.roles.accent.light = { l: 0.7, c: 0.4, h: 150 };
  const raw = recolor(cache, { floors: false }).roles.accent;
  assert.equal(raw.c, 0.4);
  assert.ok(!inGamut(oklchToRgb(raw)));
  const mapped = recolor(cache, { gamut: 'srgb', floors: false }).roles.accent;
  assert.ok(mapped.c < 0.4 && inGamut(oklchToRgb(mapped)));
  assert.equal(mapped.l, 0.7);
  assert.equal(mapped.hex, raw.hex, 'the hex was always the mapped colour');
  for (const name of names) for (const dark of [false, true]) {
    for (const [role, v] of Object.entries(recolor(bake(name), { dark, gamut: 'srgb' }).roles)) {
      assert.ok(inGamut(oklchToRgb(v)), `${name} ${role}`);
    }
  }
});

// ── the photo tool is a bake source ─────────────────────────────────────────

test('a committed palette-from-photo report bakes, and recolor() gives its own colours back', () => {
  const report = JSON.parse(readFileSync(join(here, 'palettes', 'casa-photo.json'), 'utf8'));
  const cache = bake(report);
  assert.equal(cache.name, 'casa-photo');
  const map = { surface: 'paper', 'surface-raised': 'paper-raised', 'surface-sunk': 'paper-deep', text: 'ink', 'text-soft': 'ink-soft', 'text-faint': 'ink-faint' };
  for (const theme of ['light', 'dark']) {
    const out = recolor(cache, { dark: theme === 'dark' });
    for (const role of ['accent', 'on-accent', 'accent-text', 'success', 'warning', 'danger', 'info', 'focus', 'selection', 'rule', 'rule-strong', ...Object.keys(map)]) {
      const w = report[theme][map[role] ?? role];
      assert.deepEqual(lch(out.roles[role]), lch(w), `${theme} ${role}`);
    }
    assert.equal(out.violations.length, 0, JSON.stringify(out.violations));
    assert.equal(out.roles.scrim.alpha, 0.9);
    assert.equal(out.roles.shadow.alpha, theme === 'dark' ? 0.6 : 0.4);
  }
  assert.deepEqual(Object.keys(cache.pigments), report.pigments.map(p => p.name));
});

test('bake takes a fresh paletteFromPixels result straight from pixels', () => {
  const w = 24, h = 24, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const warm = y < 14;
    data[i] = warm ? 226 : 40; data[i + 1] = warm ? 214 : 70 + x; data[i + 2] = warm ? 190 : 120; data[i + 3] = 255;
  }
  const p = paletteFromPixels([{ data, width: w, height: h }], { name: 'tiny' });
  const cache = bake(p);
  assert.equal(cache.name, 'tiny');
  for (const dark of [false, true]) assert.equal(recolor(cache, { dark }).violations.length, 0);
});

// ── contrast floors stay gated ──────────────────────────────────────────────

test('shipped palettes meet every floor as baked', () => {
  for (const name of names) for (const dark of [false, true]) {
    assert.deepEqual(recolor(bake(name), { dark, floors: false }).violations, [], `${name} ${dark ? 'dark' : 'light'}`);
  }
});

test('a retint that drops a text role under 4.5:1 is caught, and floors pulls it back', () => {
  let caught = 0, pulled = 0;
  for (const name of names) for (const dark of [false, true]) {
    const cache = bake(name);
    // Wash everything toward the middle of the lightness range: the inks
    // lose their distance from the grounds.
    const bad = recolor(cache, { dark, lightShift: dark ? -0.3 : 0.3, floors: false });
    const surfaces = surfaceRoles.map(r => contrast(bad.roles[r], bad.roles.text));
    if (bad.violations.some(v => textRoles.includes(v.role))) caught++;
    assert.ok(surfaces.length === 3);
    const fixed = recolor(cache, { dark, lightShift: dark ? -0.3 : 0.3 });
    assert.deepEqual(fixed.violations, [], `${name} ${dark}: ${JSON.stringify(fixed.violations)}`);
    if (bad.violations.length) pulled++;
  }
  assert.ok(caught >= 4, `only ${caught} of 8 themes tripped a text floor`);
  assert.ok(pulled >= caught);
});

test('floors hold across a sweep of hue, chroma and light', () => {
  let runs = 0;
  for (const name of names) {
    const cache = bake(name);
    for (const dark of [false, true]) for (const hueShift of [0, 60, 120, 180, 240, 300]) for (const chromaScale of [0, 0.5, 1, 1.6]) for (const lightShift of [-0.06, 0, 0.06]) {
      const out = recolor(cache, { dark, hueShift, chromaScale, lightShift });
      assert.deepEqual(out.violations, [], `${name} dark=${dark} hue=${hueShift} chroma=${chromaScale} light=${lightShift}`);
      runs++;
    }
  }
  assert.equal(runs, 4 * 2 * 6 * 4 * 3);
});

test('checkFloors reports the role, the ground and the ratio', () => {
  const roles = {
    surface: { l: 0.95, c: 0.01, h: 80 }, 'surface-raised': { l: 0.97, c: 0.01, h: 80 }, 'surface-sunk': { l: 0.92, c: 0.01, h: 80 },
    text: { l: 0.3, c: 0.02, h: 80 }, 'text-soft': { l: 0.8, c: 0.02, h: 80 },
  };
  const v = checkFloors(roles);
  assert.deepEqual(v.map(x => x.role), ['text-soft', 'text-soft', 'text-soft']);
  assert.deepEqual(v.map(x => x.on), surfaceRoles);
  assert.ok(v.every(x => x.min === 4.5 && x.ratio < 4.5));
});

// ── the flat perceptual derivative of a ramp ────────────────────────────────

test('a ramp between ground and ink steps evenly in OKLab: every palette, both themes, 5 to 13 stops', () => {
  let worst = { spread: 0 };
  for (const name of names) for (const dark of [false, true]) for (const steps of [5, 9, 13]) {
    const stops = ramp(bake(name), { dark, steps });
    assert.equal(stops.length, steps);
    const f = flatness(stops);
    assert.ok(isFlat(stops, 0.15), `${name} dark=${dark} steps=${steps}: spread ${f.spread.toFixed(3)} ratio ${f.ratio.toFixed(2)}`);
    if (f.spread > worst.spread) worst = { name, dark, steps, spread: f.spread, ratio: f.ratio };
  }
  console.log(`ramp flatness: worst spread ${(worst.spread * 100).toFixed(1)}% of the mean step (ratio ${worst.ratio.toFixed(2)}), ${worst.name} dark=${worst.dark} ${worst.steps} stops`);
});

test('a ramp keeps its ends: the first stop is the from role, the last is the to role', () => {
  const cache = bake('haldi');
  const stops = ramp(cache, { from: 'surface', to: 'accent', dark: true, steps: 7 });
  assert.deepEqual(lch(stops[0]), lch(cache.roles.surface.dark));
  assert.ok(Math.abs(stops[6].l - cache.roles.accent.dark.l) < 1e-12);
  assert.throws(() => ramp(cache, { from: 'nope' }), RangeError);
  assert.throws(() => ramp(cache, { steps: 1 }), RangeError);
});

test('a ramp with one bunched step fails the flat test (mutant)', () => {
  const stops = ramp(bake('susegad'), { steps: 9 });
  assert.ok(isFlat(stops));
  const bunched = stops.map((s, i) => (i === 4 ? { ...s, l: stops[3].l + (stops[4].l - stops[3].l) * 0.15 } : s));
  assert.ok(!isFlat(bunched), `spread ${flatness(bunched).spread}`);
  const f = flatness(bunched);
  assert.ok(f.ratio > 2, `ratio ${f.ratio}`);
  // and a leap, not only a bunch
  const leapt = stops.map((s, i) => (i === 4 ? { ...s, l: stops[4].l + (stops[5].l - stops[4].l) * 0.85 } : s));
  assert.ok(!isFlat(leapt));
});

test('flatness measures what it says: a hand-built ramp of known steps', () => {
  const even = [0.2, 0.3, 0.4, 0.5].map(l => ({ l, c: 0, h: 0 }));
  const f = flatness(even);
  assert.ok(f.steps.every(s => Math.abs(s - 10) < 1e-6), f.steps.join());
  assert.ok(f.ratio < 1 + 1e-9);
  const uneven = [0.2, 0.25, 0.4, 0.5].map(l => ({ l, c: 0, h: 0 }));
  assert.ok(flatness(uneven).ratio > 2.9);
});

// Keep the hex/css helpers honest: a swatch's css and hex come from the same axes.
test('every recoloured role carries css and hex that agree with its axes', () => {
  const out = recolor(bake('casa'), { dark: true, hueShift: 25, chromaScale: 1.2, lightShift: 0.02 });
  for (const [role, v] of Object.entries(out.roles)) {
    assert.equal(v.css, oklchToCss(v, v.alpha), role);
    assert.equal(v.hex, oklchToHex(v), role);
  }
});

test('a hue shift wraps round the wheel: hues stay in [0, 360)', () => {
  const cache = bake('susegad');
  for (const hueShift of [100, 200, 359, -90]) for (const dark of [false, true]) {
    for (const [role, v] of Object.entries(recolor(cache, { dark, hueShift }).roles)) {
      assert.ok(v.h >= 0 && v.h < 360, `${role} h=${v.h} after ${hueShift}`);
    }
  }
  assert.equal(recolor(cache, { hueShift: 360 }).roles.accent.h.toFixed(6), cache.roles.accent.light.h.toFixed(6));
});

// ── round 2: the gaps Rasika found ──────────────────────────────────────────

test('the 3:1 floors on rule-strong and the focus ring are checked, and floors pulls them back', () => {
  for (const role of ['rule-strong', 'focus']) {
    const cache = bake('susegad');
    // The role has slipped to nearly the ground's own lightness.
    cache.roles[role].light = { l: 0.9, c: 0.01, h: 80 };
    const bad = recolor(cache, { floors: false });
    const hit = bad.violations.filter(v => v.role === role);
    assert.equal(hit.length, 3, `${role}: ${JSON.stringify(bad.violations)}`);
    assert.ok(hit.every(v => v.min === 3 && v.ratio < 3));
    const fixed = recolor(cache);
    assert.deepEqual(fixed.violations, [], role);
    for (const g of surfaceRoles) assert.ok(contrast(fixed.roles[role], fixed.roles[g]) >= 3, `${role} on ${g}`);
  }
});

test('on-accent is held to 4.5:1 against the accent, not the grounds', () => {
  const cache = bake('susegad');
  cache.roles['on-accent'].light = { ...cache.roles.accent.light, l: cache.roles.accent.light.l + 0.05 };
  const bad = recolor(cache, { floors: false });
  assert.deepEqual(bad.violations.map(v => [v.role, v.on]), [['on-accent', 'accent']]);
  assert.deepEqual(recolor(cache).violations, []);
});

test('lightShift keeps lightness inside 0..1, however far it is pushed', () => {
  for (const lightShift of [0.6, 2, -0.6, -2]) for (const dark of [false, true]) {
    for (const [role, v] of Object.entries(recolor(bake('casa'), { dark, lightShift, floors: false }).roles)) {
      assert.ok(v.l >= 0 && v.l <= 1, `${role} l=${v.l} after ${lightShift}`);
    }
  }
});

test('a chroma-0 role keeps its baked hue when nothing moves it', () => {
  const cache = bake('casa');
  cache.roles.pencil.light = { l: 0.6, c: 0, h: 70 };
  assert.equal(recolor(cache).roles.pencil.h, 70);
  assert.equal(recolor(cache, { hueShift: 40 }).roles.pencil.h, 70, 'a grey has no hue to turn');
});

test('recolor refuses anything that is not a baked cache, by its kind', () => {
  assert.throws(() => recolor({ kind: 'sg.motion.cache', roles: {}, alpha: {} }), /bake\(\)/);
  assert.throws(() => recolor(null), TypeError);
});

/** A cache of two roles, enough to ramp between. */
const pair = (a, b) => ({ kind: CACHE_KIND, roles: { a: { light: a, dark: a }, b: { light: b, dark: b } }, alpha: {} });

test('a ramp takes the short way round the hue wheel, across 0 and between far-apart hues', () => {
  const across = ramp(pair({ l: 0.6, c: 0.12, h: 350 }, { l: 0.7, c: 0.12, h: 10 }), { from: 'a', to: 'b', steps: 5 });
  for (const s of across) assert.ok(s.h > 340 || s.h < 20, `h=${s.h} left the short arc`);
  // the old L, C, H interpolation bunched exactly these cases: a small lightness gap, hues far apart
  for (const [a, b] of [[{ l: 0.6, c: 0.08, h: 30 }, { l: 0.65, c: 0.08, h: 210 }], [{ l: 0.6, c: 0.08, h: 37 }, { l: 0.58, c: 0.08, h: 217 }]]) {
    const far = ramp(pair(a, b), { from: 'a', to: 'b', steps: 9 });
    assert.ok(isFlat(far), `spread ${flatness(far).spread}`);
  }
});

test('every ramp the cache can make is flat: all pairs of ground, ink, accent and status roles, 4 palettes, 3 to 21 stops', () => {
  let checked = 0;
  for (const name of names) for (const steps of [3, 5, 9, 21]) {
    const r = checkRamps(bake(name), { steps });
    assert.deepEqual(r.uneven, [], `${name} ${steps}: ${JSON.stringify(r.uneven.slice(0, 3))}`);
    checked += r.checked;
  }
  assert.ok(checked >= 4 * 4 * 200, `${checked}`);
  console.log(`ramps: ${checked} generated ramps from the 4 shipped palettes, 0 uneven`);
});

test("a palette-from-photo cache's generated ramps are flat too (what the tool gates on)", () => {
  const report = JSON.parse(readFileSync(join(here, 'palettes', 'casa-photo.json'), 'utf8'));
  for (const steps of [5, 9, 21]) {
    const r = checkRamps(bake(report), { steps });
    assert.equal(r.checked, 264);
    assert.deepEqual(r.uneven, []);
  }
});

test('checkRamps can fail: an impossible tolerance flags every ramp, and a ramp bent after the fact is caught', () => {
  const cache = bake('haldi');
  const r = checkRamps(cache, { tolerance: -1 });
  assert.equal(r.uneven.length, r.checked);
  assert.ok(r.worst.spread >= 0);
  const bent = ramp(cache, { steps: 9 }).map((s, i) => (i === 4 ? { ...s, l: s.l + 0.08 } : s));
  assert.ok(!isFlat(bent));
});

test('a single SMALL step among many fails the flat test as surely as a leap does', () => {
  const l = [0];
  for (let i = 1; i <= 20; i++) l.push(l[i - 1] + (i === 10 ? 0.005 : 0.05));
  const stops = l.map(v => ({ l: v / 2, c: 0, h: 0 }));
  const f = flatness(stops);
  assert.ok(Math.min(...f.steps) < 0.2 * f.mean, 'one step is a tenth of the rest');
  assert.ok(f.spread > 0.8, `spread ${f.spread}`);
  assert.ok(!isFlat(stops));
  const leap = l.map((v, i) => ({ l: (i >= 10 ? v + 0.4 : v) / 4, c: 0, h: 0 }));
  assert.ok(!isFlat(leap));
});

test('a negative or non-numeric chromaScale is refused, not folded into a grey', () => {
  const cache = bake('casa');
  assert.throws(() => recolor(cache, { chromaScale: -0.5 }), RangeError);
  assert.throws(() => recolor(cache, { chromaScale: NaN }), RangeError);
  assert.doesNotThrow(() => recolor(cache, { chromaScale: 0 }));
});

test('a hueShift or lightShift that is not a number is refused, as chromaScale is', () => {
  const cache = bake('casa');
  for (const bad of [NaN, Infinity, 'x']) {
    assert.throws(() => recolor(cache, { hueShift: bad }), RangeError, `hueShift ${bad}`);
    assert.throws(() => recolor(cache, { lightShift: bad }), RangeError, `lightShift ${bad}`);
  }
  assert.doesNotThrow(() => recolor(cache, { hueShift: -40, lightShift: -0.02 }));
});

// ── M4: the constrained-projection ramp, the JND audit, the 8-bit dither ────

test('M4: every ramp stop is in sRGB — all palettes, both themes, 3 to 21 stops, all role pairs', () => {
  let checked = 0, stops = 0;
  for (const name of names) for (const dark of [false, true]) for (const steps of [3, 5, 9, 13, 21]) {
    for (const from of ['surface', 'surface-raised', 'surface-sunk', 'text', 'text-soft', 'text-faint', 'accent', 'accent-text', 'success', 'warning', 'danger', 'info']) {
      for (const to of ['surface', 'surface-raised', 'surface-sunk', 'text', 'text-soft', 'text-faint', 'accent', 'accent-text', 'success', 'warning', 'danger', 'info']) {
        if (from === to) continue;
        const r = ramp(bake(name), { from, to, steps, dark });
        assert.equal(r.length, steps);
        for (const [i, s] of r.entries()) {
          assert.ok(inGamut(oklchToRgb(s)), `${name} ${dark ? 'dark' : 'light'} ${from}->${to} stop ${i} out of gamut`);
        }
        stops += r.length; checked++;
      }
    }
  }
  assert.ok(checked >= 4 * 2 * 5 * 132, `only ${checked} ramps`);
  console.log(`M4 in-gamut: ${stops} stops over ${checked} ramps, 0 out of sRGB`);
});

test('M4: the casa-photo cache ramps 100% in gamut, ends included', () => {
  const report = JSON.parse(readFileSync(join(here, 'palettes', 'casa-photo.json'), 'utf8'));
  const cache = bake(report);
  const ROLES = ['surface', 'surface-raised', 'surface-sunk', 'text', 'text-soft', 'text-faint', 'accent', 'accent-text', 'success', 'warning', 'danger', 'info'];
  for (const dark of [false, true]) for (const steps of [5, 9, 21]) {
    let out = 0, total = 0;
    for (const from of ROLES) for (const to of ROLES) {
      if (from === to) continue;
      for (const s of ramp(cache, { from, to, steps, dark })) { total++; if (!inGamut(oklchToRgb(s))) out++; }
    }
    assert.equal(out, 0, `casa-photo ${dark ? 'dark' : 'light'} ${steps} stops: ${out} of ${total} out of gamut`);
  }
});

test('M4: the straight line left sRGB for 0.55% of random pairs; the projection leaves 0', () => {
  let seed = 42;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const oklabOf = rgb => oklabToOklch(rgbToOklab(rgb));
  let straightOut = 0, projectedOut = 0, total = 0, continuous = 0;
  const pairs = 2000;
  for (let i = 0; i < pairs; i++) {
    const A = oklabOf({ r: rnd(), g: rnd(), b: rnd() });
    const B = oklabOf({ r: rnd(), g: rnd(), b: rnd() });
    const cache = { kind: CACHE_KIND, roles: { a: { light: A, dark: A }, b: { light: B, dark: B } }, alpha: {} };
    const steps = 9;
    const proj = ramp(cache, { from: 'a', to: 'b', steps });
    total += steps;
    projectedOut += proj.filter(s => !inGamut(oklchToRgb(s))).length;
    // the straight line it replaced, for the before number
    const a = oklchToOklab(A), b = oklchToOklab(B);
    for (let k = 1; k < steps - 1; k++) {
      const t = k / (steps - 1);
      const raw = oklabToOklch({ L: a.L * (1 - t) + b.L * t, a: a.a * (1 - t) + b.a * t, b: a.b * (1 - t) + b.b * t });
      if (!inGamut(oklchToRgb(raw))) straightOut++;
    }
    // continuity: no adjacent step leaps beyond the endpoint distance
    const endD = deltaE(proj[0], proj[steps - 1]);
    const j = jndAudit(proj);
    if (j.worst <= endD * 1.5 + 0.5) continuous++;
  }
  const pct = (100 * straightOut / total).toFixed(2);
  assert.equal(projectedOut, 0, `${projectedOut} projected stops out of gamut`);
  assert.ok(straightOut / total > 0.002, `the straight line only left sRGB for ${pct}% — tighten the pair population`);
  assert.equal(continuous, pairs, 'a projected path must stay continuous');
  console.log(`M4 random pairs: straight line left sRGB for ${pct}% of stops; projection: 0; continuous ${continuous}/${pairs}`);
});

test('M4: a ramp with no gamut pressure is the straight line, unchanged', () => {
  // Grey ramps can never leave sRGB: they must stay bit-identical to the old line.
  const cache = bake('casa');
  const grey = (l, h) => ({ l, c: 0, h });
  const c2 = { kind: CACHE_KIND, roles: { a: { light: grey(0.2, 80), dark: grey(0.2, 80) }, b: { light: grey(0.9, 80), dark: grey(0.9, 80) } }, alpha: {} };
  const stops = ramp(c2, { from: 'a', to: 'b', steps: 9 });
  for (const [i, s] of stops.entries()) {
    const t = i / 8;
    assert.ok(Math.abs(s.l - (0.2 + 0.7 * t)) < 1e-9, `stop ${i} lightness left the straight line`);
  }
});

test('M4: the JND audit exposes per-ramp adjacent deltaE, and the gate can fail it', () => {
  const stops = ramp(bake('susegad'), { from: 'surface', to: 'text', steps: 9 });
  const j = jndAudit(stops);
  assert.equal(j.steps.length, 8);
  assert.ok(j.worst >= Math.min(...j.steps) || j.steps.every(s => s === 0));
  assert.ok(Math.abs(j.mean - j.steps.reduce((s, x) => s + x, 0) / 8) < 1e-12);
  // A declared threshold the ramp meets holds; an impossible one fails.
  assert.ok(jndHolds(stops, Math.ceil(j.worst)));
  assert.ok(!jndHolds(stops, j.worst * 0.5), `worst ${j.worst.toFixed(3)} must exceed half itself`);
  // A bunched ramp is caught: pull one stop onto its neighbour.
  const bunched = stops.map((s, i) => (i === 4 ? { ...stops[3] } : s));
  assert.ok(jndAudit(bunched).steps.includes(0));
});

test('M4: the dither is opt-in — no lumps means the stops come back untouched', () => {
  const stops = ramp(bake('casa'), { from: 'surface', to: 'text', steps: 21 });
  const r = rampDither(stops);
  assert.equal(r.lumps, 0);
  assert.equal(r.dithered, false);
  assert.equal(r.stops, stops, 'no lumps: the same array, not a copy');
});

test('M4: where 8-bit rounding lumps a ramp, the dither reports it and, asked, spreads it', () => {
  // A near-flat grey ramp guarantees adjacent stops round to the same hex.
  const c2 = { kind: CACHE_KIND, roles: { a: { light: { l: 0.5, c: 0, h: 0 }, dark: { l: 0.5, c: 0, h: 0 } }, b: { light: { l: 0.5001, c: 0, h: 0 }, dark: { l: 0.5001, c: 0, h: 0 } } }, alpha: {} };
  const stops = ramp(c2, { from: 'a', to: 'b', steps: 9 });
  const quiet = rampDither(stops);
  if (quiet.lumps > 0) {
    assert.equal(quiet.dithered, false);
    assert.equal(quiet.stops, stops, 'undithered output is unchanged — colour delta 0 holds');
    const loud = rampDither(stops, { dither: true });
    assert.equal(loud.dithered, true);
    assert.equal(loud.lumps, quiet.lumps);
    // The dithered ramp is monotone in perceived lightness once rendered, or
    // at worst flat where the whole ramp is one 8-bit colour.
    const lums = loud.stops.map(s => s.l);
    let inversions = 0;
    for (let i = 1; i < lums.length; i++) if (lums[i] < lums[i - 1] - 1e-12) inversions++;
    assert.equal(inversions, 0, 'the dither must not dip the lightness');
  }
  // The dither option never moves a ramp that has no lumps, whatever it asks.
  const clean = ramp(bake('haldi'), { from: 'surface', to: 'accent', steps: 9 });
  const cleanLumps = rampDither(clean).lumps;
  if (cleanLumps === 0) {
    const asked = rampDither(clean, { dither: true });
    assert.equal(asked.dithered, false);
    assert.equal(asked.stops, clean);
  }
});
