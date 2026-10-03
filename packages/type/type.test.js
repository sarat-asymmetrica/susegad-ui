// The type tier's pure half, in Node. Pretext measures with a canvas; Node has
// none, so (as in Pretext's own suite) a fake OffscreenCanvas answers: every
// grapheme is half the font size wide. That proves our geometry (shapes, one
// width per line, logical units, fitting, cards), not a browser's glyphs; the
// scenes' browser checks cover real Kalam.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const count = t => [...graphemes.segment(t)].length;
globalThis.OffscreenCanvas = class {
  getContext() {
    return { font: '10px sans-serif', measureText(t) { const px = parseFloat(/([\d.]+)px/.exec(this.font)[1]); return { width: count(t) * px * 0.5 }; } };
  }
};
const T = await import('./layout.js');

const PARA = 'Our lowest rate, June to September. The veranda stays dry and the paddy turns green.';
const block = (text, px, extra = {}) => ({ prepared: T.prepare(text, `${px}px Kalam`), lineHeight: px * 1.3, ...extra });
const joined = lines => lines.map(l => l.text).join('').replace(/\s+/g, ' ').trim();

test('a rectangle: every line inside it, in order, and the words all there', () => {
  const shape = T.rect(100, 50, 200, 300, 10);
  const { lines, fits } = T.layIntoShape([block(PARA, 20)], shape, { top: 60, bottom: 340 });
  assert.ok(fits);
  assert.equal(joined(lines), PARA);
  for (const l of lines) {
    assert.equal(l.x, 110);
    assert.ok(l.w <= 180 + 1e-9, `line "${l.text}" is ${l.w} wide`);
    assert.ok(l.y >= 60 && l.y + l.h <= 340);
  }
  lines.slice(1).forEach((l, i) => assert.equal(l.y, lines[i].y + lines[i].h));
});

test('logical units: at scale 0.5 the words are laid at their real size and come back twice as big', () => {
  // 10 CSS px text on a surface drawn at half size: a 10 px grapheme is 5 CSS px, 10 logical units
  const big = T.layIntoShape([block('aaaa bbbb cccc', 10)], T.rect(0, 0, 100, 100), { top: 0, bottom: 100, scale: 0.5 });
  assert.deepEqual(big.lines.map(l => l.text.trim()), ['aaaa bbbb', 'cccc']);
  assert.equal(big.lines[0].w, 90); // 9 graphemes × 5 CSS px ÷ 0.5
  assert.equal(big.lines[0].h, 26); // 13 CSS px of line height ÷ 0.5
});

test('an arch: the top lines are narrower, and each one sits inside the arch at its height', () => {
  const x = 0, y = 0, w = 300, h = 400, rise = 120;
  const shape = T.arch(x, y, w, h, rise, 8);
  const { lines, fits } = T.layIntoShape([block(PARA + ' ' + PARA, 16)], shape, { top: 8, bottom: 392, minWidth: 40 });
  assert.ok(fits);
  const room = lines.map(l => shape(l.y, l.y + l.h).w);
  assert.ok(room[0] < room.at(-1) - 60, `top room ${room[0].toFixed(0)}, bottom ${room.at(-1).toFixed(0)}`);
  for (const l of lines) {
    const band = shape(l.y, l.y + l.h);
    assert.ok(l.x >= band.x - 1e-9 && l.x + l.w <= band.x + band.w + 1e-9, `"${l.text}" leaves the arch`);
  }
});

test('a slanted sign: each line starts further across as it goes down', () => {
  const { lines } = T.layIntoShape([block(PARA, 14)], T.slant(0, 0, 220, 300, 0.3, 4), { top: 4, bottom: 296 });
  assert.ok(lines.length > 3);
  lines.slice(1).forEach((l, i) => assert.ok(l.x > lines[i].x));
});

test('blocks: a heading then a paragraph, centred, with the gap between them', () => {
  const blocks = [block('Come for the rain', 28, { align: 'center' }), block(PARA, 18, { gap: 10, align: 'center' })];
  const { lines, fits } = T.layIntoShape(blocks, T.rect(0, 0, 400, 400, 10), { top: 10, bottom: 390 });
  assert.ok(fits);
  assert.equal(lines[0].block, 0);
  assert.equal(joined(lines.filter(l => l.block === 0)), 'Come for the rain');
  const first = lines.find(l => l.block === 1), last = lines.filter(l => l.block === 0).at(-1);
  assert.equal(first.y, last.y + last.h + 10);
  for (const l of lines) assert.ok(Math.abs(l.x + l.w / 2 - 200) < 1e-9, 'centred');
});

test('not fitting: too short a board, or a word wider than the board, says so', () => {
  assert.equal(T.layIntoShape([block(PARA, 20)], T.rect(0, 0, 200, 60), { top: 0, bottom: 60 }).fits, false);
  const long = T.layIntoShape([block('Supercalifragilistic', 20)], T.rect(0, 0, 100, 400), { top: 0, bottom: 400 });
  assert.equal(long.fits, false, 'a word broken across lines is not a fit');
});

