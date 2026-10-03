// Voice note: the pure core. Runs in Node.
//
// A voice message the way a phone shows it: a play button, a waveform, the
// length, and always the transcript. The time maths and the cue lookup are
// the player's (packages/player/player.core.js); the transcript can be built
// from the same WebVTT timing track narration writes (packages/narration/vtt.js).

import { formatTime, scrubberFraction, timeFromFraction, activeCue } from '../../player/player.core.js';
import { parseVtt } from '../../narration/vtt.js';
import { rng } from '../../engine/src/rng.js';
import { makeNoise } from '../../engine/src/noise.js';

export { formatTime, scrubberFraction, timeFromFraction, activeCue };

export const STRINGS = {
  play: 'Play voice message',
  pause: 'Pause voice message',
  seek: 'Position in the voice message',
  of: 'of',
  noTranscript: 'sg-voice-note: add the transcript as a .sg-voice-transcript element beside the audio. It is what most people will read.',
};

/** "0:12 of 0:42", for the seek control's aria-valuetext. */
export const timeText = (current, duration) => `${formatTime(current)} ${STRINGS.of} ${formatTime(duration)}`;

/**
 * A `peaks` attribute ("0.1 0.52 0.9 …", commas or spaces) to numbers in
 * 0..1, or null when there is nothing usable, so the caller falls back to a
 * stand-in and says so.
 * @param {string|null|undefined} text
 * @returns {number[]|null}
 */
export function parsePeaks(text) {
  if (!text || !text.trim()) return null;
  const nums = text.trim().split(/[\s,]+/).map(Number);
  if (nums.length < 4 || nums.some(n => !Number.isFinite(n))) return null;
  const max = Math.max(...nums.map(Math.abs));
  if (!max) return null;
  return nums.map(n => +(Math.abs(n) / (max > 1 ? max : 1)).toFixed(3));
}

/**
 * Peaks to `n` bars: each bar takes the loudest peak in its slice (so a short
 * loud word is never averaged away), with a small floor so silence still
 * shows as a line.
 * @param {number[]} peaks
 * @param {number} n
 * @param {number} [floor]
 */
export function barsFrom(peaks, n, floor = 0.08) {
  n = Math.max(1, Math.floor(n));
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * peaks.length) / n), b = Math.max(a + 1, Math.floor(((i + 1) * peaks.length) / n));
    let m = 0;
    for (let j = a; j < b && j < peaks.length; j++) m = Math.max(m, peaks[j]);
    out.push(+Math.max(floor, Math.min(1, m)).toFixed(3));
  }
  return out;
}

/**
 * A stand-in waveform when no real peaks were given: speech-like bursts from
 * seeded noise. Deterministic for a seed. The element marks it
 * data-waveform="stand-in", because it is a drawing, not a measurement.
 * @param {string|number} seed
 * @param {number} [n]
 */
export function standInPeaks(seed, n = 96) {
  const noise = makeNoise(`voice-note:${seed}`), r = rng(`voice-note:${seed}`);
  const out = [];
  for (let i = 0; i < n; i++) {
    const phrase = 0.5 + 0.5 * noise(i * 0.09, 1.7);            // phrases rise and fall
    const syllable = 0.5 + 0.5 * Math.sin(i * 1.3 + r() * 0.8);  // syllables flicker
    const gap = noise(i * 0.05, 9.1) < -0.35 ? 0.15 : 1;        // the odd pause between phrases
    out.push(+Math.min(1, Math.max(0.05, phrase * (0.45 + 0.55 * syllable) * gap)).toFixed(3));
  }
  return out;
}

/** How many bars fit in `width` px at a pitch (bar plus gap). */
export const barCount = (width, pitch) => Math.max(8, Math.floor(width / pitch));

/**
 * The transcript as HTML from a WebVTT track, for a build step: one span per
 * cue with its start and end, so the element can mark the phrase being
 * spoken. Word timestamp tags (narration's karaoke form) are read and dropped.
 * @param {string} vtt
 * @returns {string}
 */
export function transcriptHtml(vtt) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return parseVtt(vtt)
    .map(p => `<span class="sg-voice-cue" data-start="${+p.start.toFixed(3)}" data-end="${+p.end.toFixed(3)}">${esc(p.words.map(w => w.word).join(' '))}</span>`)
    .join(' ');
}

/** Cues from transcript spans' data-start and data-end, in the shape activeCue reads. */
export const cuesFrom = spans => spans.map((s, i) => ({ start: +s.start, end: +s.end, text: String(i) })).filter(c => Number.isFinite(c.start) && Number.isFinite(c.end));

/** The playful press: the button springs, at full motion only. Transform only. */
export function press(motion) {
  if (motion !== 'full') return null;
  return { frames: [{ transform: 'scale(1)' }, { transform: 'scale(0.86)', offset: 0.35 }, { transform: 'scale(1.06)', offset: 0.7 }, { transform: 'scale(1)' }], timing: { duration: 320, easing: 'ease-out' } };
}
