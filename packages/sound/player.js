// The thin player: turns a patch (plain data from patches.js) into Web Audio
// nodes on a context that already exists. No context management here — that
// is switch.js's job, because only it knows about the gesture and the switch.

/**
 * Play a patch on an already-running context. Builds one oscillator and gain
 * envelope per note, spaced evenly across `dur`, each shaped as a fast attack
 * and an exponential decay (the same envelope a struck or plucked sound
 * follows). Never throws: a synthesis failure should never break the caller.
 * @param {AudioContext} ctx
 * @param {{ notes: number[], dur: number, gain: number, type: OscillatorType }} patch
 */
export function render(ctx, patch) {
  try {
    const { notes, dur, gain, type } = patch;
    const master = ctx.createGain();
    master.gain.value = gain;
    master.connect(ctx.destination);
    const now = ctx.currentTime;
    const step = dur / notes.length;
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      const t0 = now + i * step * 0.92;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(1, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + step);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + step + 0.03);
      o.addEventListener('ended', () => { try { o.disconnect(); g.disconnect(); } catch { /* already gone */ } });
    });
    setTimeout(() => { try { master.disconnect(); } catch { /* already gone */ } }, (dur + 0.1) * 1000);
  } catch { /* play() never throws; a synthesis failure is silent */ }
}
