import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, openersFor, isDismiss } from './dialog.core.js';

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

test('STRINGS has a close label', () => {
  assert.equal(typeof STRINGS.dismiss, 'string');
  assert.ok(STRINGS.dismiss.length > 0);
});
