// Read an analyser the page already runs, once, into a cache. The side-effecting half of
// sound bake and reflow: it only ever calls the analyser's read methods.
//
// Consent stays where decision 0015 put it. This does not create an AudioContext, does not
// resume one, does not connect or start a source, and does not look at the sound switch. If
// the analyser's context is not running (the switch is off, no gesture yet, the segment is
// not playing) there is nothing to read, and `capture` says so by returning null.

import { bakeFrames } from './bake.core.js';

const nap = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Capture `frames` readings of an analyser, `hopMs` apart, into a cache.
 * Call it while a segment that already has consent to play is playing.
 * @param {AnalyserNode} analyser
 * @param {{ frames?: number, hopMs?: number, bands?: number, label?: string, wait?: (ms: number) => Promise<void> }} [opts]
 *   `wait` replaces the timer between readings (tests give it an instant one)
 * @returns {Promise<ReturnType<typeof bakeFrames> | null>} null when the context is not running
 */
export async function capture(analyser, { frames = 40, hopMs = 50, bands = 16, label = '', wait = nap } = {}) {
  const state = analyser?.context?.state;
  if (!analyser || (state && state !== 'running')) return null;
  const rows = [];
  const bins = new Uint8Array(analyser.frequencyBinCount);
  for (let i = 0; i < frames; i++) {
    analyser.getByteFrequencyData(bins);
    rows.push(Uint8Array.from(bins));
    if (i < frames - 1) await wait(hopMs);
  }
  return bakeFrames(rows, { hopMs, bands, label, sampleRate: analyser.context?.sampleRate ?? 48000, unit: 'byte' });
}
