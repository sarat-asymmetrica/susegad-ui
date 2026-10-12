// Core: the announcer's pure half. Runs in Node, no DOM.
//
// Two decisions live here so they can be tested without a browser:
//   1. Which way a sentence is spoken: document.ariaNotify() where the engine has it,
//      one shared live region where it does not (pickPath).
//   2. How a burst of sentences becomes one: a total that changes three times in a
//      second is read once, as its last value (createCoalescer). Polite sentences
//      replace each other; an assertive one is never replaced by a polite one, and
//      it goes first.

/** 'notify' when the engine can ariaNotify (element or document), else 'region'. */
export const pickPath = (from, doc) => (typeof from?.ariaNotify === 'function' ? 'notify' : typeof doc?.ariaNotify === 'function' ? 'notify' : 'region');

/** polite and assertive are the live-region words; ariaNotify says normal and high. */
export const notifyPriority = priority => (priority === 'assertive' ? 'high' : 'normal');

/**
 * Collects sentences and hands them to `say(text, priority, from)` after a quiet spell.
 * Trailing edge: each new sentence restarts the wait, except that nothing waits longer
 * than `maxWait` since the first of the burst, so a person holding + still hears the total
 * now and then. A polite sentence identical to what was just said within `repeatMs` is dropped, because
 * nothing changed; an assertive one always speaks.
 * @param {{ say: (text: string, priority: 'polite'|'assertive', from?: any) => void,
 *   schedule?: (fn: () => void, ms: number) => any, cancel?: (id: any) => void,
 *   now?: () => number, wait?: number, maxWait?: number, repeatMs?: number }} o
 */
export function createCoalescer({ say, schedule = setTimeout, cancel = clearTimeout, now = Date.now, wait = 250, maxWait = 1000, repeatMs = 2000 }) {
  let pending = { polite: null, assertive: null }, timer = null, started = 0, last = { text: '', at: -Infinity };

  const flush = () => {
    if (timer != null) cancel(timer);
    timer = null;
    const batch = pending;
    pending = { polite: null, assertive: null };
    for (const p of ['assertive', 'polite']) {
      const s = batch[p];
      if (!s) continue;
      // only a polite sentence can be a repeat of nothing new; an assertive one (a retry that failed again) always speaks
      if (p === 'polite' && s.text === last.text && now() - last.at < repeatMs) continue;
      if (p === 'polite') last = { text: s.text, at: now() };
      say(s.text, p, s.from);
    }
  };

  return {
    /** Queue a sentence. Empty text says nothing. */
    push(text, priority = 'polite', from) {
      text = String(text ?? '').trim();
      if (!text) return;
      const p = priority === 'assertive' ? 'assertive' : 'polite';
      pending[p] = { text, from };
      const t = now();
      if (timer == null) started = t;
      else cancel(timer);
      timer = schedule(flush, Math.max(0, Math.min(wait, started + maxWait - t)));
    },
    flush,
    /** Drop what is waiting. */
    clear() { if (timer != null) cancel(timer); timer = null; pending = { polite: null, assertive: null }; },
  };
}
