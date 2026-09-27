// Rampon koel: a rising three-note "ku-oo" call (two rising tones, with the
// second call's pitch already the "note", the lift is in the frequency
// ramp within each tone), called in a bout of three that speeds up like a
// real koel's does, then quiet for a while before the next bout. Only in
// playful (the register that flies the full flock), only with the switch
// on, and only while a bird is actually visible on screen -- read from
// birdX(), the same pure function render.js draws the birds from, so no
// hook into the renderer is needed at all (unlike Paus's rain).
//
//   import { attachRamponKoel } from '…/sound/scapes/rampon-koel.js';
//   const stop = attachRamponKoel(document.querySelector('sg-scene[name="rampon"]'));
//   // later: stop()

import { sceneContext, soundOn, onSoundChange } from '../switch.js';
import { readRegister } from '../../core/register.js';
import { scene as ramponScene, birdX, W as SCENE_W } from '../../scenes/rampon/model.js';
import { anyVisible, bout, CALL_NOTES } from './rampon-koel.core.js';

const QUIET_AFTER_BOUT_S = 6;
const FIRST_CALL_AFTER_S = 2;

function playCall(ctx) {
  try {
    const now = ctx.currentTime;
    CALL_NOTES.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      const t0 = now + i * 0.16, dur = 0.24;
      o.frequency.setValueAtTime(freq * 0.92, t0);
      o.frequency.exponentialRampToValueAtTime(freq, t0 + dur * 0.65);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.035);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
      o.addEventListener('ended', () => { try { o.disconnect(); g.disconnect(); } catch { /* already gone */ } });
    });
  } catch { /* ambient sound: a synthesis failure is silent, never thrown */ }
}

/**
 * Wire a live <sg-scene name="rampon"> up to the koel call. Returns a
 * function that tears it down.
 * @param {Element & { seed: number|string }} sceneEl
 * @returns {() => void}
 */
export function attachRamponKoel(sceneEl) {
  let on = soundOn();
  let tabVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
  let onScreen = true;
  let timer = 0;
  let index = 0;
  let gaps = bout();

  const unsub = onSoundChange(v => { on = v; });
  const onVisibility = () => { tabVisible = document.visibilityState === 'visible'; };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([entry]) => { onScreen = !!entry?.isIntersecting; })
    : null;
  io?.observe(sceneEl);

  function schedule(delaySec) {
    clearTimeout(timer);
    timer = setTimeout(tick, Math.max(50, delaySec * 1000));
  }

  function tick() {
    const ready = on && tabVisible && onScreen && readRegister(sceneEl) === 'playful';
    if (!ready) return schedule(1);
    const ctx = sceneContext();
    if (!ctx) return schedule(1);
    const S = ramponScene(sceneEl.seed ?? 1);
    const t = performance.now() / 1000;
    const xs = S.birdsAll.map(b => birdX(b, t));
    if (!anyVisible(xs, SCENE_W)) return schedule(0.5);
    playCall(ctx);
    index++;
    if (index < gaps.length + 1) schedule(gaps[index - 1]);
    else { index = 0; gaps = bout(); schedule(QUIET_AFTER_BOUT_S); }
  }

  schedule(FIRST_CALL_AFTER_S);

  return function detach() {
    clearTimeout(timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    io?.disconnect();
    unsub();
  };
}
