// The postcard's pure core: the name fits whatever it is, the layout is the same twice, the files are named for what they are.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD, MARGIN, NAME_MAX, normaliseName, seedFor, scriptOf, breakLines, fitName, layout, coverRect, describe, sniff, slug, fileName, gifTimes, progressText, graphemes } from './postcard.core.js';
import { SCENES, DEFAULT_SCENE, sceneNamed, sceneForSeed } from './scenes.js';
import { WORDS, fill } from './words.js';
import { CONCLAVE_2026 } from './events/conclave-2026.js';

// a stub oracle: each grapheme is half a size wide, a wide letter (W, M) is a whole size
const measure = (t, size, face) => graphemes(t).reduce((w, g) => w + (/[WM]/.test(g) ? 1 : 0.5) * size, 0) * (face === 'label' ? 0.9 : 1);
const NAMES = ['J', 'Asha Naik', 'Maria Conceição Fernandes de Albuquerque', 'आशा नाईक', 'ಕಾರ್ತಿಕ್ ಹೆಗಡೆ', 'അനിത മേനോൻ', 'فاطمہ خان', 'W'.repeat(NAME_MAX), 'Pneumonoultramicroscopicsilicovolcanoconiosis'.repeat(2), 'a b c d e f g h i j k l m n o p q r s t u v w x y z'];

test('normaliseName: trims, collapses, removes controls and direction overrides, keeps case, caps the length', () => {
  assert.equal(normaliseName('  Asha   Naik \n'), 'Asha Naik');
  assert.equal(normaliseName('As‮ha\u0000'), 'As ha');
  assert.equal(normaliseName('dEv KaMat'), 'dEv KaMat');
  assert.equal(normaliseName(null), '');
  assert.equal(graphemes(normaliseName('x'.repeat(200))).length, NAME_MAX);
  assert.equal(normaliseName('é'), 'é', 'NFC');
  const dev = 'क्षि'.repeat(70); // a grapheme is not cut in half by the cap
  assert.ok(graphemes(normaliseName(dev)).length <= NAME_MAX);
  assert.ok(!normaliseName(dev).endsWith('्'));
});

test('seedFor: the name makes the seed, a given seed wins, and the same name is the same seed', () => {
  assert.equal(seedFor('Asha'), seedFor(' Asha '));
  assert.notEqual(seedFor('Asha'), seedFor('asha'));
  assert.equal(seedFor('Asha', 7), 7);
  assert.equal(seedFor('Asha', 'x'), seedFor('whoever', 'x'));
  assert.equal(seedFor(''), seedFor('   '));
  for (const n of NAMES) { const s = seedFor(n); assert.ok(Number.isInteger(s) && s >= 1 && s <= 100000, `${n}: ${s}`); }
});

test('scriptOf: finds the script, and which are right to left or outside the library faces', () => {
  assert.deepEqual([scriptOf('Asha').script, scriptOf('Asha').covered], ['latin', true]);
  assert.equal(scriptOf('आशा').script, 'devanagari');
  assert.equal(scriptOf('ಕಾರ್ತಿಕ್').script, 'kannada');
  assert.deepEqual([scriptOf('അനിത').script, scriptOf('അനിത').covered, scriptOf('അനിത').rtl], ['malayalam', false, false]);
  assert.deepEqual([scriptOf('فاطمہ').script, scriptOf('فاطمہ').rtl, scriptOf('فاطمہ').covered], ['arabic', true, false]);
  assert.equal(scriptOf('தமிழ்').script, 'tamil');
  assert.equal(scriptOf('অনিতা').script, 'bengali');
  assert.equal(scriptOf('Asha आशा').script, 'devanagari');
  assert.equal(scriptOf('').script, 'latin');
});

test('breakLines: breaks at spaces, keeps a word whole unless told it may be cut, and gives up past the line limit', () => {
  const w = t => t.length * 10;
  assert.deepEqual(breakLines('aa bb cc dd', w, 50, 3), ['aa bb', 'cc dd']);
  assert.equal(breakLines('aaaaaaaaaaaa bb', w, 50, 3), null);
  assert.deepEqual(breakLines('aaaaaaaaaaaa bb', w, 50, 4, { breakWords: true }), ['aaaaa', 'aaaaa', 'aa bb']);
  assert.equal(breakLines('aaaaaaaaaaaa bb', w, 50, 2, { breakWords: true }), null);
  assert.equal(breakLines('a b c d e f g h', w, 30, 2), null);
  assert.deepEqual(breakLines('', w, 50, 3), []);
});

