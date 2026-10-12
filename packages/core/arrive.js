// arrive.js: the JavaScript half of the tala stagger. The stagger itself is CSS
// (the "arrivals" block in the stylesheet): an item that has not been seen plays
// its arrival, delayed by its beat on the teental cycle. Three small jobs are
// left to this file:
//
//   - tell the CSS whether this register may move (data-arrive="ambient" or
//     "full" on the host; absent in quiet and under reduced motion);
//   - mark an item data-seen once its arrival has played, or at once when it
//     arrives with no motion, so a re-sort or a re-append never plays it again;
//   - hand each item its delay from arrivalDelay() where sibling-index() is
//     missing, and start a later batch (new rows) again from the first beat.
//
// talaDelay() in tokens.js stays the source of truth; arrive.test.js checks the
// CSS formula against arrivalDelay(). One file, shared by every list that staggers
// (menu, event-list, gallery, data-table); the CSS block stays in each component.

import { talaDelay, tala } from '../tokens/tokens.js';

const SIBLING_INDEX = typeof CSS !== 'undefined' && !!CSS.supports?.('width', 'calc(sibling-index() * 1px)');

/**
 * The delay an arriving item waits, in ms: its beat on the tala while that is within the cap,
 * and the last in-cap beat past it. talaDelay() caps at tala.maxDelayMs, which would park every
 * item past the fifth at the cap and pop them together after it; an item that would wait that
 * long takes the fifth item's beat instead, so the tail lands with the fifth, below the rows
 * that are already down, and no list is ever kept waiting past it.
 * @param {number} index 0-based position among the arriving items
 */
export function arrivalDelay(index) {
  const d = talaDelay(index);
  if (d < tala.maxDelayMs) return d;
  let last = 0;
  for (let i = 0; talaDelay(i) < tala.maxDelayMs; i++) last = talaDelay(i);
  return last;
}

/**
 * @param {HTMLElement & { motion?: string }} host the component element
 * @param {string} selector the arriving items
 */
export function arrive(host, selector) {
  const animates = () => host.motion === 'ambient' || host.motion === 'full';
  const unseen = nodes => nodes.filter(n => n.matches?.(selector) && !n.hasAttribute('data-seen'));
  const mark = nodes => { for (const n of nodes) n.setAttribute('data-seen', ''); };
  const beat = items => items.forEach((n, i) => {
    n.style.setProperty('--sg-arrive-n', String(i));
    if (!SIBLING_INDEX) n.style.setProperty('--sg-arrive-delay', `${arrivalDelay(i)}ms`);
  });
  const mode = () => {
    if (animates()) host.setAttribute('data-arrive', host.motion);
    else { host.removeAttribute('data-arrive'); mark(unseen([...host.querySelectorAll(selector)])); }
  };
  const played = e => { if (e.animationName === 'sg-arrive' && e.target.matches?.(selector)) mark([e.target]); };
  const added = records => {
    const nodes = records.flatMap(r => [...r.addedNodes]).filter(n => n.nodeType === 1).flatMap(n => [n, ...n.querySelectorAll(selector)]);
    const fresh = unseen([...new Set(nodes)]);
    if (animates()) beat(fresh); else mark(fresh);
  };

  mode();
  if (!SIBLING_INDEX) beat(unseen([...host.querySelectorAll(selector)]));
  host.addEventListener('animationend', played);
  host.addEventListener('sg-skin', mode);
  const mo = new MutationObserver(added);
  mo.observe(host, { childList: true, subtree: true });
  return {
    /** Items moved on purpose (a sort the reader asked for) are not arrivals. */
    seen(nodes) { mark([...nodes]); },
    stop() {
      mo.disconnect();
      host.removeEventListener('animationend', played);
      host.removeEventListener('sg-skin', mode);
      host.removeAttribute('data-arrive');
    },
  };
}
