#!/usr/bin/env node
// Writes packages/tokens/tokens.css from tokens.js.
//
//   node packages/tokens/tools/build-css.mjs          write tokens.css
//   node packages/tokens/tools/build-css.mjs --check  exit 1 if tokens.css is stale
//
// Colour uses light-dark(), so a theme is just `color-scheme` and works on any
// element, and a palette is a block of custom properties that also works on
// any element. Browsers without light-dark() get a hex fallback on :root.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  palettes, type, space, radius, line, layout, motion, sound, registers, defaultRegister, oklchToCss, utilities, alphaBase,
} from '../tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
export const cssPath = join(here, '..', 'tokens.css');

const regSel = r => `[data-register="${r}"], [register="${r}"]`;
const ms = v => `${v}ms`;
const note = n => (n ? ` /* ${n} */` : '');
const ld = (l, d) => `light-dark(${l}, ${d})`;

function registerDecls(name) {
  const r = registers[name];
  const d = r.durations;
  return [
    `--sg-register: ${name};`,
    `--sg-ornament: ${r.ornament};`,
    `--sg-motion-scale: ${r.motionScale};`,
    `--sg-wobble: ${r.wobble};`,
    `--sg-overshoot: ${r.overshoot};`,
    `--sg-sound-vocabulary: "${r.sound}";`,
    ...Object.entries(d).map(([k, v]) => `--sg-dur-${k}: ${ms(v)};`),
    `--sg-ease-spring: ${r.easeSpring};`,
  ];
}

function paletteDecls(p) {
  const out = [];
  out.push('/* pigments: for drawing and decoration, the same in both themes */');
  for (const [k, v] of Object.entries(p.pigments)) out.push(`--sg-${k}: ${v.css};${note(v.note)}`);
  out.push('', '/* grounds and inks, light and dark */');
  for (const [k, v] of Object.entries(p.themed)) out.push(`--sg-${k}: ${ld(v.light.css, v.dark.css)};${note(v.note)}`);
  out.push('', '/* roles: what components read */');
  for (const [k, v] of Object.entries(p.roles)) {
    if (typeof v === 'string') { if (k !== v) out.push(`--sg-${k}: var(--sg-${v});`); }
    else out.push(`--sg-${k}: ${ld(v.light.css, v.dark.css)};${note(v.note)}`);
  }
  for (const [k, v] of Object.entries(p.alpha)) {
    out.push(`--sg-${k}: ${ld(oklchToCss(alphaBase(p, v, 'light'), v.light), oklchToCss(alphaBase(p, v, 'dark'), v.dark))};${note(v.note)}`);
  }
  out.push('--sg-lift: 0 1px 0 color-mix(in oklch, var(--sg-shadow) 12%, transparent), 0 22px 44px -28px var(--sg-shadow);');
  return out;
}

function hexDecls(p, theme) {
  const out = [];
  for (const [k, v] of Object.entries(p.pigments)) out.push(`--sg-${k}: ${v.hex};`);
  for (const [k, v] of Object.entries(p.themed)) out.push(`--sg-${k}: ${v[theme].hex};`);
  for (const [k, v] of Object.entries(p.roles)) if (typeof v !== 'string') out.push(`--sg-${k}: ${v[theme].hex};`);
  for (const [k, v] of Object.entries(p.alpha)) {
    const s = alphaBase(p, v, theme);
    const [r, g, b] = [1, 3, 5].map(i => parseInt(s.hex.slice(i, i + 2), 16));
    out.push(`--sg-${k}: rgb(${r} ${g} ${b} / ${v[theme]});`);
  }
  return out;
}

const block = (sel, decls, indent = '') =>
  `${indent}${sel} {\n${decls.map(d => (d ? `${indent}  ${d}` : '')).join('\n')}\n${indent}}`;

