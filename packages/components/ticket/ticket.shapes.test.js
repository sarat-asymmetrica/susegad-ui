import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapLines, LAYOUT } from './ticket.png.js';
import { framePaths, tearPath } from './skins/warm.js';
import { ticketShape } from './skins/playful.js';

// a fake canvas: every character is 10 wide
const m = s => s.length * 10;

test('wrapLines breaks at spaces, never wider than the line', () => {
  assert.deepEqual(wrapLines(m, 'Show this code at the door', 130), ['Show this', 'code at the', 'door']);
  assert.deepEqual(wrapLines(m, 'short', 130), ['short']);
  assert.deepEqual(wrapLines(m, '', 130), []);
  assert.deepEqual(wrapLines(m, '  spaces   all  over ', 100), ['spaces all', 'over']);
});

test('a word wider than the line is broken inside, so nothing runs off the picture', () => {
  const lines = wrapLines(m, 'abcdefghijklmnopqrstuvwxyz', 100);
  assert.deepEqual(lines, ['abcdefghij', 'klmnopqrst', 'uvwxyz']);
  assert.ok(lines.every(l => m(l) <= 100));
  assert.deepEqual(wrapLines(m, 'ok abcdefghijklmnop', 100), ['ok', 'abcdefghij', 'klmnop']);
});

test('the picture is 600 wide with room for the code and its quiet zone', () => {
  assert.equal(LAYOUT.width, 600);
  assert.ok(LAYOUT.qr >= 200 && LAYOUT.quiet >= 4);
  assert.ok(LAYOUT.width - LAYOUT.pad * 2 > LAYOUT.qr);
});

test('the pencil box is four strokes that run past their corners; the tear is one dashed line', () => {
  const a = framePaths(400, 300, 5), b = framePaths(400, 300, 5), c = framePaths(400, 300, 6);
  assert.equal(a.length, 4);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(Number(a[0].match(/^M(-?[\d.]+)/)[1]) < 0, 'the top stroke starts left of the box');
  assert.match(tearPath(400, 300, 260, true, 3), /^M260 10 Q[\d.]+ 150 260 290$/);
  assert.match(tearPath(400, 300, 200, false, 3), /^M10 200 Q200 [\d.]+ 390 200$/);
  assert.deepEqual(tearPath(400, 300, 200, false, 3), tearPath(400, 300, 200, false, 3));
});

test('the ticket has a bite out of each edge the tear meets, down the card or across it', () => {
  const v = ticketShape(400, 300, 260, true);
  assert.deepEqual(v.bites, [[260, 0, 7], [260, 300, 7]]);
  assert.match(v.perf, /^M260 13 V287$/);
  assert.match(v.edge, /^M10 0 H253 A7 7 0 0 0 267 0 H390 /);
  const h = ticketShape(400, 300, 200, false);
  assert.deepEqual(h.bites, [[0, 200, 7], [400, 200, 7]]);
  assert.match(h.perf, /^M13 200 H387$/);
  const near = ticketShape(400, 300, 3, true);
  assert.ok(near.bites[0][0] >= 19, 'a tear too close to a corner is moved in');
});
