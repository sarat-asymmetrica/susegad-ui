import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, EDGES, normalizeEdge, offTransform, openersFor, isDismiss } from './drawer.core.js';

test('normalizeEdge accepts only a known edge, and falls back to end', () => {
  for (const e of EDGES) assert.equal(normalizeEdge(e), e);
  assert.equal(normalizeEdge('left'), 'end');
  assert.equal(normalizeEdge(undefined), 'end');
  assert.equal(normalizeEdge(null), 'end');
});

test('offTransform gives a logical (start/end) transform per edge, not left/right', () => {
  assert.equal(offTransform('end'), 'translateX(100%)');
  assert.equal(offTransform('start'), 'translateX(-100%)');
  assert.equal(offTransform('top'), 'translateY(-100%)');
  assert.equal(offTransform('bottom'), 'translateY(100%)');
  assert.equal(offTransform('nonsense'), 'translateX(100%)', 'an unknown edge falls back to end, like normalizeEdge');
});

test('openersFor finds only the openers whose data-sg-drawer matches this drawer\'s id', () => {
  const candidates = [{ id: 'a', drawerAttr: 'rooms' }, { id: 'b', drawerAttr: 'ask' }];
  assert.deepEqual(openersFor(candidates, 'rooms'), ['a']);
  assert.deepEqual(openersFor(candidates, 'missing'), []);
});

test('isDismiss and STRINGS match Dialog\'s shape', () => {
  assert.equal(isDismiss('dismiss'), true);
  assert.equal(isDismiss('ok'), false);
  assert.equal(typeof STRINGS.dismiss, 'string');
});
