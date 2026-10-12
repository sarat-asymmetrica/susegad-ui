// The card's pure core: which image type bytes really are, the file name that follows them, the way a line is
// broken, and where things sit on the card.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD, PURPOSES, sniff, slug, fileName, wrap, fitSize, seedFor, layout } from './card.core.js';

const bytes = (...v) => Uint8Array.from([...v, ...new Array(16).fill(0)]);

test('sniff reads the type from the first bytes, not from what was asked for', () => {
  assert.equal(sniff(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png');
  assert.equal(sniff(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assert.equal(sniff(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])), 'image/webp');
  assert.equal(sniff(Uint8Array.from([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])), 'image/avif');
  assert.equal(sniff(bytes(0x47, 0x49, 0x46, 0x38)), 'image/gif');
  assert.equal(sniff(bytes(1, 2, 3, 4)), null);
  assert.equal(sniff(new Uint8Array(0)), null);
});

test('the file name follows the bytes: PNG to save, JPG to share', () => {
  assert.equal(PURPOSES.save, 'image/png');
  assert.equal(PURPOSES.share, 'image/jpeg');
  assert.equal(fileName('Maria Fernandes', 'image/png'), 'greeting-card-maria-fernandes.png');
  assert.equal(fileName('Maria Fernandes', 'image/jpeg'), 'greeting-card-maria-fernandes.jpg');
  // a browser that could not encode AVIF handed back PNG: the name says png
  const asked = 'image/avif', got = sniff(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a));
  assert.equal(fileName('x', got), 'greeting-card-x.png');
  assert.notEqual(fileName('x', got), fileName('x', asked));
});

test('slug keeps letters in any script, and never returns nothing', () => {
  assert.equal(slug('  Zoë  D’Souza! '), 'zoë-d-souza');
  assert.equal(slug('मारिया'), 'मारिया');
  assert.equal(slug('ಕಾರ್ತಿಕ್'), 'ಕಾರ್ತಿಕ್');
  assert.equal(slug('***'), 'guest');
  assert.equal(slug(''), 'guest');
  assert.ok(slug('a'.repeat(200)).length <= 40);
});

test('wrap breaks at spaces to fit, keeps a long word whole, and ends a long text with an ellipsis', () => {
  const measure = s => s.length * 10;
  assert.deepEqual(wrap('See you at the feast', measure, 100), ['See you at', 'the feast']);
  assert.deepEqual(wrap('Supercalifragilistic is long', measure, 100), ['Supercalifragilistic', 'is long']);
  assert.deepEqual(wrap('', measure, 100), []);
  assert.deepEqual(wrap('one two three four five six', measure, 100, 2), ['one two', 'three four…']);
});

test('fitSize takes the largest size that fits, and not less than the floor', () => {
  const at = (t, s) => t.length * s * 0.5;
  assert.equal(fitSize('Maria', at, 500, { max: 96, min: 44 }), 96);
  assert.ok(fitSize('Maria Fernandes de Souza', at, 500, { max: 96, min: 44 }) < 96);
  assert.equal(fitSize('x'.repeat(100), at, 500, { max: 96, min: 44 }), 44);
});

test('the seed is the name as written, trimmed; the card is portrait 4:5 and everything sits inside it', () => {
  assert.equal(seedFor('  Asha '), 'Asha');
  assert.notEqual(seedFor('Asha'), seedFor('asha'));
  assert.equal(seedFor(''), 'guest');
  assert.equal(CARD.width / CARD.height, 0.8);
  const L = layout();
  assert.ok(L.bloom.x >= 0 && L.bloom.x + L.bloom.size <= CARD.width && L.bloom.y + L.bloom.size < L.name.y - 20);
  assert.ok(L.name.y < L.rule.y && L.rule.y < L.line.y && L.line.y + 3 * L.line.leading < CARD.height);
});
