import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rafs, stable, signature, pollUntil, TIMERS_SCRIPT } from './wait.mjs';

/** A page whose evaluate runs the function here, with a requestAnimationFrame that ticks every 1 ms and a settable clock. */
function fakePage() {
  const g = globalThis, saved = { raf: g.requestAnimationFrame, perf: g.performance };
  let frame = 0, clock = 0;
  g.requestAnimationFrame = cb => setTimeout(() => { frame++; clock += 16; cb(clock); }, 1);
  Object.defineProperty(g, 'performance', { value: { now: () => clock }, configurable: true, writable: true });
  return {
    frame: () => frame,
    evaluate: (fn, arg) => Promise.resolve(fn(arg)),
    restore() { g.requestAnimationFrame = saved.raf; Object.defineProperty(g, 'performance', { value: saved.perf, configurable: true, writable: true }); },
  };
}

test('rafs resolves after exactly n frames', async () => {
  const p = fakePage();
  try { await rafs(p, 5); assert.equal(p.frame(), 5); } finally { p.restore(); }
});

test('stable answers once the value has held for the asked frames, and reports it parsed', async () => {
  const p = fakePage();
  try {
    globalThis.__k = 0;
    globalThis.__box = { get v() { return { n: Math.min(++globalThis.__k, 4) }; } };
    const r = await stable(p, () => globalThis.__box.v, { frames: 3 });
    assert.deepEqual(r, { ok: true, value: { n: 4 } });
    assert.ok(p.frame() >= 7, `it saw 4 change, then held for 3 more (${p.frame()} frames)`);
  } finally { delete globalThis.__box; delete globalThis.__k; p.restore(); }
});

test('stable times out, not ok, with the last reading, when the value keeps moving (it can fail)', async () => {
  const p = fakePage();
  try {
    globalThis.__n = 0;
    const r = await stable(p, () => ++globalThis.__n, { frames: 3, ms: 200 });
    assert.equal(r.ok, false);
    assert.ok(r.value > 5);
  } finally { delete globalThis.__n; p.restore(); }
});

test('stable with `not` refuses a settled value equal to the old signature, and takes the new one', async () => {
  const p = fakePage();
  try {
    globalThis.__w = 100;
    const before = await signature(p, () => globalThis.__w);
    assert.equal((await stable(p, () => globalThis.__w, { frames: 2, ms: 100, not: before })).ok, false, 'nothing changed: not ok');
    setTimeout(() => { globalThis.__w = 200; }, 30);
    assert.deepEqual(await stable(p, () => globalThis.__w, { frames: 2, ms: 2000, not: before }), { ok: true, value: 200 });
  } finally { delete globalThis.__w; p.restore(); }
});

test('stable reports a probe that throws as not ok, with the message, and passes arg through', async () => {
  const p = fakePage();
  try {
    const r = await stable(p, () => { throw new Error('boom'); }, { frames: 2, ms: 100 });
    assert.equal(r.ok, false, 'a probe that throws for ever is not settled');
    assert.match(r.value, /boom/);
    assert.deepEqual((await stable(p, a => a * 2, { arg: 21, frames: 2 })).value, 42);
  } finally { p.restore(); }
});

test('pollUntil returns the first truthy answer, and times out with the last falsy one', { timeout: 5000 }, async () => {
  let n = 0;
  assert.deepEqual(await pollUntil(() => (++n >= 3 ? 'yes' : 0), { every: 1 }), { ok: true, value: 'yes' });
  let t = 0;
  const r = await pollUntil(() => null, { ms: 100, every: 10, now: () => t, sleep: async d => { t += d; } });
  assert.deepEqual(r, { ok: false, value: null });
  assert.equal(t, 100);
});

/** Run TIMERS_SCRIPT against a fake window whose timers are Node's, as the browser would before any page script. */
function windowWithTimers() {
  const win = { setTimeout: (...a) => setTimeout(...a), clearTimeout: id => clearTimeout(id) };
  new Function('window', TIMERS_SCRIPT)(win);
  return win;
}

test('TIMERS_SCRIPT counts short timers until they fire or are cleared, and ignores long ones', async () => {
  const win = windowWithTimers();
  assert.equal(win.__timers.pending, 0);
  const a = win.setTimeout(() => {}, 20), b = win.setTimeout(() => {}, 5000), c = win.setTimeout(() => {}, 1000);
  assert.equal(win.__timers.pending, 2, 'the 5 s one is not counted');
  win.clearTimeout(c);
  assert.equal(win.__timers.pending, 1);
  await new Promise(r => setTimeout(r, 60));
  assert.equal(win.__timers.pending, 0, 'it fired');
  win.clearTimeout(b); win.clearTimeout(a);
  assert.throws(() => Object.defineProperty(win, '__timers', { value: 1 }), 'the counter cannot be redefined');
});

test('stable with timers does not count a frame while a timer is pending, and says so when the script is missing (it can fail)', async () => {
  const p = fakePage();
  try {
    globalThis.window = windowWithTimers();
    globalThis.window.setTimeout(() => {}, 80); // pending for about five fake frames
    const t0 = Date.now();
    const r = await stable(p, () => 1, { frames: 3, timers: true, ms: 5000 });
    assert.equal(r.ok, true);
    assert.ok(Date.now() - t0 >= 75, 'it waited out the timer');
    globalThis.window = {}; // a page without the script
    const missing = await stable(p, () => 1, { frames: 2, timers: true, ms: 100 });
    assert.equal(missing.ok, false);
    assert.match(missing.value, /TIMERS_SCRIPT/);
  } finally { delete globalThis.window; p.restore(); }
});