test('fitName: every line fits, for every size of name and every script, and a short name is big', () => {
  for (const n of NAMES) {
    const text = normaliseName(n), tall = scriptOf(text).tall;
    const fit = fitName(text, measure, { tall });
    assert.ok(fit.lines.length >= 1 && fit.lines.length <= 3, `${n}: ${fit.lines.length} lines`);
    for (const l of fit.lines) assert.ok(measure(l, fit.size, 'display') <= 1056, `${n}: "${l}" is ${measure(l, fit.size, 'display')} at ${fit.size}`);
    assert.ok(fit.lines.length * fit.lineHeight <= 248, `${n}: ${fit.lines.length} x ${fit.lineHeight} fits 248`);
    assert.equal(fit.lines.join('').replace(/ /g, ''), text.replace(/ /g, ''), `${n}: nothing is lost`);
  }
  assert.ok(fitName('J', measure).size >= 150, 'one letter is as big as the name gets');
  assert.equal(fitName('J', measure).lines.length, 1);
  assert.ok(fitName('Asha Naik', measure).size > fitName('Maria Conceição Fernandes de Albuquerque', measure).size);
});

test('fitName: it shrinks before it wraps, and wraps before it breaks a word', () => {
  const a = fitName('Maria Fernandes', measure), b = fitName('Maria Conceição Fernandes de Albuquerque', measure);
  assert.equal(a.lines.length, 1);
  assert.ok(b.lines.length >= 2 && b.size >= 56);
  const word = fitName('W'.repeat(60), measure);
  assert.ok(word.lines.length <= 3 && word.size < 56, 'one 60-letter word is broken inside, small');
  for (const l of word.lines) assert.ok(measure(l, word.size, 'display') <= 1056);
});

test('layout: the same name and scene give the identical layout; another name gives another', () => {
  const o = { name: 'Asha Naik', scene: 'ferry', event: CONCLAVE_2026, measure };
  assert.deepEqual(layout(o), layout({ ...o }));
  assert.notDeepEqual(layout(o).name, layout({ ...o, name: 'Bruno Fernandes' }).name);
  assert.notEqual(layout(o).seed, layout({ ...o, name: 'Bruno Fernandes' }).seed);
  assert.equal(layout({ ...o, seed: 5 }).seed, 5);
  assert.equal(layout({ ...o, name: '  Asha  Naik ' }).name.text, 'Asha Naik');
});

test('layout: nothing leaves the card, and the name, the picture and the stamp do not overlap', () => {
  const inCard = (b, what) => assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= CARD.width && b.y + b.h <= CARD.height, `${what} in the card: ${JSON.stringify(b)}`);
  const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const n of NAMES) {
    const L = layout({ name: n, scene: 'posta', event: { ...CONCLAVE_2026, line: 'We look forward to seeing you in Goa.' }, measure });
    inCard(L.picture.frame, 'picture'); inCard(L.stamp, 'stamp'); inCard(L.name.box, 'name box');
    assert.ok(!meets(L.picture.frame, L.name.box), 'picture and name');
    assert.ok(!meets(L.stamp, L.name.box), 'stamp and name');
    assert.ok(!meets(L.stamp, L.picture.frame), 'stamp and picture');
    assert.equal(L.picture.inner.w / L.picture.inner.h, 1.5, 'the inner picture is 3:2');
    for (const l of L.name.lines) assert.ok(l.baseline > L.name.box.y && l.baseline < L.name.box.y + L.name.box.h + 1, `${n}: baseline ${l.baseline}`);
    assert.ok(L.postmark.cx + L.postmark.r <= CARD.width - MARGIN + 40);
    assert.ok(L.postmark.waves[0].x0 >= L.picture.frame.x + L.picture.frame.w, 'the waves stay right of the picture');
  }
  assert.equal(CARD.width / CARD.height, 1.5);
});

test('layout: the stamp and the postmark carry the event words, the card says where to make your own', () => {
  const L = layout({ name: 'Asha', scene: 'posta', event: CONCLAVE_2026, measure });
  assert.equal(L.stamp.words.lines.join(' '), 'CONCLAVE 2026');
  assert.equal(L.postmark.ringTop.text, 'GOA');
  assert.equal(L.postmark.ringBottom.text, '22–23 OCT 2026');
  assert.equal(L.kicker.text, 'Greetings from Goa');
  assert.match(L.footer.lines.map(l => l.text).join(' '), /susegad\.asymmetrica\.ai\/postcard/);
  assert.match(L.alt, /^A postcard for Asha: /);
  const bare = layout({ name: 'Asha', event: {}, measure });
  assert.equal(bare.stamp.words, null); assert.equal(bare.kicker, null); assert.equal(bare.eventLine, null);
  assert.equal(describe({ name: 'Asha', blurb: 'the ferry crossing the Mandovi, with a jetty on each bank', event: CONCLAVE_2026 }), 'A postcard for Asha: the ferry crossing the Mandovi, with a jetty on each bank. Stamped Conclave 2026, postmarked Goa 22–23 Oct 2026.');
});

