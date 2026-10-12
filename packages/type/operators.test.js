// The named operators (layout.operators.js) in Node, through the fake oracle:
// every grapheme half the font size wide, breaks at spaces. Property-style:
// each operator is held to the invariant it exists for, over seeded random
// cases (determinism, so a failure is reproducible), with the case printed
// when one breaks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLayout, rect, arch } from './layout.core.js';
import { createFakeOracle } from './oracle.fake.js';
import { fit, clampLines, predictHeight, pack, place, distribute } from './layout.operators.js';

const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const WORDS = 'rain veranda paddy kokum harbour monsoon fish before nine vegetables morning lowest rate June September stays dry green lantern tiled roof'.split(' ');
const sentence = (r, n) => Array.from({ length: n }, () => WORDS[int(r, 0, WORDS.length - 1)]).join(' ');
const DEVA = 'नमस्ते दुनिया, यह एक लंबा वाक्य है जो कई पंक्तियों में फैलता है और क्षत्रिय ज्ञान श्री';

const oracle = createFakeOracle();
const L = createLayout(oracle);
const FONT = '20px Kalam';
const blocksFor = (text, px, leading = 1.22) => [{ prepared: L.prepare(text, `400 ${px}px Kalam`), lineHeight: +(px * leading).toFixed(2) }];
const measure = (text, font = FONT) => oracle.stats(oracle.prepare(text, font), 1e6).maxLineWidth;
const hits = (a, b) => a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;

// ── fit ────────────────────────────────────────────────────────────────────

test('fit: the size fits, and one px more does not (random rects)', () => {
  const r = rng(11);
  let tight = 0;
  for (let k = 0; k < 80; k++) {
    const text = sentence(r, int(r, 3, 30)), w = int(r, 120, 420), h = int(r, 80, 360), pad = int(r, 0, 12);
    const shape = rect(0, 0, w, h, pad), opts = { family: 'Kalam', minPx: 6, maxPx: 72, top: pad, bottom: h - pad };
    const got = fit(L, text, shape, opts), why = `case ${k}: "${text}" in ${w}x${h} pad ${pad}`;
    if (!got) { assert.equal(L.layIntoShape(blocksFor(text, 6), shape, opts).fits, false, `${why}: null, but 6px fits`); continue; }
    assert.equal(L.layIntoShape(blocksFor(text, got.px), shape, opts).fits, true, `${why}: ${got.px}px does not fit`);
    assert.equal(got.px, Math.round(got.px));
    if (got.px < 72) { tight++; assert.equal(L.layIntoShape(blocksFor(text, got.px + 1), shape, opts).fits, false, `${why}: ${got.px + 1}px fits too`); }
    assert.equal(got.lines.map(l => l.text).join('').replace(/\s+/g, ' ').trim(), text, `${why}: words lost`);
  }
  assert.ok(tight > 40, `only ${tight} cases were size-limited`);
});

test('fit: no word is broken, null when even the smallest size would break one', () => {
  const shape = rect(0, 0, 100, 300);
  const got = fit(L, 'Supercalifragilistic is long', shape, { family: 'Kalam', minPx: 8, maxPx: 40, top: 0, bottom: 300 });
  assert.ok(got.lines.every(l => !/^\S+$/.test(l.text.trim()) || l.text.trim() === 'Supercalifragilistic' || !'Supercalifragilistic'.includes(l.text.trim())));
  assert.ok(got.lines.some(l => l.text.trim() === 'Supercalifragilistic'));
  assert.equal(fit(L, 'Supercalifragilistic', shape, { family: 'Kalam', minPx: 12, maxPx: 40, top: 0, bottom: 300 }), null); // 20 graphemes at 12px = 120 > 100
});

test('fit: a short text takes maxPx, an impossible one is null, an arch fits too', () => {
  assert.equal(fit(L, 'Hi', rect(0, 0, 300, 300), { family: 'Kalam', minPx: 8, maxPx: 48, top: 0, bottom: 300 }).px, 48);
  assert.equal(fit(L, sentence(rng(1), 60), rect(0, 0, 100, 40), { family: 'Kalam', minPx: 10, maxPx: 40, top: 0, bottom: 40 }), null);
  assert.equal(fit(L, 'x', rect(0, 0, 10, 10), { family: 'Kalam', minPx: 20, maxPx: 10, top: 0, bottom: 10 }), null); // an empty range
  const shape = arch(0, 0, 300, 400, 120, 8), opts = { family: 'Kalam', minPx: 8, maxPx: 40, top: 8, bottom: 392, minWidth: 40 };
  const got = fit(L, sentence(rng(5), 40), shape, opts);
  assert.ok(got && L.layIntoShape(blocksFor(sentence(rng(5), 40), got.px), shape, opts).fits);
});

