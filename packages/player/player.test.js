import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, scrubberFraction, timeFromFraction, keyCommand, seekStep, activeCue, cuesToPlain } from './player.core.js';
import { activeAnnotations, normalizeAnnotation, normalizeAnnotations, parseAnnotationTrack } from './annotations.core.js';
import { oklchToLinearSrgb, oklchToRgb, oklchToHex, luma, halftoneCell, halftoneRadius, duotoneMix, risoOffsets, isTreatment } from './treatments.core.js';
import { parseVttTime } from '../narration/vtt.js';

// ── player.core ──

test('formatTime: minutes and seconds, hours only past an hour', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(7), '0:07');
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(3600), '1:00:00');
  assert.equal(formatTime(3725), '1:02:05');
  assert.equal(formatTime(NaN), '0:00');
  assert.equal(formatTime(-3), '0:00');
});

test('scrubberFraction and timeFromFraction round-trip and clamp', () => {
  assert.equal(scrubberFraction(30, 120), 0.25);
  assert.equal(scrubberFraction(200, 120), 1, 'clamped past the end');
  assert.equal(scrubberFraction(-5, 120), 0, 'clamped before the start');
  assert.equal(scrubberFraction(10, 0), 0, 'no duration yet');
  assert.equal(scrubberFraction(10, NaN), 0);
  assert.equal(timeFromFraction(0.5, 120), 60);
  assert.equal(timeFromFraction(2, 120), 120, 'clamped past the end');
  assert.equal(timeFromFraction(-1, 120), 0);
});

test('keyCommand: the keys the player answers to, and only those', () => {
  assert.equal(keyCommand(' '), 'toggle-play');
  assert.equal(keyCommand('k'), 'toggle-play');
  assert.equal(keyCommand('ArrowLeft'), 'seek-back');
  assert.equal(keyCommand('ArrowRight'), 'seek-fwd');
  assert.equal(keyCommand('Home'), 'seek-start');
  assert.equal(keyCommand('End'), 'seek-end');
  assert.equal(keyCommand('m'), 'toggle-mute');
  assert.equal(keyCommand('C'), 'toggle-captions');
  assert.equal(keyCommand('a'), null);
});

test('seekStep: shift widens the jump', () => {
  assert.equal(seekStep(false), 5);
  assert.equal(seekStep(true), 15);
});

test('activeCue: the cue holding time, none between or past the last', () => {
  const cues = [{ start: 0, end: 2, text: 'a' }, { start: 2, end: 5, text: 'b' }];
  assert.equal(activeCue(cues, 1).text, 'a');
  assert.equal(activeCue(cues, 2).text, 'b', 'end is exclusive, start is inclusive');
  assert.equal(activeCue(cues, 5), null, 'past the last cue');
  assert.equal(activeCue([], 1), null);
  assert.equal(activeCue(null, 1), null);
});

test('cuesToPlain: a TextTrackCueList-shaped object to plain records', () => {
  const list = { length: 2, 0: { startTime: 0, endTime: 1, text: 'x' }, 1: { startTime: 1, endTime: 2, text: 'y' } };
  assert.deepEqual(cuesToPlain(list), [{ start: 0, end: 1, text: 'x' }, { start: 1, end: 2, text: 'y' }]);
  assert.deepEqual(cuesToPlain(null), []);
});

// ── annotations.core ──

test('normalizeAnnotation: circle and arrow, clamped and defaulted', () => {
  const circle = normalizeAnnotation({ type: 'circle', start: 1, end: 3, x: 0.5, y: 0.5, r: 2 });
  assert.equal(circle.r, 0.5, 'radius clamped to at most half the frame');
  const arrow = normalizeAnnotation({ type: 'arrow', start: 1, end: 3, x: 0, y: 0, x2: 1, y2: 1 });
  assert.deepEqual([arrow.x, arrow.y, arrow.x2, arrow.y2], [0, 0, 1, 1]);
  assert.throws(() => normalizeAnnotation({ type: 'square', start: 0, end: 1 }), /type must be/);
  assert.throws(() => normalizeAnnotation({ type: 'circle', start: 2, end: 1 }), /end > start/);
});

test('normalizeAnnotations: sorted by start', () => {
  const list = normalizeAnnotations([
    { type: 'circle', start: 5, end: 6, x: 0.1, y: 0.1 },
    { type: 'circle', start: 1, end: 2, x: 0.2, y: 0.2 },
  ]);
  assert.deepEqual(list.map(a => a.start), [1, 5]);
});

