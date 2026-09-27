import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  palettes, themes, textRoles, surfaceRoles, resolveRoles, registers, motion, type, sound, space,
  fluidStep, springEasing, contrast, oklchToCss, hexToOklch, roundOklch, oklchToHex, oklchToRgb, rgbToOklch,
  parseOklch, over, utilities, roleHex,
} from './tokens.js';
import { hexToRgb, rgbToHex, fitContrast, gamutMap, inGamut } from './color.js';
import { samplePixels, medianCut, paletteFromPixels, paletteToCss, worstContrast } from './palette.js';
import { buildCss } from './tools/build-css.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'tokens.css'), 'utf8').replace(/\r\n/g, '\n');

// ── conversions ─────────────────────────────────────────────────────────────

test('every 12-bit sRGB colour survives hex → OKLCH (at token precision) → hex within one 8-bit step', () => {
  let exact = 0;
  for (let r = 0; r < 16; r++) for (let g = 0; g < 16; g++) for (let b = 0; b < 16; b++) {
    const hex = rgbToHex({ r: (r * 17) / 255, g: (g * 17) / 255, b: (b * 17) / 255 });
    const back = oklchToHex(roundOklch(hexToOklch(hex)));
    const a = hexToRgb(hex), z = hexToRgb(back);
    const worst = Math.max(Math.abs(a.r - z.r), Math.abs(a.g - z.g), Math.abs(a.b - z.b)) * 255;
    assert.ok(worst <= 1.0001, `${hex} came back as ${back}`);
    if (back === hex) exact++;
  }
  // Only colours on the very edge of the gamut move, and by one step.
  assert.ok(exact / 4096 > 0.97, `${exact} of 4096 exact`);
});

test('OKLCH → sRGB → OKLCH round-trips inside the gamut', () => {
  for (const lch of [{ l: 0.5, c: 0.1, h: 30 }, { l: 0.9, c: 0.02, h: 200 }, { l: 0.3, c: 0.05, h: 270 }, { l: 0.7, c: 0.12, h: 140 }]) {
    const back = rgbToOklch(oklchToRgb(lch));
    assert.ok(Math.abs(back.l - lch.l) < 1e-6 && Math.abs(back.c - lch.c) < 1e-6 && Math.abs(back.h - lch.h) < 1e-3, JSON.stringify(back));
  }
});

test('known values: white, black and the CSS Color 4 reference points', () => {
  const w = hexToOklch('#FFFFFF'), k = hexToOklch('#000000');
  assert.ok(Math.abs(w.l - 1) < 1e-4 && w.c < 1e-4);
  assert.ok(Math.abs(k.l) < 1e-9);
  const red = hexToOklch('#FF0000'); // oklch(62.8% 0.2577 29.23)
  assert.ok(Math.abs(red.l - 0.628) < 1e-3 && Math.abs(red.c - 0.2577) < 1e-3 && Math.abs(red.h - 29.23) < 0.05);
});

test('WCAG contrast matches the published reference numbers', () => {
  assert.equal(+contrast('#000', '#fff').toFixed(2), 21);
  assert.equal(+contrast('#777', '#fff').toFixed(2), 4.48);
  // The Casa design notes: ink 13.35:1, teak 5.17:1 on paper.
  assert.equal(+contrast('#2E2419', '#F4F0E6').toFixed(2), 13.35);
  assert.equal(+contrast('#7E5F32', '#F4F0E6').toFixed(2), 5.17);
});

test('gamutMap keeps lightness and hue and lands inside sRGB', () => {
  const m = gamutMap({ l: 0.7, c: 0.4, h: 150 });
  assert.equal(m.l, 0.7);
  assert.equal(m.h, 150);
  assert.ok(m.c < 0.4 && inGamut(oklchToRgb(m)));
});

test('fitContrast reaches its target and moves away from the ground', () => {
  const on = ['#F4F0E6', '#EAE4D6'];
  const f = fitContrast({ l: 0.7, c: 0.08, h: 217 }, on, 4.5);
  assert.ok(Math.min(...on.map(g => contrast(f, g))) >= 4.5);
  assert.ok(f.l < 0.7);
  const d = fitContrast({ l: 0.3, c: 0.08, h: 217 }, ['#14161C'], 4.5);
  assert.ok(d.l > 0.3 && contrast(d, '#14161C') >= 4.5);
});