test('fit: O(log n) prepares, not one per size', () => {
  let prepares = 0;
  const counting = { ...oracle, prepare: (t, f) => (prepares++, oracle.prepare(t, f)) };
  const layout = createLayout(counting), sizes = 200;
  fit(layout, sentence(rng(3), 40), rect(0, 0, 300, 300), { family: 'Kalam', minPx: 1, maxPx: sizes, top: 0, bottom: 300 });
  assert.ok(prepares >= 1 && prepares <= Math.ceil(Math.log2(sizes)) + 1, `${prepares} prepares for ${sizes} sizes`);
});

test('fit: step widens the grid', () => {
  const opts = { family: 'Kalam', minPx: 8, maxPx: 60, top: 0, bottom: 200, step: 4 };
  const got = fit(L, sentence(rng(9), 12), rect(0, 0, 200, 200), opts);
  assert.equal((60 - got.px) % 4, 0);
});

// ── clampLines ─────────────────────────────────────────────────────────────

const laid = (text, w, px = 20) => L.layIntoShape(blocksFor(text, px), rect(0, 0, w, 2000), { top: 0, bottom: 2000 }).lines;
const segments = s => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map(g => g.segment);
const boundaries = s => { const out = new Set([0]); let n = 0; for (const g of segments(s)) { n += g.length; out.add(n); } return out; };

test('layIntoShape gives each line its band: room', () => {
  const lines = L.layIntoShape(blocksFor('aaaa bbbb cccc dddd', 20), arch(0, 0, 300, 400, 120, 8), { top: 8, bottom: 392, minWidth: 40 }).lines;
  assert.ok(lines.every(l => l.room >= l.w - 1e-9) && lines[0].room < lines.at(-1).room);
});

test('clampLines: n lines, the last ends in an ellipsis that fits its band, the rest untouched', () => {
  const r = rng(21);
  let cut = 0;
  for (let k = 0; k < 120; k++) {
    const text = sentence(r, int(r, 4, 40)), w = int(r, 90, 400), n = int(r, 1, 5), lines = laid(text, w);
    const got = clampLines(L, lines, n, { font: FONT }), why = `case ${k}: "${text}" at ${w}, n=${n}`;
    assert.equal(got.fullText, lines.map(l => l.text).join('').trimEnd(), why);
    assert.ok(got.lines.length <= n, why);
    if (lines.length <= n) { assert.equal(got.clamped, false, why); assert.deepEqual(got.lines, lines, why); continue; }
    cut++;
    assert.equal(got.clamped, true, why);
    assert.equal(got.lines.length, n, why);
    assert.deepEqual(got.lines.slice(0, -1), lines.slice(0, n - 1), `${why}: an earlier line changed`);
    const last = got.lines.at(-1);
    assert.ok(last.text.endsWith('…'), `${why}: "${last.text}"`);
    assert.ok(measure(last.text) <= last.room + 1e-9, `${why}: "${last.text}" is ${measure(last.text)} in a band of ${last.room}`);
    assert.equal(last.w, measure(last.text), why);
    assert.ok(lines[n - 1].text.startsWith(last.text.slice(0, -1)), `${why}: not a prefix of the line it shortens`);
    // it kept as much as it could: the longest prefix that fits (found by a linear scan), or a word end holding at least half of it
    const gs = segments(lines[n - 1].text.trimEnd()), P = last.text.slice(0, -1);
    let K = gs.length; while (K > 0 && measure(gs.slice(0, K).join('').trimEnd() + '…') > last.room + 1e-9) K--;
    const longest = gs.slice(0, K).join('').trimEnd();
    assert.ok(P === longest || (P.length >= longest.length * 0.5 && /^\s/.test(lines[n - 1].text.slice(P.length))), `${why}: kept "${P}", could keep "${longest}"`);
  }
  assert.ok(cut > 60, `only ${cut} cases were cut`);
});

