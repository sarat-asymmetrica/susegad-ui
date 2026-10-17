import test from 'node:test';
import assert from 'node:assert/strict';
import { isKonkani, konkaniTag, partOfDay, dayPartWord, konkaniClock, probeKonkani, formatKonkani } from './intl.kok.js';
import { parseWhen } from './intl.core.js';

// Saturday 21 November 2026, 7 pm in Panjim
const SAT = parseWhen('2026-11-21T19:00');

/** A formatter that answers the way an engine does: the locale it resolved to, and the words it gives. */
const engine = ({ resolved, weekday, month, seen }) => (tag) => {
  seen?.push(tag);
  return {
    resolvedOptions: () => ({ locale: resolved ?? tag }),
    formatToParts: () => [{ type: 'weekday', value: weekday }, { type: 'literal', value: ', ' }, { type: 'day', value: '21' }, { type: 'literal', value: ' ' }, { type: 'month', value: month }],
  };
};
// an engine with no Konkani, whatever the tag
const WEBKIT = engine({ resolved: 'en-GB', weekday: 'Saturday', month: 'November' });
const CHROMIUM = engine({ resolved: 'kok', weekday: 'Sat', month: 'M11' });

test('gom is mapped to kok, the script kept', () => {
  assert.equal(konkaniTag('gom'), 'kok');
  assert.equal(konkaniTag('gom-Deva'), 'kok-Deva');
  assert.equal(konkaniTag('GOM-latn'), 'kok-Latn');
  assert.equal(konkaniTag('kok-Deva'), 'kok-Deva');
  assert.equal(konkaniTag('en-IN'), null);
  assert.ok(isKonkani('gom-Latn') && isKonkani('kok') && !isKonkani('mr-IN') && !isKonkani(undefined));
});

test('the day is cut into four parts, at 4, 12, 16 and 20 o’clock', () => {
  const want = { 0: 3, 3: 3, 4: 0, 11: 0, 12: 1, 15: 1, 16: 2, 19: 2, 20: 3, 23: 3 };
  for (const [h, p] of Object.entries(want)) assert.equal(partOfDay(+h), p, `hour ${h}`);
  assert.equal(dayPartWord(9, 'gom-Deva'), 'सकाळीं');
  assert.equal(dayPartWord(13, 'gom-Latn'), 'donparam');
  assert.equal(dayPartWord(19, 'gom-Deva'), 'सांजे');
  assert.equal(dayPartWord(22, 'kok-Latn'), 'rati');
});

test('the clock says the part of the day, then a twelve-hour time with minutes', () => {
  assert.equal(konkaniClock(SAT, { locale: 'gom-Deva' }), 'सांजे 7:00');
  assert.equal(konkaniClock(parseWhen('2026-11-21T09:30'), { locale: 'gom-Latn' }), 'sokallim 9:30');
  assert.equal(konkaniClock(parseWhen('2026-11-21T00:05'), { locale: 'gom-Latn' }), 'rati 12:05');
  assert.equal(konkaniClock(parseWhen('2026-11-21T12:00'), { locale: 'gom-Deva' }), 'दनपारां 12:00');
  assert.equal(konkaniClock(NaN), '');
});

test('the probe passes a real engine and names how each broken one fails', () => {
  assert.equal(probeKonkani('gom-Deva', engine({ weekday: 'शेनवार', month: 'नोव्हेंबर' })).ok, true);
  assert.equal(probeKonkani('gom-Latn', engine({ weekday: 'Sonvar', month: 'Novembr' })).ok, true);
  const chromium = probeKonkani('gom-Deva', CHROMIUM);
  assert.equal(chromium.ok, false);
  assert.match(chromium.why, /weekday reads "Sat"/);
  const webkit = probeKonkani('gom-Latn', WEBKIT);
  assert.equal(webkit.ok, false);
  assert.match(webkit.why, /resolved to en-GB/);
  assert.equal(probeKonkani('gom-Latn', engine({ weekday: 'Saturday', month: 'November' })).ok, false, 'English words under a Konkani name fail');
  assert.equal(probeKonkani('gom-Deva', engine({ weekday: 'Sonvar', month: 'Novembr' })).ok, false, 'the wrong script fails');
  assert.equal(probeKonkani('gom-Deva', () => { throw new RangeError('no'); }).ok, false, 'a throwing engine fails');
  assert.equal(probeKonkani('en-IN').ok, false);
});

