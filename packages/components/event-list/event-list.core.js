// Event list: the pure core. Runs in Node.
//
// A calendar is only honest if it keeps itself in order: what is still to come
// at the top with the soonest first, what has happened put away, and a plain
// word when there is nothing to come. This turns the cards and the clock into
// that plan. The clock work itself is event-card's core.

import { partitionEvents, nextChangeOf, STRINGS } from '../event-card/event.core.js';

export { STRINGS };

/**
 * @param {{ start: number, end?: number, zone?: string }[]} items one per card
 * @param {number} now
 * @returns {{ upcoming: object[], past: object[], empty: boolean, before: string, nextAt: number }}
 */
export function planList(items, now) {
  const { upcoming, past } = partitionEvents(items, now);
  return {
    upcoming, past,
    empty: upcoming.length === 0,
    before: past.length ? STRINGS.beforeCount(past.length) : '',
    nextAt: nextChangeOf(items, now),
  };
}

/** Same items in the same places? Then nothing needs moving. */
export const sameOrder = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
