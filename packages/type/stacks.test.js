// The mirrored font stacks in stacks.js are the ones tokens.css declares.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STACKS, stackOf } from './stacks.js';

const css = fs.readFileSync(new URL('../tokens/tokens.css', import.meta.url), 'utf8');
const declared = name => new RegExp(String.raw`--sg-font-${name}:\s*([^;]+);`).exec(css)[1].trim();

test('the mirrored stacks are the token stacks, byte for byte', () => {
  assert.equal(STACKS.hand, declared('hand'));
  assert.equal(STACKS.body, declared('body'));
});

test('hand and body stacks name a Kannada face, so a canvas measures Kannada in a face the repo ships', () => {
  assert.match(STACKS.hand, /'Noto Sans Kannada'/);
  assert.match(STACKS.body, /'Noto Sans Kannada'/);
});

test('stackOf reads the property when there is a DOM and falls back to the mirror when there is none', () => {
  assert.equal(stackOf(null, 'hand'), STACKS.hand);
  globalThis.getComputedStyle = () => ({ getPropertyValue: p => (p === '--sg-font-hand' ? " 'Mine', cursive " : '') });
  try {
    assert.equal(stackOf({}, 'hand'), "'Mine', cursive");
    assert.equal(stackOf({}, 'body'), STACKS.body);
  } finally { delete globalThis.getComputedStyle; }
});
