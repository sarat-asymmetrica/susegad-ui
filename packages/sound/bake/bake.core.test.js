import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { bakeFrames, bakeBuffer, drive, still, follow, segment, bandEdges, CACHE_KIND } from './bake.core.js';

const here = dirname(fileURLToPath(import.meta.url));
const SR = 48000, BINS = 512; // an analyser with fftSize 1024
const binOf = hz => Math.round(hz / (SR / 2 / BINS));
const bandOfHz = (hz, bands = 16) => {
  const e = bandEdges(bands, SR);
  return e.findIndex((edge, i) => hz >= edge && hz < e[i + 1]);
};

/** The middle of a band, in Hz (geometric). */
const centreHz = (b, bands = 16) => { const e = bandEdges(bands, SR); return Math.sqrt(e[b] * e[b + 1]); };

/**
 * Synthetic analyser frames: silence, with one bin, at the middle of `band`, lit to `level`
 * (a byte) in the frames `on` says. One bin, because a bin between two bands counts for both.
 */
function frames(count, band, level, on = () => true) {
  return Array.from({ length: count }, (_, f) => {
    const a = new Uint8Array(BINS);
    if (on(f)) a[binOf(centreHz(band))] = level;
    return a;
  });
}

// ── baking frames you already have ──────────────────────────────────────────

test('a lit frequency lands in the band that holds it, and only that band', () => {
  for (const want of [6, 8, 10, 12, 14]) {
    const c = bakeFrames(frames(3, want, 255));
    for (let b = 0; b < c.bands; b++) {
      const v = c.data[b];
      if (b === want) assert.equal(v, 1, `band ${b}`); else assert.equal(v, 0, `light in band ${want} leaked into band ${b}`);
    }
  }
});

test('the three input units agree: byte, decibels and 0..1 give the same table', () => {
  const byteFrame = Uint8Array.from({ length: BINS }, (_, k) => (k * 13) % 256);
  const unitFrame = Array.from(byteFrame, v => v / 255);
  const dbFrame = Array.from(unitFrame, u => -100 + u * 70);
  const a = bakeFrames([byteFrame]), b = bakeFrames([dbFrame], { unit: 'db' }), c = bakeFrames([unitFrame], { unit: 'unit' });
  assert.deepEqual(a.data, c.data);
  for (let i = 0; i < a.data.length; i++) assert.ok(Math.abs(a.data[i] - b.data[i]) <= 0.002, `band ${i}: ${a.data[i]} vs ${b.data[i]}`);
  assert.throws(() => bakeFrames([byteFrame], { unit: 'phon' }), RangeError);
  assert.throws(() => bakeFrames([byteFrame], { bands: 0 }), RangeError);
});

test('a baked cache is plain JSON with the numbers a reader needs', () => {
  const c = bakeFrames(frames(21, 9, 200), { hopMs: 40, bands: 8, label: 'chapter 2' });
  assert.equal(c.kind, CACHE_KIND);
  assert.equal(c.frames, 21);
  assert.equal(c.bands, 8);
  assert.equal(c.data.length, 21 * 8);
  assert.equal(c.durationMs, 800);
  assert.equal(c.label, 'chapter 2');
  assert.deepEqual(JSON.parse(JSON.stringify(c)), c);
});

// ── baking a buffer you already hold ────────────────────────────────────────

const tone = (hz, amp, seconds) => ({
  sampleRate: SR,
  getChannelData: () => Float32Array.from({ length: Math.round(SR * seconds) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / SR)),
});

