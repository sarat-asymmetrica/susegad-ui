// Paus rain: each visible raindrop is an audible tick, seeded like the
// drawing itself (createDrops() in packages/scenes/paus/model.js is
// deterministic for a seed, and this only reacts to what it produces, so the
// same seed sounds the same way). Voice-limited and pooled, so a storm of
// hundreds of beads a second still opens only a handful of oscillators, not
// hundreds. Only runs with the sound switch on, and stops when the scene
// leaves the viewport or the tab is hidden.
//
//   import { attachPausRain } from '…/sound/scapes/paus-rain.js';
//   const stop = attachPausRain(document.querySelector('sg-scene[name="paus"]'));
//   // later: stop()

import { sceneContext, soundOn, onSoundChange } from '../switch.js';
import { voicesToTrigger, sample, voiceFor } from './paus-rain.core.js';

const MAX_VOICES = 4;
const TICK_DUR = 0.05;
const MIN_GAP_MS = 40; // never build a new Web Audio node graph more often than this, however hard it rains

function playTick(ctx, { pan, freq, gain }, release) {
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.type = 'sine';
    o.frequency.value = freq;
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + TICK_DUR);
    o.connect(g);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(ctx.destination); } else g.connect(ctx.destination);
    o.start(now);
    o.stop(now + TICK_DUR + 0.02);
    let freed = false;
    const free = () => {
      if (freed) return; // 'ended' and the backstop can both fire; the voice is released exactly once
      freed = true;
      release();
      try { o.disconnect(); g.disconnect(); p?.disconnect(); } catch { /* already gone */ }
    };
    o.addEventListener('ended', free);
    setTimeout(free, (TICK_DUR + 0.08) * 1000); // a backstop: 'ended' can be late or missed
  } catch { release(); }
}

/**
 * Wire a live <sg-scene name="paus"> element up to the rain tick. Returns a
 * function that tears it down.
 * @param {Element} sceneEl
 * @param {{ maxPerFrame?: number }} [opts]
 * @returns {() => void}
 */
export function attachPausRain(sceneEl, { maxPerFrame = 1 } = {}) {
  let prevBeads = 0;
  let active = 0;
  let lastTrigger = 0;
  let on = soundOn();
  let visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';

  const onVisibility = () => { visible = onScreen && document.visibilityState === 'visible'; };
  let onScreen = true;
  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([entry]) => { onScreen = !!entry?.isIntersecting; onVisibility(); })
    : null;
  io?.observe(sceneEl);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  const unsubSwitch = onSoundChange(v => { on = v; });

  function onDrops(e) {
    const beads = e.detail?.beads ?? [];
    const grew = Math.max(0, beads.length - prevBeads);
    prevBeads = beads.length;
    if (!on || !visible || grew === 0) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - lastTrigger < MIN_GAP_MS) return; // rate-limit how often we build a Web Audio graph at all
    const ctx = sceneContext();
    if (!ctx) return;
    const n = voicesToTrigger(grew, MAX_VOICES - active, maxPerFrame);
    if (n <= 0) return;
    lastTrigger = now;
    const W = e.detail.W ?? 1200;
    for (const bead of sample(beads.slice(-grew), n)) {
      active++;
      playTick(ctx, voiceFor(bead, W), () => { active = Math.max(0, active - 1); });
    }
  }
  sceneEl.addEventListener('sg-paus-drops', onDrops);

  return function detach() {
    sceneEl.removeEventListener('sg-paus-drops', onDrops);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    io?.disconnect();
    unsubSwitch();
  };
}