test('parseOklch reads what oklchToCss writes', () => {
  const lch = { l: 0.5073, c: 0.0737, h: 75.04 };
  assert.deepEqual(parseOklch(oklchToCss(lch)), lch);
  assert.deepEqual(parseOklch('oklch(0.5 0.1 30)'), { l: 0.5, c: 0.1, h: 30 });
});

// ── the Casa port ────────────────────────────────────────────────────────

test('the Casa house palette is ported exactly', () => {
  const v = palettes.casa;
  const found = name => v.themed[name]?.light ?? v.pigments[name];
  for (const [name, hex] of Object.entries(v.original)) {
    if (name === 'ink-faint') continue; // deepened on purpose; the original lives on as the pigment casa-faint
    assert.equal(found(name).hex, hex, name);
  }
  assert.equal(v.pigments['casa-faint'].hex, '#93897A');
  assert.equal(v.themed.paper.dark.hex, '#14161C', 'the dark ground is the night chapter');
  assert.equal(v.themed.ink.dark.hex, '#E8E2D6', 'the dark ink is the night ink');
});

// ── the contrast gate ───────────────────────────────────────────────────────

/** The colour a browser paints: 8-bit sRGB. Contrast is checked on that, not on the ideal value. */
const painted = sw => hexToRgb(sw.hex);

const contrastRows = [];
for (const name of Object.keys(palettes)) {
  for (const theme of themes) {
    const r = resolveRoles(name, theme);
    test(`AA: ${name} ${theme}: every text role on every surface is 4.5:1 or more`, () => {
      for (const role of textRoles) for (const ground of surfaceRoles) {
        const ratio = contrast(painted(r[role]), painted(r[ground]));
        contrastRows.push({ name, theme, role, ground, ratio });
        assert.ok(ratio >= 4.5, `${role} on ${ground}: ${ratio.toFixed(2)}:1`);
      }
    });
    test(`AA: ${name} ${theme}: on-accent, selection and scrim keep text readable`, () => {
      const onAccent = contrast(painted(r['on-accent']), painted(r.accent));
      assert.ok(onAccent >= 4.5, `on-accent on accent: ${onAccent.toFixed(2)}`);
      for (const role of ['text', 'text-soft']) {
        const sel = contrast(painted(r[role]), painted(r.selection));
        assert.ok(sel >= 4.5, `${role} on selection: ${sel.toFixed(2)}`);
        // The scrim sits over a drawing we do not control: check over pure black and pure white.
        for (const under of ['#000000', '#FFFFFF']) {
          const bg = over(r.scrim.hex, r.scrim.alpha, under);
          const ratio = contrast(painted(r[role]), bg);
          assert.ok(ratio >= 4.5, `${role} on scrim over ${under}: ${ratio.toFixed(2)}`);
        }
      }
    });
    test(`AA: ${name} ${theme}: focus ring and control borders are 3:1 or more on every surface (WCAG 1.4.11; rings sit on the surface at --sg-focus-offset)`, () => {
      for (const ground of surfaceRoles) {
        for (const role of ['focus', 'rule-strong']) {
          const ratio = contrast(painted(r[role]), painted(r[ground]));
          assert.ok(ratio >= 3, `${role} on ${ground}: ${ratio.toFixed(2)}`);
        }
      }
    });
  }
}

test('contrast table (diagnostic)', t => {
  const worst = {};
  for (const row of contrastRows) {
    const k = `${row.name} ${row.theme} ${row.role}`;
    if (!worst[k] || row.ratio < worst[k].ratio) worst[k] = row;
  }
  for (const w of Object.values(worst)) t.diagnostic(`${w.name.padEnd(8)} ${w.theme.padEnd(5)} ${w.role.padEnd(12)} lowest ${w.ratio.toFixed(2)}:1 on ${w.ground}`);
});

// ── tokens.css and tokens.js agree ──────────────────────────────────────────