test('the FFT puts a tone in its own band, and a quiet tone reads at its decibel level', () => {
  for (const hz of [700, 2000, 6000]) {
    const c = bakeBuffer(tone(hz, 1, 0.5));
    const mid = Math.floor(c.frames / 2) * c.bands;
    const row = c.data.slice(mid, mid + c.bands);
    const peak = bandOfHz(hz);
    assert.ok(row[peak] >= 0.95, `${hz} Hz read ${row[peak]} in its band ${peak}`);
    const far = row.filter((_, b) => Math.abs(b - peak) >= 3);
    assert.ok(Math.max(...far) < 0.35, `${hz} Hz leaked ${Math.max(...far)} to bands 3+ away`);
  }
  // A sine at 0.01 of full scale is -40 dBFS, which the analyser window (-100..-30) puts at 60 / 70.
  const q = bakeBuffer(tone(1000, 0.01, 0.5));
  const row = q.data.slice(5 * q.bands, 6 * q.bands);
  assert.ok(Math.abs(Math.max(...row) - 60 / 70) < 0.03, `read ${Math.max(...row)}`);
});

test("a buffer bakes one row per hop, and the hop is the buffer's own", () => {
  const c = bakeBuffer(tone(500, 0.5, 1), { hopMs: 100, bands: 12 });
  assert.equal(c.frames, 10);
  assert.equal(c.bands, 12);
  assert.ok(Math.abs(c.hopMs - 100) < 1e-9);
  assert.throws(() => bakeBuffer(tone(500, 1, 0.1), { fftSize: 1000 }), RangeError);
});

// ── per frame: drive ────────────────────────────────────────────────────────

test('drive follows a tone burst: low before it, high during it', () => {
  const c = bakeFrames(frames(40, 9, 230, f => f >= 20), { hopMs: 50 });
  assert.ok(drive(c, 200) < 0.01, `before ${drive(c, 200)}`);
  assert.ok(drive(c, 1500) > 0.04, `during ${drive(c, 1500)}`);
  // one band of sixteen is lit, so the mean over all is 1/16 of its energy
  assert.ok(Math.abs(drive(c, 1500) - (230 / 255) / 16) < 0.005);
  const band = 9;
  assert.ok(Math.abs(drive(c, 1500, { band }) - 230 / 255) < 0.005, 'the lit band alone reads its energy');
  assert.equal(drive(c, 1500, { band: band === 0 ? 1 : 0 }), 0, 'another band is quiet');
  assert.ok(Math.abs(drive(c, 1500, { bands: [band, band] }) - 230 / 255) < 0.005);
});

test('drive interpolates between frames, clamps at the ends, and is a pure function of its inputs', () => {
  const c = bakeFrames([new Uint8Array(BINS), Uint8Array.from({ length: BINS }, () => 255)], { hopMs: 100, bands: 4 });
  assert.equal(drive(c, 0), 0);
  assert.equal(drive(c, 100), 1);
  assert.ok(Math.abs(drive(c, 50) - 0.5) < 1e-9);
  assert.ok(Math.abs(drive(c, 25) - 0.25) < 1e-9);
  assert.equal(drive(c, -500), 0);
  assert.equal(drive(c, 9999), 1);
  assert.equal(drive(c, 37), drive(c, 37));
  const copy = structuredClone(c);
  drive(c, 60); still(c);
  assert.deepEqual(c, copy);
});

test('floor and ceil set what reads as 0 and 1', () => {
  const half = bakeFrames([Uint8Array.from({ length: BINS }, () => 128)], { bands: 4 }); // about 0.502
  assert.ok(Math.abs(drive(half, 0) - 0.502) < 0.001);
  assert.equal(drive(half, 0, { floor: 0.6 }), 0);
  assert.equal(drive(half, 0, { ceil: 0.4 }), 1);
  assert.ok(Math.abs(drive(half, 0, { floor: 0.25, ceil: 0.75 }) - 0.504) < 0.01);
});

test("reduced motion gets the still: one steady value, the segment's mean, whatever the time", () => {
  const c = bakeFrames(frames(20, 9, 255, f => f % 2 === 0), { hopMs: 50, bands: 16 });
  const s = still(c);
  assert.ok(Math.abs(s - 0.5 / 16) < 1e-9, `${s}`);
  for (const t of [0, 25, 50, 333, 950]) assert.equal(drive(c, t, { reducedMotion: true }), s);
  assert.notEqual(drive(c, 0), drive(c, 50), 'without it the value pulses');
});

