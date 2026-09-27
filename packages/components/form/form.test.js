import test from 'node:test';
import assert from 'node:assert/strict';
import { next, words, fieldName, STRINGS, STATES, SENDING_AFTER_MS } from './form.core.js';

test('a submit with problems, then a good one, then the answer', () => {
  let s = 'idle';
  s = next(s, 'invalid'); assert.equal(s, 'invalid');
  s = next(s, 'submit'); assert.equal(s, 'sending');
  s = next(s, 'ok'); assert.equal(s, 'sent');
  s = next(s, 'reset'); assert.equal(s, 'idle');
  assert.equal(next(next('idle', 'submit'), 'fail'), 'failed');
});

test('while sending, another submit or a stray problem changes nothing', () => {
  assert.equal(next('sending', 'submit'), 'sending');
  assert.equal(next('sending', 'invalid'), 'sending');
});

test('only a send under way can settle', () => {
  assert.equal(next('idle', 'ok'), 'idle');
  assert.equal(next('sent', 'fail'), 'sent');
  assert.equal(next('failed', 'submit'), 'sending', 'trying again');
  assert.ok(STATES.includes(next('idle', 'nonsense')));
});

test('each state has words, in the register', () => {
  assert.equal(words('sending', { register: 'quiet' }), 'Sending.');
  assert.equal(words('sending', { register: 'warm' }), 'Sending your message.');
  assert.equal(words('sent', { register: 'quiet' }), 'Sent.');
  assert.equal(words('sent', { message: 'Sent. We will write back within a day.' }), 'Sent. We will write back within a day.');
  assert.equal(words('idle'), '');
  assert.equal(words('sending', { register: 'loud' }), STRINGS.sending.warm, 'an unknown register reads as warm');
});

test('the summary counts and names what to fix', () => {
  assert.equal(words('invalid', { count: 2, labels: ['Your name', 'Phone or email'] }), 'Check 2 fields: Your name, Phone or email.');
  assert.equal(words('invalid', { count: 1, labels: [''] }), 'Check 1 field.');
  assert.equal(fieldName('Phone (optional)'), 'Phone');
  assert.equal(fieldName('  Your name: * '), 'Your name');
});

test('a failure says what happened and that nothing was lost', () => {
  assert.equal(words('failed', { error: 'check your connection' }), "Couldn't send: check your connection. Your words are still here; try again when you're ready.");
  assert.equal(STRINGS.failedToastMessage("the server answered 503."), 'The server answered 503. Your words are still in the form.');
  assert.equal(STRINGS.failedToastMessage(''), 'Your words are still in the form.');
});

test('fast work never flashes a loader', () => {
  assert.ok(SENDING_AFTER_MS >= 100 && SENDING_AFTER_MS <= 300);
});

test('a summary name never ends in a doubled full stop', () => {
  assert.equal(fieldName('I have read the house rules.'), 'I have read the house rules');
  assert.equal(fieldName('House rules'), 'House rules');
  assert.equal(STRINGS.check(1, [fieldName('I agree.')]).endsWith('I agree.'), true);
});
