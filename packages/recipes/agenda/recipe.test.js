import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, phaseOf, whenWords, agendaState } from './recipe.js';
import { parseWhen } from '../../core/intl.core.js';

// Times are written the way the page writes them: wall-clock in Panjim.
const at = iso => parseWhen(iso);
const sessions = [
  { id: 'welcome', start: at('2026-11-14T09:30'), end: at('2026-11-14T10:15') },
  { id: 'a', start: at('2026-11-14T10:30'), end: at('2026-11-14T11:15') },
  { id: 'b', start: at('2026-11-14T10:30'), end: at('2026-11-14T11:15') },
  { id: 'lunch', start: at('2026-11-14T12:30'), end: at('2026-11-14T14:00') },
  { id: 'afternoon', start: at('2026-11-14T14:00'), end: at('2026-11-14T15:00') },
  { id: 'late', start: at('2026-11-14T21:00'), end: at('2026-11-15T00:30') }, // crosses midnight
  { id: 'sunday', start: at('2026-11-15T10:00'), end: at('2026-11-15T10:45') },
];
const get = (state, id) => state.items.find(i => i.id === id);

test('the start is inclusive and the end is not', () => {
  const s = { start: at('2026-11-14T10:30'), end: at('2026-11-14T11:15') };
  assert.equal(phaseOf(at('2026-11-14T10:29'), s), 'upcoming');
  assert.equal(phaseOf(at('2026-11-14T10:30'), s), 'now');
  assert.equal(phaseOf(at('2026-11-14T11:14'), s), 'now');
  assert.equal(phaseOf(at('2026-11-14T11:15'), s), 'past');
});

test('a session with no end is never on stage', () => {
  const s = { start: at('2026-11-14T10:30') };
  assert.equal(phaseOf(at('2026-11-14T10:00'), s), 'upcoming');
  assert.equal(phaseOf(at('2026-11-14T10:30'), s), 'past');
  assert.equal(phaseOf(NaN, s), 'unknown');
  assert.equal(phaseOf(at('2026-11-14T10:00'), { start: NaN }), 'unknown');
});

test('well before the first day: no marks, and the status says when it starts, in IST', () => {
  const st = agendaState(sessions, at('2026-11-01T12:00'));
  assert.equal(st.overall, 'before');
  assert.equal(st.status, 'The agenda starts Sat 14 Nov, at 9:30 am IST.');
  assert.ok(st.items.every(i => i.phase === 'upcoming' && i.label === '' && i.hidden === ''));
});

test('the day before: the first session is "Next, tomorrow at 9:30 am"', () => {
  const st = agendaState(sessions, at('2026-11-13T20:00'));
  assert.equal(get(st, 'welcome').label, 'Next, tomorrow at 9:30 am');
  assert.equal(get(st, 'a').label, '');
});

test('during a session: it is "Now on stage, until ...", the next one is named, past ones say Finished', () => {
  const st = agendaState(sessions, at('2026-11-14T10:40'));
  assert.equal(st.overall, 'on');
  assert.equal(get(st, 'a').label, 'Now on stage, until 11:15 am');
  assert.equal(get(st, 'b').label, 'Now on stage, until 11:15 am'); // parallel sessions are both on
  assert.equal(get(st, 'lunch').label, 'Next, at 12:30 pm');
  assert.equal(get(st, 'afternoon').label, '');
  assert.equal(get(st, 'welcome').hidden, 'Finished');
  assert.equal(st.status, '2 sessions are on stage now. Next, at 12:30 pm.');
});

test('between sessions: nothing is on, the next is named', () => {
  const st = agendaState(sessions, at('2026-11-14T12:00'));
  assert.equal(st.overall, 'between');
  assert.equal(st.status, 'Between sessions. Next, at 12:30 pm.');
  assert.equal(get(st, 'lunch').label, 'Next, at 12:30 pm');
  assert.ok(!st.items.some(i => i.phase === 'now'));
});

test('two sessions that start together are both "Next"', () => {
  const st = agendaState(sessions, at('2026-11-14T10:20'));
  assert.equal(get(st, 'a').label, 'Next, at 10:30 am');
  assert.equal(get(st, 'b').label, 'Next, at 10:30 am');
});

test('after the last session: everything is finished and the status thanks people', () => {
  const st = agendaState(sessions, at('2026-11-16T09:00'));
  assert.equal(st.overall, 'after');
  assert.equal(st.status, STRINGS.after);
  assert.ok(st.items.every(i => i.phase === 'past' && i.hidden === 'Finished' && i.label === ''));
});

