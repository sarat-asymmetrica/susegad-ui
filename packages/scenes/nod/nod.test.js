import test from 'node:test';
import assert from 'node:assert/strict';
import { thread, fingerAt, model, talk, wisps, streamline, BEATS, FIRST, WARM_NOD, GLASS } from './model.js';

const draftAt = FIRST + BEATS.draft;

test('thread: nothing is sent without a nod, however long you wait', () => {
  for (const t of [0, 5, 60, 3600]) assert.equal(thread(t, []).sentCount, 0, `at ${t} s`);
  const late = thread(3600, []);
  assert.ok(late.draft && late.draft.ticked === 0, 'the draft is still there, waiting, unticked');
});

test('thread: a nod before the draft appears does nothing', () => {
  const th = thread(draftAt + 5, [FIRST + 0.5, draftAt - 0.01]);
  assert.equal(th.sentCount, 0);
  assert.ok(th.draft);
});

test('thread: one nod sends exactly one reply', () => {
  const nod = draftAt + 1;
  assert.equal(thread(nod - 0.01, [nod]).sentCount, 0);
  assert.equal(thread(nod + BEATS.sent + 0.01, [nod]).sentCount, 1);
  assert.equal(thread(nod + 100, [nod], 1).sentCount, 1);
});

test('thread: the tick fills after the nod, then the draft becomes a sent bubble', () => {
  const nod = draftAt + 1, mid = thread(nod + BEATS.sent * 0.3, [nod]);
  assert.ok(mid.draft.ticked > 0 && mid.draft.ticked < 1);
  const after = thread(nod + BEATS.sent + 0.05, [nod]);
  assert.equal(after.draft, null);
  assert.equal(after.bubbles.at(-1).kind, 'reply');
});

test('thread: the next message comes after a pause, and its draft waits for its own nod', () => {
  const nod = draftAt + 1, next = nod + BEATS.next, secondDraft = next + BEATS.draft;
  const before = thread(next - 0.01, [nod]);
  assert.equal(before.bubbles.filter(b => b.kind === 'ask').length, 1);
  const waiting = thread(secondDraft + 10, [nod]);
  assert.equal(waiting.sentCount, 1);
  assert.ok(waiting.draft);
  assert.equal(thread(secondDraft + 10, [nod, secondDraft + 2]).sentCount, 2);
});

test('thread: two quick nods on one draft send it once', () => {
  const nod = draftAt + 1;
  assert.equal(thread(nod + 1, [nod, nod + 0.05]).sentCount, 1);
});

test('thread: the helper types before the draft appears', () => {
  assert.equal(thread(FIRST + BEATS.typing - 0.05, []).typing, false);
  assert.equal(thread(FIRST + BEATS.typing + 0.05, []).typing, true);
  assert.equal(thread(draftAt + 0.05, []).typing, false);
});

test('warm: one exchange, one scripted nod, and the finger is there for it', () => {
  const at = model({ time: WARM_NOD, register: 'warm' });
  assert.ok(at.finger > 0.95, `finger at the nod: ${at.finger}`);
  assert.equal(model({ time: WARM_NOD + 60, register: 'warm' }).sentCount, 1);
  assert.equal(model({ time: WARM_NOD + 60, register: 'warm' }).finger, 0);
  assert.equal(model({ time: WARM_NOD - 2, register: 'warm' }).finger, 0);
});

test('playful: the model itself never nods; nods come from the person', () => {
  assert.equal(model({ time: 600, register: 'playful' }).sentCount, 0);
});

test('quiet: the draft, waiting and unticked', () => {
  const q = model({ time: 0, register: 'quiet' });
  assert.ok(q.draft && q.draft.ticked === 0);
  assert.equal(q.settled, true);
  assert.equal(q.wisps.length, 0);
});

test('fingerAt: comes up only for a scripted nod, and always leaves', () => {
  assert.equal(fingerAt(5, 6, false), 0);
  assert.ok(fingerAt(5.5, 6, true) > 0);
  assert.equal(fingerAt(20, 6, true), 0);
  assert.equal(fingerAt(3, -Infinity, false), 0);
});

test('talk: seeded and stable', () => {
  assert.deepEqual(talk(3), talk(3));
  assert.ok(talk(3).exchanges.every(e => e.reply.lines >= 2));
});

test('wisps: rise from the tea and fade; a steady few at any time', () => {
  for (const t of [5, 30, 90]) {
    const ws = wisps(t);
    assert.ok(ws.length >= 4 && ws.length <= 8, `${ws.length} at ${t}`);
    for (const w of ws) assert.ok(w.alpha >= 0 && w.alpha <= 0.62 && Math.abs(w.x - GLASS.cx) <= 34);
  }
  const s = streamline(GLASS.cx, GLASS.level, 1, 0, 60);
  assert.ok(s.at(-1)[1] < s[0][1] - 80, 'steam goes up');
});
