import test from 'node:test';
import assert from 'node:assert/strict';
import { groupIndian, rupee, cellValue, ariaSort, nextSort, sortRows } from './data-table.core.js';

// ── Indian grouping: lakh and crore, never Western ───────────────────────

test('the 2-2-3 rhythm: ones, thousands, lakhs, crores', () => {
  assert.equal(groupIndian(0), '0');
  assert.equal(groupIndian(7), '7');
  assert.equal(groupIndian(99), '99');
  assert.equal(groupIndian(100), '100');
  assert.equal(groupIndian(999), '999');
  assert.equal(groupIndian(1000), '1,000');
  assert.equal(groupIndian(99999), '99,999');
  assert.equal(groupIndian(100000), '1,00,000');
  assert.equal(groupIndian(125000), '1,25,000');
  assert.equal(groupIndian(999999), '9,99,999');
  assert.equal(groupIndian(1000000), '10,00,000');
  assert.equal(groupIndian(10000000), '1,00,00,000');
  assert.equal(groupIndian(12500000), '1,25,00,000');
  assert.equal(groupIndian(123456789), '12,34,56,789');
  assert.equal(groupIndian(1000000000), '1,00,00,00,000');
});

test('paise, negatives, strings, and nothing', () => {
  assert.equal(groupIndian(125000.5), '1,25,000.5');
  assert.equal(groupIndian(-125000), '-1,25,000');
  assert.equal(groupIndian('125000'), '1,25,000');
  assert.equal(groupIndian('  12,00,000 '), null, 'a string with commas is not a number we were given');
  assert.equal(groupIndian(NaN), null);
  assert.equal(groupIndian(Infinity), null);
  assert.equal(groupIndian(undefined), null);
  assert.equal(groupIndian('soon'), null);
});

test('the rupee goes in front, and a number the code cannot read says nothing', () => {
  assert.equal(rupee(125000), '₹1,25,000');
  assert.equal(rupee(450), '₹450');
  assert.equal(rupee(12500000), '₹1,25,00,000');
  assert.equal(rupee(-500), '₹-500');
  assert.equal(rupee('soon'), '');
  assert.equal(rupee(null), '');
});

// ── what a cell sorts as ─────────────────────────────────────────────────

const td = (inner, attrs = {}) => ({ textContent: inner, getAttribute: k => attrs[k] ?? null });

test('data-value and data-money are trusted over the text', () => {
  assert.equal(cellValue(td('April', { 'data-value': '4' })), 4);
  assert.equal(cellValue(td('₹1,25,000', { 'data-money': '125000' })), 125000);
});

test('money-like text becomes a number, other text stays text', () => {
  assert.equal(cellValue(td('₹1,25,000')), 125000);
  assert.equal(cellValue(td('1,25,000')), 125000);
  assert.equal(cellValue(td('450')), 450);
  assert.equal(cellValue(td('April')), 'April');
  assert.equal(cellValue(td('Paid in full')), 'Paid in full');
  assert.equal(cellValue(td('')), '');
  assert.equal(cellValue(null), null);
});

// ── the sort state machine ───────────────────────────────────────────────

test('aria-sort: ascending, descending, and nothing', () => {
  assert.equal(ariaSort('asc'), 'ascending');
  assert.equal(ariaSort('desc'), 'descending');
  assert.equal(ariaSort(null), null);
  assert.equal(ariaSort(undefined), null);
});

test('one column clicked: ascending, descending, back to none', () => {
  let s = nextSort(null, 'collected');
  assert.deepEqual(s, { id: 'collected', dir: 'asc' });
  s = nextSort(s, 'collected');
  assert.deepEqual(s, { id: 'collected', dir: 'desc' });
  s = nextSort(s, 'collected');
  assert.deepEqual(s, { id: 'collected', dir: null }, 'the third click clears the sort');
  assert.equal(ariaSort(s.dir), null);
});

test('another column starts again at ascending', () => {
  assert.deepEqual(nextSort({ id: 'collected', dir: 'desc' }, 'month'), { id: 'month', dir: 'asc' });
});

// ── the rows: stable, numbers as numbers, text as text ──────────────────

test('numbers sort as numbers, so 9 does not beat 10', () => {
  const rows = [{ v: 125000 }, { v: 450 }, { v: 25000 }];
  assert.deepEqual(sortRows(rows, 'asc', r => r.v).map(r => r.v), [450, 25000, 125000]);
  assert.deepEqual(sortRows(rows, 'desc', r => r.v).map(r => r.v), [125000, 25000, 450]);
});

test('text sorts after numbers in a mixed column, and as text among itself', () => {
  const rows = [{ v: 10 }, { v: 'due' }, { v: 2 }, { v: 'asked' }];
  assert.deepEqual(sortRows(rows, 'asc', r => r.v).map(r => r.v), [2, 10, 'asked', 'due']);
});

test('equal values keep the order they were written in', () => {
  const rows = [{ n: 'a', v: 5 }, { n: 'b', v: 3 }, { n: 'c', v: 5 }, { n: 'd', v: 3 }];
  assert.deepEqual(sortRows(rows, 'desc', r => r.v).map(r => r.n), ['a', 'c', 'b', 'd']);
});

test('a direction of none leaves the written order alone', () => {
  const rows = [{ v: 3 }, { v: 1 }];
  assert.deepEqual(sortRows(rows, null, r => r.v), rows);
});
