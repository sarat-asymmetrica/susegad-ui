import test from 'node:test';
import assert from 'node:assert/strict';
import { planList, sameOrder, STRINGS } from './event-list.core.js';
import { parseWhen } from '../event-card/event.core.js';

const at = s => parseWhen(s, 'Asia/Kolkata');
const ev = (name, s, e) => ({ name, start: at(s), end: e ? at(e) : NaN });
const items = [
  ev('class', '2026-10-18T17:00', '2026-10-18T19:00'),
  ev('gone', '2026-09-27T11:00', '2026-09-27T13:00'),
  ev('workshop', '2026-10-04T11:00', '2026-10-04T13:00'),
  ev('supper', '2026-10-09T19:30', '2026-10-09T22:00'),
];

test('the plan puts what is to come first, soonest on top, and the rest in the drawer', () => {
  const p = planList(items, at('2026-10-02T10:00'));
  assert.deepEqual(p.upcoming.map(e => e.name), ['workshop', 'supper', 'class']);
  assert.deepEqual(p.past.map(e => e.name), ['gone']);
  assert.equal(p.empty, false);
  assert.equal(p.before, 'Before (1)');
});

test('with nothing to come the plan is empty, and the drawer holds everything', () => {
  const p = planList(items, at('2026-12-20T10:00'));
  assert.equal(p.empty, true);
  assert.equal(p.upcoming.length, 0);
  assert.equal(p.past.length, 4);
  assert.equal(p.before, 'Before (4)');
});

test('an empty calendar is empty, with no drawer to open', () => {
  const p = planList([], at('2026-10-02T10:00'));
  assert.equal(p.empty, true);
  assert.equal(p.before, '', 'no label, so no drawer');
  assert.equal(p.nextAt, Infinity);
});

test('the plan knows when to look again', () => {
  assert.equal(planList(items, at('2026-10-02T10:00')).nextAt, at('2026-10-04T00:00'));
  assert.equal(planList(items, at('2026-10-04T12:00')).nextAt, at('2026-10-04T13:00'));
  assert.equal(planList(items, at('2026-12-20T10:00')).nextAt, Infinity, 'all over: nothing more will change');
});

test('moving an event to the drawer happens at its end, not a moment before', () => {
  assert.equal(planList(items, at('2026-10-04T12:59:59')).upcoming[0].name, 'workshop');
  assert.equal(planList(items, at('2026-10-04T13:00')).upcoming[0].name, 'supper');
});

test('sameOrder says whether anything needs to move', () => {
  assert.equal(sameOrder([1, 2, 3], [1, 2, 3]), true);
  assert.equal(sameOrder([1, 2, 3], [1, 3, 2]), false);
  assert.equal(sameOrder([1, 2], [1, 2, 3]), false);
  assert.equal(sameOrder([], []), true);
});

test('the default words for an empty calendar are plain and carry the ask', () => {
  assert.equal(STRINGS.empty, 'Nothing on the calendar right now. Ask about a private session.');
  assert.equal(STRINGS.before, 'Before');
  assert.equal(STRINGS.beforeCount(3), 'Before (3)');
});
