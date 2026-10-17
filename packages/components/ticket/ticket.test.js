import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import jsQR from 'jsqr';
import { ALPHABET, newId, isId, spokenId, makeTicket, validTicket, timeText, rows, cardBlocks, fileName, announcement, safeStore, saveTicket, loadTicket, forgetTicket, STORAGE_KEY, isFor, expiresAt, isExpired, KEEP_DAYS } from './ticket.core.js';
import { parseWhen } from '../../core/intl.core.js';
import { BY_LANG } from './ticket.strings.js';
import { encode } from '../qr/qr.core.js';

const AT = '2026-11-21T09:30';
const mk = (extra = {}) => makeTicket({ name: 'Maria Fernandes', event: 'Mandovi Conclave', at: AT, id: 'K7QD-M3PX', issued: 1700000000000, ...extra });

test('an id has no look-alike characters and is drawn without bias', () => {
  assert.ok(!/[01OIL]/.test(ALPHABET) && ALPHABET.length === 31);
  assert.match(newId(() => Uint8Array.from({ length: 16 }, (_, k) => k)), /^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
  assert.equal(newId(() => new Uint8Array(16)), '2222-2222', 'zero is the first character');
  // a byte at 248 or over is thrown away, so 31 does not favour the first characters
  assert.equal(newId(() => Uint8Array.from({ length: 16 }, (_, k) => (k < 8 ? 255 : 30))), 'ZZZZ-ZZZZ');
  const counts = Object.fromEntries([...ALPHABET].map(c => [c, 0]));
  for (let b = 0; b < 248; b++) counts[newId(() => new Uint8Array(16).fill(b))[0]]++;
  assert.ok(Object.values(counts).every(n => n === 8), 'every character is the answer to exactly 8 of the usable bytes');
});

test('the real generator makes valid, different ids', () => {
  const ids = new Set(Array.from({ length: 200 }, () => newId()));
  assert.ok([...ids].every(isId));
  assert.ok(ids.size > 195);
});

test('isId and spokenId', () => {
  assert.ok(isId('K7QD-M3PX'));
  for (const bad of ['', 'k7qd-m3px', 'K7QDM3PX', 'K7QD-M3P', 'K7Q0-M3PX', undefined]) assert.ok(!isId(bad), String(bad));
  assert.equal(spokenId('K7QD-M3PX'), 'K 7 Q D, M 3 P X');
});

test('a ticket needs a name, an event, a time in IST and an id, and holds no email', () => {
  const t = mk();
  assert.deepEqual(t, { v: 1, id: 'K7QD-M3PX', name: 'Maria Fernandes', event: 'Mandovi Conclave', at: AT, issued: 1700000000000 });
  assert.equal(mk({ name: '   ' }), null);
  assert.equal(mk({ event: '' }), null);
  assert.equal(mk({ at: 'soon' }), null);
  assert.equal(mk({ at: '2026-02-30T10:00' }), null);
  assert.equal(mk({ id: 'nope' }), null);
  assert.equal(mk({ name: ' Maria   Fernandes ' }).name, 'Maria Fernandes', 'whitespace is tidied');
  assert.ok(!validTicket({ ...t, v: 2 }) && !validTicket(null));
  assert.ok(!('email' in makeTicket({ name: 'M', event: 'E', at: AT, id: 'K7QD-M3PX', email: 'm@example.in' })));
});

test('the time is read in IST and written in words, in English and in Konkani', () => {
  assert.equal(timeText(AT, 'en'), 'Saturday 21 November, 9:30 am');
  assert.equal(timeText('2026-11-21T19:00', 'en-IN'), 'Saturday 21 November, 7 pm');
  assert.equal(timeText(AT, 'gom-Deva'), 'शेनवार 21 नोव्हेंबर, सकाळीं 9:30');
  assert.equal(timeText(AT, 'gom-Latn'), 'Sonvar 21 Novembr, sokallim 9:30');
  assert.equal(timeText('x', 'en'), '');
  // an offset in the text wins: 04:00 UTC is 9:30 in Panjim
  assert.equal(timeText('2026-11-21T04:00:00Z', 'en'), 'Saturday 21 November, 9:30 am');
});

test('the same words whatever zone the machine is in', () => {
  const url = new URL('./ticket.core.js', import.meta.url).href;
  const probe = `import('${url}').then(m => console.log(m.timeText('${AT}', 'en'), '|', m.timeText('${AT}', 'gom-Latn')))`;
  for (const TZ of ['America/New_York', 'Pacific/Auckland', 'Europe/London']) {
    const out = execFileSync(process.execPath, ['-e', probe], { env: { ...process.env, TZ }, encoding: 'utf8' }).trim();
    assert.equal(out, 'Saturday 21 November, 9:30 am | Sonvar 21 Novembr, sokallim 9:30', TZ);
  }
});

test('the rows carry the deck’s labels in each language', () => {
  const t = mk();
  assert.deepEqual(rows(t, 'en').map(r => r.label), ['Name', 'Event', 'Time (IST)', 'Ticket id']);
  assert.deepEqual(rows(t, 'gom-Deva').map(r => r.label), ['नांव', 'कार्यक्रम', 'वेळ (IST)', 'तिकिटाचो क्रमांक']);
  assert.deepEqual(rows(t, 'gom-Latn').map(r => r.label), ['Nanv', 'Karyokrom', 'Vel (IST)', 'Tikitacho kromank']);
  assert.equal(rows(t, 'en').find(r => r.key === 'id').value, 'K7QD-M3PX');
});

test('the saved picture says what the page says, then the code and its id, then the closing line', () => {
  const b = cardBlocks(mk(), 'en');
  assert.deepEqual(b.map(x => x.kind), ['title', 'label', 'value', 'label', 'value', 'label', 'value', 'qr', 'id', 'note', 'done']);
  assert.equal(b[0].text, 'Your ticket');
  assert.equal(b.at(-1).text, 'You are on the list. See you there.');
  const qr = b.find(x => x.kind === 'qr');
  assert.equal(qr.text, 'K7QD-M3PX', 'the code holds the id');
  assert.equal(qr.alt, 'QR code for ticket K7QD-M3PX. It holds the ticket id and nothing else.');
  assert.equal(b.find(x => x.kind === 'id').text, qr.text, 'the id beside the code is the code’s text');
  assert.ok(cardBlocks(mk(), 'gom-Latn').every(x => !/[ऀ-ॿ]/.test(x.text)), 'Romi never borrows Devanagari');
  assert.equal(fileName(mk()), 'ticket-K7QD-M3PX.png');
});

/** Draw a matrix the way a picture would (8 px a module, 4 modules of quiet, black on white) and read it back. */
function decode(text) {
  const { rows: m, size } = encode(text, { ecc: 'M' });
  const px = 8, quiet = 4, side = (size + quiet * 2) * px, data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y][x] === "1") {
    for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) { const o = (((y + quiet) * px + dy) * side + (x + quiet) * px + dx) * 4; data[o] = data[o + 1] = data[o + 2] = 0; }
  }
  return jsQR(data, side, side)?.data;
}

