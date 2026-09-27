import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesPattern, textCandidates, fitLength, numberFor, dateFor, sampleFor, decodeBody, formVerdict, samplesPathFor, readSamples, valueFromText, planFor, personalFields } from './forms.mjs';
import { readFileSync } from 'node:fs';

test('patterns match the whole value, as browsers compile them', () => {
  assert.equal(matchesPattern('[1-9][0-9]{5}', '403001'), true);
  assert.equal(matchesPattern('[1-9][0-9]{5}', '4030011'), false);
  assert.equal(matchesPattern('a|b', 'ab'), false);
  assert.equal(matchesPattern(undefined, 'anything'), true);
  assert.equal(matchesPattern('(', 'x'), true); // invalid patterns are ignored
});

test('text candidates follow the field name, label and autocomplete', () => {
  assert.equal(textCandidates({ autocomplete: 'email' })[0], 'guest@example.com');
  assert.equal(textCandidates({ name: 'pin' })[0], '403001');
  assert.equal(textCandidates({ label: 'Your name' })[0], 'Asha Fernandes');
  assert.equal(textCandidates({ name: 'given-name' })[0], 'Asha');
  assert.ok(textCandidates({}).includes('Sample text'));
});

test('lengths are met by repeating and capped by cutting', () => {
  assert.equal(fitLength('Sample', 10), 'SampleSample');
  assert.equal(fitLength('Sample text', 15).length >= 15, true);
  assert.equal(fitLength('Sample text', undefined, 4), 'Samp');
  assert.equal(fitLength('ok', 0, undefined), 'ok');
});

test('numbers respect min, max and step', () => {
  assert.equal(numberFor(undefined, undefined, undefined), 2);
  assert.equal(numberFor('1', '6', '1'), 2);
  assert.equal(numberFor('5', '10', '1'), 5);
  assert.equal(numberFor('0', '1', '0.25'), 1);
  assert.equal(numberFor('1', '1'), 1);
  assert.equal(numberFor('3', '20', '5'), 3);
  assert.equal(numberFor(undefined, undefined, 'any'), 2);
  assert.equal(numberFor('10', '12', '5'), 10); // steps count from min, so min is always valid
  assert.equal(numberFor('5', '1'), null);
});

test('dates stay inside min and max', () => {
  assert.equal(dateFor(), '2026-10-15');
  assert.equal(dateFor('2027-01-01'), '2027-01-01');
  assert.equal(dateFor(undefined, '2026-01-31'), '2026-01-31');
  assert.equal(dateFor('2026-05-01', '2026-04-01'), null);
});

test('sample values by type', () => {
  assert.deepEqual(sampleFor({ tag: 'input', type: 'email' }), { action: 'fill', value: 'guest@example.com' });
  assert.deepEqual(sampleFor({ tag: 'input', type: 'checkbox' }), { action: 'check' });
  assert.deepEqual(sampleFor({ tag: 'input', type: 'radio' }), { action: 'check' });
  assert.deepEqual(sampleFor({ tag: 'input', type: 'number', min: '1', max: '6' }), { action: 'fill', value: '2' });
  assert.deepEqual(sampleFor({ tag: 'input', type: 'date', min: '2026-11-01' }), { action: 'fill', value: '2026-11-01' });
  assert.deepEqual(sampleFor({ tag: 'input', type: 'time', min: '12:00' }), { action: 'fill', value: '12:00' });
  assert.deepEqual(sampleFor({ tag: 'select', type: 'select-one', options: [{ value: '', disabled: false }, { value: 'a', disabled: true }, { value: 'b', disabled: false }] }), { action: 'select', value: 'b' });
  assert.equal(sampleFor({ tag: 'select', options: [{ value: '', disabled: false }] }).action, 'skip');
  assert.equal(sampleFor({ tag: 'input', type: 'file' }).action, 'skip');
  assert.deepEqual(sampleFor({ tag: 'input', type: 'text', name: 'pin', pattern: '[1-9][0-9]{5}' }), { action: 'fill', value: '403001' });
  assert.deepEqual(sampleFor({ tag: 'input', type: 'tel', pattern: '[0-9]{10}' }), { action: 'fill', value: '9876543210' });
  assert.deepEqual(sampleFor({ tag: 'textarea', type: 'textarea', minLength: 20 }), { action: 'fill', value: 'Sample text Sample text' });
  const r = sampleFor({ tag: 'input', type: 'text', pattern: 'ZZ[0-9]{3}' });
  assert.equal(r.action, 'skip');
  assert.match(r.reason, /pattern ZZ/);
});

