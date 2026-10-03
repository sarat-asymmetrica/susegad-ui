// Dialog: the pure core. Words, and the DOM-free parts of the state machine.
// Runs in Node (see dialog.test.js). The native <dialog> carries the modal
// behaviour itself: showModal() traps focus and blocks the rest of the page,
// Escape fires 'cancel' then 'close', and the browser restores focus to the
// element that had it before showModal() was called (0005: enhance a native
// element; this file never re-implements what the platform already does).

/** Every string a person reads. Kathakar edits these. */
export const STRINGS = {
  // the reduced-motion / no-JS opener falls back to whatever the caller wrote on their <a> or <button>
  dismiss: 'Close',
};

/**
 * Which openers on the page should open a given dialog: every element with
 * `data-sg-dialog="<id>"`, in document order. Pure given the pairs already
 * read off the DOM (the DOM read itself happens in dialog.js).
 * @param {{ id: string, dialogAttr: string | null }[]} candidates
 * @param {string} id
 */
export function openersFor(candidates, id) {
  return candidates.filter(c => c.dialogAttr === id).map(c => c.id);
}

/**
 * True when `value` (a <dialog>'s returnValue, or a click target's dataset)
 * means the dialog was dismissed rather than confirmed. Used by a skin to
 * decide whether an exit animation should look like "cancelled" or "done";
 * not required, but kept pure and tested since more than one skin reads it.
 */
export const isDismiss = value => value === 'dismiss' || value === 'cancel' || value === '';
