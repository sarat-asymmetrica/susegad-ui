// Drawer: the pure core. Words and the DOM-free geometry. Runs in Node (see
// drawer.test.js). The native <dialog> carries the modal behaviour, exactly
// as Dialog's core.js explains; this file adds only what a sliding panel
// needs: which edge, and the transform it slides from.

export const EDGES = ['start', 'end', 'top', 'bottom'];

/** Every string a person reads. Kathakar edits these. */
export const STRINGS = {
  dismiss: 'Close',
};

/** Only a known edge; anything else falls back to 'end' (the common case: a right-hand drawer in a left-to-right page). */
export const normalizeEdge = e => (EDGES.includes(e) ? e : 'end');

/**
 * The CSS transform a drawer's panel starts from, for its edge, before it
 * slides to `translate(0, 0)`. Logical (`start`/`end`), not `left`/`right`,
 * so it flips correctly in a right-to-left page.
 * @param {'start'|'end'|'top'|'bottom'} edge
 */
export function offTransform(edge) {
  switch (normalizeEdge(edge)) {
    case 'start': return 'translateX(-100%)';
    case 'top': return 'translateY(-100%)';
    case 'bottom': return 'translateY(100%)';
    default: return 'translateX(100%)';
  }
}

/** Which openers on the page should open this drawer: every id with a matching data-sg-drawer. Same shape as Dialog's openersFor, tested here too since Drawer owns its own file. */
export function openersFor(candidates, id) {
  return candidates.filter(c => c.drawerAttr === id).map(c => c.id);
}

export const isDismiss = value => value === 'dismiss' || value === 'cancel' || value === '';