test('fitSize: the largest size that fits, or null (the flat reading)', () => {
  const shape = T.rect(0, 0, 260, 200, 10);
  const build = s => [block(PARA, s)];
  const fit = T.fitSize([30, 26, 22, 18, 14], build, shape, { top: 10, bottom: 190 });
  assert.ok(fit && fit.size < 30, 'a smaller size was needed');
  assert.equal(T.layIntoShape(build(fit.size + 4), shape, { top: 10, bottom: 190 }).fits, false);
  assert.equal(T.fitSize([30, 26], build, shape, { top: 10, bottom: 190 }), null);
  // the halving search finds what trying every size in turn finds, with fewer tries
  const sizes = Array.from({ length: 33 }, (_, i) => 30 - i * 0.5);
  let tries = 0;
  const counted = s => { tries++; return build(s); };
  const linear = sizes.find(s => T.layIntoShape(build(s), shape, { top: 10, bottom: 190 }).fits);
  assert.equal(T.fitSize(sizes, counted, shape, { top: 10, bottom: 190 }).size, linear);
  assert.ok(tries <= 6, `${tries} tries for ${sizes.length} sizes`);
});

test('cards: shrink-wrap keeps the lines, balance evens them out', () => {
  const p = T.prepare('Fish before nine, vegetables all morning, and kokum in season.', '16px Kalam');
  const wrap = T.shrinkWrap(p, 240), even = T.balance(p, 240);
  assert.ok(wrap.width <= 240);
  assert.equal(even.lines, wrap.lines);
  assert.ok(even.width <= wrap.width, `balanced ${even.width} vs wrapped ${wrap.width}`);
  assert.ok(even.width < 240 * 0.9, 'balancing pulled the card in');
});

test('Devanagari: lines break between words, never inside a conjunct or before a vowel sign', () => {
  const text = 'क्षमा करा, पाऊस आला आहे आणि शेत हिरवे झाले. पावसाळ्यात भात लावणी सुरू होते.';
  const { lines, fits } = T.layIntoShape([block(text, 20)], T.rect(0, 0, 90, 600), { top: 0, bottom: 600 });
  assert.ok(fits);
  assert.ok(lines.length > 4);
  assert.equal(joined(lines), text);
  for (const l of lines) assert.equal(torn(l.text), false, `"${l.text}" starts on a vowel sign or ends on a virama`);
  assert.ok(lines.some(l => l.text.includes('क्षमा')), 'the conjunct stayed whole');
  // control: the same test on a width-only cut every 7 code units finds torn lines
  const naive = [];
  for (let i = 0; i < text.length; i += 7) naive.push(text.slice(i, i + 7));
  assert.ok(naive.some(torn), 'the test can see a torn line');
});
/** A line that starts on a combining mark (a vowel sign) or ends on a virama was cut inside a syllable. */
const VIRAMA = String.fromCharCode(0x94d);
const torn = t => /^\p{M}/u.test(t) || t.trimEnd().endsWith(VIRAMA);

test('Konkani in Romi: diacritics stay on their letters, even as combining marks', () => {
  // decomposed on purpose (a + combining tilde): the mark must never start a line
  const TILDE = String.fromCharCode(0x303);
  const text = `Dev borem korum. Pa${TILDE}v ani cha${TILDE} sokalim, mhaka pavsachem ghor avoddta.`;
  const { lines, fits } = T.layIntoShape([block(text, 18)], T.rect(0, 0, 110, 600), { top: 0, bottom: 600 });
  assert.ok(fits);
  assert.equal(joined(lines), text);
  for (const l of lines) assert.equal(torn(l.text), false, `"${l.text}" starts with a loose mark`);
  assert.ok(lines.some(l => l.text.includes(`Pa${TILDE}v`)));
  // control: a cut just before the tilde is a torn line
  assert.ok(torn(text.slice(text.indexOf(TILDE))), 'the test can see a loose mark');
});

test('setBlocks: a heading and a paragraph at the largest size that fits, centred down the room left', () => {
  const shape = T.arch(0, 0, 300, 220, 40, 10), specs = [{ tag: 'h2', text: 'Come for the rain', ratio: 1.45 }, { tag: 'p', text: PARA }];
  const set = T.setBlocks(specs, shape, { sizes: [30, 24, 20, 18, 16, 14], family: 'Kalam', top: 10, bottom: 210, minWidth: 30 });
  assert.ok(set, 'it fits at some size');
  assert.ok(set.size < 30);
  assert.deepEqual(set.blocks.map(b => b.tag), ['h2', 'p']);
  assert.equal(set.blocks[0].px, +(set.size * 1.45).toFixed(2));
  assert.equal(joined(set.lines.filter(l => l.block === 1)), PARA);
  const top = set.lines[0].y - 10, last = set.lines.at(-1), bottom = 210 - (last.y + last.h);
  assert.ok(Math.abs(top - bottom) < set.lines[0].h, `centred: ${top.toFixed(1)} above, ${bottom.toFixed(1)} below`);
  assert.equal(T.setBlocks(specs, shape, { sizes: [30, 28], family: 'Kalam', top: 10, bottom: 210 }), null, 'too big at every size: null');
  // left-aligned and from the top: each line starts where its band starts
  const left = T.setBlocks(specs, shape, { sizes: [20, 16, 14], family: 'Kalam', top: 10, bottom: 210, minWidth: 30, valign: 'top', align: 'left' });
  assert.equal(left.lines[0].y, 10);
  for (const l of left.lines) assert.equal(l.x, shape(l.y, l.y + l.h).x);
});

test('labelBox: the words plus padding, never under a 24 px target', () => {
  const box = T.labelBox('Open 7 to 1', '500 16px Mukta', 16);
  assert.equal(box.w, 11 * 8 + 16 * 0.7 * 2);
  assert.equal(box.h, 27.2);
  assert.deepEqual(T.labelBox('7', '500 10px Mukta', 10), { w: 24, h: 24 });
});

test('calmOf pads each line box into a calm rect', () => {
  assert.deepEqual(T.calmOf([{ x: 10, y: 20, w: 30, h: 8 }], 2), [{ x: 8, y: 18, w: 34, h: 12 }]);
});
