// header.core.js in Node: every format's header, built to the specification and written by real encoders.
// The cases live in header.props.js so mutants.test.js can run them against broken copies of the parser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from './header.core.js';
import { CASES, HAVE_SHARP, REAL } from './header.props.js';

for (const [name, run] of CASES) test(name, () => run(core));

test('the real encoders were really used (a skipped corpus is said, not hidden)', t => {
  if (!HAVE_SHARP) return t.skip('sharp is not installed: only the synthetic headers ran');
  const got = Object.keys(REAL);
  for (const k of ['png', 'jpeg', 'jpeg-progressive', 'jpeg-o6', 'webp-lossy', 'webp-lossless']) assert.ok(got.includes(k), `sharp wrote no ${k}`);
  console.log(`      real encoder output: ${got.join(', ')}`);
});

test('header.core.js imports nothing and touches no DOM, network or decoder', () => {
  const src = readFileSync(new URL('./header.core.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.deepEqual([...src.matchAll(/\bimport\b|\brequire\b/g)], []);
  assert.deepEqual([...src.matchAll(/\b(document|window|fetch|Image|createImageBitmap|OffscreenCanvas|navigator)\b/g)].map(m => m[1]), []);
});
