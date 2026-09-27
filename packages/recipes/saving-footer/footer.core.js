// The saving footer's state machine and view, pure. The page feeds it the
// person's edits and the transport's events; it answers with the next state
// and the effects to carry out (start a save, show or clear a toast). Nothing
// here moves on a timer of its own, so the footer never runs ahead of the work.

/** Every word the footer shows or says. Kathakar edits these. */
export const STRINGS = {
  fresh: 'No changes yet',
  unsaved: 'Changes not saved yet',
  saving: 'Saving',
  savedAt: time => `Saved at ${time}`,
  notSaved: 'Not saved',
  failed: "Couldn't save. Check your connection and try again.",
  tryAgain: 'Try again',
  recovered: "You're back online. Your changes are saved.",
  saveNow: 'Save now',
  connection: 'Connection',
};

/** "14:32": the 24-hour time a save finished, from the page's clock. */
export function clockTime(ms, timeZone) {
  const d = new Date(ms);
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, ...(timeZone ? { timeZone } : {}) }).format(d);
}

/** How long the connection indicator stays after the link is back, so the fireflies can be seen to agree. */
export const SHOW_CONNECTED_MS = 4000;

export const initial = () => ({
  phase: 'fresh',      // fresh | unsaved | saving | saved | failed
  dirty: false,        // edits the last finished save did not include
  inflight: null,      // the id of the save the transport is carrying
  startedAt: null,     // when that save started
  savedAt: null,       // when the last save finished, on the page's clock
  link: 'up',          // up | down | reconnecting, as the transport reported it
  upAt: null,          // when the link last came back up
  failedOnce: false,   // a failure is showing; a later success says so
});

/**
 * @param {ReturnType<typeof initial>} s
 * @param {{ type: string, at: number, id?: number, state?: string }} e
 * @returns {{ state: ReturnType<typeof initial>, effects: { type: string }[] }}
 */
export function reduce(s, e) {
  const n = { ...s }, fx = [];
  const start = () => { n.inflight = 'starting'; n.startedAt = e.at; n.dirty = false; n.phase = 'saving'; fx.push({ type: 'request' }); };
  switch (e.type) {
    case 'edit':
      n.dirty = true;
      if (n.phase !== 'saving' && n.phase !== 'failed') n.phase = 'unsaved';
      break;
    case 'flush': // the person paused typing, pressed "Save now", or chose "Try again"
      if (n.inflight == null && (n.dirty || n.phase === 'failed')) start();
      break;
    case 'started': // the transport took the save; remember which one
      n.inflight = e.id;
      break;
    case 'saved':
      if (e.id !== n.inflight) break;
      n.inflight = null;
      n.savedAt = e.at;
      if (n.failedOnce) { n.failedOnce = false; fx.push({ type: 'clear-error' }, { type: 'toast-recovered' }); }
      if (n.dirty) { n.phase = 'unsaved'; fx.push({ type: 'schedule-flush' }); } else n.phase = 'saved';
      break;
    case 'failed':
      if (e.id !== n.inflight) break;
      n.inflight = null;
      n.dirty = true;
      n.phase = 'failed';
      if (!n.failedOnce) { n.failedOnce = true; fx.push({ type: 'toast-error' }); }
      // it started before the link came back, so it failed for the old link: try again now
      if (n.link === 'up' && n.upAt != null && n.upAt > n.startedAt) start();
      break;
    case 'link':
      n.link = e.state;
      if (e.state === 'up') {
        n.upAt = e.at;
        // back online with work unsaved: try again by itself, once
        if (n.phase === 'failed' && n.inflight == null) start();
      }
      break;
  }
  return { state: n, effects: fx };
}

/**
 * What the footer shows at `now`: the words for the state, whether the loader
 * is up, and the connection indicator's state (or null to hide it).
 */
export function view(s, now, timeZone) {
  const connection = s.link === 'down' ? 'offline'
    : s.link === 'reconnecting' ? 'connecting'
    : s.upAt != null && now - s.upAt < SHOW_CONNECTED_MS ? 'connected' : null;
  switch (s.phase) {
    case 'saving': return { busy: true, text: STRINGS.saving, tone: 'info', connection };
    // only outcomes are announced; the rest is shown and stays silent
    case 'saved': return { busy: false, text: STRINGS.savedAt(clockTime(s.savedAt, timeZone)), tone: 'success', connection, announce: true };
    case 'failed': return { busy: false, text: STRINGS.notSaved, tone: 'danger', connection, announce: true };
    case 'unsaved': return { busy: false, text: STRINGS.unsaved, tone: 'neutral', connection };
    default: return { busy: false, text: STRINGS.fresh, tone: 'neutral', connection };
  }
}

/**
 * The machine, a transport and the typing pause, joined up. The page calls
 * edit / saveNow / retry / tick with its clock; each returns the footer's view
 * and the toasts to show or clear. Pure given the transport, so tests drive it
 * with a virtual clock.
 * @param {{ transport: { request: Function, poll: Function }, pause?: number, bytes?: () => number, timeZone?: string }} o
 */
export function createSession({ transport, pause = 1200, bytes = () => 0, timeZone } = {}) {
  let s = initial(), flushAt = null;
  const out = { toasts: [] };

  function run(e) {
    const r = reduce(s, e);
    s = r.state;
    for (const fx of r.effects) {
      if (fx.type === 'request') run({ type: 'started', at: e.at, id: transport.request(e.at, bytes()) });
      else if (fx.type === 'schedule-flush') flushAt = e.at + pause;
      else out.toasts.push(fx.type);
    }
  }
  function settle(now) {
    for (const ev of transport.poll(now)) run(ev);
    if (flushAt != null && now >= flushAt) { flushAt = null; run({ type: 'flush', at: now }); for (const ev of transport.poll(now)) run(ev); }
    const toasts = out.toasts.splice(0);
    return { view: view(s, now, timeZone), toasts, state: s };
  }

  return {
    /** The person typed: note it, and save once they pause. */
    edit(now) { run({ type: 'edit', at: now }); flushAt = now + pause; return settle(now); },
    /** "Save now" (or Ctrl+S): save at once if there is anything to save. */
    saveNow(now) { flushAt = null; run({ type: 'flush', at: now }); return settle(now); },
    /** "Try again" from the error toast. */
    retry(now) { run({ type: 'flush', at: now }); return settle(now); },
    /** Let time pass: report whatever the transport has done by now. */
    tick(now) { return settle(now); },
    get state() { return s; },
  };
}
