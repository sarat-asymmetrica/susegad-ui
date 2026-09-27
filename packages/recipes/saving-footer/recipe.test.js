import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransport } from './transport.js';
import { createSession, reduce, initial, view, clockTime, STRINGS, SHOW_CONNECTED_MS } from './footer.core.js';

const T0 = Date.UTC(2026, 8, 24, 9, 0); // 14:30 in India
const IST = 'Asia/Kolkata';

/** Drive a session with a virtual clock, 50 ms a step; returns every view by time. */
function play(session, until, actions = {}) {
  const views = [];
  for (let t = T0; t <= T0 + until; t += 50) {
    for (const act of actions[t - T0] || []) act(t);
    views.push({ t: t - T0, ...session.tick(t) });
  }
  return views;
}

test('the transport is deterministic for a seed', () => {
  const run = seed => {
    const tr = createTransport({ seed, outages: [[T0 + 3000, T0 + 5000]] });
    const ids = [tr.request(T0 + 100), tr.request(T0 + 2600), tr.request(T0 + 5200), tr.request(T0 + 9000)];
    return { ids, events: tr.poll(T0 + 20000) };
  };
  assert.deepEqual(run(4), run(4));
  assert.notDeepEqual(run(4).events, run(5).events);
});

test('a save fails if the link is down when it starts or drops while it is in flight', () => {
  const tr = createTransport({ seed: 1, latency: [1000, 1000], outages: [[T0 + 3000, T0 + 5000]] });
  const ok = tr.request(T0), mid = tr.request(T0 + 2500), dead = tr.request(T0 + 4000), handshake = tr.request(T0 + 5100);
  const ev = tr.poll(T0 + 30000);
  const of = id => ev.find(e => e.id === id);
  assert.equal(of(ok).type, 'saved');
  assert.equal(of(ok).at, T0 + 1000);
  assert.equal(of(mid).type, 'failed');
  assert.ok(of(mid).at >= T0 + 3000, 'it fails when the link drops, not before');
  assert.equal(of(dead).type, 'failed');
  assert.equal(of(handshake).type, 'failed', 'still reconnecting: not up yet');
  const link = ev.filter(e => e.type === 'link').map(e => e.state);
  assert.deepEqual(link, ['down', 'reconnecting', 'up']);
});

test('poll never reports the future', () => {
  const tr = createTransport({ seed: 2, latency: [800, 800] });
  tr.request(T0);
  assert.deepEqual(tr.poll(T0 + 799), []);
  const [e] = tr.poll(T0 + 800);
  assert.equal(e.type, 'saved');
});

test('typing, a pause, then "Saving" until the transport says saved, then the real time', () => {
  const tr = createTransport({ seed: 3, latency: [900, 900] });
  const s = createSession({ transport: tr, pause: 1200, timeZone: IST });
  const views = play(s, 6000, { 0: [t => s.edit(t)], 300: [t => s.edit(t)] });
  const at = ms => views.find(v => v.t === ms).view;
  assert.equal(at(1000).text, STRINGS.unsaved);
  assert.equal(at(1000).busy, false);
  // the pause ends 1200 ms after the last keystroke (300 + 1200 = 1500); the save takes 900 ms
  assert.equal(at(1500).busy, true);
  assert.equal(at(2350).busy, true);
  assert.equal(at(2400).text, 'Saved at 14:30');
  assert.equal(at(2400).busy, false);
  assert.equal(at(2400).tone, 'success');
});

test('the loader is up exactly while the transport carries a save', () => {
  const tr = createTransport({ seed: 9, latency: [300, 1500] });
  const s = createSession({ transport: tr, pause: 600 });
  const acts = {};
  for (let k = 0; k < 40; k++) acts[k * 350] = [t => s.edit(t)];
  const views = play(s, 20000, acts);
  for (const v of views) assert.equal(v.view.busy, tr.inFlight > 0 || v.state.inflight != null, `at ${v.t}`);
  assert.ok(views.some(v => v.view.busy) && views.at(-1).view.tone === 'success');
});

test('offline: the save fails, one error toast, the link shows; back online it retries by itself', () => {
  const tr = createTransport({ seed: 5, latency: [700, 700], handshake: [1500, 1500] });
  const s = createSession({ transport: tr, pause: 500, timeZone: IST });
  const views = play(s, 14000, {
    0: [t => tr.setNetwork(false, t)],
    100: [t => s.edit(t)],
    2000: [t => s.edit(t)],
    6000: [t => tr.setNetwork(true, t)],
  });
  const at = ms => views.find(v => v.t === ms);
  assert.equal(at(1100).view.text, STRINGS.notSaved);
  assert.equal(at(1100).view.tone, 'danger');
  assert.equal(at(1100).view.connection, 'offline');
  const toasts = views.flatMap(v => v.toasts);
  assert.equal(toasts.filter(x => x === 'toast-error').length, 1, 'one error toast, however many tries fail');
  // back: reconnecting for the handshake, then up, then the retry
  assert.equal(at(6500).view.connection, 'connecting');
  assert.equal(at(6500).view.busy, false, 'no save while still reconnecting');
  assert.equal(at(7500).view.busy, true, 'the retry starts once the link is up');
  assert.equal(at(7500).view.connection, 'connected');
  assert.ok(toasts.includes('clear-error') && toasts.includes('toast-recovered'));
  assert.match(at(8500).view.text, /^Saved at \d\d:\d\d$/);
  assert.equal(at(7500 + SHOW_CONNECTED_MS + 100).view.connection, null, 'the indicator goes once the link has been up a while');
});

