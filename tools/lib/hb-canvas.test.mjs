// The HarfBuzz canvas (hb-canvas.mjs): its CSS parsing, its choice of face per character, and that the shaping
// is real (ZWNJ does not join, the variable weight axis moves, Mukta's 500 is not its 400). Needs the repo's fonts and harfbuzzjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { splitFamilies, parseUnicodeRange, parseFont, pickWeight, parseFontFaces, createShaper, installHbCanvas, packageVersion, REPO_ROOT } from './hb-canvas.mjs';

test('splitFamilies keeps quoted names whole and drops the quotes', () => {
  assert.deepEqual(splitFamilies(`'Kalam', "Noto Sans Kannada", cursive`), ['Kalam', 'Noto Sans Kannada', 'cursive']);
  assert.deepEqual(splitFamilies('Kalam'), ['Kalam']);
});

test('parseUnicodeRange reads ranges, singles and wildcards', () => {
  assert.deepEqual(parseUnicodeRange('U+0000-02FF, U+0304, U+4??'), [[0, 0x2ff], [0x304, 0x304], [0x400, 0x4ff]]);
});

test('parseFont reads weight, size and the family list; defaults to 400', () => {
  assert.deepEqual(parseFont('400 20px Kalam, cursive'), { weight: 400, px: 20, style: 'normal', families: ['Kalam', 'cursive'] });
  assert.deepEqual(parseFont('italic 600 16.5px/1.4 "Noto Sans Kannada"'), { weight: 600, px: 16.5, style: 'italic', families: ['Noto Sans Kannada'] });
  assert.equal(parseFont('16px Mukta').weight, 400);
  assert.equal(parseFont('bold 12px Mukta').weight, 700);
  assert.equal(parseFont('nonsense'), null);
});

test('pickWeight follows the CSS matching order', () => {
  const avail = [[400, 400], [500, 500], [600, 600]];
  assert.equal(pickWeight(500, avail), 500);
  assert.equal(pickWeight(300, avail), 400);       // lighter than any: the nearest above
  assert.equal(pickWeight(700, avail), 600);       // heavier than any: the nearest below
  assert.equal(pickWeight(450, [[400, 400], [500, 500]]), 500);   // 400-500: up to 500 first
  assert.equal(pickWeight(450, [[400, 400], [600, 600]]), 400);   // none up to 500, so below, before anything heavier
  assert.equal(pickWeight(500, [[400, 600]]), 500); // inside a variable range
});

test('fonts.css parses into the faces the repo ships, with their unicode ranges and a variable weight span', () => {
  const dir = path.join(REPO_ROOT, 'packages/tokens');
  const faces = parseFontFaces(fs.readFileSync(path.join(dir, 'fonts.css'), 'utf8'), dir);
  assert.ok(faces.length >= 15);
  assert.ok(faces.every(f => fs.existsSync(f.file)), 'every face points at a file that exists');
  const noto = faces.find(f => f.family === 'Noto Sans Kannada');
  assert.deepEqual(noto.weight, [400, 600]);
  assert.ok(noto.ranges.some(([lo, hi]) => 0x0c95 >= lo && 0x0c95 <= hi), 'Noto Sans Kannada covers Kannada KA');
  assert.ok(!faces.some(f => f.family.endsWith('Fallback')), "local()-only faces are skipped: a machine's own fonts cannot be gated");
});

const shaper = await createShaper();
const w = (font, text) => shaper.measure(font, text);

test('Latin, Devanagari and Kannada all get a real width, and nothing needs a system font', () => {
  assert.ok(w('400 20px Kalam', 'Hello world') > 50);
  assert.ok(w('400 20px Kalam', 'कोंकणी भाषा संमेलन') > 100);
  assert.ok(w('400 20px Kalam', 'ಕನ್ನಡ ಭಾಷೆ ಸಮ್ಮೇಳನ') > 100);
  assert.equal(shaper.unmodelled.size, 0);
});

test('width scales with the size, and the empty string is zero', () => {
  const a = w('400 10px Mukta', 'Poi at 6'), b = w('400 20px Mukta', 'Poi at 6');
  assert.ok(Math.abs(b - 2 * a) < 1e-9);
  assert.equal(w('400 20px Mukta', ''), 0);
});

test('Kannada under the Kalam stack falls to Noto Sans Kannada (Kalam has no Kannada)', () => {
  const text = 'ಕನ್ನಡ';
  assert.equal(w('400 20px Kalam', text), w('400 20px "Noto Sans Kannada"', text));
  // taken literally, 'Kalam' alone has no face for it: the gate says so instead of guessing
  assert.deepEqual(shaper.uncovered('400 20px Kalam', 'ಕ'), ['ಕ']);
  assert.deepEqual(shaper.uncovered('400 20px Kalam', 'Hello कोंकणी'), []);
});

