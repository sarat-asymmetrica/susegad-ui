// Paus rain: the pure half. Which of this frame's new drops actually get
// turned into a sound (voice-limited and sampled, never one per drop when
// the storm is heavy), and how each one should sound (panned by where it
// sits on the glass, pitched a little higher for a smaller drop). Runs in
// Node; paus-rain.js is the thin side-effecting half that owns the oscillators.

/**
 * How many of this frame's new drops to actually sound: never more than the
 * free voices in the pool, and never more than `maxPerFrame`, so a storm of
 * hundreds of beads a second still opens only a handful of oscillators.
 */
export function voicesToTrigger(newCount, freeVoices, maxPerFrame = 3) {
  return Math.max(0, Math.min(newCount, Math.max(0, freeVoices), Math.max(0, maxPerFrame)));
}

/**
 * Evenly sample `n` items out of `arr` by index, so a batch of new drops is
 * represented across its spread rather than always the first or last few.
 */
export function sample(arr, n) {
  if (n <= 0 || !arr.length) return [];
  if (n >= arr.length) return arr.slice();
  const step = arr.length / n, out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

/**
 * A drop's voice: panned by its x position across the window, a little
 * higher pitched the smaller it is, and a little quieter too.
 * @param {{ x: number, r: number }} bead in Paus's logical units (see model.js W, H)
 * @param {number} W the window's logical width
 */
export function voiceFor(bead, W) {
  const pan = Math.max(-1, Math.min(1, (bead.x / W) * 2 - 1));
  const freq = Math.max(900, Math.min(2200, 2400 - bead.r * 260));
  const gain = Math.max(0.05, Math.min(0.22, 0.06 + bead.r * 0.035));
  return { pan: +pan.toFixed(3), freq: Math.round(freq), gain: +gain.toFixed(3) };
}
