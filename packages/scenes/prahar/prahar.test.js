import test from 'node:test';
import assert from 'node:assert/strict';
import prahar from './index.js';
import {
  model, skyAt, watchAt, hourAt, WATCHES, KEYS, LOOKS, STILL_HOUR, STILL_TIME, rulerX, hourAtX, fmt, say, wrapHour, labToRgb, lchToLab, RULER, offsetOf,
} from './model.js';
import { meta } from './meta.js';
import { paramsFromAttributes, defaultParams } from '../../core/define-scene.js';

const P = (o = {}) => ({ ...defaultParams(prahar.params), ...o });
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

test('eight watches of three hours cover the whole day, each hour in exactly one', () => {
  assert.equal(WATCHES.length, 8);
  for (let h = 0; h < 24; h += 0.25) {
    const hits = WATCHES.filter(w => wrapHour(h - w.from) < 3);
    assert.equal(hits.length, 1, `hour ${h}`);
    assert.equal(watchAt(h), hits[0]);
  }
  assert.equal(watchAt(19.2).raga, 'Yaman');
  assert.equal(watchAt(0.5).raga, 'Malkauns');
  assert.equal(watchAt(4).raga, 'Lalit');
  assert.equal(watchAt(6.5).raga, 'Bhairav');
});

test('every raga has its Devanagari name', () => {
  for (const w of WATCHES) assert.match(w.deva, /^[ऀ-ॿ\s]+$/, w.raga);
});

test('the sky: noon is bright and blue, midnight dark, dawn warm', () => {
  const noon = skyAt(13), night = skyAt(23), dawn = skyAt(6.2);
  assert.ok(lum(noon.zenith) > lum(night.zenith) + 60);
  assert.ok(noon.zenith[2] > noon.zenith[0], 'noon zenith is blue');
  assert.ok(dawn.warm > 0.8 && noon.warm < 0.1);
  assert.ok(dawn.horizon[0] > dawn.horizon[2], 'dawn horizon is warm, not blue');
});

test('OKLab blending keeps dawn out of the grey: the horizon stays saturated between keyframes', () => {
  // halfway from the rose 5.3 key to the apricot 6.2 key, plain RGB would pass near grey
  const mid = skyAt(5.75).horizon, spread = Math.max(...mid) - Math.min(...mid);
  assert.ok(spread > 40, `chroma kept: ${mid}`);
  assert.deepEqual(labToRgb(lchToLab([1, 0, 0])), [255, 255, 255]);
  assert.deepEqual(labToRgb(lchToLab([0, 0, 0])), [0, 0, 0]);
});

test('keyframes run from 0 to 24 in order', () => {
  for (let i = 1; i < KEYS.length; i++) assert.ok(KEYS[i].h > KEYS[i - 1].h);
  assert.equal(KEYS[0].h, 0); assert.equal(KEYS.at(-1).h, 24);
});

test('every register’s still is the plate’s evening, and seed 1 starts the playful day at 04:36', () => {
  for (const r of ['quiet', 'warm', 'playful']) assert.ok(Math.abs(hourAt(STILL_TIME, r) - STILL_HOUR) < 1e-9, r);
  assert.ok(Math.abs(hourAt(0, 'playful') - 4.6) < 1e-9);
  assert.equal(offsetOf(1), 0);
});

test('warm turns the day at half the playful pace', () => {
  const dw = wrapHour(hourAt(10, 'warm') - hourAt(0, 'warm')), dp = wrapHour(hourAt(10, 'playful') - hourAt(0, 'playful'));
  assert.ok(Math.abs(dp - 2 * dw) < 1e-9);
  assert.equal(LOOKS.quiet.scrub, false); assert.equal(LOOKS.warm.scrub, false); assert.equal(LOOKS.playful.scrub, true);
});

test('with hour set, time stands still and the scene settles', () => {
  const a = model({ time: 0, register: 'warm', params: P({ hour: 19.2 }) });
  const b = model({ time: 500, register: 'warm', params: P({ hour: 19.2 }) });
  assert.equal(a.hour, 19.2); assert.equal(b.hour, 19.2);
  assert.ok(a.settled && b.settled);
  assert.ok(!model({ time: 3, register: 'warm', params: P() }).settled);
  assert.equal(paramsFromAttributes(prahar.params, n => (n === 'hour' ? '30' : null)).hour, 24, 'clamped');
});

test('the ruler: 06:00 at the left end, and x back to the hour', () => {
  assert.equal(rulerX(6), RULER.x0);
  for (let h = 0; h < 24; h += 0.5) assert.ok(Math.abs(wrapHour(hourAtX(rulerX(h)) - h + 12) - 12) < 1e-9, `hour ${h}`);
});

test('the words: 19:10 to the ten minutes, and the status sentence', () => {
  assert.equal(fmt(19.2), '19:10');
  assert.equal(fmt(0.05), '00:00');
  assert.equal(say(19.2), 'Evening, Yaman, 19:10');
  assert.equal(say(4.5), 'Before dawn, Lalit, 04:30');
  assert.equal(prahar.status(P({ hour: 19.2 })), 'Evening, Yaman, 19:10');
  assert.equal(prahar.status(P()), '');
});

test('meta keeps the lineage note and says the mapping is one reckoning', () => {
  assert.match(meta.after.who, /Kesarbai Kerkar/);
  assert.match(meta.caption, /one common reckoning; traditions differ/);
  for (const k of ['title', 'gloss', 'caption', 'alt', 'keys', 'credit']) assert.ok(!meta[k].includes('—'), k);
});