test('a good engine: its words are used, asked for under the kok tag with the script kept', () => {
  const seen = [];
  // real Devanagari words that differ from the table, so the result shows whose words these are
  const own = engine({ weekday: 'शेनवारा', month: 'नोव्हेंबरा', seen });
  assert.equal(formatKonkani(SAT, { locale: 'gom-Deva', make: own }), 'शेनवारा 21 नोव्हेंबरा');
  assert.ok(seen.length && seen.every(t => t === 'kok-Deva'), seen.join());
  const latn = [];
  assert.equal(formatKonkani(SAT, { locale: 'gom-Latn', make: engine({ weekday: 'Sonvara', month: 'Novembra', seen: latn }) }), 'Sonvara 21 Novembra');
  assert.ok(latn.every(t => t === 'kok-Latn'), latn.join());
});

test('Chromium (root pattern): the table answers', () => {
  assert.equal(formatKonkani(SAT, { locale: 'gom-Deva', make: CHROMIUM }), 'शेनवार 21 नोव्हेंबर');
  assert.equal(formatKonkani(SAT, { locale: 'kok', make: CHROMIUM, time: true }), 'शेनवार 21 नोव्हेंबर, सांजे 7:00');
});

test('WebKit (en-GB for gom): the table answers, in the script asked for', () => {
  assert.equal(formatKonkani(SAT, { locale: 'gom-Latn', make: WEBKIT, time: true }), 'Sonvar 21 Novembr, sanje 7:00');
  assert.equal(formatKonkani(SAT, { locale: 'gom-Deva', make: WEBKIT, time: true }), 'शेनवार 21 नोव्हेंबर, सांजे 7:00');
});

test('options: no weekday, a year, and an instant read in IST whatever the zone', () => {
  assert.equal(formatKonkani(SAT, { locale: 'gom-Latn', make: WEBKIT, weekday: false }), '21 Novembr');
  assert.equal(formatKonkani(SAT, { locale: 'gom-Latn', make: WEBKIT, year: true }), 'Sonvar 21 Novembr 2026');
  // 7 pm in Panjim is 1:30 pm UTC: the day and the hour are the venue's
  assert.equal(formatKonkani(Date.UTC(2026, 10, 21, 13, 30), { locale: 'gom-Deva', make: WEBKIT, time: true }), 'शेनवार 21 नोव्हेंबर, सांजे 7:00');
  // 11:30 pm on Friday in Panjim is already Saturday in Tokyo; here it is still Friday
  assert.equal(formatKonkani(parseWhen('2026-11-20T23:30'), { locale: 'gom-Latn', make: WEBKIT }), 'Sukrar 20 Novembr');
});

test('every day and month has its own word, in both scripts', () => {
  for (const locale of ['gom-Deva', 'gom-Latn']) {
    const days = new Set(), months = new Set();
    for (let i = 0; i < 12; i++) months.add(formatKonkani(Date.UTC(2026, i, 15, 6), { locale, make: WEBKIT, weekday: false }).split(' ')[1]);
    for (let i = 0; i < 7; i++) days.add(formatKonkani(Date.UTC(2026, 10, 15 + i, 6), { locale, make: WEBKIT }).split(' ')[0]);
    assert.equal(months.size, 12, locale);
    assert.equal(days.size, 7, locale);
  }
});

test('the table is ICU’s own: where this engine knows Konkani, it agrees word for word', t => {
  for (const locale of ['gom-Deva', 'gom-Latn']) {
    if (!probeKonkani(locale).ok) { t.diagnostic(`${locale}: this engine has no Konkani words; skipped`); continue; }
    for (let i = 0; i < 12; i++) {
      const at = Date.UTC(2026, i, 15, 6);
      assert.equal(formatKonkani(at, { locale }), formatKonkani(at, { locale, make: WEBKIT }), `${locale} month ${i + 1}`);
    }
    for (let i = 0; i < 7; i++) {
      const at = Date.UTC(2026, 10, 15 + i, 6);
      assert.equal(formatKonkani(at, { locale }), formatKonkani(at, { locale, make: WEBKIT }), `${locale} day ${i}`);
    }
  }
});

test('nothing for a bad instant or another language', () => {
  assert.equal(formatKonkani(NaN, { locale: 'gom-Deva' }), '');
  assert.equal(formatKonkani(SAT, { locale: 'en-IN' }), '');
  assert.equal(formatKonkani('soon', { locale: 'gom-Latn' }), '');
});