test('the QR’s text and image agree: the code the picture draws decodes to the id beside it', () => {
  const t = mk();
  const qrText = cardBlocks(t, 'en').find(x => x.kind === 'qr').text;
  assert.equal(decode(qrText), t.id);
  // the check can fail: a code for another id does not read as this one
  assert.notEqual(decode('ZZZZ-ZZZZ'), t.id);
});

test('what is said aloud once: the line, then the id a character at a time', () => {
  assert.equal(announcement(mk(), 'en'), 'You are on the list. See you there. Ticket id: K 7 Q D, M 3 P X.');
  assert.equal(announcement(mk(), 'gom-Latn'), 'Tumchem nanv yadint asa. Thoim bhetum ya. Tikitacho kromank: K 7 Q D, M 3 P X.');
});

test('the device keeps the ticket, and every failure of storage reads as nothing', () => {
  const data = new Map();
  const store = safeStore(() => ({ getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }));
  assert.equal(loadTicket(store), null);
  assert.equal(saveTicket(store, mk()), true);
  assert.deepEqual(loadTicket(store), mk());
  assert.equal(JSON.parse(data.get(STORAGE_KEY)).name, 'Maria Fernandes');
  assert.ok(!/@/.test(data.get(STORAGE_KEY)), 'no email address is kept');
  forgetTicket(store);
  assert.equal(loadTicket(store), null);
  assert.equal(saveTicket(store, { ...mk(), id: 'bad' }), false, 'a ticket that is not valid is not kept');
  data.set(STORAGE_KEY, '{not json');
  assert.equal(loadTicket(store), null, 'damaged text');
  data.set(STORAGE_KEY, JSON.stringify({ ...mk(), v: 9 }));
  assert.equal(loadTicket(store), null, 'a record from another version');
  const blocked = safeStore(() => { throw new DOMException('blocked', 'SecurityError'); });
  assert.equal(loadTicket(blocked), null);
  assert.equal(saveTicket(blocked, mk()), false);
  assert.equal(safeStore(() => undefined).write('k', 'v'), false);
  const full = safeStore(() => ({ getItem: () => null, setItem() { throw new DOMException('full', 'QuotaExceededError'); }, removeItem() {} }));
  assert.equal(saveTicket(full, mk()), false);
});