/** A small CSS parser: rules with their at-rule context, and declarations. */
function parseCss(text) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const stack = [];
  let buf = '';
  for (const ch of src) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') {
      const sel = stack.pop();
      if (buf.trim() && !sel.startsWith('@')) {
        const decls = {};
        for (const d of buf.split(';')) {
          const i = d.indexOf(':');
          if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
        }
        rules.push({ selector: sel, at: stack.filter(s => s.startsWith('@')).join(' '), decls });
      }
      buf = '';
    } else buf += ch;
  }
  return rules;
}

const rules = parseCss(css);
const rule = (selector, at = '') => {
  const r = rules.find(x => x.selector === selector && x.at === at);
  assert.ok(r, `no rule ${selector} ${at}`);
  return r.decls;
};

test('tokens.css is the current output of build-css.mjs', () => {
  assert.equal(css, buildCss(), 'run: node packages/tokens/tools/build-css.mjs');
});

test('css ↔ js: every palette colour in tokens.css matches tokens.js', () => {
  for (const [name, p] of Object.entries(palettes)) {
    const d = rule(name === 'susegad' ? ':root, [data-palette="susegad"]' : `[data-palette="${name}"]`);
    for (const [k, v] of Object.entries(p.pigments)) assert.deepEqual(parseOklch(d[`--sg-${k}`]), { l: v.l, c: v.c, h: v.h }, k);
    for (const [k, v] of Object.entries(p.themed)) {
      const m = /^light-dark\((oklch\([^)]*\)),\s*(oklch\([^)]*\))\)$/.exec(d[`--sg-${k}`]);
      assert.ok(m, `${k} is light-dark()`);
      assert.deepEqual(parseOklch(m[1]), { l: v.light.l, c: v.light.c, h: v.light.h }, `${k} light`);
      assert.deepEqual(parseOklch(m[2]), { l: v.dark.l, c: v.dark.c, h: v.dark.h }, `${k} dark`);
    }
    for (const [role, v] of Object.entries(p.roles)) {
      const val = d[`--sg-${role}`];
      if (typeof v === 'string') {
        if (role !== v) assert.equal(val, `var(--sg-${v})`, role);
        continue;
      }
      const m = /^light-dark\((oklch\([^)]*\)),\s*(oklch\([^)]*\))\)$/.exec(val);
      assert.ok(m, `${role} is light-dark()`);
      assert.deepEqual(parseOklch(m[1]), { l: v.light.l, c: v.light.c, h: v.light.h }, `${role} light`);
      assert.deepEqual(parseOklch(m[2]), { l: v.dark.l, c: v.dark.c, h: v.dark.h }, `${role} dark`);
    }
    for (const role of ['surface', 'surface-raised', 'surface-sunk', 'text', 'text-soft', 'text-faint', 'accent', 'on-accent', 'accent-text', 'success', 'warning', 'danger', 'info', 'focus', 'scrim', 'selection', 'rule', 'rule-strong']) {
      assert.ok(d[`--sg-${role}`], `${name} defines --sg-${role}`);
    }
  }
});

test('css ↔ js: the hex fallback matches the swatches', () => {
  const at = '@supports not (color: light-dark(#000, #fff))';
  const light = rule(':root', at), dark = rule(':root[data-theme="dark"]', at);
  const cas = rule(':root[data-palette="casa"]', at);
  for (const [k, v] of Object.entries(palettes.susegad.themed)) {
    assert.equal(light[`--sg-${k}`], v.light.hex, k);
    assert.equal(dark[`--sg-${k}`], v.dark.hex, k);
  }
  for (const [k, v] of Object.entries(palettes.casa.themed)) assert.equal(cas[`--sg-${k}`], v.light.hex, k);
  const media = rule(':root:not([data-theme="light"])', `${at} @media (prefers-color-scheme: dark)`);
  assert.equal(media['--sg-paper'], palettes.susegad.themed.paper.dark.hex);
});

