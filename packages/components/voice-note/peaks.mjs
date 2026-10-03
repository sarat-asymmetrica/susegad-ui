#!/usr/bin/env node
// Real waveform peaks for <sg-voice-note>, computed once at build time from a
// WAV (the header is read by narration's parseWav). Other formats: convert
// first, for example `ffmpeg -i note.opus -ac 1 -ar 16000 note.wav`.
//
//   node peaks.mjs note.wav [bars=96]    prints the value for the peaks attribute
//
// In a build script: import { peaksFromWav } from './peaks.mjs'.

import { parseWav } from '../../narration/wav.js';

/**
 * The loudness (root mean square) of each of `n` equal slices, scaled so the
 * loudest slice is 1. RMS rather than the single loudest sample: speech
 * peaks near full scale in almost every slice, and a waveform of peaks is a
 * flat bar. Pure.
 * @param {ArrayLike<number>} samples mono, any scale
 * @param {number} [n]
 * @returns {number[]}
 */
export function peaksFromPcm(samples, n = 96) {
  const out = new Array(n).fill(0);
  const len = samples.length;
  if (!len) return out;
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * len) / n), b = Math.max(a + 1, Math.floor(((i + 1) * len) / n));
    let sum = 0, k = 0;
    for (let j = a; j < b && j < len; j++, k++) sum += samples[j] * samples[j];
    out[i] = Math.sqrt(sum / (k || 1));
  }
  const max = Math.max(...out) || 1;
  return out.map(v => +(v / max).toFixed(3));
}

/**
 * Peaks from a 16-bit or 8-bit PCM WAV, channels mixed down by taking the
 * loudest. Pure: bytes in, numbers out.
 * @param {Uint8Array} bytes
 * @param {number} [n]
 */
export function peaksFromWav(bytes, n = 96) {
  const h = parseWav(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset + h.dataOffset, Math.min(h.dataBytes, bytes.byteLength - h.dataOffset));
  const step = h.bitsPerSample / 8, frame = step * h.channels;
  if (step !== 2 && step !== 1) throw new Error(`peaksFromWav reads 8- or 16-bit PCM; this file is ${h.bitsPerSample}-bit. Convert it with ffmpeg first.`);
  const frames = Math.floor(view.byteLength / frame);
  const mono = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let m = 0;
    for (let c = 0; c < h.channels; c++) {
      const o = f * frame + c * step;
      const v = step === 2 ? view.getInt16(o, true) / 32768 : (view.getUint8(o) - 128) / 128;
      if (Math.abs(v) > Math.abs(m)) m = v;
    }
    mono[f] = m;
  }
  return peaksFromPcm(mono, n);
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('voice-note/peaks.mjs')) {
  const [file, bars = '96'] = process.argv.slice(2);
  if (!file) { console.error('usage: node peaks.mjs note.wav [bars]'); process.exit(2); }
  const { readFileSync } = await import('node:fs');
  console.log(peaksFromWav(readFileSync(file), +bars).join(' '));
}
