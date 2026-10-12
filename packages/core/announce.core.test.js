import test from 'node:test';
import assert from 'node:assert/strict';
import { pickPath, notifyPriority, createCoalescer } from './announce.core.js';

// a clock and a scheduler we drive by hand
function rig(opts = {}) {
  let t = 0, id = 0; const timers = new Map(), said = [];
  const c = createCoalescer({
    say: (text, priority) => said.push([text, priority]),
    now: () => t,
    schedule: (fn, ms) => { timers.set(++id, { fn, at: t + ms }); return id; },
    cancel: i => timers.delete(i),
    ...opts,
  });
  const advance = ms => {
    const end = t + ms;
    for (;;) {
      const next = [...timers].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      t = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    t = end;
  };
  return { c, said, advance, at: () => t };
}

test('path: ariaNotify on the element or the document, else the region', () => {
  assert.equal(pickPath({ ariaNotify() {} }, {}), 'notify');
  assert.equal(pickPath(undefined, { ariaNotify() {} }), 'notify');
  assert.equal(pickPath({}, { ariaNotify() {} }), 'notify');
  assert.equal(pickPath({}, {}), 'region');
  assert.equal(pickPath(undefined, undefined), 'region');
  assert.equal(pickPath(null, { ariaNotify: 'yes' }), 'region', 'a property that is not a function is not the API');
});

test('priority: assertive is high, everything else normal', () => {
  assert.equal(notifyPriority('assertive'), 'high');
  assert.equal(notifyPriority('polite'), 'normal');
  assert.equal(notifyPriority(undefined), 'normal');
});

test('three quick totals are said once, as the last one', () => {
  const { c, said, advance } = rig();
  c.push('1 person, ₹1,500'); advance(80);
  c.push('2 people, ₹3,000'); advance(80);
  c.push('3 people, ₹4,500');
  assert.deepEqual(said, [], 'nothing yet: the reader is not interrupted mid-press');
  advance(250);
  assert.deepEqual(said, [['3 people, ₹4,500', 'polite']]);
});

test('a person holding the button still hears the total now and then (maxWait)', () => {
  const { c, said, advance } = rig();
  for (let i = 1; i <= 30; i++) { c.push(`${i} people`); advance(100); } // 3 seconds of presses
  assert.ok(said.length >= 2 && said.length <= 4, `said ${said.length}`);
  assert.ok(said.every(([, p]) => p === 'polite'));
  advance(500);
  assert.equal(said.at(-1)[0], '30 people', 'the last value always lands');
});

test('assertive goes first and is never replaced by a later polite one', () => {
  const { c, said, advance } = rig();
  c.push('Slot taken', 'assertive');
  c.push('2 people, ₹3,000');
  advance(300);
  assert.deepEqual(said, [['Slot taken', 'assertive'], ['2 people, ₹3,000', 'polite']]);
});

test('the same sentence twice in a row is not said again soon, but is after a while', () => {
  const { c, said, advance } = rig();
  c.push('3 people, ₹4,500'); advance(300);
  c.push('3 people, ₹4,500'); advance(300);
  assert.equal(said.length, 1);
  advance(2000);
  c.push('3 people, ₹4,500'); advance(300);
  assert.equal(said.length, 2);
});

test('empty and missing text says nothing; clear drops what waits; flush says it now', () => {
  const { c, said, advance } = rig();
  c.push(''); c.push(undefined); c.push('   '); advance(1000);
  assert.deepEqual(said, []);
  c.push('a'); c.clear(); advance(1000);
  assert.deepEqual(said, []);
  c.push('b'); c.flush();
  assert.deepEqual(said, [['b', 'polite']]);
  advance(1000);
  assert.equal(said.length, 1, 'the timer was cancelled by the flush');
});

test('an assertive sentence always speaks, even the same one twice in a row (a retry)', () => {
  const { c, said, advance } = rig();
  c.push('Slot taken', 'assertive'); advance(300);
  c.push('Slot taken', 'assertive'); advance(300);
  assert.deepEqual(said, [['Slot taken', 'assertive'], ['Slot taken', 'assertive']]);
});
