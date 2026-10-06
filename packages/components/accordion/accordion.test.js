import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, groupsOf, namedGroups, resolveOpen, describeItems, othersToClose } from './accordion.core.js';

const item = (label, name = null, open = false) => ({ label, name, open });

// ── groups ───────────────────────────────────────────────────────────────

test('items that share a name form one group; unnamed items belong to none', () => {
  const items = [
    item('Where do I stay', 'faq'),
    item('Breakfast', 'faq'),
    item('Free-standing note'),
    item('Payments', 'pay'),
  ];
  assert.deepEqual(groupsOf(items).get('faq'), [0, 1]);
  assert.deepEqual(groupsOf(items).get('pay'), [3]);
  assert.deepEqual(namedGroups(items), ['faq']);
  assert.equal(groupsOf(items).size, 2);
});

test('a name on one item alone is not a group', () => {
  assert.deepEqual(namedGroups([item('a', 'solo')]), []);
});

test('no names, no groups', () => {
  assert.deepEqual(namedGroups([item('a'), item('b')]), []);
  assert.equal(groupsOf([item('a'), item('b')]).size, 0);
});

// ── the open account ─────────────────────────────────────────────────────

test('describeItems counts what is open, and says whether the exclusive promise holds', () => {
  const items = [item('a', 'faq', true), item('b', 'faq'), item('c')];
  assert.deepEqual(describeItems(items), { total: 3, open: [0], exclusive: true, groups: 1 });
});

test('two open in one group breaks the promise; an unnamed open one beside them does not', () => {
  const broken = [item('a', 'faq', true), item('b', 'faq', true)];
  assert.equal(describeItems(broken).exclusive, false);
  assert.deepEqual(describeItems(broken).open, [0, 1]);
  const free = [item('a', 'faq', true), item('b', 'faq'), item('c', null, true)];
  assert.equal(describeItems(free).exclusive, true);
});

test('describeItems on an empty accordion', () => {
  assert.deepEqual(describeItems([]), { total: 0, open: [], exclusive: true, groups: 0 });
});

// ── starting open: only the first of a group ─────────────────────────────

test('resolveOpen keeps the first open item of a group and closes the rest, saying so', () => {
  const r = resolveOpen([item('a', 'faq', true), item('b', 'faq', true), item('c', 'faq', true), item('d', null, true), item('e')]);
  assert.deepEqual(r.keep, [0, 3]);
  assert.deepEqual(r.closed, [1, 2]);
  assert.equal(r.warnings.length, 2);
  assert.match(r.warnings[0], /only one item of the "faq" group can start open; item 2 \("b"\) starts closed/);
  assert.match(r.warnings[1], /item 3 \("c"\)/);
});

test('resolveOpen: one open per group is left alone', () => {
  const r = resolveOpen([item('a', 'faq', true), item('b', 'pay', true)]);
  assert.deepEqual(r.keep, [0, 1]);
  assert.deepEqual(r.closed, []);
  assert.deepEqual(r.warnings, []);
});

test('resolveOpen: all closed stays closed, no warnings', () => {
  const r = resolveOpen([item('a', 'faq'), item('b', 'faq')]);
  assert.deepEqual(r.keep, []);
  assert.deepEqual(r.closed, []);
  assert.deepEqual(r.warnings, []);
});

test('resolveOpen on nothing', () => {
  assert.deepEqual(resolveOpen([]), { keep: [], closed: [], warnings: [] });
});

test('what resolveOpen keeps, describeItems calls open and exclusive', () => {
  const items = [item('a', 'faq', true), item('b', 'faq', true), item('c', 'faq', true)];
  const r = resolveOpen(items);
  const after = items.map((it, i) => ({ ...it, open: it.open && r.keep.includes(i) }));
  assert.equal(describeItems(after).exclusive, true);
  assert.deepEqual(describeItems(after).open, [0]);
});

// ── what one turn closes ─────────────────────────────────────────────────

test('othersToClose: when two of a group are somehow both open (a broken state), opening or re-opening one closes the other', () => {
  const items = [item('a', 'faq', true), item('b', 'faq', true), item('c', 'faq')];
  assert.deepEqual(othersToClose(items, 1), [0]);
  assert.deepEqual(othersToClose([item('a', 'faq', true), item('b', 'faq', true), item('c', 'faq', true)], 2), [0, 1]);
  assert.deepEqual(othersToClose([item('a', 'faq', true), item('b', 'faq'), item('c', 'faq')], 0), [], 'already alone: closes nobody');
});

test('othersToClose: closing an item closes nobody', () => {
  assert.deepEqual(othersToClose([item('a', 'faq'), item('b', 'faq')], 0), []);
});

test('othersToClose: an unnamed item closes nobody', () => {
  assert.deepEqual(othersToClose([item('a', null, true), item('b')], 0), []);
});

test('othersToClose: two groups do not reach into each other', () => {
  assert.deepEqual(othersToClose([item('a', 'faq', true), item('b', 'pay', true)], 1), []);
});

// ── words ────────────────────────────────────────────────────────────────

test('the accordion adds no words of its own: the STRINGS shelf is empty on purpose', () => {
  assert.deepEqual(STRINGS, {});
});
