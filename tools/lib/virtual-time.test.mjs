import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { HOLD_SCRIPT, VIRTUAL_FRAMES, hashPixels } from './virtual-time.mjs';

const channels = [];
after(() => { for (const c of channels) { c.port1.close(); c.port2.close(); } }); // an open port keeps the process alive

/** Run an init script against a fake window, as the browser would before any page script. */
function pageWith(script, extra = {}) {
  const real = []; // callbacks the "real" requestAnimationFrame was given
  const thrown = []; // what the script rethrows from a failing callback (in a page: an uncaught error event)
  class Channel extends MessageChannel { constructor() { super(); channels.push(this); } }
  const win = {
    requestAnimationFrame: cb => real.push(cb),
    cancelAnimationFrame: () => {},
    ...extra,
  };
  win.window = win;
  new Function('window', 'MessageChannel', 'setTimeout', script)(win, Channel, fn => { try { fn(); } catch (e) { thrown.push(e); } });
  return { win, real, thrown };
}

test('not held, requestAnimationFrame goes to the real one and step refuses', async () => {
  const { win, real } = pageWith(HOLD_SCRIPT);
  win.requestAnimationFrame(() => {});
  assert.equal(real.length, 1);
  assert.equal(win.__tools.held, false);
  await assert.rejects(() => win.__tools.step(1), /hold/);
});

test('held, callbacks queue and each step runs them once with a timestamp 1/60 s later', async () => {
  const { win, real } = pageWith(HOLD_SCRIPT);
  win.__tools.hold();
  const seen = [];
  const loop = ts => { seen.push(ts); win.requestAnimationFrame(loop); };
  win.requestAnimationFrame(loop);
  assert.equal(real.length, 0);
  await win.__tools.step(3);
  assert.equal(seen.length, 3);
  assert.ok(Math.abs(seen[1] - seen[0] - 1000 / 60) < 1e-9);
  assert.ok(Math.abs(seen[2] - seen[1] - 1000 / 60) < 1e-9);
  assert.equal(win.__tools.frames, 3);
});

test('a callback queued during a step waits for the next step', async () => {
  const { win } = pageWith(HOLD_SCRIPT);
  win.__tools.hold();
  let n = 0;
  win.requestAnimationFrame(function again() { n++; win.requestAnimationFrame(again); });
  await win.__tools.step(1);
  assert.equal(n, 1);
});

test('cancelAnimationFrame removes a queued callback', async () => {
  const { win } = pageWith(HOLD_SCRIPT);
  win.__tools.hold();
  let ran = false;
  const id = win.requestAnimationFrame(() => { ran = true; });
  win.cancelAnimationFrame(id);
  await win.__tools.step(1);
  assert.equal(ran, false);
});

test('a step awaits promises and messages queued by a callback', async () => {
  const { win } = pageWith(HOLD_SCRIPT);
  win.__tools.hold();
  let after = false;
  win.requestAnimationFrame(() => { Promise.resolve().then(() => { after = true; }); });
  await win.__tools.step(1);
  assert.equal(after, true);
});

test('release hands the queued callbacks back to the real requestAnimationFrame', () => {
  const { win, real } = pageWith(HOLD_SCRIPT);
  win.__tools.hold();
  win.requestAnimationFrame(() => {});
  win.requestAnimationFrame(() => {});
  win.__tools.release();
  assert.equal(real.length, 2);
  assert.equal(win.__tools.held, false);
});

test('a throwing callback does not stop the others in its frame', async () => {
  const { win, thrown } = pageWith(HOLD_SCRIPT);
  win.__tools.hold();
  let ran = false;
  win.requestAnimationFrame(() => { throw new Error('boom'); });
  win.requestAnimationFrame(() => { ran = true; });
  await win.__tools.step(1);
  assert.equal(ran, true);
  assert.equal(thrown.length, 1);
  assert.match(thrown[0].message, /boom/);
});

test('VIRTUAL_FRAMES is held from the first script and toTime steps until the harness clock reads t', async () => {
  const { win, real } = pageWith(VIRTUAL_FRAMES);
  assert.equal(win.__tools.held, true);
  let vt = 0;
  win.__clock = { get time() { return vt / 1000; } };
  win.requestAnimationFrame(function tick() { vt += 1000 / 60; win.requestAnimationFrame(tick); });
  await win.__fast.toTime(2);
  assert.equal(real.length, 0);
  assert.equal(win.__fast.frames, 120);
  assert.ok(win.__clock.time >= 2 - 1e-6);
  await win.__fast.toTime(1); // already past: no step
  assert.equal(win.__fast.frames, 120);
  await win.__fast.step(5);
  assert.equal(win.__fast.frames, 125);
});

