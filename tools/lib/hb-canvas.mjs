// A canvas for Node that measures text with the library's own fonts and HarfBuzz: the measuring half of the
// text gate (tools/text-gate.mjs). It is a tool, never shipping code.
//
// Pretext (packages/type/vendor) cannot be handed a canvas; on first use it does
// `new OffscreenCanvas(1, 1).getContext('2d')` and keeps that context. So `installHbCanvas()` puts a stand-in
// OffscreenCanvas on globalThis BEFORE the vendored Pretext is first imported, and its context answers
// `measureText` the way the browser would:
//
//   1. parse `ctx.font` ("400 20px Kalam, cursive") into weight, px and a family list;
//   2. if the list is just the head of one of the tokens' font stacks (a scene writes only 'Kalam'), widen it
//      to that whole stack (tokens.css --sg-font-*), because that is the intent; `stack: 'literal'` keeps it as written;
//   3. for each character walk the families in order and take the first @font-face whose weight matches and whose
//      unicode-range covers it (packages/tokens/fonts.css, parsed, never hard-coded). Joiners and combining marks
//      stay with the character before them, so a ZWNJ stays in the run it is blocking;
//   4. shape each run of one face with harfbuzzjs (woff2 opened by wawoff2), the variable weight axis set where
//      the face has one, and add up xAdvance / upem * px.
//
// Characters no declared face covers (a system face would draw them in a browser) are counted in
// `shaper.unmodelled` and measured with a stated stand-in width; the gate reports them rather than hiding them.
// `tools/text-gate.calibrate.mjs` measures the same strings in Chromium and says how far this canvas is from it.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
const require = createRequire(import.meta.url);

/** The installed version of a package, found the way Node would find it (up the tree from here, through the worktree junction). */
export function packageVersion(name) {
  for (let dir = HERE; ; dir = path.dirname(dir)) {
    const f = path.join(dir, 'node_modules', name, 'package.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')).version;
    if (dir === path.dirname(dir)) return null;
  }
}

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-monospace', 'ui-serif', 'ui-sans-serif', 'ui-rounded', 'emoji', 'math', 'fangsong']);

// ── Parsing the library's own CSS ────────────────────────────────────────