test('with nothing baked, the intensity is 0 (a still), never a throw', () => {
  assert.equal(drive(null, 100), 0);
  assert.equal(drive(undefined, 100, { reducedMotion: true }), 0);
  assert.equal(drive(bakeFrames([]), 100), 0);
  assert.equal(still(null), 0);
});

// ── the envelope and the chapters ───────────────────────────────────────────

test('follow rises faster than it falls, converges, and holds at dt 0', () => {
  const up = follow(0, 1, 40), down = follow(1, 0, 40);
  assert.ok(Math.abs(up - (1 - Math.exp(-1))) < 1e-12, 'one attack time constant');
  assert.ok(1 - down < up, 'it falls more slowly than it rises');
  assert.equal(follow(0.3, 0.9, 0), 0.3);
  let v = 0;
  for (let i = 0; i < 200; i++) v = follow(v, 0.8, 16);
  assert.ok(Math.abs(v - 0.8) < 1e-6);
  for (let i = 0; i < 400; i++) v = follow(v, 0, 16);
  assert.ok(v < 1e-6);
});

test('a segment is a slice of the table, with its own clock', () => {
  const c = bakeFrames(frames(40, 9, 255, f => f >= 20), { hopMs: 50 });
  const quiet = segment(c, 0, 900), loud = segment(c, 1000, 1950);
  assert.equal(quiet.frames, 19);
  assert.equal(loud.frames, 20);
  assert.equal(loud.durationMs, 950);
  assert.equal(still(quiet), 0);
  assert.ok(still(loud) > 0.05);
  assert.equal(still(segment(c, 0, c.durationMs)), still(c));
  assert.throws(() => segment(c, 500, 100), RangeError);
});

test('bandEdges runs log-spaced from 60 Hz to 16 kHz and stops at the Nyquist', () => {
  const e = bandEdges(16, 48000);
  assert.equal(e.length, 17);
  assert.ok(Math.abs(e[0] - 60) < 1e-9 && Math.abs(e[16] - 16000) < 1e-6);
  const ratio = e[1] / e[0];
  for (let i = 2; i < e.length; i++) assert.ok(Math.abs(e[i] / e[i - 1] - ratio) < 1e-9);
  assert.equal(bandEdges(4, 22050)[4], 11025);
});

// ── consent: baking never makes a sound ─────────────────────────────────────

test('bake.core.js has no way to make or start audio, or to read the sound switch', () => {
  const src = readFileSync(join(here, 'bake.core.js'), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const word of ['AudioContext', 'resume(', '.start(', 'createOscillator', 'createBufferSource', 'localStorage', 'sg-sound', 'soundOn', 'setTimeout', 'document', 'window']) {
    assert.ok(!src.includes(word), `bake.core.js mentions ${word}`);
  }
});

// ── round 2: the gaps Rasika found ──────────────────────────────────────────

test('the reduced-motion still is a typical moment: the median, not the spike-lifted mean', () => {
  // one loud frame in ten, the rest a quiet murmur in band 9
  const fr = Array.from({ length: 20 }, (_, f) => {
    const a = new Uint8Array(BINS);
    a[binOf(centreHz(9))] = f % 10 === 5 ? 255 : 51; // 0.2 against 1.0
    return a;
  });
  const c = bakeFrames(fr, { hopMs: 50 });
  const opts = { band: 9 };
  assert.ok(Math.abs(still(c, opts) - 0.2) < 0.005, `median ${still(c, opts)}`);
  assert.ok(Math.abs(still(c, { ...opts, of: 'mean' }) - (0.2 * 0.9 + 1 * 0.1)) < 0.005, `mean ${still(c, { ...opts, of: 'mean' })}`);
  assert.ok(still(c, { ...opts, of: 'mean' }) > still(c, opts) + 0.05);
  for (const t of [0, 250, 777]) assert.equal(drive(c, t, { ...opts, reducedMotion: true }), still(c, opts));
  // an even count takes the middle pair
  const two = bakeFrames([frames(1, 9, 0)[0], frames(1, 9, 255)[0]], {});
  assert.ok(Math.abs(still(two, { band: 9 }) - 0.5) < 1e-9);
});