test('clampLines: a cut falls on a word end when that costs little, mid-word when it must', () => {
  const text = 'alpha beta gamma delta epsilon zeta';
  const lines = laid(text, 5 * 20 * 0.5 * 5.5); // about 27 graphemes: "alpha beta gamma delta" fits one line
  const wordy = clampLines(L, lines, 1, { font: FONT }).lines[0];
  assert.match(wordy.text, /^(alpha|alpha beta|alpha beta gamma|alpha beta gamma delta)…$/);
  const long = clampLines(L, laid('Supercalifragilisticexpialidocious and more', 100, 20), 1, { font: FONT }).lines[0]; // a word wider than the band is broken by the layout
  assert.match(long.text, /^Supercal[a-z]*…$/);
  assert.ok(measure(long.text) <= long.room + 1e-9 && long.text.length > 4);
});

test('clampLines: never cuts inside a Devanagari cluster, at any width', () => {
  const marks = /\p{M}/u, VIRAMA = '्', boundary = boundaries(DEVA);
  let cuts = 0;
  for (let w = 40; w <= 700; w += 7) {
    const lines = laid(DEVA, w, 20);
    for (const n of [1, 2]) {
      const got = clampLines(L, lines, n, { font: FONT });
      if (!got.clamped) continue;
      cuts++;
      const last = got.lines.at(-1), prefix = last.text.slice(0, -1), src = lines[n - 1].text;
      assert.ok(src.startsWith(prefix), `w=${w}: "${prefix}" is not a prefix of "${src}"`);
      assert.ok(!marks.test(src.slice(prefix.length)[0] ?? ''), `w=${w}: cut before a combining mark in "${prefix}|${src.slice(prefix.length)}"`);
      assert.ok(!prefix.endsWith(VIRAMA), `w=${w}: "${prefix}" ends on a virama`);
      const offset = lines.slice(0, n - 1).reduce((s, l) => s + l.text.length, 0) + prefix.length;
      assert.ok(boundary.has(offset), `w=${w}: offset ${offset} is inside a cluster of the whole text`);
      assert.ok(measure(last.text) <= last.room + 1e-9, `w=${w}`);
    }
  }
  assert.ok(cuts > 40, `only ${cuts} Devanagari cuts`);
});

test('clampLines: mid-word cuts keep whole clusters even when the measure would let half a cluster in', () => {
  // an oracle that charges per code point, as a real font can: a base and its virama or matra each take room, so a cut inside a cluster would 'fit'
  const perCodePoint = { ...createFakeOracle(), prepare: (t, f) => ({ gs: Array.from(t), unit: parseFloat(/([\d.]+)px/.exec(f)[1]) * 0.5 }) };
  const cp = createLayout(perCodePoint), word = 'अ संविधानसंशोधनअधिनियमक्षत्रियज्ञान', boundary = boundaries(word);
  let cuts = 0;
  for (const layout of [L, cp]) {
    for (let room = 20; room <= 300; room += 3) {
      const line = { block: 0, text: word, x: 0, y: 0, w: 400, h: 24, room };
      const got = clampLines(layout, [line, { ...line, y: 24, text: 'more' }], 1, { font: FONT });
      const prefix = got.lines[0].text.slice(0, -1);
      cuts++;
      assert.ok(boundary.has(prefix.length) && !/\p{M}/u.test(word[prefix.length] ?? '') && !prefix.endsWith('्'), `room ${room}: "${prefix}|${word.slice(prefix.length)}" is cut inside a cluster`);
    }
  }
  assert.ok(cuts > 150);
});

test('clampLines: more says the layout itself ran out; a centred line is re-centred; no room is reported', () => {
  const lines = laid('alpha beta gamma delta', 400);
  assert.equal(lines.length, 1);
  const done = clampLines(L, lines, 3, { font: FONT, more: true });
  assert.equal(done.clamped, true);
  assert.ok(done.lines[0].text.endsWith('…'));
  const centred = L.layIntoShape([{ ...blocksFor('alpha beta gamma delta epsilon zeta eta theta', 20)[0], align: 'center' }], rect(0, 0, 120, 2000), { top: 0, bottom: 2000 }).lines;
  const c = clampLines(L, centred, 1, { font: FONT, align: 'center' }).lines[0];
  assert.ok(Math.abs(c.x - (c.room - c.w) / 2) < 1e-9, `x ${c.x} for ${c.w} in ${c.room}`);
  const tiny = clampLines(L, [{ block: 0, text: 'abc def', x: 0, y: 0, w: 35, h: 24, room: 3 }, { block: 0, text: 'more', x: 0, y: 24, w: 20, h: 24 }], 1, { font: FONT });
  assert.equal(tiny.fits, false);
  assert.equal(tiny.lines[0].text, '…');
  assert.deepEqual(clampLines(L, lines, 0, { font: FONT }).lines, []);
});

