import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, score, filterOptions, markRange, STRINGS } from './combobox.core.js';

const PLACES = [
  { value: 'Mumbai', aliases: ['Bombay', 'मुंबई'] },
  { value: 'Navi Mumbai' },
  { value: 'Balcão' },
  { value: 'Panaji', aliases: ['Panjim', 'पणजी'] },
  { value: 'Old Goa' },
  { value: 'Thiruvananthapuram', aliases: ['Trivandrum'] },
  { value: 'Bengaluru', aliases: ['Bangalore', 'ಬೆಂಗಳೂರು'] },
  { value: 'Margao', aliases: ['Madgaon', 'मडगांव'] },
];
const names = q => filterOptions(q, PLACES).map(r => r.option.value);

test('fold: Latin accents go, Indic vowel signs stay', () => {
  assert.equal(fold('Balcão'), 'balcao');
  assert.equal(fold('São Tomé'), 'sao tome');
  assert.equal(fold('  Old   Goa! '), 'old goa');
  assert.equal(fold('मुंबई'), 'मुंबई'.normalize('NFC'), 'Devanagari keeps its anusvara and matras');
  assert.equal(fold('ಬೆಂಗಳೂರು'), 'ಬೆಂಗಳೂರು'.normalize('NFC'), 'Kannada keeps its vowel signs');
  assert.equal(fold('Thiruvananthapuram', { loose: true }), 'tiruvanantapuram');
  assert.equal(fold('Madgaon', { loose: true }), 'madgaon');
});

test('"mum" finds Mumbai first, then Navi Mumbai', () => {
  assert.deepEqual(names('mum'), ['Mumbai', 'Navi Mumbai']);
});

test('"Balcao" finds "Balcão", in any case', () => {
  assert.deepEqual(names('Balcao'), ['Balcão']);
  assert.deepEqual(names('BALCÃO'), ['Balcão']);
});

test('older names and other scripts find the place, and say which', () => {
  const r = filterOptions('bomb', PLACES);
  assert.equal(r[0].option.value, 'Mumbai'); assert.equal(r[0].via, 'Bombay');
  assert.equal(filterOptions('मुं', PLACES)[0].option.value, 'Mumbai');
  assert.equal(filterOptions('ಬೆಂಗ', PLACES)[0].option.value, 'Bengaluru');
  assert.equal(filterOptions('panjim', PLACES)[0].via, 'Panjim');
});

test('spelled as heard: loose romanisation finds the place, below exact matches', () => {
  assert.deepEqual(names('tiruvanant'), ['Thiruvananthapuram']);
  const r = filterOptions('madgaon', PLACES);
  assert.equal(r[0].option.value, 'Margao');
});

test('word starts, and ranking keeps the page order among equals', () => {
  assert.deepEqual(names('goa'), ['Old Goa']);
  assert.equal(score('goa', 'Old Goa'), 2);
  assert.equal(score('ai', 'Panaji'), -1, 'two letters inside a word are not a match');
  assert.equal(score('aji', 'Panaji'), 4);
  assert.deepEqual(names(''), PLACES.map(p => p.value), 'an empty query shows everything, in order');
});

test('markRange maps accents back to the original text', () => {
  assert.deepEqual(markRange('Balcão', 'balcao'), [0, 6]);
  assert.deepEqual(markRange('Navi Mumbai', 'mum'), [5, 8]);
  assert.deepEqual(markRange('Mumbai', 'Mu'), [0, 2]);
  assert.equal(markRange('Mumbai', 'xyz'), null);
});

test('words', () => {
  assert.equal(STRINGS.count(0), 'No suggestions');
  assert.equal(STRINGS.count(1), '1 suggestion');
  assert.equal(STRINGS.count(4), '4 suggestions');
});
