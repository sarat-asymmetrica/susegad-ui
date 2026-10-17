import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, openersFor, isDismiss } from './dialog.core.js';
import { lintText } from '../../../tools/copy-lint.mjs';

test('openersFor finds only the openers whose data-sg-dialog matches this dialog\'s id, in order', () => {
  const candidates = [
    { id: 'a', dialogAttr: 'ask' },
    { id: 'b', dialogAttr: 'rooms' },
    { id: 'c', dialogAttr: 'ask' },
  ];
  assert.deepEqual(openersFor(candidates, 'ask'), ['a', 'c']);
  assert.deepEqual(openersFor(candidates, 'rooms'), ['b']);
  assert.deepEqual(openersFor(candidates, 'missing'), []);
});

test('isDismiss recognises the dismiss return values, and only those', () => {
  assert.equal(isDismiss('dismiss'), true);
  assert.equal(isDismiss('cancel'), true);
  assert.equal(isDismiss(''), true);
  assert.equal(isDismiss('ok'), false);
  assert.equal(isDismiss('send'), false);
});

test('STRINGS: every value is a plain, non-empty, copy-lint-clean string, and the close label is there', () => {
  assert.ok(STRINGS.dismiss, 'a close label');
  for (const [k, v] of Object.entries(STRINGS)) {
    assert.ok(typeof v === 'string' && v.trim() === v && v.length > 0, `${k}: a trimmed, non-empty string`);
    assert.deepEqual(lintText(v), [], `${k} reads clean to the copy lint`);
  }
});