test('activeAnnotations: fades in and out, nothing showing outside its window', () => {
  const list = [{ type: 'circle', start: 1, end: 3, x: 0.5, y: 0.5, r: 0.1 }];
  assert.equal(activeAnnotations(list, 0.5).length, 0, 'before it starts');
  assert.equal(activeAnnotations(list, 3.5).length, 0, 'after it ends');
  const start = activeAnnotations(list, 1)[0];
  assert.ok(start.opacity < 0.1, 'just starting: nearly invisible');
  const mid = activeAnnotations(list, 2)[0];
  assert.equal(mid.opacity, 1, 'fully faded in by the middle');
  const end = activeAnnotations(list, 2.99)[0];
  assert.ok(end.opacity < 0.2, 'about to end: fading out');
});

test('parseAnnotationTrack: WebVTT metadata cues, one JSON object each', () => {
  const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.500\n{"type":"circle","x":0.5,"y":0.4,"r":0.1}\n\n' +
    '00:00:04.000 --> 00:00:06.000\n{"type":"arrow","x":0.1,"y":0.1,"x2":0.9,"y2":0.9}\n';
  const list = parseAnnotationTrack(vtt, parseVttTime);
  assert.equal(list.length, 2);
  assert.equal(list[0].type, 'circle');
  assert.equal(list[0].start, 1);
  assert.equal(list[1].type, 'arrow');
  assert.equal(list[1].end, 6);
});

// ── treatments.core ──

test('oklchToRgb: black and white round-trip through the gamma curve', () => {
  assert.deepEqual(oklchToRgb(0, 0, 0), [0, 0, 0]);
  assert.deepEqual(oklchToRgb(1, 0, 0), [255, 255, 255]);
});

test('oklchToHex: a plausible ink colour comes out as a real hex triplet', () => {
  const hex = oklchToHex(0.3, 0.08, 260);
  assert.match(hex, /^#[0-9a-f]{6}$/);
});

test('oklchToLinearSrgb: grey has equal channels', () => {
  const [r, g, b] = oklchToLinearSrgb(0.5, 0, 0);
  assert.ok(Math.abs(r - g) < 1e-9 && Math.abs(g - b) < 1e-9);
});

test('luma: white is brighter than black, pure red is dimmer than pure green', () => {
  assert.ok(luma(1, 1, 1) > luma(0, 0, 0));
  assert.ok(luma(0, 1, 0) > luma(1, 0, 0));
});

test('halftoneCell: a pixel is within half a cell of its own centre', () => {
  const cell = 10;
  for (const [x, y] of [[0, 0], [23, 41], [-7, 100], [512.3, -88.1]]) {
    const c = halftoneCell(x, y, cell, Math.PI / 6);
    assert.ok(c.dist <= (cell * Math.SQRT2) / 2 + 1e-6, `dist ${c.dist} for (${x},${y})`);
  }
});

test('halftoneCell: two points in the same cell share a centre', () => {
  const a = halftoneCell(100, 100, 12, 0.3);
  const b = halftoneCell(100.5, 100.5, 12, 0.3);
  assert.ok(Math.abs(a.cx - b.cx) < 1e-9 && Math.abs(a.cy - b.cy) < 1e-9);
});

test('halftoneRadius: fully covered is the biggest dot, empty is none', () => {
  assert.ok(halftoneRadius(0, 10) > halftoneRadius(0.5, 10));
  assert.equal(halftoneRadius(1, 10), 0);
  assert.ok(halftoneRadius(0, 10) <= 5);
});

test('duotoneMix: interpolates between the two colours and clamps at the ends', () => {
  const a = [10, 20, 30], b = [200, 100, 50];
  assert.deepEqual(duotoneMix(0, a, b), a);
  assert.deepEqual(duotoneMix(1, a, b), b);
  assert.deepEqual(duotoneMix(-1, a, b), a, 'clamped below 0');
  assert.deepEqual(duotoneMix(2, a, b), b, 'clamped above 1');
});

test('risoOffsets: deterministic for a seed, and the three plates differ', () => {
  const a = risoOffsets(3), b = risoOffsets(3);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.cyan, a.magenta);
});

test('isTreatment: the four named looks, nothing else', () => {
  for (const t of ['ink', 'halftone', 'duotone', 'riso']) assert.ok(isTreatment(t));
  assert.equal(isTreatment('sepia'), false);
});
