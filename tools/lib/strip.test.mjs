import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shortFlags, evenTimes, columnsFor, layoutStrip, layoutOnion, headerLines, cellLabel, pct, frameOf,
  meanLuminance, analyseFrames, medianFrame, onionAlphas, onionBlend, onionDiff, motionFacts, factsText, FACT_DEFAULTS,
} from './strip.mjs';

const frame = (w, h, rgb = [255, 255, 255]) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) d.set([...rgb, 255], i);
  return { data: d };
};
const dot = (f, w, x, y, rgb = [0, 0, 0]) => f.data.set([...rgb, 255], (y * w + x) * 4);

test('-n is an alias for --n and only that', () => {
  assert.deepEqual(shortFlags(['tinto', '-n', '12', '--from', '1']), ['tinto', '--n', '12', '--from', '1']);
  assert.deepEqual(shortFlags(['-n=6']), ['--n=6']);
  assert.deepEqual(shortFlags(['--name', 'x']), ['--name', 'x']);
});

test('even times include both ends and land on distinct clock frames', () => {
  assert.deepEqual(evenTimes(0, 10, 3), [0, 5, 10]);
  assert.deepEqual(evenTimes(2, 9, 1), [2]);
  const t = evenTimes(0, 8, 12);
  assert.equal(t.length, 12);
  assert.equal(t[0], 0);
  assert.ok(Math.abs(t[11] - 8) < 1e-9);
  assert.equal(new Set(t.map(frameOf)).size, 12);
});

test('even times refuse a span that would repeat a frame, and bad numbers', () => {
  assert.throws(() => evenTimes(0, 0.05, 12), /closer than one clock frame/);
  assert.throws(() => evenTimes(4, 4, 2), /must be after/);
  assert.throws(() => evenTimes(0, 5, 0), /whole number/);
  assert.throws(() => evenTimes(0, 5, 2.5), /whole number/);
  assert.throws(() => evenTimes(-1, 5, 3), /from 0 up/);
});

test('columns: a row for a few, a grid for more, never more than n', () => {
  assert.equal(columnsFor(3), 3);
  assert.equal(columnsFor(6), 3);
  assert.equal(columnsFor(12), 4);
  assert.equal(columnsFor(20), 6);
  assert.equal(columnsFor(2, 9), 2);
  assert.equal(columnsFor(12, 5), 5);
});

test('the strip layout tiles cells without overlap and fits every one inside the sheet', () => {
  const L = layoutStrip({ n: 12, frameW: 1100, frameH: 733, cellW: 320 });
  assert.equal(L.cols, 4);
  assert.equal(L.rows, 3);
  assert.equal(L.cell.w, 320);
  assert.equal(L.cell.h, Math.round(733 * 320 / 1100));
  assert.equal(L.cells.length, 12);
  for (const c of L.cells) {
    assert.ok(c.image.x >= 0 && c.image.x + c.image.w <= L.width, `cell ${c.i} inside the width`);
    assert.ok(c.image.y + c.image.h <= L.height, `cell ${c.i} inside the height`);
    assert.equal(c.image.y, c.label.y + c.label.h, 'the image sits right under its label');
  }
  // reading order: left to right, then down
  assert.ok(L.cells[1].image.x > L.cells[0].image.x);
  assert.equal(L.cells[4].image.x, L.cells[0].image.x);
  assert.ok(L.cells[4].image.y > L.cells[0].image.y);
  // no two images overlap
  for (const a of L.cells) for (const b of L.cells) {
    if (a.i >= b.i) continue;
    const apart = a.image.x + a.image.w <= b.image.x || b.image.x + b.image.w <= a.image.x || a.image.y + a.image.h <= b.image.y || b.image.y + b.image.h <= a.image.y;
    assert.ok(apart, `cells ${a.i} and ${b.i} do not overlap`);
  }
});

test('the onion layout puts the image under its header', () => {
  const L = layoutOnion({ frameW: 1100, frameH: 733 });
  assert.equal(L.image.w, 1100);
  assert.equal(L.image.y + L.image.h + 16, L.height);
  assert.equal(L.width, 1100 + 32);
});

test('the header names the target, register, theme, seed and the clock', () => {
  const l = headerLines({ scene: 'tinto', register: 'warm', theme: 'dark', seed: 3, params: { movable: '' }, clock: 'frozen', from: 0, to: 8, n: 12, size: { w: 1100, h: 733 } });
  assert.equal(l[0], 'tinto · warm · dark · seed 3 · movable=');
  assert.match(l[1], /^0\.00 to 8\.00 s · 12 frames · 1100 x 733 px each · frozen clock/);
  const real = headerLines({ url: '/a.html', clock: 'real', from: 1, to: 2, n: 1 });
  assert.equal(real[0], '/a.html · warm · light · seed default');
  assert.match(real[1], /1 frame · real clock \(times measured, not repeatable\)$/);
  const onion = headerLines({ scene: 'x', clock: 'frozen', from: 0, to: 4, n: 3, kind: 'onion', times: [0, 2, 4], diff: true });
  assert.equal(onion.length, 3);
  assert.match(onion[2], /only what changed .* 0\.00, 2\.00, 4\.00 s/);
});