test('a ZWNJ does not join: the same letters are wider with it, as in the board copy', () => {
  const joined = w('400 20px Kalam', 'ಜೂನ್ನಿಂದ'), apart = w('400 20px Kalam', 'ಜೂನ್‌ನಿಂದ');
  assert.ok(apart > joined + 5, `ZWNJ ${apart.toFixed(2)} vs joined ${joined.toFixed(2)}`);
});

test('the variable weight axis is set: Noto Sans Kannada 600 is wider than 400', () => {
  const text = 'ಕನ್ನಡ ಭಾಷೆ ಸಮ್ಮೇಳನ';
  assert.ok(w('600 20px "Noto Sans Kannada"', text) > w('400 20px "Noto Sans Kannada"', text) + 0.2);
  assert.equal(w('700 20px "Noto Sans Kannada"', text), w('600 20px "Noto Sans Kannada"', text), 'beyond the axis it clamps');
});

test('weights map to their own files: Mukta 500 is not its 400, Kalam 300 is not its 400', () => {
  assert.notEqual(w('500 20px Mukta', 'Open 7 to 1'), w('400 20px Mukta', 'Open 7 to 1'));
  assert.notEqual(w('300 20px Kalam', 'Open 7 to 1'), w('400 20px Kalam', 'Open 7 to 1'));
});

test('a bare stack head is widened to its token stack, and "literal" is not', async () => {
  const lit = await createShaper({ stack: 'literal' });
  assert.deepEqual(lit.uncovered('400 20px Kalam', 'ಕ'), ['ಕ']);
  assert.ok(w('400 20px Kalam', 'ಕ') > 0);
  assert.equal(lit.measure('400 20px Kalam', 'ಕ'), 0.5 * 20, 'uncovered characters are counted at the stated stand-in width');
  assert.ok(lit.unmodelled.has('ಕ'), 'and recorded');
});

test("the stand-in OffscreenCanvas answers measureText with the shaper's width, and can be removed", () => {
  const undo = installHbCanvas(shaper);
  try {
    const ctx = new globalThis.OffscreenCanvas(1, 1).getContext('2d');
    ctx.font = '400 20px Kalam, cursive';
    assert.equal(ctx.measureText('Hello world').width, w('400 20px Kalam, cursive', 'Hello world'));
    assert.equal(ctx.measureText('').width, 0);
  } finally { undo(); }
  assert.equal(typeof globalThis.OffscreenCanvas, 'undefined');
});

test('the committed calibration was made with these dependencies and these font files', () => {
  const cal = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packages/type/fixtures/calibration.json'), 'utf8'));
  assert.equal(cal.harfbuzzjs, packageVersion('harfbuzzjs'), 'harfbuzzjs changed: run node tools/text-gate.calibrate.mjs');
  assert.equal(cal.wawoff2, packageVersion('wawoff2'), 'wawoff2 changed: run node tools/text-gate.calibrate.mjs');
  for (const f of cal.fonts) {
    const sha = crypto.createHash('sha1').update(fs.readFileSync(path.join(REPO_ROOT, f.file))).digest('hex').slice(0, 12);
    assert.equal(sha, f.sha1, `${f.file} changed since the calibration: run node tools/text-gate.calibrate.mjs`);
  }
  assert.equal(cal.fonts.length, new Set(shaper.faces.map(f => f.file)).size, 'a font file was added or removed since the calibration');
});

test('coverage is by glyph, not by unicode-range: a face that has the range but no glyph hands the character on (glyph 0 is .notdef)', () => {
  const mukta = shaper.faces.find(f => f.family === 'Mukta' && f.weight[0] === 400 && f.file.includes('latin'));
  const inRange = cp => mukta.ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
  let hole = null;
  for (let cp = 0xa0; cp < 0x2ff && hole === null; cp++) if (inRange(cp) && shaper.faceFor(['Mukta'], 400, 'normal', cp) === null) hole = cp;
  assert.ok(hole !== null, 'Mukta Latin has a code point in its range that it has no glyph for');
  const ch = String.fromCodePoint(hole);
  assert.deepEqual(shaper.uncovered('400 16px Mukta', ch), [ch]);
  // with a later family that does draw it, the character falls through to that one
  const later = shaper.faces.find(f => f.family !== 'Mukta' && inRange(hole) && shaper.faceFor([f.family], 400, 'normal', hole));
  if (later) assert.equal(shaper.faceFor(['Mukta', later.family], 400, 'normal', hole).family, later.family);
  // and a joiner is never asked for a glyph
  assert.ok(shaper.faceFor(['Mukta'], 400, 'normal', 0x200c));
});

test('a word and a space are shaped apart, as Blink does: a kern pair with the space (Mukta 500, closing quote then space) is not applied', () => {
  const font = '500 32px Mukta';
  assert.ok(Math.abs(w(font, '” x') - (w(font, '”') + w(font, ' ') + w(font, 'x'))) < 1e-9);
  // calibrated: Chromium measures it so (tools/text-gate.calibrate.mjs, typography strings), 1.28 px wider than whole-string shaping would
});