test('describe: the name comes first; with none it says there is room for one; with no event it stops after the picture', () => {
  assert.equal(describe({ name: 'आशा', blurb: 'the old post office in Fontainhas', event: CONCLAVE_2026 }), 'A postcard for आशा: the old post office in Fontainhas. Stamped Conclave 2026, postmarked Goa 22–23 Oct 2026.');
  assert.equal(describe({ name: '', blurb: 'a green door', event: CONCLAVE_2026 }), 'A postcard with space for your name: a green door. Stamped Conclave 2026, postmarked Goa 22–23 Oct 2026.');
  assert.equal(describe({ name: 'Asha', blurb: 'a green door', event: {} }), 'A postcard for Asha: a green door.');
  assert.equal(describe({ name: 'Asha', blurb: 'a green door', event: { place: 'Goa' } }), 'A postcard for Asha: a green door. Postmarked Goa.');
});

test('layout: an empty name holds the placeholder, lighter in the drawing, and is still no name for the alt text or the file', () => {
  const L = layout({ name: '  ', placeholder: 'Your name', scene: 'ferry', blurb: 'the ferry', event: CONCLAVE_2026, measure });
  assert.deepEqual([L.name.empty, L.name.text, L.name.lines.map(l => l.text)], [true, '', ['Your name']]);
  assert.ok(L.name.size >= 84, 'the placeholder is set as large as a short name');
  assert.match(L.alt, /^A postcard with space for your name: the ferry\./);
  const real = layout({ name: 'Asha', placeholder: 'Your name', measure, event: CONCLAVE_2026 });
  assert.deepEqual([real.name.empty, real.name.lines.map(l => l.text)], [false, ['Asha']]);
  assert.equal(layout({ name: '', measure }).name.lines.length, 0, 'with no placeholder an empty name draws nothing');
  assert.equal(fileName('', 'image/png'), 'postcard-guest.png');
});

test('layout: an optional line goes on the ruled lines and fits them', () => {
  const L = layout({ name: 'Asha', event: { ...CONCLAVE_2026, line: 'See you by the river at the Conclave, with something warm to drink and plenty of time to talk.' }, measure });
  assert.ok(L.eventLine.lines.length >= 1 && L.eventLine.lines.length <= 3);
  for (const l of L.eventLine.lines) assert.ok(measure(l.text, L.eventLine.size, 'hand') <= L.right.w);
});

test('layout: a blank name draws no name', () => {
  const L = layout({ name: '   ', event: CONCLAVE_2026, measure });
  assert.deepEqual(L.name.lines, []); assert.ok(L.seed >= 1);
});

test('layout: Urdu is set right to left, Malayalam is not and says it is outside the library faces', () => {
  assert.equal(layout({ name: 'فاطمہ خان', measure }).name.direction, 'rtl');
  assert.equal(layout({ name: 'Asha', measure }).name.direction, 'ltr');
  const m = layout({ name: 'അനിത മേനോൻ', measure });
  assert.equal(m.covered, false); assert.equal(m.name.direction, 'ltr');
});

test('coverRect: crops a scene to the picture without squeezing it', () => {
  const inner = { w: 1008, h: 672 };
  assert.deepEqual(coverRect(1200, 800, inner), [0, 0, 1200, 800]);
  const [sx, sy, sw, sh] = coverRect(1200, 520, inner);
  assert.ok(Math.abs(sw / sh - 1.5) < 1e-9 && sx > 0 && sy === 0);
  const [, ty, tw, th] = coverRect(1200, 900, inner);
  assert.ok(Math.abs(tw / th - 1.5) < 1e-9 && ty > 0);
});

test('files: bytes say what a file is, the name follows the bytes, and a name in any script makes a file name', () => {
  assert.equal(sniff(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
  assert.equal(sniff(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0])), 'image/gif');
  assert.equal(sniff(Uint8Array.from([1, 2, 3])), null);
  assert.equal(fileName('Asha Naik', 'image/png'), 'postcard-asha-naik.png');
  assert.equal(fileName('Asha Naik', 'image/gif'), 'postcard-asha-naik.gif');
  assert.equal(fileName('आशा नाईक', 'image/png'), 'postcard-आशा-नाईक.png');
  assert.equal(fileName('***', 'image/png'), 'postcard-guest.png');
  assert.ok(slug('x'.repeat(100)).length <= 40);
  assert.ok(!slug('Maria Conceição Fernandes de Albuquerque').endsWith('-'));
});