test('try again while offline fails again without a second toast', () => {
  const tr = createTransport({ seed: 6, latency: [500, 500] });
  const s = createSession({ transport: tr, pause: 300 });
  const views = play(s, 5000, { 0: [t => tr.setNetwork(false, t), t => s.edit(t)], 2000: [t => s.retry(t)] });
  assert.equal(views.flatMap(v => v.toasts).filter(x => x === 'toast-error').length, 1);
  assert.ok(views.some(v => v.t > 2000 && v.view.busy));
  assert.equal(views.at(-1).view.text, STRINGS.notSaved);
});

test('edits during a save are saved next, never lost', () => {
  const tr = createTransport({ seed: 7, latency: [1000, 1000] });
  const s = createSession({ transport: tr, pause: 400 });
  const views = play(s, 6000, { 0: [t => s.edit(t)], 600: [t => s.edit(t)] });
  // first save 400..1400 includes the edit at 0 only; the edit at 600 is saved after it
  assert.equal(views.find(v => v.t === 1400).view.text, STRINGS.unsaved);
  assert.equal(views.at(-1).view.tone, 'success');
  assert.equal(views.at(-1).state.dirty, false);
});

test('the machine ignores stale results and the words are plain', () => {
  const s0 = { ...initial(), inflight: 3, phase: 'saving' };
  assert.equal(reduce(s0, { type: 'saved', id: 2, at: 1 }).state.phase, 'saving');
  assert.equal(clockTime(T0 + 2 * 3600e3 + 125e3, IST), '16:32');
  assert.equal(view(initial(), 0).text, STRINGS.fresh);
  for (const w of Object.values(STRINGS)) {
    const text = typeof w === 'function' ? w('14:32') : w;
    assert.ok(!text.includes(String.fromCharCode(0x2014)));
  }
});

test('a save that was doomed before the link came back is retried once it fails', () => {
  // typing while reconnecting starts a save that fails fast; the link comes up while it is still in flight
  let s = { ...initial(), phase: 'failed', dirty: true, failedOnce: true, link: 'reconnecting' };
  let r = reduce(s, { type: 'flush', at: 1000 });
  assert.deepEqual(r.effects.map(f => f.type), ['request']);
  s = reduce(r.state, { type: 'started', id: 7, at: 1000 }).state;
  r = reduce(s, { type: 'link', state: 'up', at: 1200 });
  assert.deepEqual(r.effects, [], 'a save is in flight, so no second one yet');
  r = reduce(r.state, { type: 'failed', id: 7, at: 1400 });
  assert.deepEqual(r.effects.map(f => f.type), ['request'], 'it failed for the old link: try again now the link is up');
  assert.equal(r.state.phase, 'saving');
  // but a failure while the link was up the whole time is not retried in a loop
  let u = { ...initial(), link: 'up', upAt: 0, dirty: true };
  u = reduce(u, { type: 'flush', at: 5000 }).state;
  u = reduce(u, { type: 'started', id: 8, at: 5000 }).state;
  const f = reduce(u, { type: 'failed', id: 8, at: 5600 });
  assert.equal(f.state.phase, 'failed');
  assert.ok(!f.effects.some(x => x.type === 'request'));
});

test('the race end to end: typing while reconnecting still ends saved', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const tr = createTransport({ seed, latency: [350, 1300], handshake: [1100, 2200] });
    const s = createSession({ transport: tr, pause: 300 });
    const acts = { 0: [t => tr.setNetwork(false, t), t => s.edit(t)], 3000: [t => tr.setNetwork(true, t)] };
    // keep typing through the reconnect, so pause-saves start while the link is not up yet
    for (let k = 0; k < 12; k++) acts[3000 + k * 200] = [...(acts[3000 + k * 200] || []), t => s.edit(t)];
    const views = play(s, 15000, acts);
    assert.equal(views.at(-1).view.tone, 'success', `seed ${seed} ended on "${views.at(-1).view.text}"`);
  }
});

test('only outcomes are announced; typing and saving are shown but silent', () => {
  const at = { ...initial(), savedAt: T0 };
  assert.equal(view({ ...at, phase: 'saved' }, T0, IST).announce, true);
  assert.equal(view({ ...at, phase: 'failed' }, T0, IST).announce, true);
  for (const phase of ['fresh', 'unsaved', 'saving']) assert.ok(!view({ ...at, phase }, T0, IST).announce, phase);
});