test('a session across midnight stays on stage after the date turns', () => {
  const late = agendaState(sessions, at('2026-11-14T23:50'));
  assert.equal(get(late, 'late').label, 'Now on stage, until 12:30 am');
  const after = agendaState(sessions, at('2026-11-15T00:10'));
  assert.equal(after.overall, 'on');
  assert.equal(get(after, 'late').phase, 'now');
  assert.equal(get(after, 'late').label, 'Now on stage, until 12:30 am');
  assert.equal(get(after, 'sunday').label, 'Next, at 10 am'); // today, now that it is Sunday
  const done = agendaState(sessions, at('2026-11-15T00:30'));
  assert.equal(get(done, 'late').phase, 'past');
  assert.equal(done.status, 'Between sessions. Next, at 10 am.');
});

test('the evening before a morning session says "tomorrow"', () => {
  const st = agendaState(sessions, at('2026-11-14T22:00'));
  assert.equal(get(st, 'sunday').label, 'Next, tomorrow at 10 am'); // the late session is on, and Sunday is tomorrow
  assert.equal(st.status, 'One session is on stage now. Next, tomorrow at 10 am.');
  assert.equal(whenWords(at('2026-11-14T22:00'), at('2026-11-15T10:00')), 'tomorrow at 10 am');
  assert.equal(whenWords(at('2026-11-10T22:00'), at('2026-11-15T10:00')), 'Sun 15 Nov at 10 am');
});

test('the same instant reads the same on a machine in New York', () => {
  // the agenda counts in Panjim's days, whatever the machine's own zone is: 8:10 pm on the 13th
  // in New York is 6:40 am on the 14th in Panjim, so the first session is still to come, today.
  const ny = Date.UTC(2026, 10, 14, 1, 10); // 01:10 UTC = 20:10 in New York (UTC-5) = 06:40 IST
  const st = agendaState(sessions, ny);
  assert.equal(get(st, 'welcome').label, 'Next, at 9:30 am');
  const same = agendaState(sessions, at('2026-11-14T06:40'));
  assert.deepEqual(st, same);
});

test('a session with a date nobody can read is left out of the story', () => {
  const st = agendaState([...sessions, { id: 'broken', start: NaN, end: NaN }], at('2026-11-14T10:40'));
  assert.equal(get(st, 'broken').phase, 'unknown');
  assert.equal(get(st, 'broken').label, '');
  assert.equal(st.overall, 'on');
  assert.equal(agendaState([], at('2026-11-14T10:40')).overall, 'empty');
});

