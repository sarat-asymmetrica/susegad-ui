// The accordion's pure core: everything about which items are open, and which
// of them belong to an exclusive group, worked out from plain data. Runs in
// Node; no DOM here. The element reads its <details> children into this
// shape, and the skins read the result back to draw with.
//
// The platform already owns the toggling: a <details> opens and closes with
// Enter or Space on its <summary>, and several <details> sharing the same
// `name` form an exclusive group, only one open at a time. What this core
// adds is the checks and the account: which items should start open (the
// platform keeps only the first of a group, silently), which items belong to
// which group, and a plain count a skin or a page can read.

/** The words the element or a skin would ever show. The accordion adds no
 * words of its own: every word people read is the author's markup. Kept as an
 * empty object so a future string lands here, and so the contract is explicit. */
export const STRINGS = {};

/**
 * One accordion item, read from the DOM by the element.
 * @typedef {{ name: string|null, open: boolean, label: string }} Item
 */

/** An exclusive group: the indices of the items that share one `name`. */
export function groupsOf(items) {
  const groups = new Map();
  items.forEach((it, i) => { if (it.name) { if (!groups.has(it.name)) groups.set(it.name, []); groups.get(it.name).push(i); } });
  return groups;
}

/** Names that carry more than one item. */
export function namedGroups(items) {
  return [...groupsOf(items).entries()].filter(([, ix]) => ix.length > 1).map(([name]) => name);
}

/**
 * Which items should start open. The platform keeps only the FIRST of a group
 * that ships with `open`, and drops the rest without a word. We do the same
 * thing in the open, and say so: the first item of a name group keeps `open`,
 * the others lose it, and each loss is a warning a page can read in the console.
 * @returns {{ keep: number[], closed: number[], warnings: string[] }}
 */
export function resolveOpen(items) {
  const keep = [], closed = [], warnings = [];
  const seen = new Set();
  items.forEach((it, i) => {
    if (!it.open) return;
    if (!it.name) { keep.push(i); return; }
    if (seen.has(it.name)) {
      closed.push(i);
      warnings.push(`only one item of the "${it.name}" group can start open; item ${i + 1} ("${it.label}") starts closed.`);
    } else { seen.add(it.name); keep.push(i); }
  });
  return { keep, closed, warnings };
}

/**
 * What a reader can see right now: how many items, how many open, and whether
 * every open one is alone in its group (the exclusive promise, held or not).
 * @returns {{ total: number, open: number[], exclusive: boolean, groups: number }}
 */
export function describeItems(items) {
  const open = items.map((it, i) => (it.open ? i : -1)).filter(i => i >= 0);
  const groups = groupsOf(items);
  let exclusive = true;
  for (const name of namedGroups(items)) {
    const openIn = groups.get(name).filter(i => items[i].open);
    if (openIn.length > 1) exclusive = false;
  }
  // An unnamed item can sit beside an open one and the promise still holds:
  // only named (exclusive) groups are part of it.
  return { total: items.length, open, exclusive, groups: namedGroups(items).length };
}

/**
 * After one item turns open, which of its group-mates should close. An item
 * with no name closes nobody; a named one closes every other open item of its
 * group. The element lets the platform do this itself when it can (the native
 * exclusive group) and uses this only to describe and verify what happened.
 * @returns {number[]} indices to close
 */
export function othersToClose(items, index) {
  const it = items[index];
  if (!it?.name || !it.open) return [];
  return groupsOf(items).get(it.name).filter(i => i !== index && items[i].open);
}