// ── pack ───────────────────────────────────────────────────────────────────

test('predictHeight is the line count times the line height, and matches the laid height', () => {
  const r = rng(31);
  for (let k = 0; k < 30; k++) {
    const text = sentence(r, int(r, 2, 40)), w = int(r, 100, 360), lh = 26;
    const predicted = predictHeight(L, text, FONT, w, lh), lines = L.layIntoShape([{ prepared: L.prepare(text, FONT), lineHeight: lh }], rect(0, 0, w, 5000), { top: 0, bottom: 5000 }).lines;
    assert.equal(predicted, lines.length * lh, `"${text}" at ${w}`);
  }
});

test('pack: no overlaps, inside the width, order stable, and every block in the shortest column', () => {
  const r = rng(41);
  for (let k = 0; k < 60; k++) {
    const columns = int(r, 1, 6), gap = int(r, 0, 16), width = int(r, 200, 900), blocks = Array.from({ length: int(r, 0, 30) }, (_, i) => ({ id: `b${i}`, height: int(r, 1, 6) * 20 }));
    const got = pack(blocks, { columns, gap, width }), why = `case ${k}: ${columns} cols, gap ${gap}, ${blocks.length} blocks`;
    assert.deepEqual(got.items.map(i => i.id), blocks.map(b => b.id), `${why}: order`);
    const cw = (width - gap * (columns - 1)) / columns, tops = new Array(columns).fill(0);
    got.items.forEach((it, i) => { // replay: the independent account of "greedy, shortest, leftmost"
      const want = tops.indexOf(Math.min(...tops.map(t => t))); // indexOf gives the leftmost minimum
      assert.equal(it.column, want, `${why}: block ${i} went to column ${it.column}, the shortest is ${want} (tops ${tops})`);
      assert.ok(Math.abs(it.y - tops[want]) < 1e-9 && Math.abs(it.x - want * (cw + gap)) < 1e-9 && Math.abs(it.w - cw) < 1e-9 && it.h === blocks[i].height, why);
      tops[want] += it.h + gap;
      assert.ok(it.x >= -1e-9 && it.x + it.w <= width + 1e-9, `${why}: leaves the width`);
    });
    got.items.forEach((a, i) => got.items.slice(i + 1).forEach(b => assert.ok(!hits(a, b), `${why}: ${a.id} overlaps ${b.id}`)));
    const bottom = Math.max(0, ...got.items.map(i => i.y + i.h));
    assert.ok(Math.abs(got.height - bottom) < 1e-9, `${why}: height ${got.height}, lowest edge ${bottom}`);
  }
});

test('pack: a hand case, and ties go left', () => {
  const got = pack([{ id: 'a', height: 100 }, { id: 'b', height: 50 }, { id: 'c', height: 50 }, { id: 'd', height: 40 }], { columns: 2, gap: 10, width: 210 });
  assert.deepEqual(got.items.map(i => [i.id, i.column, i.x, i.y]), [['a', 0, 0, 0], ['b', 1, 110, 0], ['c', 1, 110, 60], ['d', 0, 0, 110]]);
  assert.equal(got.height, 150);
  assert.deepEqual(pack([], { columns: 3, gap: 8, width: 300 }), { items: [], height: 0 });
  assert.equal(pack([{ id: 'x', height: 5 }, { id: 'y', height: 5 }], { columns: 3, gap: 0, width: 90 }).items.map(i => i.column).join(), '0,1');
});

// ── place ──────────────────────────────────────────────────────────────────

const scatter = (r, n, bounds) => Array.from({ length: n }, (_, i) => ({
  id: `l${i}`, anchor: { x: bounds.x + int(r, 0, bounds.w), y: bounds.y + int(r, 0, bounds.h) }, w: int(r, 20, 70), h: int(r, 10, 24), priority: int(r, 0, 3),
}));

