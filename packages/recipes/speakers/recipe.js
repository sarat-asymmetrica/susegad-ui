// The speakers recipe: a grid of <sg-person-card>s for an event's speakers, after the
// member-directory recipe. Each card gives a name, a role and organisation, one line on the
// talk, and the talk's title as a link to its slot in the agenda. Optionally a row of track
// checkboxes narrows the grid, and the choice lives in the address (?track=AI%20for%20Kids)
// so a filtered view can be shared. Without JavaScript every speaker shows and the links work.
//
// No photo: a speaker without one gets a small marigold in the card's round disc, grown from
// their name (the same name always grows the same flower), as decoration: the name is already the
// card's text. A person gives a photo only with their consent recorded, and then you write an
// img.sg-person-photo into their card yourself (see person-card's docs); the disc, and so the
// bloom, steps aside. With JavaScript off there is no disc at all, only the name and the words.

import '../../components/check/check.js';
import '../../components/person-card/person-card.js';
import '../../components/bloom/bloom.js';
import { filterPeople, personOf } from '../../components/person-card/person.core.js';
import { strings, langOf, langOfKey, sameLanguage } from '../../core/strings.js';
import { BY_LANG } from './recipe.strings.js';

export const STRINGS = BY_LANG.en; // the English table

// ── the shareable filter state: just the tracks ─────────────────────────

/** The ticked tracks, from a query string. */
export const tracksOf = params => (params.get('track') ?? '').split(',').map(t => t.trim()).filter(Boolean);

/** The same tracks as a query string; nothing ticked is an empty one. */
export function tracksToQuery(tracks) {
  const p = new URLSearchParams();
  if (tracks?.length) p.set('track', [...tracks].join(','));
  return p;
}

/**
 * The address with the ticked tracks set, and nothing else touched: the page's other parameters
 * (?register, ?lang, ?utm_source) and its #hash stay as they are. No tracks removes ?track.
 */
export function urlWithTracks(href, tracks) {
  const next = new URL(href);
  if (tracks?.length) next.searchParams.set('track', [...tracks].join(','));
  else next.searchParams.delete('track');
  return next.href;
}

/** Which of these speakers show for the ticked tracks? Nothing ticked means everyone. */
export const visibleFor = (people, tracks) => filterPeople(people, { q: '', tracks });

/**
 * The default avatar: a zendu grown from the speaker's name. It has no label and no words, so the
 * bloom is decoration and hidden from assistive technology, which is right inside an aria-hidden disc.
 */
export function bloomAvatar(card, { name }) {
  const bloom = card.ownerDocument.createElement('sg-bloom');
  bloom.setAttribute('kind', 'zendu');
  bloom.setAttribute('seed-from', name);
  bloom.setAttribute('size', '2.75rem'); // the disc is 3rem across
  return bloom;
}

/**
 * Wire a speakers grid.
 * @param {HTMLElement} root the element holding the (optional) track checkboxes and the cards
 * @param {{
 *   url?: URL,
 *   avatar?: (card: HTMLElement, who: { name: string, seed: string }) => Node | null
 * }} [o]
 *   url: the address to read and write (tests pass their own).
 *   avatar: called once per card; a returned node is put in the card's round disc in place of
 *   the initials (the disc is aria-hidden, so it must be decoration; the name is already text).
 *   The default is bloomAvatar. Pass your own function for another drawing, a function that
 *   returns null per card to keep the initials, or avatar: null to keep initials everywhere.
 */
export function mountSpeakers(root, { url = new URL(location.href), avatar = bloomAvatar } = {}) {
  const cards = [...root.querySelectorAll('sg-person-card')];
  const boxes = [...root.querySelectorAll('input[name=track]')];
  const status = root.querySelector('.sg-speakers-count');
  const empty = root.querySelector('.sg-speakers-empty');
  if (!cards.length) { console.warn('sg-speakers: at least one sg-person-card is needed.'); return null; }
  const people = cards.map(personOf);

  if (avatar) {
    cards.forEach(card => {
      const who = { name: card.name ?? '', seed: card.getAttribute('seed') || card.name || '' };
      const node = avatar(card, who);
      const disc = card.querySelector('.sg-person-initials');
      if (node && disc) { disc.replaceChildren(node); card.dataset.avatar = node.localName === 'sg-bloom' ? 'bloom' : 'custom'; }
    });
  }

  const apply = (write = true) => {
    const tracks = boxes.filter(b => b.checked).map(b => b.value);
    const show = visibleFor(people, tracks);
    cards.forEach((c, i) => { c.closest('li').hidden = !show[i]; });
    const n = show.filter(Boolean).length;
    // the words follow the page's language; a text from a key that language lacks is English and says lang="en"
    const lang = langOf(root), S = strings(BY_LANG, lang);
    const mark = (el, key) => { if (!sameLanguage(lang, 'en') && langOfKey(BY_LANG, lang, key) === 'en') el.setAttribute('lang', 'en'); else el.removeAttribute('lang'); };
    if (status) { status.textContent = S.shown(n); mark(status, 'shown'); }
    if (empty) {
      empty.hidden = n > 0;
      const p = empty.querySelector('p');
      if (p && !p.textContent.trim()) { p.textContent = S.empty; mark(p, 'empty'); } // the page left it blank: the recipe's words
    }
    if (write) {
      history.replaceState(null, '', urlWithTracks(location.href, tracks)); // from where the page is now, not from where it mounted
    }
    return n;
  };

  root.querySelector('form')?.addEventListener('submit', e => e.preventDefault()); // Enter in a checkbox row must not reload the page
  for (const b of boxes) b.addEventListener('change', () => apply(true));
  const initial = tracksOf(url.searchParams);
  for (const b of boxes) b.checked = initial.includes(b.value);
  apply(false);

  return { get count() { return cards.filter(c => !c.closest('li').hidden).length; } };
}