test('cell labels give the time and the change, and a change is never rounded to nothing', () => {
  assert.equal(cellLabel({ t: 0, changed: null }), '0.00 s · first frame');
  assert.equal(cellLabel({ t: 3.6363, changed: 0.0241 }), '3.64 s · 2.41% changed');
  assert.equal(pct(0), '0%');
  assert.equal(pct(0.0001), '<0.05%');
  assert.equal(pct(0.5), '50.0%');
  assert.equal(pct(null), 'n/a');
});

test('mean luminance runs from black to white', () => {
  assert.equal(meanLuminance(frame(2, 2, [0, 0, 0]).data), 0);
  assert.ok(Math.abs(meanLuminance(frame(2, 2, [255, 255, 255]).data) - 1) < 1e-9);
  const half = frame(2, 1, [255, 255, 255]);
  half.data.set([0, 0, 0, 255], 0);
  assert.ok(Math.abs(meanLuminance(half.data) - 0.5) < 1e-9);
});

test('analysis: the first cell has no step; a moved dot is counted and boxed; equal frames change nothing', () => {
  const w = 10, h = 10;
  const a = frame(w, h), b = frame(w, h), c = frame(w, h);
  dot(a, w, 2, 2); dot(b, w, 6, 7); dot(c, w, 6, 7);
  const r = analyseFrames([a, b, c], w, h);
  assert.equal(r[0].changed, null);
  assert.equal(r[1].changedPixels, 2);
  assert.equal(r[1].changed, 0.02);
  assert.deepEqual(r[1].bbox, { x: 2, y: 2, w: 5, h: 6 });
  assert.equal(r[2].changed, 0);
  assert.equal(r[2].bbox, null);
  assert.ok(r[0].luminance < 1 && r[0].luminance > 0.97, 'a white frame with one black pixel of 100');
});

test('the median frame drops a thing that visits a place only once', () => {
  const w = 6, h = 1;
  const fs = [0, 1, 2, 3, 4].map(k => { const f = frame(w, h); dot(f, w, k, 0); return f; });
  const m = medianFrame(fs, w, h);
  for (let x = 0; x < w; x++) assert.deepEqual([...m.slice(x * 4, x * 4 + 4)], [255, 255, 255, 255], `pixel ${x} is background`);
  // an even count averages the middle pair
  const two = medianFrame([frame(1, 1, [0, 0, 0]), frame(1, 1, [100, 100, 100])], 1, 1);
  assert.deepEqual([...two], [50, 50, 50, 255]);
});

test('onion alphas rise from faint to solid', () => {
  const a = onionAlphas(5);
  assert.equal(a[0], 0.2);
  assert.equal(a[4], 1);
  for (let i = 1; i < a.length; i++) assert.ok(a[i] > a[i - 1]);
  assert.deepEqual(onionAlphas(1), [1]);
});

test('the onion keeps the still background exact and fades the older positions of a moving dot', () => {
  const w = 12, h = 1, n = 4;
  const fs = Array.from({ length: n }, (_, k) => { const f = frame(w, h); dot(f, w, 1 + k * 3, 0); return f; });
  const bg = medianFrame(fs, w, h);
  const out = onionBlend(fs, bg, w, h, onionAlphas(n));
  const px = x => out[x * 4];
  // background between the dots stays white
  for (const x of [0, 2, 3, 5, 6, 8, 9, 11]) assert.equal(px(x), 255, `pixel ${x} is untouched`);
  // the newest position is solid ink, and each older one is lighter than the next
  assert.equal(px(10), 0);
  assert.ok(px(7) > px(10) && px(4) > px(7) && px(1) > px(4), `older ghosts are fainter: ${[1, 4, 7, 10].map(px)}`);
  assert.ok(px(1) < 255, 'the oldest ghost is still visible');
});

test('the onion diff paints only what changed, older steps fainter, over a faded last frame', () => {
  const w = 8, h = 1;
  const fs = [1, 3, 5].map(x => { const f = frame(w, h); dot(f, w, x, 0); return f; });
  const out = onionDiff(fs, w, h, onionAlphas(3));
  const at = x => [...out.slice(x * 4, x * 4 + 3)];
  // pixel 7 never changed: a faded white, not vermilion
  assert.deepEqual(at(7), [255, 255, 255]);
  // pixel 5 changed only in the newest step (alpha 1): full vermilion. Pixel 1 only in the step before
  // (alpha 0.6), over faded white: 255 * 0.4 + 227 * 0.6, 255 * 0.4 + 66 * 0.6.
  assert.deepEqual(at(5), [227, 66, 52]);
  assert.deepEqual(at(1), [238, 142, 133]);
  assert.ok(at(1)[1] > at(5)[1], 'the older step is fainter');
  assert.equal(out[3], 255);
});

// ── facts ─────────────────────────────────────────────────────────────────

