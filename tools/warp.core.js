// Warp: bring a running scene to a chosen moment without waiting it out (perf.mjs --at, review-pack's
// content shots). The scene element keeps its own clock and has no seek, and an abri-like scene walks
// a simulation forward as it plays, so a jump would skip work. Instead, requestAnimationFrame is
// wrapped: while warping, callbacks run back to back with a stepped timestamp (1/60 s a frame, no
// vsync wait), so the scene plays every frame it would have, only faster than real time. When it ends
// the wrapper keeps a constant offset so the timestamps the scene sees stay continuous (a real frame
// has a smaller clock than the stepped one, which would otherwise read as a negative dt).
//
// The governor is fed 16.7 ms frames while warping, so it stays at full quality through the warp; how
// it then behaves is the measured window's business. to(seconds, frameMs) steps with longer frames
// instead (LOW_QUALITY_FRAME_MS): the governor sees a struggling machine, steps down a quarter per
// 60 slow frames to its floor, and a fast machine only climbs back after about 4 s of calm frames. Pure data here (a script string and a stage
// table); the page side is tested through perf.mjs and the pack, and warp.core.test.mjs checks the table.

/** Installed once into the page (idempotent). Adds window.__warp = { to(seconds), moment(), played }. */
export const WARP_SCRIPT = `(() => {
  if (window.__warp) return;
  const inner = window.requestAnimationFrame.bind(window), innerCancel = window.cancelAnimationFrame.bind(window);
  let warping = false, offset = 0, nid = 2e9, played = 0;
  const q = new Map();
  window.requestAnimationFrame = cb => {
    if (warping) { const id = nid++; q.set(id, cb); return id; }
    return inner(ts => cb(ts + offset));
  };
  window.cancelAnimationFrame = id => { if (!q.delete(id)) innerCancel(id); };
  const port = new MessageChannel();
  const settle = () => new Promise(r => { port.port1.onmessage = () => r(); port.port2.postMessage(0); });
  const stage = () => (window.__piece?.shadowRoot?.querySelector('.stage')) || null;
  window.__warp = {
    get played() { return played; },
    moment() {
      const d = stage()?.dataset || {};
      return { warped: +played.toFixed(2), u: d.u != null ? +d.u : null, stage: d.stage ?? null };
    },
    async to(seconds, frameMs = 1000 / 60) {
      const n = Math.round((seconds * 1000) / frameMs);
      let vt = performance.now() + offset, i = 0, idle = 0;
      warping = true;
      while (i < n) {
        // nothing asked for a frame: a still scene (quiet, reduced motion) has no clock to warp
        if (!q.size) { if (++idle > 100) break; await new Promise(r => setTimeout(r, 4)); continue; }
        idle = 0;
        const cbs = [...q.values()];
        q.clear();
        vt += frameMs; i++;
        for (const cb of cbs) { try { cb(vt); } catch (e) { setTimeout(() => { throw e; }); } }
        await settle();
      }
      played += (i * frameMs) / 1000;
      offset = vt - performance.now();
      warping = false;
      for (const cb of q.values()) inner(ts => cb(ts + offset));
      q.clear();
      return played;
    },
  };
})();`;

/**
 * The moment a scene's main stage shows, as seconds of its own clock for a register: where its
 * headline feature is on screen. Scenes not listed show their first few seconds. abri's drift is
 * u 33 of the tray's local clock (the comb ends about u 29), and warm runs the tray at 0.75 of the
 * page's clock, playful at 1, quiet is the still (nothing to wait for).
 */
export const MAIN_STAGE = {
  abri: { u: 33, pace: { quiet: 0, warm: 0.75, playful: 1 } },
};
/** Frame length that reads as slow to the governor (it steps down above 1.5 x 16.7 ms); the loop caps a frame at 100 ms. */
export const LOW_QUALITY_FRAME_MS = 34;
export const DEFAULT_STAGE_SECONDS = 4;

/** @returns {number} seconds of warp to reach the scene's main stage in this register */
export function stageSeconds(slug, register = 'warm') {
  const s = MAIN_STAGE[slug];
  if (!s) return DEFAULT_STAGE_SECONDS;
  const pace = s.pace?.[register] ?? 1;
  return pace > 0 ? Math.ceil(s.u / pace) : 1;
}
