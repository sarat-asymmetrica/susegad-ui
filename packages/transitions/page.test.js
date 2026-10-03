import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldAnimate } from './page.core.js';
import { nextTransitionName, sameDocumentTransition } from './page.js';

test('shouldAnimate needs support and no reduced motion', () => {
  assert.equal(shouldAnimate({ supported: true, reducedMotion: false }), true);
  assert.equal(shouldAnimate({ supported: false, reducedMotion: false }), false);
  assert.equal(shouldAnimate({ supported: true, reducedMotion: true }), false);
  assert.equal(shouldAnimate({ supported: false, reducedMotion: true }), false);
  assert.equal(shouldAnimate(), false, 'defaults to unsupported, so an unknown environment never animates');
});

test('nextTransitionName is unique on every call and stable in its prefix', () => {
  const a = nextTransitionName('sg-vt'), b = nextTransitionName('sg-vt');
  assert.notEqual(a, b);
  assert.match(a, /^sg-vt-\d+$/);
  assert.match(nextTransitionName('sg-kantar'), /^sg-kantar-\d+$/);
});

// sameDocumentTransition has no DOM here (no document.startViewTransition in
// Node), so it always takes the "run directly" path — which is itself the
// no-support fallback this function exists to guarantee.
test('sameDocumentTransition runs the update directly with no document.startViewTransition', () => {
  let ran = 0;
  const result = sameDocumentTransition(() => { ran++; });
  assert.equal(ran, 1);
  assert.equal(result, null);
});

test('sameDocumentTransition runs directly, not twice, when a transition is already pending', () => {
  let ran = 0;
  const fakePending = {};
  const result = sameDocumentTransition(() => { ran++; }, { pending: fakePending });
  assert.equal(ran, 1);
  assert.equal(result, null);
});

test('sameDocumentTransition runs directly under reduced motion even if a transition object is somehow available', () => {
  const savedStartViewTransition = globalThis.document?.startViewTransition;
  globalThis.document = { startViewTransition: fn => { fn(); return { finished: Promise.resolve() }; } };
  let ran = 0;
  const result = sameDocumentTransition(() => { ran++; }, { reducedMotion: true });
  assert.equal(ran, 1);
  assert.equal(result, null, 'reduced motion never returns a transition to track');
  if (savedStartViewTransition === undefined) delete globalThis.document;
});