test('css ↔ js: type, space, motion, sound and the register', () => {
  const root = rule(':root');
  for (const [k, v] of Object.entries(type.families)) assert.equal(root[`--sg-font-${k}`], v.join(', '), k);
  for (const n of type.scale.steps) assert.equal(root[`--sg-step-${n}`], fluidStep(n).css, `step ${n}`);
  for (const [k, v] of Object.entries(space)) assert.equal(root[`--sg-space-${k}`], v);
  for (const [k, v] of Object.entries(motion.easings)) if (k !== 'spring') assert.equal(root[`--sg-ease-${k}`], v, k);
  for (const [k, v] of Object.entries(sound)) assert.equal(root[`--sg-sound-${k}`], `"${v}"`);
  assert.equal(root['--sg-register'], 'warm');
  assert.equal(root['--sg-measure'], type.measure);
  for (const [name, r] of Object.entries(registers)) {
    const d = rule(`[data-register="${name}"], [register="${name}"]`);
    assert.equal(d['--sg-register'], name);
    assert.equal(+d['--sg-ornament'], r.ornament);
    assert.equal(+d['--sg-wobble'], r.wobble);
    assert.equal(d['--sg-ease-spring'], r.easeSpring);
    for (const [k, v] of Object.entries(r.durations)) assert.equal(d[`--sg-dur-${k}`], `${v}ms`, `${name} ${k}`);
  }
  const reduced = rule(':root, [data-register], [register]', '@media (prefers-reduced-motion: reduce)');
  for (const [k, v] of Object.entries(motion.reduced)) assert.equal(reduced[`--sg-dur-${k}`], `${v}ms`, k);
});

test('every Indic script has a web face and a system fallback in every family', () => {
  const f = type.families;
  const has = (list, ...names) => names.some(n => list.includes(n));
  for (const fam of ['display', 'body', 'hand']) {
    assert.ok(has(f[fam], "'Nirmala UI'"), `${fam}: Windows covers Devanagari and Kannada with Nirmala UI`);
    assert.ok(has(f[fam], "'Kohinoor Devanagari'", "'Noto Serif Devanagari'", "'Devanagari Sangam MN'"), `${fam}: Apple or Noto Devanagari`);
    assert.ok(has(f[fam], "'Kannada Sangam MN'", "'Noto Sans Kannada'", "'Noto Serif Kannada'", "'Tiro Kannada'"), `${fam}: a Kannada face`);
    assert.match(f[fam].at(-1), /^(serif|sans-serif|cursive)$/);
  }
  assert.equal(f.mono.at(-1), 'monospace');
  // A Latin system face must come before the first Indic system face, or it takes the Latin too.
  const firstIndic = list => list.findIndex(n => ["'Nirmala UI'", "'Kohinoor Devanagari'", "'Noto Sans Devanagari'", "'Noto Serif Devanagari'"].includes(n));
  assert.ok(f.display.indexOf('Georgia') < firstIndic(f.display));
  assert.ok(f.body.indexOf("'Segoe UI'") < firstIndic(f.body));
  assert.ok(f.hand.indexOf("'Segoe Print'") < firstIndic(f.hand));
  assert.ok(f.mono.indexOf('Consolas') < firstIndic(f.mono));
});

// ── motion and the register ─────────────────────────────────────────────────

test('quiet keeps every transition under 200ms and runs nothing ambient', () => {
  const d = registers.quiet.durations;
  for (const [k, v] of Object.entries(d)) if (k !== 'ambient') assert.ok(v < 200, `${k}: ${v}`);
  assert.equal(d.ambient, 0);
  assert.equal(registers.quiet.overshoot, 0);
});

test('reduced motion: movement is effectively instant, opacity may still fade', () => {
  for (const k of ['instant', 'quick', 'calm', 'slow', 'ambient']) assert.ok(motion.reduced[k] < 1);
  assert.ok(motion.reduced.fade > 0 && motion.reduced.fade <= 200);
});

test('springs start at 0, end at 1, and playful overshoots more than warm', () => {
  const vals = s => s.slice(7, -1).split(',').map(Number);
  for (const r of ['warm', 'playful']) {
    const v = vals(registers[r].easeSpring);
    assert.equal(v[0], 0);
    assert.equal(v.at(-1), 1);
  }
  assert.ok(registers.playful.overshoot > registers.warm.overshoot);
  assert.ok(registers.warm.overshoot > 0 && registers.warm.overshoot < 0.06);
  assert.ok(Math.max(...vals(springEasing(0.48))) - 1 > 0.1);
});

test('the fluid type scale grows step by step at both ends', () => {
  for (let n = -1; n < 5; n++) {
    assert.ok(fluidStep(n + 1).min > fluidStep(n).min);
    assert.ok(fluidStep(n + 1).max > fluidStep(n).max);
  }
  assert.equal(fluidStep(0).min, 1);
});