test('place: no overlaps, no escapes from the bounds, none in an obstacle, and every label accounted for', () => {
  const r = rng(51);
  let dropped = 0, placedAll = 0;
  for (let k = 0; k < 60; k++) {
    const bounds = { x: 10, y: 20, w: int(r, 200, 500), h: int(r, 150, 400) };
    const obstacles = Array.from({ length: int(r, 0, 5) }, () => ({ x: bounds.x + int(r, 0, bounds.w - 40), y: bounds.y + int(r, 0, bounds.h - 40), w: int(r, 10, 60), h: int(r, 10, 60) }));
    const labels = scatter(r, int(r, 1, 40), bounds), got = place(labels, { bounds, obstacles }), why = `case ${k}: ${labels.length} labels`;
    assert.deepEqual([...got.placed.map(p => p.id), ...got.dropped].sort(), labels.map(l => l.id).sort(), `${why}: every label placed or dropped, once`);
    for (const p of got.placed) {
      assert.ok(p.x >= bounds.x - 1e-9 && p.y >= bounds.y - 1e-9 && p.x + p.w <= bounds.x + bounds.w + 1e-9 && p.y + p.h <= bounds.y + bounds.h + 1e-9, `${why}: ${p.id} leaves the bounds`);
      obstacles.forEach((o, i) => assert.ok(!hits(p, o), `${why}: ${p.id} covers obstacle ${i}`));
    }
    got.placed.forEach((a, i) => got.placed.slice(i + 1).forEach(b => assert.ok(!hits(a, b), `${why}: ${a.id} overlaps ${b.id}`)));
    for (const p of got.placed) for (const l of labels) if (l.id !== p.id) assert.ok(!hits(p, { x: l.anchor.x - 3, y: l.anchor.y - 3, w: 6, h: 6 }), `${why}: ${p.id} covers ${l.id}'s anchor`);
    assert.deepEqual(place(labels, { bounds, obstacles }), got, `${why}: not deterministic`);
    dropped += got.dropped.length; placedAll += got.placed.length;
  }
  assert.ok(dropped > 10 && placedAll > 300, `the cases were too easy or too hard: ${placedAll} placed, ${dropped} dropped`);
});

test('place: nearest side first, priority wins a contested spot, nudges and diagonals are used, the too-big are dropped', () => {
  const bounds = { x: 0, y: 0, w: 300, h: 200 };
  const alone = place([{ id: 'a', anchor: { x: 100, y: 100 }, w: 40, h: 16 }], { bounds });
  assert.deepEqual([alone.placed[0].side, alone.placed[0].x, alone.placed[0].y], ['right', 100, 92]);
  const two = place([{ id: 'low', anchor: { x: 100, y: 100 }, w: 40, h: 16 }, { id: 'high', anchor: { x: 100, y: 100 }, w: 40, h: 16, priority: 5 }], { bounds });
  assert.equal(two.placed.find(p => p.id === 'high').side, 'right');
  assert.equal(two.placed.find(p => p.id === 'low').side, 'left');
  assert.deepEqual(two.placed.map(p => p.id), ['low', 'high'], 'placed come back in input order');
  const walled = place([{ id: 'a', anchor: { x: 100, y: 100 }, w: 40, h: 16 }], { bounds, obstacles: [{ x: 100, y: 80, w: 40, h: 40 }, { x: 60, y: 80, w: 40, h: 40 }, { x: 80, y: 60, w: 40, h: 40 }, { x: 80, y: 100, w: 40, h: 40 }] });
  assert.ok(walled.placed.length === 1 && walled.placed[0].side !== 'right', 'a ring of obstacles pushes it out to a nudge');
  assert.deepEqual(place([{ id: 'big', anchor: { x: 50, y: 50 }, w: 400, h: 20 }], { bounds }).dropped, ['big']);
  assert.deepEqual(place([], { bounds }), { placed: [], dropped: [] });
});

// ── distribute ─────────────────────────────────────────────────────────────

const objective = (items, centers) => items.reduce((s, v, i) => s + (centers[i] - v.at) ** 2, 0);
const feasible = (items, c, { start, end, minGap }) => c.every((x, i) => x - items[i].size / 2 >= start - 1e-9 && x + items[i].size / 2 <= end + 1e-9
  && (i === 0 || x - c[i - 1] >= (items[i].size + items[i - 1].size) / 2 + minGap - 1e-9));

