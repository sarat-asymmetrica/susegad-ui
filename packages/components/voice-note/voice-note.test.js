import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parsePeaks, barsFrom, standInPeaks, barCount, transcriptHtml, cuesFrom, activeCue, timeText, press } from './voice-note.core.js';
import { peaksFromPcm, peaksFromWav } from './peaks.mjs';
import { writeSilentWav } from '../../narration/wav.js';
import { palettes, resolveRoles, contrast, toRgb } from '../../tokens/tokens.js';

const spread = p => fileURLToPath(new URL(`../../recipes/storybook-spread/${p}`, import.meta.url));

test('parsePeaks reads spaces or commas, scales above 1, and refuses what it cannot use', () => {
  assert.deepEqual(parsePeaks('0.1 0.5, 1 0.25'), [0.1, 0.5, 1, 0.25]);
  assert.deepEqual(parsePeaks('2 4 8 4'), [0.25, 0.5, 1, 0.5]);
  for (const bad of [null, '', '  ', '0.1 0.2', '0.1 x 0.3 0.4', '0 0 0 0']) assert.equal(parsePeaks(bad), null, String(bad));
});

test('barsFrom keeps the loudest peak in each slice and floors silence', () => {
  assert.deepEqual(barsFrom([0, 0, 1, 0, 0, 0, 0.5, 0], 4), [0.08, 1, 0.08, 0.5]);
  assert.equal(barsFrom([0.3, 0.6], 10).length, 10);
});

test('the stand-in is deterministic for a seed, differs between seeds, and stays in 0..1', () => {
  const a = standInPeaks('note.m4a'), b = standInPeaks('note.m4a'), c = standInPeaks('other.m4a');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(a.every(v => v >= 0.05 && v <= 1));
  assert.ok(new Set(a).size > 20, 'it varies like speech, not a flat bar');
});

test('barCount fits the width and never drops below 8', () => {
  assert.equal(barCount(400, 4), 100);
  assert.equal(barCount(10, 4), 8);
});

test('peaks from PCM are loudness per slice, the loudest scaled to 1', () => {
  const pcm = new Float32Array(400);
  for (let i = 100; i < 200; i++) pcm[i] = i % 2 ? 0.5 : -0.5;
  for (let i = 300; i < 400; i++) pcm[i] = i % 2 ? 0.25 : -0.25;
  assert.deepEqual(peaksFromPcm(pcm, 4), [0, 1, 0, 0.5]);
});

test('peaks from a WAV: silence is flat, the storybook narration is not', () => {
  assert.ok(peaksFromWav(writeSilentWav({ durationSec: 1 }), 16).every(v => v === 0));
  const real = peaksFromWav(readFileSync(spread('spread.en.wav')), 96);
  assert.equal(real.length, 96);
  assert.equal(Math.max(...real), 1);
  assert.ok(Math.min(...real) < 0.2, 'the pauses between phrases show');
});

test('the transcript comes from the timing track, one span per cue, tags dropped', () => {
  const html = transcriptHtml(readFileSync(spread('spread.en.vtt'), 'utf8'));
  const spans = [...html.matchAll(/data-start="([\d.]+)" data-end="([\d.]+)">([^<]*)</g)];
  assert.ok(spans.length > 10);
  assert.equal(spans[0][3], 'The sky turned the colour of an old kadai all at once');
  assert.ok(!html.includes('&lt;00:'), 'no timestamp tags in the words');
  const cues = cuesFrom(spans.map(m => ({ start: m[1], end: m[2] })));
  assert.equal(activeCue(cues, 5)?.text, '1');
  assert.equal(activeCue(cues, 4.6), null, 'between phrases, nothing is marked');
});

test('the seek control says where it is in words', () => {
  assert.equal(timeText(12.4, 42), '0:12 of 0:42');
  assert.equal(timeText(0, NaN), '0:00 of 0:00');
});

test('the press springs only at full motion, transform only', () => {
  for (const m of ['still', 'state', 'ambient']) assert.equal(press(m), null);
  for (const f of press('full').frames) assert.deepEqual(Object.keys(f).filter(k => !['transform', 'offset'].includes(k)), []);
});

for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  test(`AA: ${name} ${theme}: the playful pill's time and bars read on the highlighter`, () => {
    const r = resolveRoles(name, theme), hex = k => toRgb(r[k].hex);
    assert.ok(contrast(hex('text'), hex('selection')) >= 4.5, 'time');
    for (const bar of ['text-soft', 'accent-text']) assert.ok(contrast(hex(bar), hex('selection')) >= 3, `${bar} bars: ${contrast(hex(bar), hex('selection')).toFixed(2)}`);
    assert.ok(contrast(hex('on-accent'), hex('accent')) >= 3, 'play icon');
  });
}