test('submission bodies decode by content type', () => {
  assert.deepEqual(decodeBody('application/x-www-form-urlencoded', 'a=1&b=two+words'), [['a', '1'], ['b', 'two words']]);
  const multipart = '------x\r\nContent-Disposition: form-data; name="email"\r\n\r\nguest@example.com\r\n------x\r\nContent-Disposition: form-data; name="n"\r\n\r\n2\r\n------x--\r\n';
  assert.deepEqual(decodeBody('multipart/form-data; boundary=----x', multipart), [['email', 'guest@example.com'], ['n', '2']]);
  assert.deepEqual(decodeBody('application/json', '{"a":"x","b":2}'), [['a', 'x'], ['b', '2']]);
  assert.deepEqual(decodeBody('', ''), []);
});

test('verdicts', () => {
  const ok = { required: 2, novalidate: false, skipped: 0, empty: { submitted: false }, filled: { submitted: true, invalid: [] } };
  assert.equal(formVerdict(ok).pass, true);
  assert.equal(formVerdict({ ...ok, empty: { submitted: true } }).pass, false);
  assert.equal(formVerdict({ ...ok, novalidate: true, empty: { submitted: true } }).pass, true);
  const stuck = formVerdict({ ...ok, filled: { submitted: false, invalid: [{}] } });
  assert.equal(stuck.pass, false);
  assert.match(stuck.notes.join(' '), /1 field\(s\) still invalid/);
  assert.match(formVerdict({ ...ok, filled: { submitted: false, invalid: [] } }).notes.join(' '), /check the submit button/);
  assert.match(formVerdict({ ...ok, required: 0, empty: { submitted: true } }).notes[0], /no required fields/);
});

test('form-check.json lives beside the page', () => {
  assert.equal(samplesPathFor('/packages/recipes/booking/index.html'), 'packages/recipes/booking/form-check.json');
  assert.equal(samplesPathFor('/packages/recipes/booking/index.html?register=quiet'), 'packages/recipes/booking/form-check.json');
  assert.equal(samplesPathFor('/packages/recipes/enquiry/'), 'packages/recipes/enquiry/form-check.json');
  assert.equal(samplesPathFor('/page.html'), 'form-check.json');
});

test('form-check.json: values, checkboxes and values read from the page', () => {
  const s = readSamples(JSON.stringify({ about: 'x', values: { name: 'Asha', guests: 4, rules: true, code: { press: '.send', read: '.note', match: '(\\d{3}) (\\d{3})' }, fixed: { value: 'a' } } }));
  assert.deepEqual(s.get('name'), { value: 'Asha' });
  assert.deepEqual(s.get('guests'), { value: '4' });
  assert.deepEqual(s.get('rules'), { value: true });
  assert.equal(s.get('code').press, '.send');
  assert.equal(s.get('fixed').value, 'a');
  assert.equal(readSamples('{}').size, 0);
});

test('form-check.json: mistakes are errors, not silence', () => {
  for (const bad of ['not json', '[]', '{"valuse":{}}', '{"values":[]}', '{"values":{"a":null}}', '{"values":{"a":["x"]}}',
    '{"values":{"a":{"presss":".x","value":"1"}}}', '{"values":{"a":{"press":".x"}}}', '{"values":{"a":{"value":"1","read":".x"}}}',
    '{"values":{"a":{"value":"1","match":"x"}}}', '{"values":{"a":{"read":".x","match":"("}}}']) {
    assert.throws(() => readSamples(bad), /form-check\.json/, bad);
  }
});

