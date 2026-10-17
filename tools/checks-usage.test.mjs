import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const checks = path.join(path.dirname(fileURLToPath(import.meta.url)), 'checks.mjs');
const run = (...args) => spawnSync(process.execPath, [checks, ...args], { encoding: 'utf8', timeout: 20000 });

test('a file name is a usage error that says how to run one check, and starts nothing', () => {
  const r = run('packages/components/menu/menu.check.mjs');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown argument: packages\/components\/menu\/menu\.check\.mjs/);
  assert.match(r.stderr, /run its file directly/);
  assert.doesNotMatch(r.stdout, /Running \d+ checks/);
});

test('--help prints usage and exits 0 without running anything', () => {
  const r = run('--help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^usage: node tools\/checks\.mjs/);
  assert.doesNotMatch(r.stdout, /Running \d+ checks/);
});

test('the real flags still work (--dry lists, runs nothing)', () => {
  const r = run('--engine=webkit', '--dry');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^Would run \d+ checks/);
});
