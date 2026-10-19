// Waits on state, not on the clock, for browser checks on the real clock.
//
// A fixed waitForTimeout is a guess about the machine: too short under load (the flake), too long on a quiet
// one (the wall time). These wait for the thing the clause needs and give a bounded answer, so a clause that
// never reaches its state fails with what the page showed instead of passing or failing by luck.
//
//   rafs      n real animation frames. Real-clock pages only: openStepped holds requestAnimationFrame, use frames() there.
//   stable    a page value (a function, run once a frame) unchanged for n frames in a row; `not` also needs it to
//             differ from a signature taken earlier (a relayout that has to have happened). Counts frames, not
//             milliseconds, so a slow machine waits longer, not less.
//   TIMERS_SCRIPT  an init script that counts the page's own short setTimeouts still waiting (window.__timers.pending);
//             stable(..., { timers: true }) then counts a frame only when none is, so a debounce or a settle
//             timer that has yet to fire holds the wait open, however slow the machine is.
//   pollUntil a Node-side probe, tried every `every` ms until it answers truthy or `ms` pass.
//
// stable and pollUntil answer { ok, value } and never throw on a timeout: the check decides what a timeout means
// (usually a failed clause that prints `value`). Tested in wait.test.mjs.

/** Resolve after `n` real animation frames of the page. */
export const rafs = (page, n = 2) => page.evaluate(n => new Promise(resolve => {
  const tick = () => (--n > 0 ? requestAnimationFrame(tick) : resolve());
  requestAnimationFrame(tick);
}), n);

/**
 * Evaluate `fn` (a page function, given `arg`) once a frame until its JSON value has not changed for `frames`
 * frames in a row, or `ms` of real time pass. With `not`, the settled value must also differ from that JSON string.
 * With `timers`, a frame in which the page still has a short timer pending (TIMERS_SCRIPT) does not count.
 * `fn` is serialised with toString() and rebuilt in the page, so it must not close over anything. A probe that throws is not a
 * reading: ok is false when the last one threw, and value is the `error: ...` message.
 * @returns {Promise<{ ok: boolean, value: any }>} value is the last reading, parsed
 */
export async function stable(page, fn, { arg, frames = 3, ms = 10000, not, timers = false } = {}) {
  const r = await page.evaluate(([src, arg, frames, ms, not, timers]) => new Promise(resolve => {
    const probe = new Function('arg', `return (${src})(arg)`);
    const t0 = performance.now();
    let last, same = 0, failed = false;
    const tick = () => {
      let v;
      try { v = JSON.stringify(probe(arg)) ?? 'undefined'; failed = false; } catch (e) { v = JSON.stringify(`error: ${e.message}`); failed = true; }
      if (timers && !window.__timers) return resolve({ ok: false, value: JSON.stringify('timers: TIMERS_SCRIPT is not installed on this page') });
      if (v === last && !(timers && window.__timers.pending)) same++; else { same = 0; last = v; }
      if (same >= frames && v !== not) return resolve({ ok: !failed, value: v });
      if (performance.now() - t0 > ms) return resolve({ ok: false, value: v });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), [fn.toString(), arg, frames, ms, not, timers]);
  return { ok: r.ok, value: r.value === 'undefined' ? undefined : JSON.parse(r.value) };
}

/**
 * Init script (context.addInitScript, before the page loads): counts the page's setTimeouts of 1.5 s or less that have not
 * fired or been cleared, as window.__timers.pending. A debounce of 120 ms and a settle of 350 ms show up in it; a long
 * timeout (a clock, a say-live clear) does not hold anything up.
 */
export const TIMERS_SCRIPT = `(() => {
  const set = window.setTimeout.bind(window), clear = window.clearTimeout.bind(window), live = new Set();
  window.setTimeout = (fn, ms, ...rest) => {
    if (typeof fn !== 'function' || !(ms <= 1500 || ms === undefined)) return set(fn, ms, ...rest);
    const id = set((...a) => { live.delete(id); return fn(...a); }, ms, ...rest);
    live.add(id);
    return id;
  };
  window.clearTimeout = id => { live.delete(id); return clear(id); };
  Object.defineProperty(window, '__timers', { value: { get pending() { return live.size; } } });
})();`;

/** `stable`'s signature for a reading, to pass as `not`: take it before the change, wait for a settled value that differs. */
export const signature = async (page, fn, arg) => JSON.stringify(await page.evaluate(fn, arg)) ?? 'undefined';

/**
 * Try `probe` (sync or async, in Node) every `every` ms until it answers truthy, or `ms` pass.
 * @returns {Promise<{ ok: boolean, value: any }>} value is the last answer
 */
export async function pollUntil(probe, { ms = 10000, every = 50, now = () => Date.now(), sleep = t => new Promise(r => setTimeout(r, t)) } = {}) {
  const t0 = now();
  for (;;) {
    const value = await probe();
    if (value) return { ok: true, value };
    if (now() - t0 >= ms) return { ok: false, value };
    await sleep(every);
  }
}

// ── for scene pages (tools/harness/scene.html and the demos): window.__ready, window.__piece ──

/** A cheap fingerprint of the scene's canvas (48 x 32 average of it), or null when the page has none. */
export const canvasPrint = () => {
  const cv = (window.__piece?.shadowRoot ?? document).querySelector('canvas');
  if (!cv || !cv.width) return null;
  const s = Object.assign(document.createElement('canvas'), { width: 48, height: 32 }), g = s.getContext('2d', { willReadFrequently: true });
  g.drawImage(cv, 0, 0, 48, 32);
  let hash = 0;
  for (const v of g.getImageData(0, 0, 48, 32).data) hash = (hash * 31 + v) >>> 0;
  return hash;
};

/**
 * A still (reduced motion, or the quiet skin) is finished drawing: the page's fonts are in and the canvas
 * fingerprint has not changed for `frames` frames. Replaces "wait 300 ms, then grab". {ok:false} means it kept changing.
 */
export async function stillSettled(page, { frames = 6, ms = 15000 } = {}) {
  await page.evaluate(() => document.fonts?.ready);
  return stable(page, canvasPrint, { frames, ms });
}

/**
 * A freshly loaded (or reloaded) page is at rest: sg-ready, fonts in, no request in flight for a moment, three frames drawn.
 * For a clause that watches for something the page must not do (ask for a host, throw), which can only be seen once loading is over.
 * `ready: false` is for a page that never sets window.__ready (a control built from plain HTML).
 * `quiet` (ms) is a floor for a clause that asserts something NEVER happens (no request leaves, no late import): once the
 * page is loaded it is also held open for that long on the page's own clock, so an offender that fires a second late is
 * still inside the window. A wait for absence has to be a timed window; leave `quiet` off for a clause that wants speed.
 */
export async function loaded(page, { ms = 30000, ready = true, quiet = 0 } = {}) {
  if (ready) await page.waitForFunction(() => window.__ready === true, null, { timeout: ms });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForLoadState('networkidle', { timeout: ms }).catch(() => {});
  await rafs(page, 3);
  if (quiet > 0) await page.evaluate(q => new Promise(resolve => { const end = performance.now() + q, tick = () => (performance.now() >= end ? resolve() : requestAnimationFrame(tick)); tick(); }), quiet);
}