export function buildCss() {
  const parts = [];
  parts.push(`/* Susegad UI tokens.

   Generated from tokens.js by tools/build-css.mjs. Edit tokens.js, then run
     node packages/tokens/tools/build-css.mjs
   tokens.test.js checks the two agree and that every text role meets WCAG 2.2 AA.

   Selectors, all usable on :root or any element:
     data-palette="susegad|casa"   colour palette (default susegad)
     data-theme="light|dark"          absent: follow prefers-color-scheme
     data-register="quiet|warm|playful" (or register="...")  default warm

   Components read the roles (--sg-surface, --sg-text, --sg-accent ...), never
   the pigments. A nested data-theme changes color-scheme, so an element
   inside it must read the tokens itself (color: var(--sg-text)) rather than
   inherit an already-resolved colour from outside. */`);

  // Static tokens.
  const fam = Object.entries(type.families).map(([k, v]) => `--sg-font-${k}: ${v.join(', ')};`);
  const steps = type.scale.steps.map(n => [n, type.steps[n]]).map(([k, v]) => `--sg-step-${k}: ${v.css};`);
  const leading = Object.entries(type.leading).map(([k, v]) => `--sg-leading-${k}: ${v};`);
  const weights = Object.entries(type.weights).map(([k, v]) => `--sg-weight-${k}: ${v};`);
  const sp = Object.entries(space).map(([k, v]) => `--sg-space-${k}: ${v};`);
  const rad = Object.entries(radius).map(([k, v]) => `--sg-radius-${k}: ${v};`);
  const ln = Object.entries(line).filter(([k]) => k !== 'hairlineRetina').map(([k, v]) => `--sg-${k}: ${v};`);
  const ease = Object.entries(motion.easings).map(([k, v]) => `--sg-ease-${k}: ${v};`);
  const snd = Object.entries(sound).map(([k, v]) => `--sg-sound-${k}: "${v}";`);

  parts.push(block(':root', [
    'color-scheme: light dark;',
    '',
    '/* type: Latin, Devanagari and Kannada, each with system fallbacks */',
    ...fam, ...weights, ...steps, ...leading,
    `--sg-measure: ${type.measure};`,
    `--sg-measure-narrow: ${type.measureNarrow};`,
    `--sg-content: ${layout.content};`,
    '',
    '/* space, radii and lines */',
    ...sp, ...rad, ...ln,
    '',
    '/* motion: easings; durations come with the register below */',
    ...ease.filter(e => !e.startsWith('--sg-ease-spring')),
    '',
    '/* sound: names of synth patches; the sound layer plays them, off by default */',
    ...snd,
    '',
    `/* the register: ${defaultRegister} unless a data-register says otherwise */`,
    ...registerDecls(defaultRegister),
  ]));

  parts.push(block('[data-theme="light"]', ['color-scheme: light;']));
  parts.push(block('[data-theme="dark"]', ['color-scheme: dark;']));

  for (const [name, p] of Object.entries(palettes)) {
    const sel = name === 'susegad' ? `:root, [data-palette="${name}"]` : `[data-palette="${name}"]`;
    parts.push(`/* ── palette: ${p.label}. ${p.about}\n   Source: ${p.source} */`);
    parts.push(block(sel, paletteDecls(p)));
  }

  // Hex fallback for browsers without light-dark(). Root only.
  const fb = [];
  fb.push(block(':root', hexDecls(palettes.susegad, 'light'), '  '));
  fb.push(block(':root[data-palette="casa"]', hexDecls(palettes.casa, 'light'), '  '));
  fb.push(`  @media (prefers-color-scheme: dark) {\n${block(':root:not([data-theme="light"])', hexDecls(palettes.susegad, 'dark'), '    ')}\n${block(':root[data-palette="casa"]:not([data-theme="light"])', hexDecls(palettes.casa, 'dark'), '    ')}\n  }`);
  fb.push(block(':root[data-theme="dark"]', hexDecls(palettes.susegad, 'dark'), '  '));
  fb.push(block(':root[data-palette="casa"][data-theme="dark"]', hexDecls(palettes.casa, 'dark'), '  '));
  parts.push(`/* Browsers without light-dark(): the same palettes in hex, on :root only. */\n@supports not (color: light-dark(#000, #fff)) {\n${fb.join('\n')}\n}`);

  // Registers.
  parts.push('/* ── the register */');
  for (const name of Object.keys(registers)) parts.push(block(regSel(name), registerDecls(name)));
  const springy = Object.keys(registers).filter(r => registers[r].spring).map(regSel).join(', ');
  parts.push(`/* Browsers without linear(): a cubic-bezier with a small overshoot. */\n@supports not (animation-timing-function: linear(0, 1)) {\n${block(`:root, ${springy}`, [`--sg-ease-spring: ${motion.springFallback};`], '  ')}\n}`);

  const red = motion.reduced;
  parts.push(`/* Reduced motion wins over every register: movement is instant, opacity may
   still fade, ambient loops do not run. */\n@media (prefers-reduced-motion: reduce) {\n${block(':root, [data-register], [register]', [
    ...Object.entries(red).map(([k, v]) => `--sg-dur-${k}: ${ms(v)};`),
    '--sg-motion-scale: 0;',
    `--sg-ease-spring: ${motion.easings.out};`,
  ], '  ')}\n}`);

  // Type details.
  const indic = type.indicLangs.map(l => `:lang(${l})`).join(', ');
  parts.push(`/* Indic scripts carry matras above and below the line. Konkani in Romi is Latin. */\n${block(indic, Object.entries(type.leadingIndic).map(([k, v]) => `--sg-leading-${k}: ${v};`))}\n${block(':lang(kok-Latn)', Object.entries(type.leading).map(([k, v]) => `--sg-leading-${k}: ${v};`))}`);
  parts.push(`/* A true pencil hairline on dense screens. */\n@media (min-resolution: 2dppx) {\n${block(':root', [`--sg-hairline: ${line.hairlineRetina};`], '  ')}\n}`);

  // Utilities last, so they win over anything above at equal specificity.
  parts.push('/* ── utilities: classes every component and recipe may rely on */');
  for (const [sel, decls] of Object.entries(utilities)) parts.push(block(sel, Object.entries(decls).map(([k, v]) => `${k}: ${v};`)));

  return parts.join('\n\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const css = buildCss();
  if (process.argv.includes('--check')) {
    const current = readFileSync(cssPath, 'utf8').replace(/\r\n/g, '\n');
    if (current !== css) { console.error('tokens.css is stale: run node packages/tokens/tools/build-css.mjs'); process.exit(1); }
    console.log('tokens.css is current');
  } else {
    writeFileSync(cssPath, css);
    console.log(`wrote ${cssPath} (${css.length} bytes)`);
  }
}