// ── palette from photo ──────────────────────────────────────────────────────

/** A seeded "photograph": plaster wall, a dark doorway, a pool, a red stair. */
function scene(seed, w = 120, h = 90) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    let c;
    if (x > 40 && x < 60 && y > 30) c = [46, 36, 25]; // teak doorway in shadow
    else if (y > 70) c = [31, 150, 180]; // pool
    else if (x > 100 && y > 20 && y < 50) c = [164, 69, 44]; // laterite stair
    else if (x < 20) c = [110, 125, 60]; // garden
    else c = [236, 228, 210]; // lime plaster
    const n = (rnd() - 0.5) * 18;
    data[i] = c[0] + n; data[i + 1] = c[1] + n; data[i + 2] = c[2] + n; data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

test('palette extraction is deterministic', () => {
  const imgs = [scene(1), scene(2)];
  const a = paletteFromPixels(imgs, { name: 't' });
  const b = paletteFromPixels(imgs, { name: 't' });
  assert.deepEqual(a, b);
  assert.equal(paletteToCss(a), paletteToCss(b));
});

test('median cut with refinement accounts for every sample', () => {
  const pts = samplePixels([scene(3)]);
  const sw = medianCut(pts, 8);
  assert.equal(sw.reduce((s, x) => s + x.count, 0), pts.length / 3);
  assert.ok(Math.abs(sw.reduce((s, x) => s + x.weight, 0) - 1) < 1e-9);
});

test('palette from photo finds the scene and every text colour meets AA', () => {
  const p = paletteFromPixels([scene(4), scene(5)], { name: 't' });
  const worst = worstContrast(p.contrast);
  assert.ok(worst.ratio >= 4.5, JSON.stringify(worst));
  // the plaster is the paper: warm and light
  assert.ok(p.light.paper.l >= 0.95 && p.light.paper.h > 60 && p.light.paper.h < 110, JSON.stringify(p.light.paper));
  // the pool becomes info, the stair becomes danger
  assert.ok(p.light.info.h > 180 && p.light.info.h < 250, `info hue ${p.light.info.h}`);
  assert.ok(p.light.danger.h < 50 || p.light.danger.h > 340, `danger hue ${p.light.danger.h}`);
  assert.notEqual(p.sources.info, 'synthesised');
  assert.notEqual(p.sources.danger, 'synthesised');
  for (const theme of ['light', 'dark']) assert.ok(p.contrast[theme]['on-accent'].accent >= 4.5);
});

test('palette from photo still gives a readable palette from a photo with no light in it', () => {
  const w = 40, h = 40, data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 20 + (i % 13); data[i + 1] = 24; data[i + 2] = 40; data[i + 3] = 255; }
  const p = paletteFromPixels([{ data, width: w, height: h }]);
  assert.ok(worstContrast(p.contrast).ratio >= 4.5);
  assert.ok(p.light.paper.l >= 0.95);
});

// ── self-hosted fonts ───────────────────────────────────────────────────────

test('fonts.css: every face is local, exists, swaps, and carries a unicode-range', () => {
  const fontsCss = readFileSync(join(here, 'fonts.css'), 'utf8');
  const faces = fontsCss.split('@font-face').slice(1);
  assert.ok(faces.length >= 15);
  for (const f of faces) {
    const fam = /font-family:\s*'([^']+)'/.exec(f)[1];
    const url = /url\('([^']+)'\)/.exec(f);
    if (fam.endsWith(' Fallback')) {
      assert.match(f, /src:\s*local\(/, fam);
      assert.match(f, /size-adjust:\s*[\d.]+%/, fam);
      continue;
    }
    assert.ok(url, `${fam} has a url()`);
    assert.ok(!/^[a-z]+:/i.test(url[1]), `${fam} is served from the site, not ${url[1]}`);
    assert.ok(readFileSync(join(here, url[1])).length > 1000, `${url[1]} exists`);
    assert.match(f, /font-display:\s*swap/, fam);
    assert.match(f, /unicode-range:/, fam);
  }
  for (const text of [fontsCss, css]) assert.doesNotMatch(text, /https?:\/\//, 'no third-party requests');
});

