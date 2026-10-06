// Tests for the rest analyser. It must fail on a broken fixture before it counts:
// each fixture run through the analyser is red, the clean twin green.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stillAfterReady, restBetweenMoments } from './rest.core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = p => JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'rest', p), 'utf8'));

test('the broken reduced-motion strip fails (it kept moving after ready)', () => {
  const findings = stillAfterReady(FIX('reduced-still-broken.json').cells);
  assert.equal(findings.length, 2, JSON.stringify(findings));
  assert.ok(findings.every(f => f.rule === 'reduced motion: it kept moving after ready'));
});

test('the clean reduced-motion strip passes', () => {
  assert.deepEqual(stillAfterReady(FIX('reduced-still-clean.json').cells), []);
});

test('a cell before ready may differ; the first ready cell pins the still', () => {
  const findings = stillAfterReady([{ at: 0, ready: false, changedShare: 0.9 }, { at: 1, ready: true, changedShare: 0 }]);
  assert.deepEqual(findings, []);
});

test('the broken idle record fails; the clean one passes', () => {
  const bad = restBetweenMoments(FIX('idle-broken.json'));
  assert.equal(bad.pass, false);
  assert.ok(bad.why.includes('still moving'), bad.why);
  const good = restBetweenMoments(FIX('idle-clean.json'));
  assert.equal(good.pass, true);
});

test('a record taken less than 3 s apart never counts as rest', () => {
  const r = restBetweenMoments({ changedPixels: 0, total: 1000, settleMs: 12000, gapMs: 2000 });
  assert.equal(r.pass, false);
});
