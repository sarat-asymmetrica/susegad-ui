// The agenda recipe: sessions across one or two days, with "now on stage" worked out from the
// Indian clock. The page is plain HTML that reads in full without JavaScript (every time is
// written out, in IST). With JavaScript this file adds three things, in words:
//
//   Now on stage, until 11:15 am     a session that is on
//   Next, at 2 pm                    the soonest session still to come
//   Finished                         read by a screen reader; the look just goes quiet
//
// and one calm status line at the top ("Between sessions. Next, at 2 pm."). It checks the
// clock once a minute. It never moves focus, never replaces a node, and says nothing aloud:
// the status line is ordinary text, not a live region, so a reader meets it only when they
// get to it. (announce() from core/announce.js is for a change someone just caused, such as
// a total; here nobody pressed anything, so it stays out of it.)
//
// Why this is not built on <sg-event-list>: that list puts what has finished into a closed
// "Before" drawer, and its cards say "Booking is closed" once they are over. An agenda keeps
// the morning on the page, readable, so someone arriving at lunch can see what they missed.
// The clock work (IST, days, words) is core/intl.core.js, the same code the cards use.

import { IST, parseWhen, clock, daysFrom, formatDate } from '../../core/intl.core.js';
import { strings, langOf, langOfKey, sameLanguage } from '../../core/strings.js';
import { BY_LANG } from './recipe.strings.js';

export const STRINGS = BY_LANG.en; // the English table, for Node and for anyone who wants the words

const MINUTE = 60000;

// ── the pure core: runs in Node, no DOM ─────────────────────────────────

/** 'upcoming' | 'now' | 'past' | 'unknown'. The start is inclusive and the end is not. */
export function phaseOf(now, { start, end }) {
  if (!Number.isFinite(now) || !Number.isFinite(start)) return 'unknown';
  if (Number.isFinite(end) && end > start) return now >= end ? 'past' : now >= start ? 'now' : 'upcoming';
  return now >= start ? 'past' : 'upcoming'; // no end written: over the moment it starts, never "on stage"
}

/** Which table key says when a coming session starts: 'at' (today), 'tomorrowAt' or 'onDayAt'. */
export const whenKey = (now, start, zone = IST) => { const n = daysFrom(now, start, zone); return n === 0 ? 'at' : n === 1 ? 'tomorrowAt' : 'onDayAt'; };

/** "at 2 pm", "tomorrow at 10 am", "Sun 15 Nov at 10 am": when a coming session starts, as a person would say it. */
export function whenWords(now, start, zone = IST, S = STRINGS) {
  const key = whenKey(now, start, zone);
  return key === 'onDayAt' ? S.onDayAt(formatDate(start, zone), clock(start, zone)) : S[key](clock(start, zone));
}

/**
 * What the agenda says at `now`.
 * @param {{ id: string, start: number, end?: number, kind?: string }[]} sessions in any order; parallel ones are fine.
 *   A break (kind "break": tea, lunch) is on the page and says "On now" while it is, but it is never
 *   "on stage" or "Next", and the status line does not count it: nobody is speaking.
 * @param {number} now milliseconds since 1970 (the instant; the machine's own zone does not matter)
 * @param {string} [zone]
 * @param {object} [S] the words (strings(BY_LANG, lang)); English by default
 * @returns {{ overall: 'empty'|'before'|'on'|'between'|'after', status: string, statusKeys: string[], items: { id, phase, label, hidden, keys }[] }}
 *   `keys` are the table keys each text was made from, so the page can mark any that fell back to English
 */
export function agendaState(sessions, now, zone = IST, S = STRINGS) {
  const rows = sessions.map(s => ({ ...s, phase: phaseOf(now, s) }));
  const known = rows.filter(r => r.phase !== 'unknown' && r.kind !== 'break');
  const coming = known.filter(r => r.phase === 'upcoming');
  const on = known.filter(r => r.phase === 'now');
  const nextAt = Math.min(Infinity, ...coming.map(r => r.start));
  // "Next" is only said when it is today or tomorrow: a week out, "Next, at 9 am" would mislead.
  const nextIsNear = Number.isFinite(nextAt) && daysFrom(now, nextAt, zone) <= 1;

  const items = rows.map(r => {
    let label = '', hidden = '', keys = [];
    const until = Number.isFinite(r.end) ? clock(r.end, zone) : '';
    if (r.phase === 'now') { const k = r.kind === 'break' ? 'breakNow' : 'now'; label = S[k](until); keys = [k]; }
    else if (r.phase === 'upcoming' && r.kind !== 'break' && nextIsNear && r.start === nextAt) { label = S.next(whenWords(now, r.start, zone, S)); keys = ['next', whenKey(now, r.start, zone)]; }
    else if (r.phase === 'past') { hidden = S.finished; keys = ['finished']; }
    return { id: r.id, phase: r.phase, label, hidden, keys };
  });

  const nextWords = nextIsNear ? ` ${S.next(whenWords(now, nextAt, zone, S))}.` : '';
  const nextKeys = nextIsNear ? ['next', whenKey(now, nextAt, zone)] : [];
  let overall, status, statusKeys = [];
  if (!known.length) { overall = 'empty'; status = ''; }
  else if (on.length) { overall = 'on'; status = S.on(on.length) + nextWords; statusKeys = ['on', ...nextKeys]; }
  else if (!coming.length) { overall = 'after'; status = S.after; statusKeys = ['after']; }
  else if (coming.length === known.length) { overall = 'before'; status = S.before(formatDate(nextAt, zone), clock(nextAt, zone)); statusKeys = ['before']; }
  else { overall = 'between'; status = S.between + nextWords; statusKeys = ['between', ...nextKeys]; }
  return { overall, status, statusKeys, items };
}