test('every key has its Konkani, except forget and forgot, which the deck does not have: they read in English until Kathakar writes them', () => {
  const keys = Object.keys(BY_LANG.en).filter(k => !['forget', 'forgot'].includes(k));
  for (const tag of ['gom-Deva', 'gom-Latn']) assert.deepEqual(Object.keys(BY_LANG[tag]).sort(), keys.sort(), tag);
});

test('plain words: no exclamation, no em dash, and one mention of a server, to say none was used', () => {
  const english = Object.values(BY_LANG.en).map(v => (typeof v === 'function' ? v('K7QD-M3PX') : v)).join(' ');
  assert.ok(!/[!—]/.test(english));
  assert.equal((english.match(/server/g) ?? []).length, 1);
});

test('a ticket belongs to an event by its id, so it is still this event\u2019s on a page in another language', () => {
  const t = makeTicket({ name: 'Maria', event: 'Mandovi Conclave', eventId: 'mandovi-conclave', at: AT, id: 'K7QD-M3PX' });
  assert.equal(t.eventId, 'mandovi-conclave');
  assert.ok(isFor(t, { eventId: 'mandovi-conclave', event: 'मांडवी कॉन्क्लेव्ह', at: AT }), 'the Konkani page names the event differently, and it is still the same event');
  assert.ok(!isFor(t, { eventId: 'another-event', event: 'Mandovi Conclave', at: AT }), 'another event, even with the same name');
  assert.ok(!isFor(t, { eventId: 'mandovi-conclave', at: '2026-11-22T09:30' }), 'the same event on another day is another ticket');
  const old = makeTicket({ name: 'Maria', event: 'Mandovi Conclave', at: AT, id: 'K7QD-M3PX' });
  assert.ok(!('eventId' in old));
  assert.ok(isFor(old, { event: 'Mandovi Conclave', at: AT }), 'a ticket with no id still matches by name and time');
  assert.ok(!isFor(old, { event: 'मांडवी', at: AT }), 'and by name alone it would not survive a change of language, which is why the id exists');
  assert.ok(!isFor(null, {}));
});

test('a ticket is kept seven days after the event\u2019s day, then deleted: the day it goes is read in IST', () => {
  const t = makeTicket({ name: 'Maria', event: 'E', at: '2026-11-21T09:30', id: 'K7QD-M3PX' });
  assert.equal(KEEP_DAYS, 7);
  assert.equal(expiresAt(t), parseWhen('2026-11-28T00:00'));
  assert.equal(isExpired(t, parseWhen('2026-11-27T23:59')), false, 'the sixth day after is still kept');
  assert.equal(isExpired(t, parseWhen('2026-11-28T00:00')), true, 'the seventh day it is gone');
  assert.equal(isExpired(t, parseWhen('2026-11-21T10:00')), false, 'on the day, of course');
  // 11:30 pm on 27 November in Panjim is 6:00 pm UTC on the 27th: the same answer for a visitor anywhere
  assert.equal(isExpired(t, Date.UTC(2026, 10, 27, 18, 0)), false);
  assert.equal(isExpired(t, Date.UTC(2026, 10, 27, 18, 30)), true, 'midnight in Panjim');
});

test('loadTicket deletes an expired ticket when it is looked for, and only when it is told the time', () => {
  const data = new Map();
  const store = safeStore(() => ({ getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }));
  saveTicket(store, mk());
  assert.deepEqual(loadTicket(store, parseWhen('2026-11-27T12:00')), mk());
  assert.ok(data.has(STORAGE_KEY));
  assert.equal(loadTicket(store, parseWhen('2026-11-28T00:00')), null);
  assert.ok(!data.has(STORAGE_KEY), 'it was removed from the device, not only hidden');
  saveTicket(store, mk());
  assert.deepEqual(loadTicket(store), mk(), 'with no time given nothing expires');
});
