// Tests for the motif lint. The lint must fail on a broken fixture before it counts:
// the same fixture run through the CLI goes red, the clean twin goes green.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lintMotifs, glossNamesOrigin } from './motif-lint.core.js';
import { heroNamesFromHtml } from './motif-lint.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const BROKEN = path.join(HERE, 'fixtures', 'motif', 'registry-broken.json');
const CLEAN = path.join(HERE, 'fixtures', 'motif', 'registry-clean.json');

test('a registry with sacred-without-lead, regional-without-gloss and a bad tier fails', () => {
  const findings = lintMotifs(load(BROKEN), { heroNames: ['hero-item'] });
  const byItem = Object.groupBy(findings, f => f.item);
  assert.ok(byItem['sacred-without-lead'].some(f => f.rule === 'sacred needs a lead'));
  assert.ok(byItem['regional-unnamed'].some(f => f.rule === 'regional needs a gloss that names its home'));
  assert.ok(byItem['bad-tier'].some(f => f.rule === 'unknown tier'));
  assert.ok(byItem['hero-item'].some(f => f.rule === 'the hero must be goa'));
  assert.ok(!byItem['sacred-with-lead'], 'the led sacred piece must not be reported');
  assert.ok(!byItem['clean-regional'], 'a regional gloss that names Tamil Nadu must pass');
});

test('the clean twin passes, hero included', () => {
  assert.deepEqual(lintMotifs(load(CLEAN), { heroNames: ['hero-item'] }), []);
});

test('glossNamesOrigin: adjectival and multiword forms', () => {
  assert.equal(glossNamesOrigin('The Goan balcão.', 'goa'), true);
  assert.equal(glossNamesOrigin('A threshold drawing from Tamil Nadu.', 'tamil nadu'), true);
  assert.equal(glossNamesOrigin('Nothing about the place.', 'bengal'), false);
  assert.equal(glossNamesOrigin('', 'goa'), false);
});

test('the hero is read from the front door markup', () => {
  assert.deepEqual(
    heroNamesFromHtml('<sg-scene id="mast-stage" name="kantar" hero="true"></sg-scene><sg-scene name="paus"></sg-scene>'),
    ['kantar'],
  );
});

test('the CLI exits non-zero on the broken fixture, zero on the clean one', () => {
  const red = (() => {
    try {
      execFileSync(process.execPath, ['tools/motif-lint.mjs', 'tools/fixtures/motif/registry-broken.json', '--hero=hero-item'], { cwd: path.join(HERE, '..'), encoding: 'utf8' });
      return null;
    } catch (e) { return e; }
  })();
  assert.ok(red, 'the CLI should have failed on the broken fixture');
  assert.ok(red.stdout.includes('sacred needs a lead'));
  assert.ok(red.stdout.includes('the hero must be goa'));
  const green = execFileSync(process.execPath, ['tools/motif-lint.mjs', 'tools/fixtures/motif/registry-clean.json', '--hero=hero-item'], { cwd: path.join(HERE, '..'), encoding: 'utf8' });
  assert.ok(green.includes('0 finding(s)'));
});
