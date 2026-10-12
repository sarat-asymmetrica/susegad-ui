// Bake and reflow for sound: the spectrum once, then arithmetic per frame.
//
//   bakeFrames(frames, opts)  once: FFT frames you already have (an analyser's
//                             bins, read per chapter or segment) become a
//                             small band-by-time table. Plain JSON.
//   bakeBuffer(buffer, opts)  once: the same table from an AudioBuffer you
//                             already hold, by running the FFT here. Nothing
//                             plays; a buffer is only read.
//   drive(cache, atMs, opts)  per frame: the 0..1 intensity at a time, for a
//                             scene to move with. Interpolation and a clamp.
//   follow(prev, target, dt)  a one-pole envelope, so a scene breathes
//                             instead of flickering. Pure; you hold the state.
//
// Consent is untouched (decision 0015). Nothing in this file creates, resumes
// or starts audio, or reads the sound switch: it turns numbers into numbers.
// capture.js reads an analyser the page already runs under its own consent.
// Pure: no DOM, no timer, no Promise; runs in Node.

export const CACHE_KIND = 'sg.sound.cache';
export const CACHE_VERSION = 1;

/** The analyser's own decibel window (getByteFrequencyData maps minDecibels..maxDecibels to 0..255). */
const MIN_DB = -100, MAX_DB = -30;

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const r3 = v => +v.toFixed(3);

/** Band edges in Hz, log spaced from 60 Hz to 16 kHz (or the Nyquist), `bands + 1` of them. */
export function bandEdges(bands, sampleRate) {
  const lo = 60, hi = Math.min(16000, sampleRate / 2);
  return Array.from({ length: bands + 1 }, (_, i) => lo * (hi / lo) ** (i / bands));
}

/** To the analyser's 0..1 scale from a byte (0..255), decibels, or a value already in 0..1. */
const toUnit = {
  byte: v => v / 255,
  db: v => clamp01((v - MIN_DB) / (MAX_DB - MIN_DB)),
  unit: v => clamp01(v),
};

/** Reduce a frame of linear bins to `bands` log-spaced bands, each the peak of the bins in it. */
function toBands(bins, bands, sampleRate, unit) {
  const f = toUnit[unit];
  const n = bins.length, binHz = sampleRate / 2 / n;
  const edges = bandEdges(bands, sampleRate);
  const out = new Array(bands);
  for (let b = 0; b < bands; b++) {
    const a = Math.min(n - 1, Math.max(0, Math.floor(edges[b] / binHz)));
    const z = Math.min(n - 1, Math.max(a, Math.ceil(edges[b + 1] / binHz) - 1));
    let peak = 0;
    for (let k = a; k <= z; k++) peak = Math.max(peak, f(bins[k]));
    out[b] = r3(peak);
  }
  return out;
}

function pack(rows, { bands, hopMs, sampleRate, label }) {
  return {
    kind: CACHE_KIND, version: CACHE_VERSION, label, bands, hopMs, sampleRate,
    frames: rows.length, durationMs: Math.max(0, rows.length - 1) * hopMs,
    data: rows.flat(),
  };
}

/**
 * Bake FFT frames into a band-by-time table.
 * @param {ArrayLike<number>[]} frames one array of bins per time step, low to high frequency
 *   (an `AnalyserNode`'s `getByteFrequencyData` or `getFloatFrequencyData` output)
 * @param {{ hopMs?: number, bands?: number, sampleRate?: number, unit?: 'byte'|'db'|'unit', label?: string }} [opts]
 *   `hopMs` is the time between frames
 */
export function bakeFrames(frames, { hopMs = 50, bands = 16, sampleRate = 48000, unit = 'byte', label = '' } = {}) {
  if (!toUnit[unit]) throw new RangeError(`unit is 'byte', 'db' or 'unit', not ${unit}`);
  if (!(hopMs > 0) || !Number.isInteger(bands) || bands < 1) throw new RangeError('hopMs is above 0 and bands is a whole number, 1 or more');
  return pack(frames.map(fr => toBands(fr, bands, sampleRate, unit)), { bands, hopMs, sampleRate, label });
}

// An iterative radix-2 FFT of a real signal, in place over re/im.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/**
 * Bake an AudioBuffer you already hold. Runs a Hann-windowed FFT every `hopMs`
 * over channel 0 and reduces each to bands, on the analyser's decibel window,
 * so a table from a buffer and one from an analyser read alike. Plays nothing.
 * @param {{ sampleRate: number, getChannelData: (c: number) => ArrayLike<number> }} buffer
 * @param {{ fftSize?: number, hopMs?: number, bands?: number, label?: string }} [opts]
 */
export function bakeBuffer(buffer, { fftSize = 1024, hopMs = 50, bands = 16, label = '' } = {}) {
  if (fftSize < 8 || (fftSize & (fftSize - 1)) !== 0) throw new RangeError('fftSize is a power of two, 8 or more');
  const x = buffer.getChannelData(0), sr = buffer.sampleRate;
  const hop = Math.max(1, Math.round((hopMs * sr) / 1000));
  const win = Float64Array.from({ length: fftSize }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  const norm = 2 / win.reduce((s, v) => s + v, 0); // a full-scale sine reads 1
  const rows = [];
  for (let start = 0; start < x.length; start += hop) {
    const re = new Float64Array(fftSize), im = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) re[i] = (x[start + i] ?? 0) * win[i];
    fft(re, im);
    const bins = new Array(fftSize / 2);
    for (let k = 0; k < bins.length; k++) bins[k] = 20 * Math.log10(Math.max(1e-10, Math.hypot(re[k], im[k]) * norm));
    rows.push(toBands(bins, bands, sr, 'db'));
  }
  return pack(rows, { bands, hopMs: (hop * 1000) / sr, sampleRate: sr, label });
}