test('distribute: order kept, gaps at least minGap, inside the bounds', () => {
  const r = rng(61);
  let moved = 0;
  for (let k = 0; k < 100; k++) {
    const minGap = int(r, 0, 10), start = int(r, 0, 20), n = int(r, 1, 12), items = Array.from({ length: n }, (_, i) => ({ id: i, at: int(r, 0, 600), size: int(r, 10, 60) }));
    const need = items.reduce((s, v) => s + v.size, 0) + minGap * (n - 1), end = start + (r() < 0.8 ? need + int(r, 0, 300) : need - int(r, 1, need / 2));
    const got = distribute(items, { axis: 'x', start, end, minGap }), why = `case ${k}: ${JSON.stringify(items)} in [${start},${end}] gap ${minGap}`;
    assert.equal(got.overflow, need > end - start + 1e-9, why);
    assert.deepEqual(got.items.map(i => i.at), [...items].map(i => i.at).sort((a, b) => a - b), `${why}: order of at`);
    got.items.forEach((it, i) => {
      assert.ok(it.x >= start - 1e-9, `${why}: ${it.id} starts at ${it.x}`);
      if (i) assert.ok(it.x - (got.items[i - 1].x + got.items[i - 1].w) >= minGap - 1e-9, `${why}: gap before ${it.id} is ${it.x - (got.items[i - 1].x + got.items[i - 1].w)}`);
      if (!got.overflow) assert.ok(it.x + it.w <= end + 1e-9, `${why}: ${it.id} ends at ${it.x + it.w}`);
      if (Math.abs(it.shift) > 1e-9) moved++;
    });
  }
  assert.ok(moved > 100, `only ${moved} items moved: the cases were too easy`);
});

test('distribute: nothing moves when it already fits; it is the least-squares answer (no feasible nudge does better)', () => {
  const free = [{ id: 'a', at: 50, size: 20 }, { id: 'b', at: 150, size: 20 }, { id: 'c', at: 300, size: 40 }];
  assert.deepEqual(distribute(free, { start: 0, end: 400, minGap: 8 }).items.map(i => i.shift), [0, 0, 0]);
  const r = rng(71);
  for (let k = 0; k < 60; k++) {
    const opts = { start: 0, end: 400, minGap: int(r, 0, 8) }, items = Array.from({ length: int(r, 2, 6) }, (_, i) => ({ id: i, at: int(r, 0, 400), size: int(r, 10, 50) }));
    const got = distribute(items, opts);
    if (got.overflow) continue;
    const c = got.items.map(i => i.center), sorted = got.items.map(i => ({ ...i, size: i.w })), best = objective(sorted, c);
    assert.ok(feasible(sorted, c, opts), `case ${k}: result infeasible`);
    for (let t = 0; t < 400; t++) {
      const d = c.map(() => (r() - 0.5) * 6);
      if (t % 2) { const lo = int(r, 0, c.length - 1), hi = int(r, lo, c.length - 1), s = (r() - 0.5) * 6; d.fill(0); for (let i = lo; i <= hi; i++) d[i] = s; } // slide a whole run
      const next = c.map((x, i) => x + d[i]);
      if (feasible(sorted, next, opts)) assert.ok(objective(sorted, next) >= best - 1e-7, `case ${k}: nudging ${d.map(x => x.toFixed(2))} improves ${best} to ${objective(sorted, next)}`);
    }
  }
});

test('distribute: overflow is reported and the order and gaps survive; y axis names its keys; empty is fine', () => {
  const items = [{ id: 'a', at: 10, size: 50 }, { id: 'b', at: 20, size: 50 }, { id: 'c', at: 30, size: 50 }];
  const got = distribute(items, { axis: 'y', start: 0, end: 120, minGap: 5 });
  assert.equal(got.overflow, true);
  assert.deepEqual(got.items.map(i => [i.y, i.h]), [[0, 50], [55, 50], [110, 50]]);
  assert.deepEqual(distribute([], { start: 0, end: 10 }), { items: [], overflow: false });
  assert.deepEqual(distribute([{ id: 'x', at: -30, size: 20 }], { start: 0, end: 100 }).items.map(i => i.x), [0]);
  assert.deepEqual(distribute([{ id: 'x', at: 500, size: 20 }], { start: 0, end: 100 }).items.map(i => i.x), [80]);
});

// ── review fixes: Indic conjuncts, the word-end rule, anchors, fit's inputs, the cache ──

