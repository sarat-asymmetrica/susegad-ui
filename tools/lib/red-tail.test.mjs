import test from 'node:test';
import assert from 'node:assert/strict';
import { redTail } from './red-tail.mjs';

const many = k => Array.from({ length: k }, (_, i) => `pass  clause ${i}`);

test('a FAIL line above the tail is kept (the CI case: one red clause, then 30 passing ones)', () => {
  const out = ['pass  first', 'FAIL  warm: the door opens  (0 of 1)', ...many(30), '75 passed, 1 failed in chromium'].join('\n');
  const t = redTail(out);
  assert.match(t, /FAIL {2}warm: the door opens/);
  assert.match(t, /75 passed, 1 failed/);
  assert.equal(t.split('\n').length, 1 + 1 + 15);
});

test('a FAIL inside the tail is printed once, and a short output is printed whole', () => {
  const out = [...many(3), 'FAIL  x', 'done'].join('\n');
  assert.equal(redTail(out), out);
});

test('indented FAIL and TAP "not ok" lines count', () => {
  const out = ['  FAIL  nested', 'not ok 3 - tap', ...many(20)].join('\n');
  const t = redTail(out);
  assert.match(t, /^ {2}FAIL {2}nested\nnot ok 3 - tap\n… \(5 line/);
});
