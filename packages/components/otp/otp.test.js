import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toAsciiDigits, digitsOf, lengthOf, insert, remove, activeBoxes, groupEnds, boxPose, landing } from './otp.core.js';

test('digitsOf keeps digits only, as ASCII, from any Indian script and full width', () => {
  assert.equal(digitsOf('Your code is 482-913. Do not share it.'), '482913');
  assert.equal(digitsOf('४८२९१३'), '482913', 'Devanagari');
  assert.equal(digitsOf('೪೮೨೯೧೩'), '482913', 'Kannada');
  assert.equal(digitsOf('৪৮২ ௯௧௩'), '482913', 'Bengali and Tamil');
  assert.equal(digitsOf('４８２９１３'), '482913', 'full width');
  assert.equal(digitsOf('123456789', 6), '123456');
  assert.equal(digitsOf(null), '');
  assert.equal(digitsOf('abc'), '');
});

test('lengthOf: the attribute, then maxlength, then the pattern, then 6; kept between 3 and 12', () => {
  assert.equal(lengthOf({ length: '4', maxlength: 6 }), 4);
  assert.equal(lengthOf({ maxlength: 8 }), 8);
  assert.equal(lengthOf({ maxlength: -1, pattern: '[0-9]{5}' }), 5);
  assert.equal(lengthOf({ pattern: '\\d{7}' }), 7);
  assert.equal(lengthOf({}), 6);
  assert.equal(lengthOf({ length: '1' }), 3);
  assert.equal(lengthOf({ length: '40' }), 12);
  assert.equal(lengthOf({ length: 'six' }), 6);
});

test('typing fills the next box and moves on', () => {
  assert.deepEqual(insert('', 0, 0, '4', 6), { value: '4', caret: 1, changed: true });
  assert.deepEqual(insert('48', 2, 2, '2', 6), { value: '482', caret: 3, changed: true });
});

test('typing over a box replaces its digit, never pushes the rest along', () => {
  assert.deepEqual(insert('482913', 2, 3, '7', 6), { value: '487913', caret: 3, changed: true }, 'a selected box');
  assert.deepEqual(insert('482913', 2, 2, '7', 6), { value: '487913', caret: 3, changed: true }, 'the caret in a full code');
  assert.deepEqual(insert('48291', 1, 1, '0', 6), { value: '40291', caret: 2, changed: true });
  assert.deepEqual(insert('482913', 6, 6, '5', 6), { value: '482913', caret: 6, changed: false }, 'a full code takes no more');
});

test('letters and symbols go nowhere', () => {
  assert.deepEqual(insert('48', 2, 2, 'a', 6), { value: '48', caret: 2, changed: false });
  assert.deepEqual(insert('48', 2, 2, ' ', 6).changed, false);
});

test('a paste or an SMS autofill fills every box, wherever the caret was', () => {
  assert.deepEqual(insert('', 0, 0, 'Your code is 482 913', 6), { value: '482913', caret: 6, changed: true });
  assert.deepEqual(insert('11', 1, 1, '482913', 6), { value: '482913', caret: 6, changed: true });
  assert.deepEqual(insert('1', 1, 1, '48', 6), { value: '148', caret: 3, changed: true }, 'a short paste types in');
  assert.deepEqual(insert('', 0, 0, '48291377', 6).value, '482913', 'a long paste stops at the last box');
});

test('backspace empties the box before the caret and pulls the rest along', () => {
  assert.deepEqual(remove('482913', 6, 6), { value: '48291', caret: 5, changed: true });
  assert.deepEqual(remove('482913', 3, 3), { value: '48913', caret: 2, changed: true });
  assert.deepEqual(remove('482', 0, 0), { value: '482', caret: 0, changed: false }, 'nothing before the first box');
  assert.deepEqual(remove('482913', 2, 3), { value: '48913', caret: 2, changed: true }, 'a selected box goes');
  assert.deepEqual(remove('482913', 0, 6), { value: '', caret: 0, changed: true }, 'select all and delete');
  assert.deepEqual(remove('482913', 2, 2, true), { value: '48913', caret: 2, changed: true }, 'delete forward');
  assert.deepEqual(remove('482913', 4, 4, false, true), { value: '13', caret: 0, changed: true }, 'a word delete clears to the start');
});

test('the current box follows the caret, or the selection, and only while focused', () => {
  assert.deepEqual(activeBoxes(2, 2, 6, true), [2]);
  assert.deepEqual(activeBoxes(6, 6, 6, true), [5], 'a full code keeps the last box current');
  assert.deepEqual(activeBoxes(1, 4, 6, true), [1, 2, 3]);
  assert.deepEqual(activeBoxes(0, 6, 6, true).length, 6);
  assert.deepEqual(activeBoxes(2, 2, 6, false), []);
});

test('long codes break into groups for reading', () => {
  assert.deepEqual(groupEnds(6), [2]);
  assert.deepEqual(groupEnds(8), [3]);
  assert.deepEqual(groupEnds(9), [2, 5]);
  assert.deepEqual(groupEnds(4), []);
  assert.deepEqual(groupEnds(5), []);
});

test('playful stamps tilt a little, fixed per box; quiet and warm sit square', () => {
  assert.deepEqual(boxPose('code', 2, 'warm'), { rotate: 0, x: 0, y: 0 });
  assert.deepEqual(boxPose('code', 2, 'playful'), boxPose('code', 2, 'playful'));
  assert.notDeepEqual(boxPose('code', 2, 'playful'), boxPose('code', 3, 'playful'));
  for (let i = 0; i < 50; i++) assert.ok(Math.abs(boxPose('x', i, 'playful').rotate) <= 3.5);
});

test('landing: none under reduced motion or in quiet, ink in warm, a press and spread in playful', () => {
  assert.equal(landing('still'), null);
  assert.equal(landing('state'), null);
  const w = landing('ambient');
  assert.ok(w.timing.duration <= 300 && !w.spread);
  assert.equal(w.frames.at(-1).opacity, 1);
  const p = landing('full');
  assert.match(p.frames.at(-1).transform, /scale\(1\)/);
  assert.ok(p.frames.some(f => /scale\(0\.9/.test(f.transform)), 'presses past flat');
  assert.equal(p.spread.frames.at(-1).opacity, 0);
});

test('toAsciiDigits writes any script\'s digits as ASCII and keeps everything else', () => {
  assert.equal(toAsciiDigits('९८२२० १२३४५'), '98220 12345', 'Devanagari, with its space');
  assert.equal(toAsciiDigits('+೯೧ ೯೮೨೨೦-೧೨೩೪೫'), '+91 98220-12345', 'Kannada, with + and a hyphen');
  assert.equal(toAsciiDigits('98220 12345'), '98220 12345', 'ASCII unchanged');
  assert.equal(toAsciiDigits('name@example.com'), 'name@example.com');
  assert.equal(toAsciiDigits('१८६२२५'), '186225');
  assert.equal(toAsciiDigits(null), '');
});
