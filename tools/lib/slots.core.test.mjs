import test from 'node:test';
import assert from 'node:assert/strict';
import { slotLimit, defaultSlotCount, judgeSlot, planAcquire, waitMessage, serializeRecord, parseRecord, slotFileName } from './slots.core.js';

const alive = pids => pid => pids.includes(pid);
const rec = (pid, label = `l${pid}`, extra = {}) => ({ pid, label, startedAt: '2026-10-08T00:00:00.000Z', token: `t${pid}`, ...extra });

test('the default is half the cores, never below one', () => {
  assert.equal(defaultSlotCount(4), 2);
  assert.equal(defaultSlotCount(1), 1);
  assert.equal(defaultSlotCount(0), 1);
  assert.equal(defaultSlotCount(7), 3);
});

test('SG_BROWSER_SLOTS: a count, 0 for no limit, junk falls back to the default', () => {
  assert.equal(slotLimit({}, 4), 2);
  assert.equal(slotLimit({ SG_BROWSER_SLOTS: '1' }, 16), 1);
  assert.equal(slotLimit({ SG_BROWSER_SLOTS: '3' }, 4), 3);
  assert.equal(slotLimit({ SG_BROWSER_SLOTS: '0' }, 4), Infinity);
  assert.equal(slotLimit({ SG_BROWSER_SLOTS: 'many' }, 4), 2);
  assert.equal(slotLimit({ SG_BROWSER_SLOTS: '-2' }, 4), 2);
  assert.equal(slotLimit({ SG_BROWSER_SLOTS: '' }, 4), 2);
});

test('judgeSlot: no file is free; a live pid holds; a dead pid is stale', () => {
  const opts = { isAlive: alive([10]), now: 1000 };
  assert.equal(judgeSlot(undefined, opts), 'free');
  assert.equal(judgeSlot({ record: rec(10), mtimeMs: 0 }, opts), 'held');
  assert.equal(judgeSlot({ record: rec(11), mtimeMs: 0 }, opts), 'stale');
});

test('judgeSlot: a child pid keeps a slot held after its owner died, and a dead pair is stale', () => {
  assert.equal(judgeSlot({ record: rec(11, 'x', { childPid: 12 }), mtimeMs: 0 }, { isAlive: alive([12]), now: 1 }), 'held');
  assert.equal(judgeSlot({ record: rec(11, 'x', { childPid: 12 }), mtimeMs: 0 }, { isAlive: alive([]), now: 1 }), 'stale');
});

test('judgeSlot: a file nobody has written to yet is held while young and stale when old', () => {
  const opts = { isAlive: alive([]), now: 100000, graceMs: 5000 };
  assert.equal(judgeSlot({ record: null, mtimeMs: 99000 }, opts), 'held');
  assert.equal(judgeSlot({ record: null, mtimeMs: 90000 }, opts), 'stale');
});

test('planAcquire takes the first free slot', () => {
  const plan = planAcquire({ limit: 2, entries: [{ record: rec(1), mtimeMs: 0 }, undefined], isAlive: alive([1]), now: 1 });
  assert.deepEqual({ claim: plan.claim, reclaim: plan.reclaim }, { claim: 1, reclaim: [] });
});

test('planAcquire with every slot held waits and names the holders', () => {
  const plan = planAcquire({ limit: 1, entries: [{ record: rec(1, 'review-a'), mtimeMs: 0 }], isAlive: alive([1]), now: 1 });
  assert.equal(plan.claim, null);
  assert.deepEqual(plan.reclaim, []);
  assert.deepEqual(plan.holders, ['review-a (pid 1)']);
});

test('planAcquire reclaims stale slots before it waits', () => {
  const plan = planAcquire({ limit: 2, entries: [{ record: rec(1), mtimeMs: 0 }, { record: rec(2), mtimeMs: 0 }], isAlive: alive([2]), now: 1 });
  assert.equal(plan.claim, null);
  assert.deepEqual(plan.reclaim, [0]);
  assert.deepEqual(plan.holders, ['l2 (pid 2)']);
});

test('planAcquire never plans past the limit, even if more files exist', () => {
  const plan = planAcquire({ limit: 1, entries: [{ record: rec(1), mtimeMs: 0 }, undefined], isAlive: alive([1]), now: 1 });
  assert.equal(plan.claim, null);
});

test('waitMessage', () => {
  assert.equal(waitMessage(['a (pid 1)', 'b (pid 2)']), 'waiting for a browser slot (held by: a (pid 1), b (pid 2))');
  assert.equal(waitMessage([]), 'waiting for a browser slot (held by: someone starting up)');
});

test('records round-trip, and junk reads as null', () => {
  const r = rec(5, 'label with spaces', { childPid: 6 });
  assert.deepEqual(parseRecord(serializeRecord(r)), r);
  assert.equal(parseRecord(''), null);
  assert.equal(parseRecord('{not json'), null);
  assert.equal(parseRecord('{"pid":"x"}'), null);
});

test('slot file names are stable', () => assert.equal(slotFileName(3), 'slot-3.lock'));