/** Split a CSS list on top-level commas, unquoting the family names. */
export function splitFamilies(list) {
  const out = []; let cur = '', q = null;
  for (const ch of list) {
    if (q) { if (ch === q) q = null; else cur += ch; } else if (ch === '"' || ch === "'") q = ch;
    else if (ch === ',') { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

/** `U+0000-02FF, U+0304, U+4??` -> [[lo, hi], ...] */
export function parseUnicodeRange(s) {
  return s.split(',').map(t => t.trim().replace(/^U\+/i, '')).filter(Boolean).map(t => {
    if (t.includes('?')) return [parseInt(t.replaceAll('?', '0'), 16), parseInt(t.replaceAll('?', 'F'), 16)];
    const [a, b] = t.split('-');
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  });
}

/** Every @font-face that has a url() source: { family, weight: [lo, hi], style, file, ranges|null }. Faces that are only local() are skipped: a machine's own fonts cannot be gated. */
export function parseFontFaces(css, baseDir) {
  const faces = [];
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = m[1], get = p => new RegExp(`${p}\\s*:\\s*([^;]+);`).exec(body)?.[1].trim();
    const url = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(get('src') ?? '')?.[1];
    if (!url) continue;
    const w = (get('font-weight') ?? '400').split(/\s+/).map(Number);
    const ur = get('unicode-range');
    faces.push({
      family: splitFamilies(get('font-family'))[0], weight: [w[0], w[1] ?? w[0]], style: get('font-style') ?? 'normal',
      file: path.resolve(baseDir, url), ranges: ur ? parseUnicodeRange(ur) : null,
    });
  }
  return faces;
}

/** The token stacks: { 'sg-font-hand': ['Kalam', 'Kalam Fallback', ...], ... } from tokens.css. */
export function parseStacks(css) {
  const out = {};
  for (const m of css.matchAll(/--(sg-font-[a-z]+)\s*:\s*([^;]+);/g)) out[m[1]] = splitFamilies(m[2]);
  return out;
}

/** Parse a canvas font string. Returns { weight, px, style, families } or null. */
export function parseFont(font) {
  const m = /^(.*?)(\d+(?:\.\d+)?)px(?:\s*\/\s*[^\s]+)?\s+(.+)$/.exec(font.trim());
  if (!m) return null;
  let weight = 400, style = 'normal';
  for (const t of m[1].trim().split(/\s+/).filter(Boolean)) {
    if (/^\d{1,4}$/.test(t)) weight = +t; else if (t === 'bold') weight = 700; else if (t === 'italic' || t === 'oblique') style = 'italic';
  }
  return { weight, px: +m[2], style, families: splitFamilies(m[3]) };
}

/** CSS font weight matching over the weights a family offers (ranges count as their span). Returns the face weight-set to use. */
export function pickWeight(want, avail) {
  const has = w => avail.some(([lo, hi]) => w >= lo && w <= hi);
  if (has(want)) return want;
  const nums = [...new Set(avail.flatMap(([lo, hi]) => [lo, hi]))].sort((a, b) => a - b);
  const below = nums.filter(w => w < want).reverse(), above = nums.filter(w => w > want);
  let order;
  if (want >= 400 && want <= 500) order = [...above.filter(w => w <= 500), ...below, ...above.filter(w => w > 500)];
  else if (want < 400) order = [...below, ...above];
  else order = [...above, ...below];
  return order[0] ?? want;
}

const inRanges = (ranges, cp) => !ranges || ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
/** Characters that attach to the one before them for font choice: joiners, variation selectors, combining marks, viramas. */
const IGNORABLE = /^\p{Default_Ignorable_Code_Point}$/u;
const ATTACHES = /^[\p{M}‌‍︀-️]$/u;

// ── The shaper ───────────────────────────────────────────────────────────

/**
 * @param {{ root?: string, stack?: 'token'|'literal', lang?: string|null }} [o]
 *   `stack: 'token'` (default) widens a bare stack head such as 'Kalam' to its tokens.css stack; 'literal' does not.
 */
export async function createShaper({ root = REPO_ROOT, stack = 'token', lang = null } = {}) {
  const hb = await import('harfbuzzjs');
  const wawoff2 = require('wawoff2');
  const tokensDir = path.join(root, 'packages', 'tokens');
  const faces = parseFontFaces(fs.readFileSync(path.join(tokensDir, 'fonts.css'), 'utf8'), tokensDir);
  const stacks = parseStacks(fs.readFileSync(path.join(tokensDir, 'tokens.css'), 'utf8'));
  const byFamily = new Map();
  for (const f of faces) (byFamily.get(f.family) ?? byFamily.set(f.family, []).get(f.family)).push(f);

  // Open every font file once. Decompression is async, so it happens here and measureText stays synchronous.
  const opened = new Map(); // file -> { face, font, upem, variable }
  for (const file of new Set(faces.map(f => f.file))) {
    const ttf = await wawoff2.decompress(fs.readFileSync(file));
    const face = new hb.Face(new hb.Blob(new Uint8Array(ttf)), 0);
    opened.set(file, { face, font: new hb.Font(face), upem: face.upem, fonts: new Map() });
  }
  /** A Font for this file at a weight: variable faces get the wght axis set (cached per weight). */
  const fontFor = (face, weight) => {
    const o = opened.get(face.file), variable = face.weight[0] !== face.weight[1];
    const w = variable ? Math.min(Math.max(weight, face.weight[0]), face.weight[1]) : 0;
    if (!variable) return o;
    if (!o.fonts.has(w)) {
      const font = new hb.Font(o.face);
      font.setVariations([new hb.Variation('wght', w)]);
      o.fonts.set(w, { ...o, font });
    }
    return o.fonts.get(w);
  };

  /** Does this face have a glyph for the character (not .notdef)? Joiners and other default-ignorables are never drawn, so they are not asked. */
  const hasGlyph = (face, cp) => !!opened.get(face.file).font.nominalGlyph(cp);

  const shaper = {
    lang, stack, stacks, faces, unmodelled: new Map(), widths: new Map(),
    /** The families to walk for a font string's family list. */
    familiesFor(families) {
      if (stack !== 'token') return families;
      const head = families.filter(f => !GENERIC.has(f.toLowerCase()));
      for (const s of Object.values(stacks)) if (head.length === 1 && s[0] === head[0]) return s;
      return families;
    },
    /** Which declared face draws this code point at this weight: the first family in the list with a covering face, or null. */
    faceFor(families, weight, style, cp) {
      for (const fam of families) {
        const all = byFamily.get(fam) ?? [], cands = all.some(f => f.style === style) ? all.filter(f => f.style === style) : all.filter(f => f.style === 'normal');
        if (!cands.length) continue;
        const w = pickWeight(weight, cands.map(f => f.weight));
        // among the faces of the chosen weight, the LAST declared that covers the character wins (CSS: later rules take precedence)
        // a face that has the range but not the glyph does not draw the character: the browser tries the next family (glyph 0 is .notdef)
        const hit = [...cands].reverse().find(f => w >= f.weight[0] && w <= f.weight[1] && inRanges(f.ranges, cp) && (IGNORABLE.test(String.fromCodePoint(cp)) || hasGlyph(f, cp)));
        if (hit) return hit;
      }
      return null;
    },
    /** Split text into runs of one face: [{ face|null, text }]. */
    runs(text, families, weight, style) {
      const out = [];
      let prev;
      for (const ch of text) {
        const cp = ch.codePointAt(0);
        let face;
        if (prev !== undefined && ATTACHES.test(ch)) face = prev; else face = shaper.faceFor(families, weight, style, cp);
        prev = face;
        const last = out.at(-1);
        if (last && last.face === face) last.text += ch; else out.push({ face, text: ch });
      }
      return out;
    },
    /** The characters of `text` no declared face draws when `font` is taken literally (no widening to the token stack): a browser would use a system face for these. */
    uncovered(font, text) {
      const f = parseFont(font) ?? { weight: 400, style: 'normal', families: ['serif'] };
      return [...new Set(shaper.runs(text, f.families, f.weight, f.style).filter(r => !r.face).flatMap(r => [...r.text].filter(c => !ATTACHES.test(c))))];
    },
    /** Width in CSS px of `text` set in `font` (a canvas font string). */
    measure(font, text) {
      const key = `${font}\u0000${shaper.lang}\u0000${text}`;
      const hit = shaper.widths.get(key);
      if (hit !== undefined) return hit;
      const f = parseFont(font) ?? { weight: 400, px: 10, style: 'normal', families: ['serif'] };
      const families = shaper.familiesFor(f.families);
      let width = 0;
      for (const run of shaper.runs(text, families, f.weight, f.style)) {
        if (!run.face) {
          // no declared face: a system face would draw it. Count it and use half an em per character as a stand-in.
          for (const ch of run.text) shaper.unmodelled.set(ch, (shaper.unmodelled.get(ch) ?? 0) + 1);
          width += [...run.text].filter(c => !ATTACHES.test(c)).length * 0.5 * f.px;
          continue;
        }
        const { font: hbFont, upem } = fontFor(run.face, f.weight);
        // Blink shapes a word and each space separately (its word cache), so a kern pair with the space (Mukta has one for a closing quote
        // and a space: 1.28 px at 32 px) is never applied in a browser; shaping the pieces apart gives the same widths
        for (const piece of run.text.split(/( )/)) {
          if (!piece) continue;
          const buf = new hb.Buffer();
          buf.addText(piece);
          buf.guessSegmentProperties();
          if (shaper.lang) buf.setLanguage(shaper.lang);
          hb.shape(hbFont, buf);
          let adv = 0;
          for (const p of buf.getGlyphPositions()) adv += p.xAdvance;
          width += adv / upem * f.px;
        }
      }
      if (shaper.widths.size > 50000) shaper.widths.clear();
      shaper.widths.set(key, width);
      return width;
    },
  };
  return shaper;
}

/**
 * Put a stand-in OffscreenCanvas on globalThis whose 2d context measures with `shaper`. Call it before the first
 * import of anything that reaches the vendored Pretext. Returns a function that removes it again.
 */
export function installHbCanvas(shaper) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'OffscreenCanvas');
  class HbOffscreenCanvas {
    constructor(w = 1, h = 1) { this.width = w; this.height = h; }
    getContext() {
      const ctx = {
        font: '10px sans-serif', lang: 'inherit', letterSpacing: '0px',
        measureText(text) {
          const width = text === '' ? 0 : shaper.measure(this.font, String(text));
          return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 };
        },
      };
      return ctx;
    }
  }
  globalThis.OffscreenCanvas = HbOffscreenCanvas;
  return () => { if (had) Object.defineProperty(globalThis, 'OffscreenCanvas', had); else delete globalThis.OffscreenCanvas; };
}
