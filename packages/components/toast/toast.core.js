// Toast: the pure core. Timing, the queue, and the words. Runs in Node.
//
// WCAG 2.2.1 (timing adjustable) shapes the rules here:
//   - how long a toast stays is set by how long it takes to read, never less than 5 s;
//   - errors and toasts with an action never time out, the person dismisses them;
//   - a page can turn timeouts off altogether (duration="0" on the region);
//   - the clock stops while the region is hovered, focused or the tab is hidden.

export const TONES = ['info', 'success', 'warning', 'error'];

/** Every string a person reads or hears. Kathakar edits these. */
export const STRINGS = {
  dismiss: 'Dismiss',
  dismissNamed: text => `Dismiss: ${text}`,
  region: 'Notifications',
  waiting: n => (n === 1 ? '1 more waiting' : `${n} more waiting`),
  // spoken before the message, so the tone is never carried by colour or icon alone
  prefix: { info: '', success: '', warning: 'Warning: ', error: 'Error: ' },
};

export const TIMING = {
  minMs: 5000,
  maxMs: 20000,
  // time to notice the toast, then a slow reading pace: 180 words a minute
  noticeMs: 2000,
  perWordMs: 333,
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const words = text => (String(text ?? '').trim().match(/\S+/g) || []).length;

/** How long a message takes to read, in ms, rounded up to 100 ms and held between min and max. */
export function readingTime(text, t = TIMING) {
  const ms = t.noticeMs + words(text) * t.perWordMs;
  return clamp(Math.ceil(ms / 100) * 100, t.minMs, t.maxMs);
}

/** Only known tones; anything else is info. */
export const normalizeTone = tone => (TONES.includes(tone) ? tone : 'info');

/**
 * How long this toast stays, in ms; 0 means until dismissed.
 * @param {{ tone?: string, text?: string, duration?: number|null, hasAction?: boolean, regionDuration?: number|null }} o
 */
export function durationFor({ tone, text = '', duration = null, hasAction = false, regionDuration = null } = {}) {
  if (regionDuration === 0) return 0; // the page (or the person's setting) turned timeouts off
  if (normalizeTone(tone) === 'error' || hasAction) return 0;
  if (duration != null && Number.isFinite(duration)) return duration <= 0 ? 0 : Math.max(duration, TIMING.minMs);
  const base = readingTime(text);
  return regionDuration != null && regionDuration > 0 ? Math.max(base, regionDuration) : base;
}

/** Title and message as one sentence run: a full stop between them unless the title already ends in punctuation. */
export function joinTitle(title, message) {
  const t = String(title ?? '').replace(/\s+/g, ' ').trim(), m = String(message ?? '').replace(/\s+/g, ' ').trim();
  if (!t || !m) return t || m;
  return /[.!?:;…]$/.test(t) ? `${t} ${m}` : `${t}. ${m}`;
}

/** What a screen reader hears: the tone, then the text, with whitespace tidied. */
export function announcement(tone, text) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t ? `${STRINGS.prefix[normalizeTone(tone)]}${t}` : '';
}

/** Which live region carries it: errors interrupt, everything else waits its turn. */
export const liveRole = tone => (normalizeTone(tone) === 'error' ? 'alert' : 'status');

/**
 * The queue. Toasts arrive in order; the first `max` are shown and the rest
 * wait, so nothing is lost and nothing is shown for less than its full time.
 * Only shown toasts spend time, and none do while the queue is paused. When
 * the shown toasts are piled (`front: true`), only the one in front, the
 * newest, spends time: the ones behind it cannot be read yet.
 */
export function createQueue({ max = 3, front = false } = {}) {
  /** @type {{ id: string, duration: number, remaining: number }[]} */
  const items = [];
  let paused = false;
  const shown = () => items.slice(0, Math.max(1, max));
  const timed = () => (front ? shown().slice(-1) : shown());
  return {
    get front() { return front; },
    set front(v) { front = !!v; },
    get max() { return max; },
    set max(n) { max = Math.max(1, n | 0); },
    get paused() { return paused; },
    get size() { return items.length; },
    add(id, duration) {
      if (items.some(i => i.id === id)) return;
      items.push({ id, duration, remaining: duration });
    },
    remove(id) {
      const i = items.findIndex(x => x.id === id);
      if (i >= 0) items.splice(i, 1);
      return i >= 0;
    },
    /** ids currently on screen, oldest first */
    visible: () => shown().map(i => i.id),
    /** how many are waiting behind the visible ones */
    waiting: () => Math.max(0, items.length - shown().length),
    has: id => items.some(i => i.id === id),
    remaining: id => items.find(i => i.id === id)?.remaining ?? null,
    pause() { paused = true; },
    resume() { paused = false; },
    /** Spend dt ms on every shown, timed toast; returns the ids whose time ran out, oldest first. */
    tick(dt) {
      if (paused || !(dt > 0)) return [];
      const out = [];
      for (const i of timed()) {
        if (i.duration <= 0) continue;
        i.remaining = Math.max(0, i.remaining - dt);
        if (i.remaining === 0) out.push(i.id);
      }
      out.forEach(id => this.remove(id));
      return out;
    },
    /** ms until the next shown toast runs out, or null when none is timed (or the queue is paused) */
    nextDue() {
      if (paused) return null;
      const t = timed().filter(i => i.duration > 0).map(i => i.remaining);
      return t.length ? Math.min(...t) : null;
    },
  };
}

/** Parse a hotkey such as "Alt+T" into a matcher for KeyboardEvent-like objects; "none" gives null. */
export function parseHotkey(spec) {
  const s = String(spec ?? '').trim();
  if (!s || s.toLowerCase() === 'none') return null;
  const parts = s.split('+').map(p => p.trim().toLowerCase()).filter(Boolean);
  const key = parts.pop();
  const need = { alt: parts.includes('alt'), ctrl: parts.includes('ctrl'), shift: parts.includes('shift'), meta: parts.includes('meta') };
  // match on e.code where we can, so Option+T on a Mac (which types a dagger) still works
  const code = /^[a-z]$/.test(key) ? `Key${key.toUpperCase()}` : /^[0-9]$/.test(key) ? `Digit${key}` : null;
  return e => !!e && e.altKey === need.alt && e.ctrlKey === need.ctrl && e.shiftKey === need.shift && e.metaKey === need.meta &&
    (code ? e.code === code : String(e.key).toLowerCase() === key);
}

/** A postmark's date line, e.g. "24 SEP 14:32", from a Date. Pure given the date. */
export function postmarkText(date, locale = 'en-IN') {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  const mon = d.toLocaleString(locale, { month: 'short' }).replace('.', '').slice(0, 3).toUpperCase();
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${mon} ${hh}:${mm}`;
}