test('gifTimes: three seconds at ten frames a second is thirty frames a tenth apart, from the start given', () => {
  const t = gifTimes();
  assert.equal(t.length, 30); assert.equal(t[0], 0); assert.ok(Math.abs(t[29] - 2.9) < 1e-9);
  assert.deepEqual(gifTimes({ fps: 10, seconds: 0.3, start: 8.5 }).map(x => +x.toFixed(2)), [8.5, 8.6, 8.7]);
  assert.equal(gifTimes({ seconds: 0 }).length, 1);
});

test('progressText: a percentage in words, never past 100', () => {
  assert.equal(progressText('drawing', 15, 30), 'Drawing the frames: 50%');
  assert.equal(progressText('encoding', 99, 30), 'Putting the frames together: 100%');
});

test('scenes: the picker list is unique, each has words for the alt text, and sceneNamed falls back to the first', () => {
  assert.equal(new Set(SCENES.map(s => s.name)).size, SCENES.length);
  for (const s of SCENES) { assert.ok(s.blurb.length > 3 && typeof s.load === 'function', s.name); assert.ok(!/[.!]$/.test(s.blurb)); assert.ok(/^[A-Z]/.test(s.label) && s.label.length < 26, `${s.name}: a picker name`); }
  assert.equal(sceneNamed('nope'), SCENES[0]); assert.equal(sceneNamed('ferry').name, 'ferry');
});

test('the Conclave config is placeholders in one file: the three defaults, an en dash in the dates', () => {
  assert.deepEqual([CONCLAVE_2026.stamp, CONCLAVE_2026.place, CONCLAVE_2026.dates], ['Conclave 2026', 'Goa', '22–23 Oct 2026']);
  assert.ok(Object.isFrozen(CONCLAVE_2026));
});

test('sceneForSeed: a name picks the same scene every time, never a still one, and an empty name picks the ferry', () => {
  assert.equal(DEFAULT_SCENE, 'ferry'); assert.equal(sceneForSeed(null), 'ferry'); assert.equal(sceneNamed(DEFAULT_SCENE).still, undefined);
  const seen = new Set();
  for (const n of NAMES.concat(['Dev Kamat', 'Rohan Gaonkar', 'Zoë D’Souza', 'Joaquim Menezes'])) {
    const a = sceneForSeed(seedFor(n)); assert.equal(a, sceneForSeed(seedFor(` ${n} `)), n); assert.ok(!sceneNamed(a).still, `${n} -> ${a}`); seen.add(a);
  }
  assert.ok(seen.size >= 3, `the scenes picked: ${[...seen]}`);
  assert.equal(sceneForSeed(1e5), sceneForSeed(1e5)); assert.ok(SCENES.some(s => s.name === sceneForSeed(99999)));
});

test('words: every hole in the strings is one the maker fills, and fill leaves an unknown hole as it was', () => {
  const known = new Set(['max', 'scene', 'percent', 'filename', 'size', 'name', 'stamp', 'url']);
  for (const [k, v] of Object.entries(WORDS)) for (const [, hole] of v.matchAll(/\{(\w+)\}/g)) assert.ok(known.has(hole), `${k}: {${hole}}`);
  assert.equal(fill('Saved {filename} ({size}).', { filename: 'a.png', size: '3 KB' }), 'Saved a.png (3 KB).');
  assert.equal(fill('Hello {who}'), 'Hello {who}');
  for (const v of Object.values(WORDS)) assert.ok(!/[—]/.test(v), 'no em dash in a string people read');
});

test('progressText: takes the words to say it in', () => {
  assert.equal(progressText('drawing', 15, 30, { drawing: 'A {percent}', encoding: 'B {percent}' }), 'A 50');
  assert.equal(progressText('encoding', 15, 30, { drawing: 'A {percent}', encoding: 'B {percent}' }), 'B 50');
});

test('the Goa config: a Goa postcard postmarked Panjim, no event name, no line, frozen, an en dash in the dates', async () => {
  const { GOA_OCT_2026 } = await import('./events/goa-oct-2026.js');
  assert.deepEqual({ ...GOA_OCT_2026 }, { stamp: 'Goa', place: 'Panjim', dates: '22–23 Oct 2026', line: '' });
  assert.ok(Object.isFrozen(GOA_OCT_2026));
  assert.ok(!/conclave/i.test(JSON.stringify(GOA_OCT_2026)), 'no official event name by default');
});