const VIRAMA = { Devanagari: '्', Bengali: '্', Gurmukhi: '੍', Gujarati: '્', Oriya: '୍', Tamil: '்', Telugu: '్', Kannada: '್', Malayalam: '്' };
const SCRIPT_WORDS = {
  Devanagari: 'संविधानक्षत्रियज्ञानश्रीमान', Bengali: 'বিজ্ঞানসংস্কৃতিক্ষত্রিয়শ্রী', Gurmukhi: 'ਸ੍ਵਾਮੀਪ੍ਰਸ਼ਾਦਸ੍ਵਰਗ',
  Gujarati: 'સંસ્કૃતિક્ષત્રિયજ્ઞાનશ્રી', Oriya: 'ସଂସ୍କୃତିକ୍ଷତ୍ରିୟଜ୍ଞାନଶ୍ରୀ', Tamil: 'ஸ்ரீகிருஷ்ணன்தமிழ்நாடுஸ்வாமி',
  Telugu: 'సంస్కృతక్షత్రియప్రక్రియస్వామి', Kannada: 'ಅಕ್ಷರಕ್ಷತ್ರಿಯಕ್ಷೇತ್ರಪ್ರಕ್ಷೇಪಣಸಂಸ್ಕೃತ', Malayalam: 'സംസ്കൃതക്ഷത്രിയസ്വാമിപ്രക്രിയ', // this Node's ICU already joins Malayalam conjuncts, so this row cannot fail here (it guards an ICU that does not)
};
// the independent account of a bad cut: not after a virama (or virama + ZWJ), not before a combining mark or a joiner
const badCut = (src, off) => {
  const before = src.slice(0, off).replace(/‍$/, '');
  return (before.length > 0 && Object.values(VIRAMA).includes(before.slice(-1))) || /^[\p{M}‌‍]/u.test(src.slice(off));
};
const cpLayout = createLayout({ ...createFakeOracle(), prepare: (t, f) => ({ gs: Array.from(t), unit: parseFloat(/([\d.]+)px/.exec(f)[1]) * 0.5 }) });
const wordLine = (text, room) => [{ block: 0, text, x: 0, y: 0, w: 400, h: 24, room }, { block: 0, text: 'more', x: 0, y: 24, w: 40, h: 24, room }];

test('clampLines: no cut leaves a virama behind, in any of the nine Indic scripts, under either measure', () => {
  let cuts = 0;
  for (const [script, word] of Object.entries(SCRIPT_WORDS)) {
    assert.ok(word.includes(VIRAMA[script]), `the ${script} word has no virama to test`);
    for (const layout of [L, cpLayout]) {
      for (let room = 20; room <= 300; room += 3) {
        const got = clampLines(layout, wordLine(word, room), 1, { font: FONT });
        const prefix = got.lines[0].text.slice(0, -1);
        cuts++;
        assert.ok(word.startsWith(prefix) && !badCut(word, prefix.length), `${script} room ${room}: "${prefix}|${word.slice(prefix.length)}" is cut inside a conjunct`);
      }
    }
  }
  assert.ok(cuts > 1500);
});

test('clampLines: Kannada conjuncts stay whole, and a ZWNJ is a legal break', () => {
  const word = 'ಜೂನ್‌ನಿಂದಸೆಪ್ಟೆಂಬರ್ವರೆಗೆ'; // "from June", with the deliberate ZWNJ after the virama
  let atZwnj = 0;
  for (const layout of [L, cpLayout]) {
    for (let room = 20; room <= 300; room += 2) {
      const prefix = clampLines(layout, wordLine(word, room), 1, { font: FONT }).lines[0].text.slice(0, -1);
      assert.ok(!badCut(word, prefix.length), `room ${room}: "${prefix}|${word.slice(prefix.length)}"`);
      if (prefix.endsWith('‌')) atZwnj++;
    }
  }
  assert.ok(atZwnj > 0, 'no cut ever landed after the ZWNJ, though it is a legal break');
});

