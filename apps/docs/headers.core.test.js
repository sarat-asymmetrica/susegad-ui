import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSP, CROSS_ORIGIN_PREFIXES, headersText } from './headers.core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// The CSP the site served before this file existed, byte for byte: a change
// here must be deliberate, never a slip while adding a rule.
const CSP_FROZEN = 'default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; '
  + 'img-src \'self\' data: blob:; font-src \'self\'; media-src \'self\'; connect-src \'self\'; object-src \'none\'; '
  + "base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

test('the CSP string is unchanged, byte for byte', () => {
  assert.equal(CSP, CSP_FROZEN);
});

test('the generated _headers carries exactly the two cross-origin rules, and nothing wider', () => {
  const text = headersText();
  assert.match(text, /^\/packages\/\*\n  Access-Control-Allow-Origin: \*\n$/m, 'exactly one rule for /packages/*');
  assert.match(text, /^\/registry\/\*\n  Access-Control-Allow-Origin: \*\n$/m, 'exactly one rule for /registry/*');
  const rules = text.match(/^(\S+)\n  ([\w-]+): (.+)$/gm) ?? [];
  const acao = rules.filter(r => r.includes('Access-Control-Allow-Origin')).map(r => r.split('\n')[0]);
  assert.deepEqual(acao.sort(), ['/packages/*', '/registry/*'], 'no other path opens cross-origin');
  assert.match(text, new RegExp(`Content-Security-Policy: ${CSP.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`), 'the CSP line, as frozen');
  assert.match(text, /^\/\*\n  Content-Security-Policy:/m, 'the general rule still applies everywhere');
  assert.match(text, /frame-ancestors 'none'/, 'still no framing');
  for (const p of CROSS_ORIGIN_PREFIXES) assert.ok(p.endsWith('/*') || p.endsWith('/'), p);
});

test('the built copy, when it exists, matches what the pure core writes', () => {
  const built = path.join(HERE, '../../out/docs/_headers');
  if (!fs.existsSync(built)) return; // a fresh checkout: run node apps/docs/build.mjs first
  assert.equal(fs.readFileSync(built, 'utf8'), headersText());
});