test('a value read from page text: groups joined, or the whole match', () => {
  const note = 'Prototype: nothing leaves this page. The code we would have texted to 98220 12345 is 186 225.';
  assert.equal(valueFromText(note, 'is (\\d{3}) (\\d{3})'), '186225');
  assert.equal(valueFromText('Code: 482913', '\\d{6}'), '482913');
  assert.equal(valueFromText('  plain  '), 'plain');
  assert.equal(valueFromText('no code yet', '\\d{6}'), null);
});

test('the page\'s value wins; optional fields without one are left alone', () => {
  const s = readSamples(JSON.stringify({ values: { departure: '2026-11-20', room: 'whole', rules: false, breakfast: true, guests: '4', sig: 'Asha' } }));
  assert.deepEqual(planFor({ tag: 'input', type: 'date', name: 'departure', required: true }, s), { action: 'fill', value: '2026-11-20', press: undefined, read: undefined, match: undefined, from: 'page' });
  assert.equal(planFor({ tag: 'input', type: 'radio', name: 'room', required: true }, s).value, 'whole');
  assert.equal(planFor({ tag: 'input', type: 'checkbox', name: 'rules' }, s).action, 'uncheck');
  assert.equal(planFor({ tag: 'input', type: 'checkbox', name: 'breakfast' }, s).action, 'check');
  assert.equal(planFor({ tag: 'select', type: 'select-one', name: 'guests', options: [] }, s).action, 'select');
  assert.equal(planFor({ tag: 'input', type: 'text', name: '', id: 'sig', required: true }, s).value, 'Asha', 'found by id');
  assert.deepEqual(planFor({ tag: 'input', type: 'text', name: 'notes' }, s), { action: 'leave', from: null });
  assert.equal(planFor({ tag: 'input', type: 'email', name: 'email', required: true }, s).from, 'tool');
  assert.equal(planFor({ tag: 'input', type: 'email', name: 'email', required: true }).value, 'guest@example.com');
});

test('stepper verdicts: moving on empty fails; a stuck walk is named', () => {
  const ok = { required: 3, novalidate: false, skipped: 0, empty: { submitted: false }, filled: { submitted: true, invalid: [] } };
  assert.equal(formVerdict({ ...ok, empty: { submitted: false, walkedOn: true } }).pass, false);
  const stuck = formVerdict({ ...ok, filled: { submitted: false, invalid: [{}], stuck: { step: 1, count: 4, message: 'Stays at this time of year are at least 3 nights.' } } });
  assert.equal(stuck.pass, false);
  assert.ok(stuck.notes.some(n => n === 'the stepper stayed on step 1 of 4: "Stays at this time of year are at least 3 nights."'), stuck.notes.join(' | '));
});

test('a GET form with personal fields fails: they would sit in the address bar', () => {
  const fields = [
    { tag: 'input', type: 'date', name: 'arrival' }, { tag: 'input', type: 'text', name: 'name', autocomplete: 'name' },
    { tag: 'input', type: 'tel', name: 'phone' }, { tag: 'input', type: 'text', name: 'signature' },
    { tag: 'input', type: 'text', name: 'contact', autocomplete: 'email' }, { tag: 'select', type: 'select-one', name: 'guests' },
    { tag: 'input', type: 'text', name: 'from', autocomplete: 'address-level2' },
  ];
  assert.deepEqual(personalFields(fields), ['name', 'phone', 'signature', 'contact']);
  assert.deepEqual(personalFields([{ tag: 'input', type: 'search', name: 'q' }]), []);
  const ok = { required: 2, novalidate: false, skipped: 0, empty: { submitted: false }, filled: { submitted: true, invalid: [] } };
  const v = formVerdict({ ...ok, personalInGet: ['name', 'phone'] });
  assert.equal(v.pass, false);
  assert.match(v.notes.join(' '), /method GET would put name, phone in the address bar: use POST/);
  assert.equal(formVerdict({ ...ok, personalInGet: [] }).pass, true);
});

test('the recipes\' form-check.json files read cleanly', () => {
  for (const r of ['booking', 'enquiry']) {
    const s = readSamples(readFileSync(new URL(`../../packages/recipes/${r}/form-check.json`, import.meta.url), 'utf8'));
    assert.ok(s.size >= 2, r);
  }
});
