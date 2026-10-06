import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, initialsOf, tiltOf, hueOf, fold, personOf, filterPeople } from './person.core.js';

// ── initialsOf ───────────────────────────────────────────────────────────

test('two names give two initials', () => {
  assert.equal(initialsOf('Sarita Fernandes'), 'SF');
});

test('middle names are skipped: first and last word', () => {
  assert.equal(initialsOf("Ana Julia D'Souza"), 'AD');
  assert.equal(initialsOf('Melwyn Dsouza e Cruz'), 'MC');
  assert.equal(initialsOf('Ana Julia de Souza'), 'AS');
});

test('a single name gives one initial', () => {
  assert.equal(initialsOf('Meera'), 'M');
});

test('spaces at the edges and in the middle are ignored', () => {
  assert.equal(initialsOf('  Melwyn  '), 'M');
  assert.equal(initialsOf('Sarita   Fernandes'), 'SF');
  assert.equal(initialsOf('\tSarita\nFernandes '), 'SF');
});

test('no letters at all gives nothing, not a crash', () => {
  for (const bad of ['', '   ', null, undefined, '— · —']) assert.equal(initialsOf(bad), '');
});

test('accents are kept as written and uppercased with the letter, and other scripts work', () => {
  assert.equal(initialsOf('évelyne Fernandes'), 'ÉF');
  assert.equal(initialsOf('Élodie Fernandes'), 'ÉF');
  assert.equal(initialsOf('अमीष कामत'), 'अक');
});

test('digits count as letters, so a handle is not eaten', () => {
  assert.equal(initialsOf('4bidden Nomad'), '4N');
});

test('small words with no letters are skipped', () => {
  assert.equal(initialsOf('—" Meera'), 'M');
});

// ── what the skins read ──────────────────────────────────────────────────

test('tiltOf is seeded: never flat, always the same for the same seed', () => {
  const t = tiltOf('priyanka');
  assert.ok(Math.abs(t) >= 0.4 && Math.abs(t) <= 1.4, `${t}`);
  for (let i = 0; i < 12; i++) {
    const x = tiltOf(`seed-${i}`);
    assert.notEqual(x, 0);
    assert.equal(x, tiltOf(`seed-${i}`), 'same seed, same tilt');
  }
  assert.notEqual(tiltOf('priyanka'), tiltOf('aldo'), 'different people lean differently');
});

test('hueOf is seeded and within the wheel', () => {
  const h = hueOf('priyanka');
  assert.ok(h >= 0 && h <= 359, `${h}`);
  assert.equal(h, hueOf('priyanka'));
});

// ── the directory's filter ───────────────────────────────────────────────

const people = [
  { name: 'Priyanka Naik', track: 'AI for Kids', words: fold('Priyanka Naik Teacher, Aldona A Konkani storybook reader') },
  { name: 'Melwyn Fernandes', track: 'Tech for Good', words: fold('Melwyn Fernandes Retired engineer Aldona A village hall booking board') },
  { name: 'Sarita Kamat', track: 'Workshops for Founders', words: fold('Sarita Kamat Founder Siolim A pricing workshop for one-person studios') },
];

test('a word matches the name, the role or the building line', () => {
  assert.deepEqual(filterPeople(people, { q: 'priyanka' }), [true, false, false]);
  assert.deepEqual(filterPeople(people, { q: 'aldona' }), [true, true, false]);
  assert.deepEqual(filterPeople(people, { q: 'storybook' }), [true, false, false]);
});

test('two words must both match, anywhere in the words', () => {
  assert.deepEqual(filterPeople(people, { q: 'priyanka storybook' }), [true, false, false]);
  assert.deepEqual(filterPeople(people, { q: 'priyanka siolim' }), [false, false, false]);
});

test('accents are folded, so the filter forgives them', () => {
  assert.deepEqual(filterPeople(people, { q: 'fernandés' }), [false, true, false]);
});

test('a track filter alone keeps that track only; both together narrow', () => {
  assert.deepEqual(filterPeople(people, { tracks: ['Tech for Good'] }), [false, true, false]);
  assert.deepEqual(filterPeople(people, { q: 'a', tracks: ['AI for Kids'] }), [true, false, false]);
});

test('no filter keeps everything, and empty words match nothing lost', () => {
  assert.deepEqual(filterPeople(people, {}), [true, true, true]);
  assert.deepEqual(filterPeople(people, { q: '   ' }), [true, true, true]);
});

test('STRINGS: the photo alt names the person', () => {
  assert.equal(STRINGS.photoAlt('Priyanka Naik'), "Priyanka Naik's photo");
});
