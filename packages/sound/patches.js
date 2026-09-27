// The synthesised vocabulary, as data. Pure: no Web Audio here, so it runs and
// is tested in Node. player.js turns a patch into nodes.
//
// Four words: tick (a light click, for a day picked or a key struck), confirm
// (something small went right), complete (a piece of work finished), error
// (gentle, never alarming). Each is one or a few short tones, described as
// { notes, dur, gain, type }: `notes` play in even steps across `dur`.

export const VOCAB = ['tick', 'confirm', 'complete', 'error'];

// The playful register's full vocabulary. quiet and warm scale and thin it.
const FULL = {
  tick: { notes: [1300], dur: 0.028, gain: 0.16, type: 'sine' },
  // a small rise: something was accepted
  confirm: { notes: [660, 880], dur: 0.1, gain: 0.2, type: 'sine' },
  // a little further, a landing: a major third climbing to a fifth
  complete: { notes: [523.25, 659.25, 783.99], dur: 0.16, gain: 0.22, type: 'sine' },
  // a soft, low double note, never a buzz or a harsh tone: bad news said kindly
  error: { notes: [246.94, 220], dur: 0.18, gain: 0.17, type: 'sine' },
};

const scaled = (p, gainScale, durScale = 1) => ({ ...p, gain: +(p.gain * gainScale).toFixed(4), dur: +(p.dur * durScale).toFixed(4) });

/**
 * The patch for one word in one register, or null when that register keeps
 * silent for it (decision 0015: quiet plays confirmations only).
 * @param {string} name one of VOCAB
 * @param {'quiet'|'warm'|'playful'} register
 * @returns {{ notes: number[], dur: number, gain: number, type: OscillatorType }|null}
 */
export function patchFor(name, register) {
  if (!VOCAB.includes(name)) return null;
  if (register === 'quiet') return name === 'confirm' ? scaled(FULL.confirm, 0.55, 0.8) : null;
  if (register === 'warm') return scaled(FULL[name], 0.75);
  return FULL[name] ?? null; // playful, and any other value: the full vocabulary
}