// ---- first come, first served: tickets ----
import * as core from './slots.core.js';

const tk = (ms, pid, mtimeMs = 1000) => ({ name: core.ticketName({ ms, seq: 0, pid, rand: 'aa' }), mtimeMs });
const look = ({ limit = 1, entries = [], tickets, self, alive: pids = [1, 2, 3, 4], now = 1000 } = {}) =>
  planAcquire({ limit, entries, isAlive: alive(pids), now, tickets, self: self?.name });

test('tickets sort by time, then sequence, then pid, whatever their digits', () => {
  const a = core.ticketName({ ms: 999, seq: 0, pid: 900, rand: 'x' });
  const b = core.ticketName({ ms: 1000, seq: 0, pid: 5, rand: 'x' });
  const c = core.ticketName({ ms: 1000, seq: 1, pid: 4, rand: 'x' });
  const d = core.ticketName({ ms: 1000, seq: 1, pid: 40, rand: 'x' });
  assert.deepEqual([d, b, c, a].sort(core.compareTickets), [a, b, c, d]);
  assert.deepEqual(core.parseTicketName(c), { ms: 1000, seq: 1, pid: 4, rand: 'x' });
  assert.equal(core.parseTicketName('slot-0.lock'), null);
  assert.equal(core.parseTicketName('wait-junk'), null);
});

test('the starvation case: a runner that just released and asks again waits behind the waiter', () => {
  // slot is free; waiter (pid 1, ticket at t=100) has been polling; the runner (pid 2) releases and asks again at t=900
  const waiter = tk(100, 1), runner = tk(900, 2);
  const plan = look({ tickets: [waiter, runner], self: runner });
  assert.equal(plan.claim, null, 'the runner must not take the slot out from under the waiter');
  assert.equal(plan.ahead, 1);
  assert.equal(look({ tickets: [waiter, runner], self: waiter }).claim, 0, 'the waiter takes it');
});

test('with two free slots, two waiters ahead leave nothing for the third; one ahead leaves one', () => {
  const [a, b, c] = [tk(1, 1), tk(2, 2), tk(3, 3)];
  const entries = [undefined, undefined];
  assert.equal(look({ limit: 2, entries, tickets: [a, b, c], self: c }).claim, null);
  assert.equal(look({ limit: 2, entries, tickets: [a, b, c], self: b }).claim, 0);
  assert.equal(look({ limit: 2, entries, tickets: [a, b, c], self: a }).claim, 0);
});

test('first come, first served among three waiters, one slot freeing at a time', () => {
  const [a, b, c] = [tk(1, 1), tk(2, 2), tk(3, 3)];
  const order = [];
  let queue = [a, b, c];
  while (queue.length) {
    const winners = queue.filter(me => look({ tickets: queue, self: me }).claim === 0);
    assert.equal(winners.length, 1, 'exactly one may take a single free slot');
    order.push(winners[0].name);
    queue = queue.filter(t => t !== winners[0]);
  }
  assert.deepEqual(order, [a.name, b.name, c.name]);
});

test('tickets of dead pids are skipped and reported for cleanup', () => {
  const ghost = tk(1, 99), me = tk(2, 2);
  const plan = look({ tickets: [ghost, me], self: me });
  assert.equal(plan.claim, 0);
  assert.deepEqual(plan.staleTickets, [ghost.name]);
});

test('a live pid that stopped polling (old mtime) is skipped like a dead one', () => {
  const frozen = tk(1, 1, 1000 - 60_000), me = tk(2, 2);
  const plan = look({ tickets: [frozen, me], self: me });
  assert.equal(plan.claim, 0);
  assert.deepEqual(plan.staleTickets, [frozen.name]);
});

test('a ticket is not stale while its mtime is within the grace', () => {
  const fresh = tk(1, 1, 1000 - 4000), me = tk(2, 2);
  assert.equal(look({ tickets: [fresh, me], self: me }).claim, null);
});

test('younger tickets never hold anyone back', () => {
  const me = tk(1, 1), later = tk(2, 2);
  assert.equal(look({ tickets: [me, later], self: me }).claim, 0);
});

test('no tickets argument: the plan is the old one (claim the first free slot)', () => {
  assert.equal(look({ entries: [{ record: rec(1), mtimeMs: 0 }, undefined], limit: 2 }).claim, 1);
  assert.equal(look({ entries: [{ record: rec(1), mtimeMs: 0 }], limit: 1 }).claim, null);
});

test('a held slot still reports its holders, with the queue ahead of me', () => {
  const a = tk(1, 1), me = tk(2, 2);
  const plan = look({ entries: [{ record: rec(3), mtimeMs: 0 }], tickets: [a, me], self: me });
  assert.equal(plan.claim, null);
  assert.deepEqual(plan.holders, ['l3 (pid 3)']);
  assert.match(waitMessage(plan.holders, plan.ahead), /^waiting for a browser slot \(held by: l3 \(pid 3\)\); 1 waiting ahead of you$/);
});
