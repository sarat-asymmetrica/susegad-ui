// loop.js: the heartbeat, and run(), the usual way to mount a piece.
// loop() touches no DOM of its own: matchMedia and requestAnimationFrame can
// be injected, so it runs under a fake clock in Node.
import { stage } from './stage.js';

/** @typedef {{ reduced: boolean, time: number, playing: boolean, play: () => void, pause: () => void,
 *   seek: (t: number) => void, redraw: () => void }} Loop
 *   reduced is read once; seek and redraw draw once with dt = 0. */

/**
 * requestAnimationFrame wrapper. render(t, dt) gets seconds since start and
 * seconds since the last drawn frame. `fps` > 0 limits how often it draws
 * (e.g. 12 for a hand-animated feel) while time keeps flowing smoothly.
 * A gap longer than 0.1 s (a hidden tab) counts as 0.1 s.
 * @param {(t: number, dt: number) => void} render
 * @param {{ fps?: number, matchMedia?: (q: string) => { matches: boolean },
 *   raf?: (cb: (now: number) => void) => number, caf?: (id: number) => void }} [opts]
 * @returns {Loop}
 */
export function loop(render, {
  fps = 0,
  matchMedia = globalThis.matchMedia && (q => globalThis.matchMedia(q)),
  raf = cb => requestAnimationFrame(cb),
  caf = id => cancelAnimationFrame(id),
} = {}) {
  const reduced = !!matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let id = 0, playing = false, time = 0, prev = 0, last = -1;
  function tick(now) {
    id = raf(tick);
    const dt = prev ? Math.min(0.1, (now - prev) / 1000) : 1 / 60;
    prev = now;
    time += dt;
    if (fps && last >= 0 && time - last < 1 / fps) return;
    const step = last < 0 ? dt : time - last;
    last = time;
    render(time, step);
  }
  return {
    reduced,
    get time() { return time; },
    get playing() { return playing; },
    play() { if (playing) return; playing = true; prev = 0; id = raf(tick); },
    pause() { playing = false; caf(id); },
    seek(t) { time = t; last = t; render(time, 0); },
    redraw() { render(time, 0); },
  };
}

/**
 * The usual way to mount a piece: stage + loop + reduced-motion handling.
 * draw(ctx, t, dt, st) is called every frame with the transform already set.
 * With prefers-reduced-motion (or autoplay: false) it draws one still frame
 * at `still` seconds.
 *
 * That still is drawn synchronously, inside run(), before run() returns. If
 * draw() reads the controller, declare it with `let`:
 *
 *     let ctl = null;
 *     ctl = run(el, { draw: (g, t) => { if (ctl && ctl.playing) … } });
 *
 * `const ctl = run(…)` throws a ReferenceError (temporal dead zone) on the
 * reduced-motion path only, the path least often tested.
 * @param {HTMLElement} el
 * @param {{ W?: number, H?: number, fps?: number, still?: number, autoplay?: boolean, maxDpr?: number,
 *   draw: (g: CanvasRenderingContext2D, t: number, dt: number, st: import('./stage.js').Stage) => void }} opts
 */
export function run(el, { W, H, fps = 0, still = 0, autoplay = true, maxDpr = 2, draw }) {
  const st = stage(el, { W, H, maxDpr });
  const lp = loop((t, dt) => { st.begin(); draw(st.ctx, t, dt, st); }, { fps });
  st.onresize = () => lp.redraw();
  if (lp.reduced || !autoplay) lp.seek(still); else lp.play();
  return {
    stage: st,
    loop: lp,
    get playing() { return lp.playing; },
    play: () => lp.play(),
    pause: () => lp.pause(),
    destroy() { lp.pause(); st.destroy(); },
  };
}
