import test from 'node:test';
import assert from 'node:assert/strict';
import { stageSeconds, WARP_SCRIPT, DEFAULT_STAGE_SECONDS } from './warp.core.js';

test('abri: the drift moment follows the register pace, quiet is the still', () => {
  assert.equal(stageSeconds('abri', 'playful'), 33);
  assert.equal(stageSeconds('abri', 'warm'), 44);
  assert.equal(stageSeconds('abri', 'quiet'), 1);
});

test('a scene without an entry shows its first few seconds', () => {
  assert.equal(stageSeconds('kolam', 'warm'), DEFAULT_STAGE_SECONDS);
});

test('the page script parses', () => {
  assert.doesNotThrow(() => new Function(WARP_SCRIPT));
});