test('clampLines: the word-end rule, exactly (a word end holding at least half the cut is taken)', () => {
  // 20 px, ten per grapheme. Room 150 fits 14 graphemes and the ellipsis: "alpha beta gam", but the word end "alpha beta" holds 10 of 14
  assert.equal(clampLines(L, wordLine('alpha beta gamma delta', 150), 1, { font: FONT }).lines[0].text, 'alpha beta…');
  // room 120 fits "a bcdefghij" (11); the only word end holds 1 of 11, under half, so it cuts mid-word
  assert.equal(clampLines(L, wordLine('a bcdefghijklmnopqrstuv', 120), 1, { font: FONT }).lines[0].text, 'a bcdefghij…');
  // and over random text: exactly the rule, against a linear scan
  const r = rng(81);
  let wordEnds = 0, midWord = 0;
  for (let k = 0; k < 200; k++) {
    const text = sentence(r, int(r, 6, 30)), w = int(r, 90, 330), n = int(r, 1, 3), lines = laid(text, w);
    if (lines.length <= n) continue;
    const src = lines[n - 1].text.trimEnd(), gs = segments(src), room = lines[n - 1].room, head = j => gs.slice(0, j).join('').trimEnd();
    let K = gs.length; while (K > 0 && measure(head(K) + '…') > room + 1e-9) K--;
    let want = head(K);
    for (let j = K; K < gs.length && j >= Math.ceil(K * 0.5) && j > 0; j--) { // a line that fits whole is not shortened
      if (j < gs.length && /^\s/.test(gs[j]) && head(j) && measure(head(j) + '…') <= room + 1e-9) { want = head(j); break; }
    }
    want === head(K) ? midWord++ : wordEnds++;
    const got = clampLines(L, lines, n, { font: FONT }).lines.at(-1).text;
    assert.equal(got, want + '…', `case ${k}: "${src}" in ${room}`);
  }
  assert.ok(wordEnds > 20 && midWord > 20, `${wordEnds} word ends, ${midWord} plain cuts: the cases do not exercise both`);
});

test('clampLines: measuring prefixes never evicts the scene text from the layout cache', () => {
  let prepares = 0;
  const layout = createLayout({ ...oracle, prepare: (t, f) => (prepares++, oracle.prepare(t, f)) });
  layout.prepare('the scene words', FONT);
  for (let k = 0; k < 80; k++) clampLines(layout, wordLine(sentence(rng(100 + k), 12), 120), 1, { font: FONT });
  const before = prepares;
  layout.prepare('the scene words', FONT);
  assert.equal(prepares, before, 'the scene text had to be prepared again');
  assert.ok(before > 300, `only ${before} probes: not enough to flood a 256-entry cache`);
});

test('fit throws a clear error when minPx or maxPx is missing', () => {
  const shape = rect(0, 0, 100, 100), base = { family: 'Kalam', top: 0, bottom: 100 };
  assert.throws(() => fit(L, 'x', shape, { ...base, maxPx: 20 }), /minPx and maxPx/);
  assert.throws(() => fit(L, 'x', shape, { ...base, minPx: 8 }), TypeError);
  assert.throws(() => fit(L, 'x', shape, { ...base, minPx: 8, maxPx: NaN }), TypeError);
  assert.throws(() => fit(L, 'x', shape), TypeError);
});

test('place keeps off every other label\'s anchor', () => {
  const bounds = { x: 0, y: 0, w: 300, h: 200 };
  const labels = [{ id: 'a', anchor: { x: 100, y: 100 }, w: 40, h: 16, priority: 1 }, { id: 'b', anchor: { x: 110, y: 100 }, w: 40, h: 16 }];
  const got = place(labels, { bounds });
  assert.notEqual(got.placed.find(p => p.id === 'a').side, 'right', 'a sits on b\'s anchor');
  for (const p of got.placed) for (const l of labels) if (l.id !== p.id) assert.ok(!hits(p, { x: l.anchor.x - 3, y: l.anchor.y - 3, w: 6, h: 6 }), `${p.id} covers ${l.id}'s anchor`);
});

test('clampLines: a word that ends in a virama is a word end (a virama joins only a letter, not a space)', () => {
  // "ಜೂನ್" (June) ends in a virama. Room 50 holds four clusters and the ellipsis; the word end after "ಜೂನ್" holds 2 of the 4, so the cut goes there
  const got = clampLines(L, wordLine('ಜೂನ್ ನಿಂದಸೆಪ್ಟೆಂಬರ್', 50), 1, { font: FONT }).lines[0].text;
  assert.equal(got, 'ಜೂನ್…');
});

test('clampLines: a virama followed by a ZWJ still joins the letter after it', () => {
  const word = 'ಕ್‍ಷಅಕ್‍ಷರಕ್‍ಷೇತ್ರಪ್ರಕ್‍ಷೇಪಣ';
  assert.ok(word.includes('್‍'));
  let cuts = 0;
  for (const layout of [L, cpLayout]) {
    for (let room = 20; room <= 260; room += 2) {
      const prefix = clampLines(layout, wordLine(word, room), 1, { font: FONT }).lines[0].text.slice(0, -1);
      cuts++;
      assert.ok(!badCut(word, prefix.length), `room ${room}: "${prefix}|${word.slice(prefix.length)}" is cut after a virama and ZWJ`);
    }
  }
  assert.ok(cuts > 200);
});
