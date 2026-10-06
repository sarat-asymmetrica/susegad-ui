// The member-directory recipe: a list of <sg-person-card>s, filtered live by a
// text field (the library's <sg-field>) and by track checkboxes, with the
// filter state in the URL's query so a filtered view is shareable, and a kind
// empty state when nothing matches. Pure core in directory.core.js; this file
// is the wiring, built from library parts only.

import '../../components/field/field.js';
import '../../components/check/check.js';
import '../../components/person-card/person-card.js';
import {
  filterPeople, personOf,
} from '../../components/person-card/person.core.js';

export const STRINGS = {
  shown: n => (n === 1 ? 'Showing 1 member' : `Showing ${n} members`),
  empty: 'No one matches that yet. Try a shorter word, or a different track.',
  queryNote: 'This filtered view is in the address; copy it and anyone opening it sees the same members.',
};

// ── the shareable filter state ──────────────────────────────────────────

/** Read the filter from a query string (the page's own, by default). */
export function stateOf(params) {
  const q = String(params.get('q') ?? '');
  const tracks = (params.get('track') ?? '').split(',').map(t => t.trim()).filter(Boolean);
  return { q, tracks };
}

/** The same state as a query string, omitting what is empty. */
export function stateToQuery({ q, tracks }) {
  const p = new URLSearchParams();
  if (q?.trim()) p.set('q', q.trim());
  if (tracks?.length) p.set('track', [...tracks].join(','));
  return p;
}

/**
 * Wire a directory.
 * @param {HTMLElement} root the element holding the field, the checkboxes and the cards
 * @param {{ url?: URL }} [o] a URL to read and write (tests pass their own)
 */
export function mountDirectory(root, { url = new URL(location.href) } = {}) {
  const field = root.querySelector('input[name=q]');
  const boxes = [...root.querySelectorAll('input[name=track]')];
  const cards = [...root.querySelectorAll('sg-person-card')];
  const status = root.querySelector('.sg-directory-count');
  const empty = root.querySelector('.sg-directory-empty');
  const note = root.querySelector('.sg-directory-share');
  if (!field || !cards.length || !status || !empty) {
    console.warn('sg-directory: a text field, at least one card, a count and an empty state are needed.');
    return null;
  }

  const people = cards.map(personOf);

  let last = '';
  const apply = (write = true) => {
    const f = { q: field.value, tracks: boxes.filter(b => b.checked).map(b => b.value) };
    const show = filterPeople(people, f);
    cards.forEach((c, i) => { c.hidden = !show[i]; });
    const n = show.filter(Boolean).length;
    status.textContent = STRINGS.shown(n);
    empty.hidden = n > 0;
    if (note) note.hidden = n >= cards.length;
    const query = stateToQuery(f);
    if (write) {
      const next = new URL(url);
      next.search = `?${query}`;
      history.replaceState(null, '', next);
    }
    const key = query.toString();
    if (key !== last) { last = key; root.dispatchEvent(new CustomEvent('sg-directory-filter', { bubbles: true, detail: stateOf(new URLSearchParams(key)) })); }
    return n;
  };

  const sync = () => apply(true);
  field.addEventListener('input', sync);
  field.closest('form')?.addEventListener('submit', e => e.preventDefault());
  for (const b of boxes) b.addEventListener('change', sync);

  // an incoming ?q and ?track prefill the controls and the view
  const initial = stateOf(url.searchParams);
  field.value = initial.q;
  for (const b of boxes) b.checked = initial.tracks.includes(b.value);
  apply(false);

  return {
    get count() { return cards.filter(c => !c.hidden).length; },
    get state() { return stateOf(new URL(location.href).searchParams); },
  };
}