test('hashPixels: the same bytes hash the same, one changed byte does not, and it fits 32 bits', () => {
  const a = { px: Buffer.from([1, 2, 3, 4, 5, 6]) }, b = { px: Buffer.from([1, 2, 3, 4, 5, 6]) }, c = { px: Buffer.from([1, 2, 3, 4, 5, 7]) };
  assert.equal(hashPixels(a), hashPixels(b));
  assert.notEqual(hashPixels(a), hashPixels(c));
  const big = { px: Buffer.alloc(3 * 5000, 255) };
  assert.ok(hashPixels(big) >= 0 && hashPixels(big) < 2 ** 32);
});

test('plantFault serves the scene file with one string replaced, on a route that names the scene folder', async () => {
  const { plantFault } = await import('./virtual-time.mjs');
  const checkUrl = new URL('../../packages/scenes/shet/shet.check.mjs', import.meta.url).href;
  const seen = [];
  const routes = plantFault(checkUrl, (name, ok) => seen.push([name, ok]), ['model.js', 'const held = params.progress != null;', 'const held = false; // $&']);
  assert.equal(routes.length, 1);
  assert.match(routes[0][0], /packages\/scenes\/shet\/model\.js\*$/);
  assert.equal(routes[0][0].includes('\\'), false);
  let served;
  routes[0][1]({ fulfill: o => { served = o; } });
  assert.match(served.body, /const held = false; \/\/ \$&/);
  assert.equal(served.body.includes('params.progress != null;'), false);
  assert.equal(served.contentType, 'text/javascript');
  assert.deepEqual(seen, []);
});

test('plantFault fails the check, and serves the file as it is, when the line has moved', async () => {
  const { plantFault } = await import('./virtual-time.mjs');
  const checkUrl = new URL('../../packages/scenes/shet/shet.check.mjs', import.meta.url).href;
  const seen = [];
  const routes = plantFault(checkUrl, (name, ok) => seen.push([name, ok]), ['model.js', 'this line is not in the file', 'x']);
  assert.equal(seen.length, 1);
  assert.equal(seen[0][1], false);
  let served;
  routes[0][1]({ fulfill: o => { served = o; } });
  assert.match(served.body, /const held = params\.progress/);
});

test('plantFault applies several rows for one file to a single served copy, and one route per file', async () => {
  const { plantFault } = await import('./virtual-time.mjs');
  const checkUrl = new URL('../../packages/scenes/shet/shet.check.mjs', import.meta.url).href;
  const seen = [];
  const routes = plantFault(checkUrl, (name, ok) => seen.push([name, ok]),
    ['model.js', 'const held = params.progress != null;', 'const held = false;'],
    ['render.js', 'function start() {', 'function start() { /* planted */'],
    ['model.js', 'export function', 'export /* second row */ function']);
  assert.equal(routes.length, 2);
  const bodies = {};
  for (const [glob, handler] of routes) handler({ fulfill: o => { bodies[glob.slice(glob.lastIndexOf('/') + 1, -4)] = o.body; } });
  assert.match(bodies.model, /const held = false;/);
  assert.ok(bodies.model.includes('export /* second row */ function'));
  assert.match(bodies.render, /planted/);
  assert.deepEqual(seen, []);
});

test('toFrozen steps to the frame that sets __frozen and no further, and reports a page that never freezes', async () => {
  const { win } = pageWith(VIRTUAL_FRAMES);
  win.requestAnimationFrame(function tick() { if (win.__fast.frames === 7) win.__frozen = true; win.requestAnimationFrame(tick); });
  assert.equal(await win.__fast.toFrozen(3), false);
  assert.equal(win.__fast.frames, 3);
  assert.equal(await win.__fast.toFrozen(100), true);
  assert.equal(win.__fast.frames, 7); // frame 7 sets it, and the step stops there
  assert.equal(await win.__fast.toFrozen(100), true);
  assert.equal(win.__fast.frames, 7);
});

test('toTime throws, rather than looping for ever, on a page with no harness clock', async () => {
  const { win } = pageWith(VIRTUAL_FRAMES);
  await assert.rejects(() => win.__fast.toTime(1), /harness clock/);
});

test('forceQuality serves the governor with a globalThis.__q handle at the sample() entry', async () => {
  const { forceQuality } = await import('./virtual-time.mjs');
  const routes = forceQuality();
  assert.equal(routes.length, 1);
  assert.ok(routes[0][0].endsWith('packages/engine/src/governor.js*'));
  let served;
  routes[0][1]({ fulfill: o => { served = o; } });
  assert.ok(served.body.includes('sample(dt) { if (globalThis.__q) { g.level = globalThis.__q; return g.level; }'));
  assert.equal(served.contentType, 'text/javascript');
});