test('no word of the agenda uses an em dash or hurries anyone', () => {
  const words = [STRINGS.now('11 am'), STRINGS.next('at 2 pm'), STRINGS.finished, STRINGS.before('on Sat 14 Nov'), STRINGS.on(1), STRINGS.on(3), STRINGS.between, STRINGS.after].join(' ');
  assert.ok(!words.includes('—'));
  assert.ok(!/hurry|last chance|don't miss|only \d/i.test(words));
});

test('a break says "On now" while it is, but is never on stage, never "Next", and not counted in the status', () => {
  const withBreaks = [
    { id: 'talk', start: at('2026-11-14T10:30'), end: at('2026-11-14T11:15') },
    { id: 'tea', kind: 'break', start: at('2026-11-14T11:15'), end: at('2026-11-14T11:45') },
    { id: 'talk2', start: at('2026-11-14T11:45'), end: at('2026-11-14T12:30') },
  ];
  const during = agendaState(withBreaks, at('2026-11-14T10:40'));
  assert.equal(get(during, 'tea').label, '');              // not "Next": the next thing on stage is talk2
  assert.equal(get(during, 'talk2').label, 'Next, at 11:45 am');
  const tea = agendaState(withBreaks, at('2026-11-14T11:20'));
  assert.equal(get(tea, 'tea').label, 'On now, until 11:45 am');
  assert.equal(tea.overall, 'between');
  assert.equal(tea.status, 'Between sessions. Next, at 11:45 am.');
  assert.equal(get(tea, 'talk').hidden, 'Finished');
});

import { sessionsOf } from './recipe.js';

// a stand-in for the page: just enough of the DOM that sessionsOf reads
const li = (id, times, data = {}) => ({ id, dataset: data, querySelectorAll: () => times.map(t => ({ getAttribute: () => t })) });
const root = (...lis) => ({ querySelectorAll: () => lis });

test('a session reads its start and end from its two <time datetime>, with the offset, once', () => {
  const [s] = sessionsOf(root(li('a', ['2026-11-14T10:30:00+05:30', '2026-11-14T11:15:00+05:30'])));
  assert.equal(s.start, at('2026-11-14T10:30'));
  assert.equal(s.end, at('2026-11-14T11:15'));
  assert.equal(s.id, 'a');
});

test('data-start and data-end still work, and win over the <time> elements', () => {
  const [s] = sessionsOf(root(li('b', ['2026-11-14T10:30:00+05:30', '2026-11-14T11:15:00+05:30'], { start: '2026-11-14T12:00', end: '2026-11-14T13:00' })));
  assert.equal(s.start, at('2026-11-14T12:00'));
  assert.equal(s.end, at('2026-11-14T13:00'));
});

test('a session with one <time> has a start and no end, and a break is marked by data-kind', () => {
  const [s, t] = sessionsOf(root(li('c', ['2026-11-14T10:30:00+05:30']), li('d', ['2026-11-14T11:00:00+05:30', '2026-11-14T11:30:00+05:30'], { kind: 'break' })));
  assert.ok(Number.isNaN(s.end));
  assert.equal(t.kind, 'break');
});

import { BY_LANG } from './recipe.strings.js';
import { strings, langOfKey } from '../../core/strings.js';

test('the agenda keeps its words in a table; Konkani is written in both scripts, so no key falls back to English (and a table without a key does)', () => {
  const en = Object.keys(BY_LANG.en);
  assert.ok(['now', 'breakNow', 'next', 'at', 'tomorrowAt', 'onDayAt', 'finished', 'before', 'on', 'between', 'after'].every(k => en.includes(k)));
  const kok = strings(BY_LANG, 'gom-Deva');
  assert.equal(kok.finished, 'सोंपलें');
  assert.equal(strings(BY_LANG, 'gom-Latn').finished, 'Somplem');
  for (const tag of ['gom-Deva', 'gom-Latn']) {
    assert.ok(en.every(k => langOfKey(BY_LANG, tag, k) === tag), `${tag} has every key`);
    assert.ok(en.every(k => k in BY_LANG[tag]));
  }
  assert.equal(strings(BY_LANG, 'gom-Deva').on(2), '2 सत्रां आतां स्टेजार आसात.');
  assert.equal(strings(BY_LANG, 'gom-Latn').next(strings(BY_LANG, 'gom-Latn').at('2 pm')), 'Fudlem, 2 pm velar');
  const gap = { en: BY_LANG.en, 'gom-Deva': {} };
  assert.ok(en.every(k => langOfKey(gap, 'gom-Deva', k) === 'en'), 'a table with no Konkani is English, marked so');
});

test('a language that has some keys speaks them, and the keys say which were English', () => {
  const table = { en: BY_LANG.en, 'gom-Deva': { finished: 'संपलें' } };
  const S = strings(table, 'gom-Deva');
  const st = agendaState(sessions, at('2026-11-14T10:40'), undefined, S);
  const done = st.items.find(i => i.id === 'welcome');
  assert.equal(done.hidden, 'संपलें');
  assert.equal(langOfKey(table, 'gom-Deva', done.keys[0]), 'gom-Deva');
  const now = st.items.find(i => i.id === 'a');
  assert.equal(now.label, 'Now on stage, until 11:15 am'); // not translated yet: English
  assert.deepEqual(now.keys, ['now']);
  assert.equal(langOfKey(table, 'gom-Deva', 'now'), 'en');
  assert.deepEqual(st.statusKeys, ['on', 'next', 'at']);
});

test('"on" keeps its one-versus-many branch in both Konkani scripts', () => {
  const deva = strings(BY_LANG, 'gom-Deva'), latn = strings(BY_LANG, 'gom-Latn');
  assert.equal(deva.on(1), 'एक सत्र आतां स्टेजार आसा.');
  assert.equal(deva.on(3), '3 सत्रां आतां स्टेजार आसात.');
  assert.equal(latn.on(1), 'Ek satr atam stejar asa.');
  assert.equal(latn.on(3), '3 satram atam stejar asat.');
  for (const S of [deva, latn]) assert.ok(!/^\d/.test(S.on(1)), 'the singular is a word ("one"), not the digit with the plural');
});