test('drive and still never return NaN: a bad time is the start, a reversed range is the same range', () => {
  const c = bakeFrames(frames(30, 9, 255, f => f >= 15), { hopMs: 50 });
  assert.equal(drive(c, NaN, { band: 9 }), drive(c, 0, { band: 9 }));
  assert.equal(drive(c, undefined), drive(c, 0));
  assert.equal(drive(c, 1000, { bands: [12, 6] }), drive(c, 1000, { bands: [6, 12] }));
  assert.ok(drive(c, 1000, { bands: [6, 12] }) > 0);
  assert.equal(drive(c, 1000, { bands: [-5, 99] }), drive(c, 1000));
  for (const v of [drive(c, NaN), drive(c, 1000, { bands: [3, 2] }), drive(c, 1000, { bands: [5, 2] }), still(c, { bands: [3, 2] })]) {
    assert.ok(Number.isFinite(v) && !Object.is(v, -0), String(v));
  }
});

test("a segment starts at the frame the start falls in (it rounds down), so the chapter's first moment is kept", () => {
  const marked = Array.from({ length: 10 }, (_, f) => {
    const a = new Uint8Array(BINS);
    a[binOf(centreHz(9))] = f * 20;
    return a;
  });
  const c = bakeFrames(marked, { hopMs: 100 });
  const seg = segment(c, 250, 700); // frame 2.5 -> starts at frame 2
  assert.deepEqual(seg.data.slice(0, c.bands), c.data.slice(2 * c.bands, 3 * c.bands));
  assert.equal(seg.frames, 6); // frames 2..7
  assert.deepEqual(segment(c, 200, 700).data.slice(0, c.bands), c.data.slice(2 * c.bands, 3 * c.bands));
});

test('the median sorts first: a loud frame sitting at the middle index does not become the still', () => {
  const fr = Array.from({ length: 21 }, (_, f) => {
    const a = new Uint8Array(BINS);
    a[binOf(centreHz(9))] = f === 10 ? 255 : 51;
    return a;
  });
  const c = bakeFrames(fr, { hopMs: 50 });
  assert.ok(Math.abs(still(c, { band: 9 }) - 0.2) < 0.005, `${still(c, { band: 9 })}`);
  // and a quiet frame at the middle of a loud run is not the still either
  const loud = bakeFrames(fr.map((_, f) => { const a = new Uint8Array(BINS); a[binOf(centreHz(9))] = f === 10 ? 51 : 255; return a; }), { hopMs: 50 });
  assert.equal(still(loud, { band: 9 }), 1);
});

test('floor and ceil that are not numbers fall back to 0 and 1; a ceil at the floor is a step', () => {
  const c = bakeFrames(frames(10, 9, 128), { hopMs: 50 });
  const plain = still(c, { band: 9 });
  for (const bad of [NaN, undefined, 'x', Infinity]) {
    assert.equal(still(c, { band: 9, floor: bad }), plain, `floor ${bad}`);
    assert.equal(still(c, { band: 9, ceil: bad }), plain, `ceil ${bad}`);
    assert.equal(drive(c, 100, { band: 9, floor: bad, ceil: bad }), drive(c, 100, { band: 9 }));
  }
  assert.equal(still(c, { band: 9, floor: 0.3, ceil: 0.3 }), 1);
  assert.equal(still(c, { band: 9, floor: 0.9, ceil: 0.9 }), 0);
  assert.equal(still(c, { band: 9, floor: plain, ceil: plain }), 0, 'exactly at the step reads 0, not NaN');
  assert.ok(Number.isFinite(drive(c, 100, { band: 9, floor: 0.5, ceil: 0.1 })));
});
