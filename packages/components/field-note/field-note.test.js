import test from 'node:test';
import assert from 'node:assert/strict';
import { pickMessage, nextShown, tokenList, STRINGS } from './field-note.core.js';
import { arrowPath, valueRuns } from './skins/warm.js';

test('a valid field has no message', () => {
  assert.deepEqual(pickMessage({ valid: true }), { check: null, message: '' });
  assert.deepEqual(pickMessage(null), { check: null, message: '' });
});

test('messages say what happened and how to fix it', () => {
  assert.equal(pickMessage({ valueMissing: true }, { label: 'Your email' }).message, 'Enter your email.');
  assert.equal(pickMessage({ valueMissing: true }, { label: 'Email:' }).message, 'Enter your email.');
  assert.equal(pickMessage({ valueMissing: true }, { label: 'OTP' }).message, 'Enter your OTP.', 'acronyms keep their capitals');
  assert.equal(pickMessage({ valueMissing: true }, {}).message, 'Fill in this field.');
  assert.equal(pickMessage({ valueMissing: true }, { kind: 'choice', label: 'Room' }).message, 'Choose your room.');
  assert.equal(pickMessage({ valueMissing: true }, { kind: 'check' }).message, 'Tick this box to continue.');
  assert.equal(pickMessage({ typeMismatch: true }, { type: 'email' }).message, 'Enter an email address like name@example.com.');
  assert.equal(pickMessage({ tooShort: true }, { minLength: 8, length: 5 }).message, 'Use at least 8 characters. You have 5.');
  assert.equal(pickMessage({ rangeOverflow: true }, { max: '6' }).message, 'Enter 6 or less.');
  assert.equal(pickMessage({ rangeOverflow: true }, { type: 'number', min: '1', max: '6' }).message, 'Enter a number from 1 to 6.');
  assert.equal(pickMessage({ stepMismatch: true }, { step: '1' }).message, 'Enter a whole number.');
  assert.equal(pickMessage({ badInput: true }, { type: 'number' }).message, 'Enter a number, using digits.');
});

test('the first thing to fix wins, and the page can word any check', () => {
  assert.equal(pickMessage({ valueMissing: true, typeMismatch: true }, { type: 'email' }).check, 'valueMissing');
  assert.equal(pickMessage({ patternMismatch: true }, { messages: { patternMismatch: 'Use 10 digits, like 98220 12345.' } }).message, 'Use 10 digits, like 98220 12345.');
  assert.equal(pickMessage({ customError: true }, { validationMessage: 'That date is already booked.' }).message, 'That date is already booked.');
});

test('no nagging while typing the first time', () => {
  let s = { dirty: false, shown: false };
  s = nextShown(s, 'input', false);
  assert.equal(s.shown, false, 'typing does not show it');
  s = nextShown(s, 'blur', false);
  assert.equal(s.shown, true, 'leaving a changed, invalid field shows it');
  s = nextShown(s, 'input', false);
  assert.equal(s.shown, true, 'still wrong: still shown');
  s = nextShown(s, 'input', true);
  assert.equal(s.shown, false, 'fixed: it goes at once');
  s = nextShown(s, 'input', false);
  assert.equal(s.shown, false, 'broken again while typing: wait for the blur');
  assert.equal(nextShown(s, 'blur', false).shown, true);
});

test('tabbing through an untouched field says nothing; submitting shows everything', () => {
  const quiet = nextShown({ dirty: false, shown: false }, 'blur', false);
  assert.deepEqual(quiet, { dirty: false, shown: false });
  assert.equal(nextShown(quiet, 'submit', false).shown, true);
  assert.equal(nextShown(quiet, 'server', false).shown, true);
  assert.deepEqual(nextShown({ dirty: true, shown: true }, 'reset', false), { dirty: false, shown: false });
});

test('aria-describedby keeps the ids that were already there', () => {
  assert.equal(tokenList('hint-1', 'note-1', true), 'hint-1 note-1');
  assert.equal(tokenList('hint-1 note-1', 'note-1', true), 'hint-1 note-1');
  assert.equal(tokenList('hint-1 note-1', 'note-1', false), 'hint-1');
  assert.equal(tokenList(null, 'note-1', false), '');
});

test('the pencil arrow is seeded: the same seed draws the same arrow', () => {
  const a = arrowPath(7), b = arrowPath(7), c = arrowPath(8);
  assert.deepEqual(a, b);
  assert.notEqual(a.shaft, c.shaft);
  assert.match(a.shaft, /^M[\d.]+ [\d.]+ C/);
  const [x, y] = a.end;
  assert.ok(x > 0 && x < 40 && y > 0 && y < 28, 'it ends inside its box');
  assert.equal(STRINGS.prefix.error, 'Error: ');
});

test('date limits are said the way people say dates, in the page language', () => {
  assert.equal(pickMessage({ rangeUnderflow: true }, { type: 'date', min: '2026-10-16' }).message, 'Choose 16 October 2026 or later.');
  assert.equal(pickMessage({ rangeUnderflow: true }, { type: 'date', min: '2026-10-16', lang: 'en' }).message, 'Choose 16 October 2026 or later.');
  assert.equal(pickMessage({ rangeOverflow: true }, { type: 'date', max: '2027-01-05', lang: 'en-GB' }).message, 'Choose 5 January 2027 or earlier.');
  assert.equal(pickMessage({ rangeOverflow: true }, { type: 'date', max: '2027-01-05', lang: 'en-US' }).message, 'Choose January 5, 2027 or earlier.');
  assert.match(pickMessage({ rangeUnderflow: true }, { type: 'date', min: '2026-10-16', lang: 'hi' }).message, /16 अक्टूबर 2026/, 'Hindi month name');
});

test('time and month limits read naturally; odd values pass through', async () => {
  const { formatBound } = await import('./field-note.core.js');
  assert.equal(formatBound('2026-10', 'month', 'en'), 'October 2026');
  assert.match(formatBound('09:30', 'time', 'en'), /^9:30\s?am$/i);
  assert.equal(formatBound('2026-W42', 'week', 'en'), '2026-W42');
  assert.equal(formatBound('6', 'number', 'en'), '6');
  assert.equal(formatBound('', 'date', 'en'), '');
});

test('examples, numbers and addresses are marked, so they can be set in the body face', () => {
  const vals = s => valueRuns(s).filter(([, v]) => v).map(([x]) => x);
  assert.deepEqual(vals('Use 10 digits, like 98220 12345.'), ['10', '98220 12345']);
  assert.deepEqual(vals('Enter an email address like name@example.com.'), ['name@example.com']);
  assert.deepEqual(vals('Enter a number from 1 to 6.'), ['1', '6']);
  assert.deepEqual(vals('Enter a web address starting with https://.'), []);
  assert.deepEqual(vals('Visit https://casa.example/book, then 14:30.'), ['https://casa.example/book', '14:30']);
  assert.deepEqual(vals('Choose 16 October 2026 or later.'), ['16', '2026']);
  assert.equal(valueRuns('Enter your name.').length, 1);
  assert.equal(valueRuns('Use 10 digits, like 98220 12345.').map(([x]) => x).join(''), 'Use 10 digits, like 98220 12345.', 'nothing lost or added');
});
