// The pure part of the sideways-scroll gate. The browser part (a page that really does scroll sideways, in a phone
// context, against the old innerWidth yardstick) is tools/lib/overflow.check.mjs, run by `npm run check` through a slot.

import test from 'node:test';
import assert from 'node:assert/strict';
import { sidewaysScroll } from './overflow.mjs';

test('an allowClipped exception needs a reason', () => {
  assert.throws(() => sidewaysScroll(null, 390, { allowClipped: ' ' }), /needs a reason/);
  assert.throws(() => sidewaysScroll(null, 390, { allowClipped: '' }), /needs a reason/);
});
