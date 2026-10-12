import { test } from 'node:test';
import assert from 'node:assert/strict';
import { report, format } from './strings-review.mjs';

const by = { en: { a: 'A', b: 'B' }, 'gom-Deva': { a: 'अ' }, 'gom-Latn': { a: 'a', b: 'b' } };

test('the report counts, per language, the keys no reader has checked and the keys with no draft', () => {
  const r = report(by, new Set(['gom-Latn:a']));
  assert.deepEqual(r.map(x => [x.tag, x.written, x.unchecked, x.missing]), [['gom-Deva', 1, ['a'], ['b']], ['gom-Latn', 2, ['b'], []]]);
});

test('the printed report names the counts and the keys', () => {
  const t = format(report(by, new Set()));
  assert.match(t, /gom-Deva: 1 of 1 written keys not yet checked/);
  assert.match(t, /1 English keys have no draft \(b\)/);
  assert.match(t, /a, b/);
});

test('with everything checked and written, nothing is listed', () => {
  const r = report({ en: { a: 'A' }, 'gom-Deva': { a: 'अ' } }, new Set(['gom-Deva:a']));
  assert.deepEqual(r[0].unchecked.concat(r[0].missing), []);
});