/** The band indices a `band` or `bands` option names: a number, a [lo, hi] range, or all. */
function bandRange(cache, { band, bands }) {
  const top = cache.bands - 1;
  const fit = v => Math.min(top, Math.max(0, v));
  if (Number.isInteger(band)) return [fit(band), fit(band)];
  // A range is taken in either order, and clamped to the bands there are.
  if (Array.isArray(bands) && Number.isInteger(bands[0]) && Number.isInteger(bands[1])) return [fit(Math.min(bands[0], bands[1])), fit(Math.max(bands[0], bands[1]))];
  return [0, top];
}

/** Mean of a frame row over a band range. */
function rowEnergy(cache, row, lo, hi) {
  let s = 0;
  for (let b = lo; b <= hi; b++) s += cache.data[row * cache.bands + b];
  return s / (hi - lo + 1);
}

// floor and ceil that are not numbers fall back to 0 and 1; a ceil at or under the floor makes a step.
const shape = (e, floor, ceil) => {
  const lo = Number.isFinite(floor) ? floor : 0, hi = Number.isFinite(ceil) ? ceil : 1;
  return hi > lo ? clamp01((e - lo) / (hi - lo)) : (e > lo ? 1 : 0);
};

/**
 * The scene intensity, 0..1, at a time in the baked segment. Linear between
 * frames; before the start it is the first frame and after the end the last.
 * @param {ReturnType<typeof bakeFrames>} cache
 * @param {number} atMs milliseconds from the start of the segment
 * @param {{ band?: number, bands?: [number, number], floor?: number, ceil?: number, reducedMotion?: boolean }} [opts]
 *   `band` picks one band (0 is the lowest), `bands` a [lo, hi] range, neither all of them.
 *   `floor` and `ceil` are the energies that read as 0 and 1. Reduced motion
 *   returns the `still`, a steady value instead of a pulse.
 */
export function drive(cache, atMs, opts = {}) {
  if (!cache || !cache.frames) return 0;
  const { floor = 0, ceil = 1, reducedMotion = false } = opts;
  if (reducedMotion) return still(cache, opts);
  const [lo, hi] = bandRange(cache, opts);
  // A time that is not a number is the start of the segment.
  const at = atMs > 0 ? atMs : 0;
  const x = Math.min(cache.frames - 1, at / cache.hopMs);
  const i = Math.min(cache.frames - 1, Math.floor(x));
  const j = Math.min(cache.frames - 1, i + 1);
  const e = rowEnergy(cache, i, lo, hi) * (1 - (x - i)) + rowEnergy(cache, j, lo, hi) * (x - i);
  return shape(e, floor, ceil);
}

/**
 * The still: one steady value for the whole segment, what a scene paints when
 * the visitor has asked for less motion or there is nothing to listen to. By
 * default it is the median frame, a typical moment (a segment with one loud
 * frame in ten has a median of its quiet level, where its mean is twice that).
 * `of: 'mean'` gives the average level instead.
 * @param {ReturnType<typeof bakeFrames>} cache
 * @param {{ of?: 'median'|'mean', band?: number, bands?: [number, number], floor?: number, ceil?: number }} [opts]
 */
export function still(cache, opts = {}) {
  if (!cache || !cache.frames) return 0;
  const { floor = 0, ceil = 1, of = 'median' } = opts;
  const [lo, hi] = bandRange(cache, opts);
  const rows = Array.from({ length: cache.frames }, (_, r) => rowEnergy(cache, r, lo, hi));
  let e;
  if (of === 'mean') e = rows.reduce((s, v) => s + v, 0) / rows.length;
  else {
    rows.sort((p, q) => p - q);
    const m = rows.length >> 1;
    e = rows.length % 2 ? rows[m] : (rows[m - 1] + rows[m]) / 2;
  }
  return shape(e, floor, ceil);
}

/**
 * One step of a smoothing envelope: rises toward `target` over about
 * `attackMs`, falls over about `releaseMs`. Pure; the caller keeps `prev`.
 */
export function follow(prev, target, dtMs, { attackMs = 40, releaseMs = 240 } = {}) {
  const tau = target > prev ? attackMs : releaseMs;
  return prev + (target - prev) * (1 - Math.exp(-Math.max(0, dtMs) / tau));
}

/**
 * A slice of a cache between two times: bake a whole track once, then take
 * its chapters by arithmetic.
 */
export function segment(cache, startMs, endMs) {
  const a = Math.max(0, Math.floor(startMs / cache.hopMs));
  const b = Math.min(cache.frames - 1, Math.ceil(endMs / cache.hopMs));
  if (b < a) throw new RangeError('A segment ends after it starts');
  const rows = [];
  for (let r = a; r <= b; r++) rows.push(cache.data.slice(r * cache.bands, (r + 1) * cache.bands));
  return pack(rows, { bands: cache.bands, hopMs: cache.hopMs, sampleRate: cache.sampleRate, label: cache.label });
}