/**
 * Sessions read from the page: each <li class="sg-session">. The times come from the two
 * <time datetime="2026-11-14T10:30:00+05:30"> in its .sg-session-time (the start, then the end), so a
 * session's time is written once for the machine and once for the eye, not three times. A session
 * may still carry data-start and data-end instead, which win if present (the older way).
 */
export function sessionsOf(root, zone = IST) {
  return [...root.querySelectorAll('.sg-session')].map((el, i) => {
    const [a, b] = [...el.querySelectorAll('.sg-session-time time')].map(t => t.getAttribute('datetime'));
    return {
      el, id: el.id || `session-${i}`,
      start: parseWhen(el.dataset.start ?? a, zone), end: parseWhen(el.dataset.end ?? b, zone), kind: el.dataset.kind ?? '',
    };
  });
}

// ── the wiring ──────────────────────────────────────────────────────────

/**
 * Wire an agenda.
 * @param {HTMLElement} root the .sg-agenda element
 * @param {{ now?: () => number, zone?: string, tick?: boolean }} [o]
 *   now: the clock (tests and ?now= demos pass a fixed one); tick: false never sets the timer
 */
export function mountAgenda(root, { now = () => Date.now(), zone = IST, tick = true } = {}) {
  const sessions = sessionsOf(root, zone);
  if (!sessions.length) { console.warn('sg-agenda: no .sg-session elements with data-start were found.'); return null; }
  const doc = root.ownerDocument;

  // one status line, made once, ordinary text: not role=status, not aria-live
  let line = root.querySelector('.sg-agenda-status');
  if (!line) {
    line = doc.createElement('p');
    line.className = 'sg-agenda-status';
    (root.querySelector('.sg-agenda-zone') ?? root.firstElementChild).after(line);
  }
  // each session gets one state element, made once, first in the <li> so it is read before the title
  const slots = new Map(sessions.map(s => {
    let el = s.el.querySelector('.sg-session-state');
    if (!el) { el = doc.createElement('p'); el.className = 'sg-session-state'; s.el.prepend(el); }
    return [s.id, el];
  }));

  // The words follow the page's language (the nearest lang). A text made from a key the language's table
  // does not have yet is English, so it says lang="en": a screen reader then reads it in English's voice.
  const wordsFor = () => { const lang = langOf(root); return { lang, S: strings(BY_LANG, lang) }; };
  const markEnglish = (el, keys, lang) => {
    if (!sameLanguage(lang, 'en') && keys.some(k => langOfKey(BY_LANG, lang, k) === 'en')) el.setAttribute('lang', 'en'); else el.removeAttribute('lang');
  };

  let last = '', timer = 0;
  const refresh = () => {
    const { lang, S } = wordsFor();
    const state = agendaState(sessions, now(), zone, S);
    const key = JSON.stringify([lang, state.status, state.items.map(i => [i.phase, i.label])]);
    if (key === last) return state; // nothing moved this minute: touch nothing
    last = key;
    root.dataset.state = state.overall;
    line.textContent = state.status;
    line.hidden = !state.status;
    markEnglish(line, state.statusKeys, lang);
    state.items.forEach((item, i) => {
      const { el } = sessions[i], slot = slots.get(item.id);
      el.dataset.phase = item.phase;
      if (item.phase === 'now') el.setAttribute('aria-current', 'time'); else el.removeAttribute('aria-current');
      slot.textContent = item.label || item.hidden;
      slot.hidden = !slot.textContent;
      markEnglish(slot, item.keys, lang);
      slot.classList.toggle('sg-visually-hidden', !item.label && !!item.hidden);
    });
    root.dispatchEvent(new CustomEvent('sg-agenda-change', { bubbles: true, detail: { overall: state.overall, now: state.items.filter(x => x.phase === 'now').map(x => x.id) } }));
    return state;
  };

  // a calm timer: wake just after each minute turns, only while the tab is showing
  const arm = () => {
    clearTimeout(timer); timer = 0;
    if (!tick || doc.visibilityState === 'hidden') return;
    timer = setTimeout(() => { refresh(); arm(); }, MINUTE - (Date.now() % MINUTE) + 50);
  };
  const onVisible = () => { if (doc.visibilityState === 'visible') refresh(); arm(); };
  if (tick) doc.addEventListener('visibilitychange', onVisible);
  refresh(); arm();

  return {
    refresh,
    get state() { return agendaState(sessions, now(), zone, wordsFor().S); },
    stop() { clearTimeout(timer); timer = 0; doc.removeEventListener('visibilitychange', onVisible); },
  };
}
