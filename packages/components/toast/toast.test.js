import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readingTime, durationFor, announcement, joinTitle, liveRole, normalizeTone, createQueue, parseHotkey, postmarkText, TIMING, STRINGS,
} from './toast.core.js';

test('reading time grows with the words and stays between 5 s and 20 s', () => {
  assert.equal(readingTime(''), TIMING.minMs);
  assert.equal(readingTime('Saved'), TIMING.minMs);
  const twenty = readingTime(Array(20).fill('word').join(' '));
  assert.ok(twenty > TIMING.minMs && twenty < TIMING.maxMs, `20 words: ${twenty}`);
  assert.equal(twenty % 100, 0);
  assert.equal(readingTime(Array(200).fill('word').join(' ')), TIMING.maxMs);
});

test('errors and toasts with an action wait for the person', () => {
  assert.equal(durationFor({ tone: 'error', text: 'Could not save' }), 0);
  assert.equal(durationFor({ tone: 'success', text: 'Deleted', hasAction: true }), 0);
  assert.equal(durationFor({ tone: 'error', duration: 3000 }), 0, 'an error cannot be given a timeout');
});

test('the page can turn timeouts off, and asked-for durations never go below the minimum', () => {
  assert.equal(durationFor({ tone: 'info', text: 'Hi', regionDuration: 0 }), 0);
  assert.equal(durationFor({ tone: 'info', duration: 1000 }), TIMING.minMs);
  assert.equal(durationFor({ tone: 'info', duration: 0 }), 0);
  assert.equal(durationFor({ tone: 'info', duration: 9000 }), 9000);
  assert.equal(durationFor({ tone: 'info', text: 'Hi', regionDuration: 12000 }), 12000, 'a longer region default wins');
});

test('the tone is spoken, not only shown', () => {
  assert.equal(announcement('error', '  Could not   save. '), 'Error: Could not save.');
  assert.equal(announcement('warning', 'Low space'), 'Warning: Low space');
  assert.equal(announcement('success', 'Saved'), 'Saved');
  assert.equal(announcement('info', '   '), '');
  assert.equal(liveRole('error'), 'alert');
  assert.equal(liveRole('success'), 'status');
  assert.equal(normalizeTone('shouting'), 'info');
  assert.equal(STRINGS.dismissNamed('Saved'), 'Dismiss: Saved');
});

test('the queue shows the first few and keeps the rest waiting, untimed', () => {
  const q = createQueue({ max: 2 });
  q.add('a', 5000); q.add('b', 0); q.add('c', 5000);
  assert.deepEqual(q.visible(), ['a', 'b']);
  assert.equal(q.waiting(), 1);
  assert.deepEqual(q.tick(4000), []);
  assert.equal(q.remaining('c'), 5000, 'a waiting toast spends no time');
  assert.deepEqual(q.tick(1000), ['a']);
  assert.deepEqual(q.visible(), ['b', 'c']);
  assert.equal(q.remaining('c'), 5000, 'it starts its full time when it is shown');
  assert.equal(q.nextDue(), 5000);
});

test('a paused queue spends nothing; an untimed toast never expires', () => {
  const q = createQueue({ max: 3 });
  q.add('a', 5000); q.add('b', 0);
  q.pause();
  assert.deepEqual(q.tick(60000), []);
  assert.equal(q.nextDue(), null);
  q.resume();
  assert.deepEqual(q.tick(60000), ['a']);
  assert.deepEqual(q.tick(1e9), []);
  assert.deepEqual(q.visible(), ['b']);
  assert.equal(q.nextDue(), null);
});

test('duplicates are ignored and removal reports whether anything went', () => {
  const q = createQueue();
  q.add('a', 1); q.add('a', 1);
  assert.equal(q.size, 1);
  assert.equal(q.remove('a'), true);
  assert.equal(q.remove('a'), false);
  assert.deepEqual(q.tick(-5), []);
});

test('hotkeys match by physical key, so Option+T on a Mac works', () => {
  const m = parseHotkey('Alt+T');
  const ev = (o) => ({ altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, ...o });
  assert.equal(m(ev({ altKey: true, code: 'KeyT', key: '†' })), true);
  assert.equal(m(ev({ altKey: true, shiftKey: true, code: 'KeyT', key: 'T' })), false);
  assert.equal(m(ev({ code: 'KeyT', key: 't' })), false);
  assert.equal(parseHotkey('none'), null);
  assert.equal(parseHotkey(''), null);
  assert.equal(parseHotkey('F8')(ev({ key: 'F8', code: 'F8' })), true);
});

test('the postmark reads day, month and time', () => {
  assert.equal(postmarkText(new Date(2026, 8, 24, 14, 32)), '24 SEP 14:32');
  assert.equal(postmarkText(new Date(2026, 0, 3, 9, 5)), '3 JAN 09:05');
  assert.equal(postmarkText('not a date'), '');
});

test('the postmark carries its ring words and date, escaped', async () => {
  const { postmarkSvg, RING } = await import('./skins/playful.js');
  const svg = postmarkSvg({ ring: RING.error, date: '24 SEP 14:32', id: 'x' });
  assert.match(svg, /RETURNED/);
  assert.match(svg, /24 SEP 14:32/);
  assert.match(svg, /aria-hidden="true"/);
  assert.match(postmarkSvg({ ring: '<b>' }), /&lt;b&gt;/);
});

test('in a pile only the letter in front spends time; the next comes forward with its full time', () => {
  const q = createQueue({ max: 3, front: true });
  q.add('a', 5000); q.add('b', 6000); q.add('c', 0); q.add('d', 5000);
  assert.deepEqual(q.visible(), ['a', 'b', 'c']);
  assert.equal(q.nextDue(), null, 'the front letter is an error that waits for the person');
  assert.deepEqual(q.tick(60000), []);
  assert.equal(q.remaining('a'), 5000, 'letters behind the front one keep their time');
  q.remove('c');
  assert.deepEqual(q.visible(), ['a', 'b', 'd'], 'the waiting one joins the pile in front');
  assert.deepEqual(q.tick(5000), ['d']);
  assert.deepEqual(q.tick(6000), ['b']);
  q.front = false;
  assert.equal(q.nextDue(), 5000);
});

test('a title and its message are read with a pause between them', () => {
  assert.equal(joinTitle("Couldn't save", 'Check your connection.'), "Couldn't save. Check your connection.");
  assert.equal(joinTitle('Saved!', 'All done.'), 'Saved! All done.');
  assert.equal(joinTitle('Note:', 'Checkout is at 11.'), 'Note: Checkout is at 11.');
  assert.equal(joinTitle('', 'Just a message.'), 'Just a message.');
  assert.equal(joinTitle('Just a title', '  '), 'Just a title');
});
