// <sg-data-table>: the pure core, shared by the element, the tests and the docs.
// Runs in Node. Three jobs:
//
//   1. Indian money (from core-intl): groupIndian() writes 125000 as "1,25,000" and 12500000 as
//      "1,25,00,000" (lakh and crore, the 2-2-3 rhythm), never the Western
//      125,000, and without a locale library, which would group Western-style
//      on most machines. rupee() puts the rupee in front.
//   2. What a cell sorts as: cellValue() reads the number an author stated
//      (data-value, data-money) or the text, and says whether it is a number.
//   3. The sort state machine: nextSort() turns a click into the next column
//      and direction, and ariaSort() gives the aria-sort value the th carries.

import { groupIndian, rupees } from '../../core/intl.core.js';

// The grouping and the rupee live in core/intl.core.js (core-intl), shared with menu, wa-order
// and every page that writes money. Re-exported so this module keeps one door.
export { groupIndian };

/** "₹1,25,000". A `paise` above 0 always shows two decimals. Non-finite input gives an empty string: a cell says nothing rather than a lie. */
export const rupee = (n, { paise = 0 } = {}) => rupees(n, { paise: paise > 0 ? true : 'auto' });

// ── what a cell sorts as ────────────────────────────────────────────────

const MONEY = /^[₹]?\s*-?[\d,]+(?:\.\d+)?$/;

/**
 * The value a <td> sorts by, in order of trust: data-value, then data-money
 * (both author-stated), then the text. A number is returned as a number when
 * the text is money-like ("₹1,25,000" strips to 125000); anything else stays
 * text. `null` for a cell that is not there.
 */
export function cellValue(td) {
  if (!td) return null;
  const stated = td.getAttribute('data-value') ?? td.getAttribute('data-money');
  if (stated != null && /^-?\d+(?:\.\d+)?$/.test(stated.trim())) return Number(stated);
  const text = td.textContent.trim();
  if (MONEY.test(text)) return Number(text.replace(/[₹,\s]/g, ''));
  return text;
}

// ── the sort state machine ──────────────────────────────────────────────

/** The aria-sort value a th carries for a direction, or null for none. */
export const ariaSort = dir => (dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : null);

/** The label the sort button reads, for assistive technology. */
export const sortLabel = (name, dir) => (dir ? `Sort by ${name}, now ${dir === 'asc' ? 'smallest first' : 'largest first'}` : `Sort by ${name}`);

/**
 * One click on a column header. Cycle: none → ascending → descending → none,
 * and any other column starts again at ascending. `current` is { id, dir } or null.
 * @returns {{ id: string, dir: 'asc' | 'desc' | null }}
 */
export function nextSort(current, id) {
  if (!current || current.id !== id) return { id, dir: 'asc' };
  return { id, dir: current.dir === 'asc' ? 'desc' : null };
}

/** A stable sort of `rows` by the values taken with `value(row)`; equal values keep their order. */
export function sortRows(rows, dir, value) {
  if (!dir) return [...rows];
  const keyed = rows.map((r, i) => ({ r, i, v: value(r) ?? '' }));
  keyed.sort((a, b) => {
    const an = typeof a.v === 'number', bn = typeof b.v === 'number';
    let c = an && bn ? a.v - b.v : an !== bn ? (an ? -1 : 1) : String(a.v).localeCompare(String(b.v), 'kn');
    if (c) return dir === 'asc' ? c : -c;
    return a.i - b.i;
  });
  return keyed.map(k => k.r);
}
