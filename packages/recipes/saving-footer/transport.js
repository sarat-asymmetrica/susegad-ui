// A fake network for the saving footer: pure and seeded, reporting only what happened. Times are
// milliseconds on the page's own clock. Nothing here touches the DOM or real
// timers; the page asks `poll(now)` what has happened by now.
//
// The world decides whether the network is there: a seeded list of outages,
// or the demo's switch (`setNetwork(up, at)`). The transport reports what a
// real client would see: saves that finish or fail, and a link that drops,
// then comes back through a reconnect handshake before it is up again.

import { rng } from '../../engine/src/rng.js';

/**
 * @param {{ seed?: number|string, latency?: [number, number], handshake?: [number, number],
 *   failFast?: number, outages?: [number, number][] }} [o]
 */
export function createTransport({ seed = 1, latency = [350, 1300], handshake = [1100, 2200], failFast = 400, outages = [] } = {}) {
  const lat = rng(`saving-latency:${seed}`);
  const spans = outages.map(([a, b]) => [a, b]).sort((x, y) => x[0] - y[0]); // [from, to) the world is down
  const pending = new Map();
  let nextId = 1, polled = -Infinity;

  /** How long the reconnect handshake takes after the world returns at b: seeded by b, so order never matters. */
  const hs = b => Math.round(rng(`saving-handshake:${seed}:${b}`).range(handshake[0], handshake[1]));

  /** The link as the client sees it at t: 'down', 'reconnecting' or 'up'. */
  function linkAt(t) {
    let last = null;
    for (const [a, b] of spans) {
      if (t >= a && t < b) return 'down';
      if (b <= t) last = b;
    }
    return last != null && t < last + hs(last) ? 'reconnecting' : 'up';
  }

  /** Every change of link state, as { at, state }, in time order. */
  function transitions() {
    const out = [];
    spans.forEach(([a, b], i) => {
      out.push({ at: a, state: 'down' });
      if (b === Infinity) return;
      out.push({ at: b, state: 'reconnecting' });
      const up = b + hs(b), next = spans[i + 1];
      if (!next || up < next[0]) out.push({ at: up, state: 'up' });
    });
    return out;
  }

  /** The demo's switch: the world's network goes away or comes back at `at`. */
  function setNetwork(up, at) {
    const open = spans.find(([, b]) => b === Infinity);
    if (!up && !open && linkAt(at) !== 'down') spans.push([at, Infinity]);
    if (up && open) open[1] = Math.max(at, open[0]);
  }

  /** Start a save at `at` carrying `bytes`. Its outcome is only known once poll() reaches it. */
  function request(at, bytes = 0) {
    const id = nextId++;
    pending.set(id, { id, at, bytes, took: Math.round(lat.range(latency[0], latency[1])) });
    return id;
  }

  /** When a save started at s and taking `took` fails, or null if the link held. */
  function failure(s, took) {
    if (linkAt(s) !== 'up') return s + failFast;
    const drop = spans.find(([a]) => a > s && a < s + took);
    return drop ? drop[0] + Math.round(failFast / 2) : null;
  }

  /** Everything that has happened after the last poll and by `now`, in time order. */
  function poll(now) {
    const events = transitions().filter(e => e.at > polled && e.at <= now).map(e => ({ type: 'link', ...e }));
    for (const p of [...pending.values()]) {
      const fail = failure(p.at, p.took);
      if (fail != null && fail <= now) { pending.delete(p.id); events.push({ type: 'failed', id: p.id, at: fail, reason: 'offline' }); }
      else if (fail == null && p.at + p.took <= now) { pending.delete(p.id); events.push({ type: 'saved', id: p.id, at: p.at + p.took, bytes: p.bytes }); }
    }
    polled = now;
    return events.sort((a, b) => a.at - b.at);
  }

  return { request, poll, setNetwork, linkAt, get inFlight() { return pending.size; } };
}