/** Cells at 1 s spacing from a list of step changes (null = the first cell). */
const cellsFrom = (changes, { playing = true, dt = 1 } = {}) => changes.map((c, i) => ({
  t: i * dt, playing: Array.isArray(playing) ? playing[i] : playing, changed: c, bbox: c ? { x: 10, y: 20, w: 30, h: 40 } : null,
}));

test('facts: a smooth motion has no frozen span and no jump', () => {
  const f = motionFacts(cellsFrom([null, 0.02, 0.021, 0.019, 0.02, 0.022, 0.02]));
  assert.deepEqual(f.frozen, []);
  assert.deepEqual(f.jumps, []);
  assert.deepEqual(f.active, { from: 0, to: 6 });
  assert.equal(f.resolution, 1);
  assert.deepEqual(f.union, { x: 10, y: 20, w: 30, h: 40 });
});

test('facts: a stall while playing is a frozen span, with its start and end', () => {
  const f = motionFacts(cellsFrom([null, 0.02, 0, 0, 0, 0.02, 0.02]));
  assert.equal(f.frozen.length, 1);
  assert.deepEqual([f.frozen[0].from, f.frozen[0].to, f.frozen[0].duration, f.frozen[0].steps], [1, 4, 3, 3]);
  assert.deepEqual(f.rests, []);
  assert.deepEqual(f.active, { from: 0, to: 6 });
});

test('facts: the same quiet stretch is a rest, not a fault, when the scene is not playing', () => {
  const still = cellsFrom([null, 0.02, 0, 0, 0, 0.02], { playing: [true, true, false, false, false, true] });
  const f = motionFacts(still);
  assert.deepEqual(f.frozen, []);
  assert.equal(f.rests.length, 1);
  assert.equal(f.rests[0].playing, false);
  // and unknown (a page with no piece) is reported as unknown, never as a freeze
  const unknown = motionFacts(cellsFrom([null, 0.02, 0, 0, 0, 0.02], { playing: null }));
  assert.deepEqual(unknown.frozen, []);
  assert.equal(unknown.rests[0].playing, null);
});

test('facts: a quiet stretch no longer than the stated time is not frozen', () => {
  assert.equal(motionFacts(cellsFrom([null, 0.02, 0, 0.02, 0.02])).frozen.length, 0); // 1 s
  assert.equal(motionFacts(cellsFrom([null, 0.02, 0, 0, 0.02, 0.02])).frozen.length, 1); // 2 s > 1.5 s
  assert.equal(motionFacts(cellsFrom([null, 0.02, 0, 0, 0.02, 0.02]), { still: 3 }).frozen.length, 0);
});

test('facts: one step that changes far more than its neighbours is a jump', () => {
  const f = motionFacts(cellsFrom([null, 0.02, 0.02, 0.9, 0.02, 0.02, 0.02]));
  assert.equal(f.jumps.length, 1);
  assert.deepEqual([f.jumps[0].from, f.jumps[0].to], [2, 3]);
  assert.equal(f.jumps[0].changed, 0.9);
  assert.equal(f.jumps[0].around, 0.02);
});

test('facts: a picture that changes a lot every step has no jump, and a tiny blip is not one', () => {
  assert.deepEqual(motionFacts(cellsFrom([null, 0.6, 0.7, 0.65, 0.7, 0.6])).jumps, []);
  assert.deepEqual(motionFacts(cellsFrom([null, 0, 0, 0.03, 0, 0])).jumps, []); // under jumpMin
  assert.equal(motionFacts(cellsFrom([null, 0, 0, 0.3, 0, 0])).jumps.length, 1); // a pop out of stillness
});

test('facts: nothing changing at all is said plainly', () => {
  const f = motionFacts(cellsFrom([null, 0, 0, 0, 0], { playing: false }));
  assert.equal(f.active, null);
  assert.equal(f.union, null);
  assert.match(factsText(f).join('\n'), /no motion: nothing changed/);
});

test('facts text quotes the spans, the jump, the boxes and the sampling resolution', () => {
  const cells = cellsFrom([null, 0.02, 0, 0, 0, 0.9, 0.02, 0.02]);
  const text = factsText(motionFacts(cells), { w: 1100, h: 733 }).join('\n');
  assert.match(text, /sampled every 1\.00 s at most/);
  assert.match(text, /FROZEN 1\.00 to 4\.00 s: 3\.00 s with no change while playing/);
  assert.match(text, /JUMP 4\.00 to 5\.00 s: 90\.0% changed/);
  assert.match(text, /x 10 to 40, y 20 to 60/);
  assert.match(text, /of 1100 x 733/);
  const clean = factsText(motionFacts(cellsFrom([null, 0.02, 0.02, 0.02, 0.02]))).join('\n');
  assert.match(clean, /frozen spans: none/);
  assert.match(clean, /jumps: none/);
});

test('the defaults are the ones the README states', () => {
  assert.deepEqual(FACT_DEFAULTS, { still: 1.5, eps: 0.0002, jumpMin: 0.05, jumpFactor: 4, jumpFloor: 0.005 });
});
