import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, rupees, availability, isWhole, initial, reduce, view } from './room.core.js';
import { createSource, roomFor, ROOM_IDS } from './source.js';

const instant = () => Promise.resolve();

test('rupees use Indian digit grouping', () => {
  assert.equal(rupees(3200), '₹3,200');
  assert.equal(rupees(125000), '₹1,25,000');
  assert.equal(rupees(12500000), '₹1,25,00,000');
  assert.equal(rupees(999.6), '₹1,000');
});

test('availability: the words carry it, the tone backs it up', () => {
  assert.deepEqual(availability(0), { text: 'Fully booked', tone: 'neutral', bookable: false });
  assert.deepEqual(availability(1), { text: '1 room left', tone: 'warning', bookable: true });
  assert.deepEqual(availability(2), { text: '2 rooms left', tone: 'warning', bookable: true });
  assert.deepEqual(availability(5), { text: 'Available', tone: 'success', bookable: true });
  assert.equal(availability(-3).text, 'Fully booked');
});

test('beds read naturally', () => {
  assert.equal(STRINGS.beds({ double: 1 }), '1 double bed');
  assert.equal(STRINGS.beds({ double: 3, single: 2 }), '3 double beds and 2 single beds');
  assert.equal(STRINGS.beds({ single: 1 }), '1 single bed');
});

test('the source is deterministic per seed and only varies availability', () => {
  for (const id of ROOM_IDS) {
    assert.deepEqual(roomFor(id, 3), roomFor(id, 3));
    const a = roomFor(id, 1), b = roomFor(id, 2);
    assert.equal(a.name, b.name); assert.equal(a.rate, b.rate);
  }
  assert.equal(roomFor('nowhere'), null);
});

test('the source answers with real data, and fails only when the world says so', async () => {
  const waits = [];
  const src = createSource({ seed: 1, wait: ms => (waits.push(ms), instant()) });
  const room = await src.load('garden');
  assert.equal(room.name, 'Garden room');
  assert.equal(room.rate, 3200);
  src.failNext();
  await assert.rejects(src.load('garden'), e => e.code === 'network');
  const again = await src.load('garden');
  assert.equal(again.name, 'Garden room', 'one failure, then back to normal');
  await assert.rejects(src.load('nowhere'), e => e.code === 'not-found');
  assert.ok(waits.every(ms => ms > 0), 'every answer takes network time');
  assert.equal(src.calls, 4);
});

test('the source waits only through its wait function, so latency is seeded', async () => {
  const run = async () => { const w = []; const s = createSource({ seed: 7, wait: ms => (w.push(ms), instant()) }); await s.load('garden'); await s.load('house'); return w; };
  assert.deepEqual(await run(), await run());
});

test('overrides force a field, for pages and tests', async () => {
  const src = createSource({ wait: instant, overrides: { garden: { left: 0 } } });
  assert.equal((await src.load('garden')).left, 0);
});

test('machine: load, then loaded', () => {
  let s = reduce(initial, { type: 'load', request: 1 });
  assert.equal(s.phase, 'loading');
  s = reduce(s, { type: 'loaded', request: 1, room: roomFor('garden') });
  assert.equal(s.phase, 'loaded');
  assert.equal(s.room.name, 'Garden room');
});

test('machine: a stale answer never overwrites a newer request', () => {
  let s = reduce(initial, { type: 'load', request: 1 });
  s = reduce(s, { type: 'load', request: 2 });
  const stale = reduce(s, { type: 'loaded', request: 1, room: roomFor('house') });
  assert.equal(stale, s);
  const staleFail = reduce(s, { type: 'failed', request: 1 });
  assert.equal(staleFail, s);
  assert.equal(reduce(s, { type: 'failed', request: 2 }).phase, 'failed');
});

test('machine: failure, then try again', () => {
  let s = reduce(reduce(initial, { type: 'load', request: 1 }), { type: 'failed', request: 1, error: 'network' });
  assert.equal(s.phase, 'failed');
  s = reduce(s, { type: 'load', request: 2 });
  assert.equal(s.phase, 'loading');
  assert.equal(s.error, null);
  assert.equal(reduce(s, { type: 'nonsense' }), s);
});

test('view: the skeleton stays until the details arrive, and never claims an arrival on failure', () => {
  assert.deepEqual(view(initial).skeleton, { busy: true, hidden: false });
  const loading = reduce(initial, { type: 'load', request: 1 });
  assert.deepEqual(view(loading).skeleton, { busy: true, hidden: false });
  assert.equal(view(loading).room, null);
  const failed = reduce(loading, { type: 'failed', request: 1 });
  assert.deepEqual(view(failed).skeleton, { busy: true, hidden: true }, 'still busy, only hidden');
  assert.equal(view(failed).error, STRINGS.failed);
  const loaded = reduce(loading, { type: 'loaded', request: 1, room: { ...roomFor('house'), left: 0 } });
  const v = view(loaded);
  assert.deepEqual(v.skeleton, { busy: false, hidden: false });
  assert.equal(v.room.price, '₹1,25,000');
  assert.equal(v.room.per, 'a week');
  assert.equal(v.room.badge.text, 'Fully booked');
  assert.equal(v.room.action, STRINGS.askOther);
  assert.equal(v.error, null);
});

test('copy has no em dashes', () => {
  const all = JSON.stringify(STRINGS) + STRINGS.sleeps(2) + STRINGS.left(2);
  assert.ok(!all.includes('—'));
});

test('the whole house is available or fully booked, never "1 room left"', () => {
  assert.deepEqual(availability(1, { whole: true }), { text: 'Available', tone: 'success', bookable: true });
  assert.equal(availability(0, { whole: true }).text, 'Fully booked');
  assert.equal(STRINGS.left(1, { whole: true }), 'Available');
  assert.equal(STRINGS.left(1), '1 room left');
  const house = roomFor('house', 3);
  assert.equal(house.left, 1, 'seed 3 leaves the house with left = 1');
  assert.ok(isWhole(house));
  assert.ok(isWhole({ per: 'week' }), 'let by the week means whole');
  assert.ok(!isWhole(roomFor('garden', 3)));
  const v = view(reduce(reduce(initial, { type: 'load', request: 1 }), { type: 'loaded', request: 1, room: house }));
  assert.equal(v.room.badge.text, 'Available');
  assert.equal(v.room.action, STRINGS.book);
});
