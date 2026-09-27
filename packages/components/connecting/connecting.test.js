import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSwarm, advance, order, flash, lights, still, textFor, normState, COUPLING, STATES, STRINGS } from './connecting.core.js';

const run = (sw, seconds, state) => { for (let t = 0; t < seconds; t += 0.25) advance(sw, 0.25, state); return sw; };

test('deterministic for a seed, whatever the frame rate', () => {
  const a = createSwarm(4, 9), b = createSwarm(4, 9);
  for (let i = 0; i < 300; i++) advance(a, 1 / 60, 'connected');
  for (let i = 0; i < 100; i++) advance(b, 0.05, 'connected');
  assert.deepEqual(a.phase.map(p => p.toFixed(9)), b.phase.map(p => p.toFixed(9)));
  assert.notDeepEqual(createSwarm(5, 9).phase, a.phase);
});

test('only connected couples: the others push apart', () => {
  assert.ok(COUPLING.connected > 0);
  for (const s of STATES.filter(s => s !== 'connected')) assert.ok(COUPLING[s] <= 0, s);
});

test('connected: the swarm falls into sync within four seconds', () => {
  for (const seed of [1, 2, 3, 7, 11, 23]) for (const n of [7, 14]) {
    const sw = run(createSwarm(seed, n), 4, 'connected');
    assert.ok(order(sw.phase) > 0.95, `seed ${seed} n ${n}: r = ${order(sw.phase)}`);
  }
});

test('connecting and offline never look in sync, even straight after being connected', () => {
  for (const state of ['connecting', 'offline']) for (const seed of [1, 2, 3, 7, 11, 23]) {
    const sw = run(createSwarm(seed, 7), 6, 'connected');
    assert.ok(order(sw.phase) > 0.95);
    run(sw, 3, state);
    // from here on, sampled every quarter second for a minute, they stay out of step
    for (let t = 0; t < 60; t += 0.25) {
      advance(sw, 0.25, state);
      assert.ok(order(sw.phase) < 0.5, `${state} seed ${seed} at ${t}s: r = ${order(sw.phase)}`);
    }
  }
});

test('flash rises to 1 at the flash and fades; lights stay in the field', () => {
  assert.ok(Math.abs(flash(0) - 1) < 1e-9);
  assert.ok(flash(1) < flash(0.2) && flash(3) < flash(1));
  assert.ok(flash(Math.PI * 2 - 0.1) > flash(Math.PI * 2 - 0.3));
  const sw = run(createSwarm(3, 12, { W: 104, H: 28 }), 10, 'connecting');
  for (const l of lights(sw, 'connecting')) {
    assert.ok(l.x > 0 && l.x < 104 && l.y > 0 && l.y < 28, `${l.x},${l.y}`);
    assert.ok(l.glow >= 0 && l.glow <= 1);
  }
});

test('offline is dim; the still shows the state', () => {
  const sw = createSwarm(2, 7);
  assert.ok(Math.max(...lights(sw, 'offline').map(l => l.glow)) <= 0.3);
  const on = still(sw, 'connected').map(l => l.glow);
  assert.ok(Math.min(...on) > 0.8, 'connected still: all lit together');
  const scatter = still(sw, 'connecting').map(l => l.glow);
  assert.ok(Math.max(...scatter) - Math.min(...scatter) > 0.5, 'connecting still: a mix of bright and dim');
  assert.ok(Math.max(...still(sw, 'offline').map(l => l.glow)) <= 0.3);
});

test('the state is always in words', () => {
  for (const reg of Object.keys(STRINGS)) for (const s of STATES) assert.ok(textFor(s, reg).length > 0);
  assert.equal(textFor('connected', 'warm', 'Live updates'), 'Live updates: connected');
  assert.equal(normState('nonsense'), 'connecting');
  for (const words of Object.values(STRINGS)) for (const w of Object.values(words)) assert.ok(!w.includes(String.fromCharCode(0x2014)));
});

test('connecting again after being connected says reconnecting', () => {
  assert.equal(textFor('connecting', 'warm', '', true), 'Reconnecting');
  assert.equal(textFor('connecting', 'warm', 'Connection', true), 'Connection: reconnecting');
  assert.equal(textFor('connecting', 'quiet'), 'Connecting', 'the first time it is plain connecting');
  for (const s of ['connected', 'offline']) assert.equal(textFor(s, 'warm', '', true), textFor(s, 'warm'), `${s} is unchanged`);
});
