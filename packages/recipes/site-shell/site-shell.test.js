import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextStep, isFirstStep, STEPS } from './site-shell.core.js';

test('nextStep walks the two-step flow forward, and holds at the end', () => {
  assert.equal(nextStep('dates'), 'held');
  assert.equal(nextStep('held'), 'held');
});

test('nextStep is a no-op on a step it does not recognise', () => {
  assert.equal(nextStep('nonsense'), 'nonsense');
});

test('isFirstStep names exactly the flow\'s own first step', () => {
  assert.equal(isFirstStep(STEPS[0]), true);
  assert.equal(isFirstStep(STEPS[1]), false);
  assert.equal(isFirstStep('nonsense'), false);
});
