import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, compare } from './typecheck.mjs';

const OUT = [
  "packages/a/a.core.js(3,5): error TS2339: Property 'x' does not exist on type '{}'.",
  "packages/a/a.core.js(9,1): error TS2339: Property 'y' does not exist on type '{}'.",
  String.raw`packages\b\model.js(1,1): error TS2322: Type 'string' is not assignable to type 'number'.`,
  '  a continuation line that is not an error',
].join('\r\n');

test('parse counts per file and code, with slashes normalised', () => {
  const { counts, errors } = parse(OUT);
  assert.deepEqual(counts, { 'packages/a/a.core.js|TS2339': 2, 'packages/b/model.js|TS2322': 1 });
  assert.equal(errors.length, 3);
  assert.equal(errors[0].line, 3);
});

test('compare: a rise and a new pair are red, a fall is not', () => {
  const base = { 'a|TS1': 2, 'b|TS2': 3 };
  const { rose, fell } = compare(base, { 'a|TS1': 3, 'b|TS2': 1, 'c|TS3': 1 });
  assert.deepEqual(rose, [['a|TS1', 2, 3], ['c|TS3', 0, 1]]);
  assert.deepEqual(fell, [['b|TS2', 3, 1]]);
  assert.deepEqual(compare(base, base), { rose: [], fell: [] });
});