test('the token stacks name the self-hosted faces first, each followed by its fallback', () => {
  const fontsCss = readFileSync(join(here, 'fonts.css'), 'utf8');
  const declared = new Set([...fontsCss.matchAll(/font-family:\s*'([^']+)'/g)].map(m => `'${m[1]}'`));
  assert.equal(type.families.display[0], "'Castoro'");
  assert.equal(type.families.body[0], "'Mukta'");
  assert.equal(type.families.hand[0], "'Kalam'");
  for (const fam of ['display', 'body', 'hand']) {
    const stack = type.families[fam];
    assert.ok(declared.has(stack[0]), `${stack[0]} is declared in fonts.css`);
    const fb = stack.findIndex(n => n.endsWith(" Fallback'"));
    assert.ok(fb > 0 && declared.has(stack[fb]), `${fam} has a declared metric fallback`);
    // every self-hosted face comes before the fallback
    stack.slice(0, fb).forEach(n => assert.ok(declared.has(n), `${n} in ${fam} is self-hosted`));
  }
  for (const f of ["'Tiro Devanagari Marathi'", "'Tiro Kannada'", "'Noto Sans Kannada'"]) assert.ok(declared.has(f), f);
});

// ── utilities ───────────────────────────────────────────────────────────────

test('the visually-hidden utilities are in tokens.css, exactly as tokens.js defines them', () => {
  for (const [sel, decls] of Object.entries(utilities)) {
    const d = rule(sel);
    for (const [k, v] of Object.entries(decls)) assert.equal(d[k], v, `${sel} ${k}`);
  }
  const vh = rule('.sg-vh');
  // hidden from sight, never from assistive tech: no display:none, no visibility:hidden
  assert.equal(vh['clip-path'], 'inset(50%)');
  assert.equal(vh.width, '1px');
  assert.equal(vh.overflow, 'hidden');
  assert.equal(vh['white-space'], 'nowrap');
  assert.equal(vh.position, 'absolute');
  assert.ok(!('display' in vh) && !('visibility' in vh));
  const shown = rule('.sg-vh-focusable:focus-visible');
  assert.equal(shown['clip-path'], 'none');
  assert.ok(shown.outline.includes('--sg-focus'), 'a focused skip link shows the focus ring');
});

test('pencil: a drawing role, fainter than every text role, still visible on every surface', () => {
  for (const name of Object.keys(palettes)) for (const theme of themes) {
    const r = resolveRoles(name, theme);
    assert.ok(r.pencil, `${name} ${theme} has pencil`);
    for (const s of surfaceRoles) {
      const on = contrast(r.pencil, r[s]);
      assert.ok(on >= 1.8, `${name} ${theme}: pencil on ${s} is ${on.toFixed(2)}:1, too faint to see`);
      assert.ok(on < contrast(r['text-faint'], r[s]), `${name} ${theme}: pencil on ${s} should be fainter than text-faint`);
    }
  }
  assert.equal(resolveRoles('casa', 'light').pencil.hex, '#93897A', "the Casa redesign's own pencil");
});

test('roleHex: every opaque role as hex, for canvas code', () => {
  const h = roleHex('casa', 'light');
  assert.equal(h.pencil, '#93897A');
  assert.equal(h.text, palettes.casa.original.ink);
  assert.ok(!('scrim' in h) && !('shadow' in h), 'translucent roles are left out');
  for (const name of Object.keys(palettes)) for (const theme of themes) {
    for (const [k, v] of Object.entries(roleHex(name, theme))) assert.match(v, /^#[0-9A-F]{6}$/, `${name} ${theme} ${k}`);
  }
});

test('the lift shadow is darker than the ground it falls on, in every palette and theme (never a glow)', () => {
  for (const name of Object.keys(palettes)) for (const theme of themes) {
    const r = resolveRoles(name, theme);
    const shadow = over(r.shadow.hex, r.shadow.alpha, r.surface.hex);
    assert.ok(rgbToOklch(shadow).l < r.surface.l, `${name} ${theme}: the shadow over the surface is lighter than the surface`);
  }
  assert.equal(resolveRoles('susegad', 'dark').shadow.hex, '#000000');
  assert.equal(resolveRoles('casa', 'light').shadow.hex, palettes.casa.original.ink, 'by day, still the ink');
});
