// A fake upload service: pure and seeded, reporting only what happened. Times are milliseconds on
// the page's own clock. Nothing here touches the DOM or real timers; the page
// asks `poll(now)` what has happened by now.
//
// Each upload is planned when it starts, as a real client would see it: a
// short wait before the first byte, then chunks of bytes at a rate that varies
// (with the odd slow patch), then a pause while the server checks the file,
// then `done`. A file can be made to fail part way through, as a dropped
// connection would.

import { rng } from '../../engine/src/rng.js';

/**
 * @param {{ seed?: number|string, chunk?: number, rate?: [number, number],
 *   latency?: [number, number], check?: [number, number],
 *   fails?: (file: { name: string, size: number }, attempt: number) => number | null }} [o]
 *   rate: bytes per second, low and high. fails: return a fraction (0..1) of the file
 *   at which this attempt drops, or null for an attempt that succeeds.
 */
export function createUploadTransport({
  seed = 1, chunk = 64 * 1024, rate = [260_000, 1_200_000], latency = [120, 420], check = [250, 700],
  fails = () => null,
} = {}) {
  const uploads = new Map();
  const attempts = new Map();
  let nextId = 1;

  /** Start sending `file` at `at`. Returns an id; every event about it carries that id. */
  function start(file, at) {
    const id = nextId++;
    const attempt = (attempts.get(file.name) ?? 0) + 1;
    attempts.set(file.name, attempt);
    const r = rng(`upload:${seed}:${file.name}:${file.size}:${attempt}`);
    const dropAt = fails(file, attempt);
    const events = [];
    let t = at + r.range(latency[0], latency[1]), loaded = 0;
    while (loaded < file.size) {
      const n = Math.min(chunk, file.size - loaded);
      const slow = r.chance(0.08) ? r.range(3, 7) : 1; // the odd slow patch, as on a real network
      t += ((n / r.range(rate[0], rate[1])) * 1000) * slow;
      if (dropAt != null && (loaded + n) / file.size >= dropAt) {
        events.push({ type: 'failed', id, at: Math.round(t), loaded, total: file.size, reason: 'connection' });
        break;
      }
      loaded += n;
      events.push({ type: 'progress', id, at: Math.round(t), loaded, total: file.size });
    }
    if (loaded === file.size) events.push({ type: 'done', id, at: Math.round(t + r.range(check[0], check[1])), loaded, total: file.size });
    uploads.set(id, { id, events, next: 0, cancelled: false });
    return id;
  }

  /** Every event that has happened by `now`, in time order, each delivered once. */
  function poll(now) {
    const out = [];
    for (const u of uploads.values()) {
      if (u.cancelled) continue;
      while (u.next < u.events.length && u.events[u.next].at <= now) out.push(u.events[u.next++]);
    }
    return out.sort((a, b) => a.at - b.at || a.id - b.id);
  }

  /** Stop an upload: nothing more is reported about it. */
  function cancel(id) { const u = uploads.get(id); if (u) u.cancelled = true; }

  /** Is anything still on its way? The page runs its clock only while this is true. */
  const busy = () => [...uploads.values()].some(u => !u.cancelled && u.next < u.events.length);

  /** When the last planned event lands (for tests and for freezing a demo at the end). */
  const settlesAt = () => Math.max(0, ...[...uploads.values()].map(u => u.events.at(-1)?.at ?? 0));

  return { start, poll, cancel, busy, settlesAt };
}
