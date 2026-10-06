// Tests for until-fail. It must catch a deliberately flaky fixture's first failure and
// keep its full output, before it counts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const state = path.join(os.tmpdir(), 'until-fail-flaky.json');
fs.rmSync(state, { force: true }); // a fresh counter, so run 2 fails

test('until-fail catches the flaky fixture on its second run and keeps the full output', () => {
  const out = execFileSync(process.execPath, ['tools/until-fail.mjs', 'tools/fixtures/until-fail/flaky.mjs', '--max', '20'],
    { cwd: REPO, encoding: 'utf8' });
  assert.ok(out.includes('failed on run 2'), out);
  const m = /Full output: (\S+)/.exec(out);
  assert.ok(m, out);
  const log = fs.readFileSync(path.join(REPO, m[1].replaceAll('/', path.sep)), 'utf8');
  assert.ok(log.includes('failed on run 2 of 20'));
  assert.ok(log.includes('the flake failed, as arranged'), log);
  assert.ok(log.includes('the long stack line the flake prints'), 'the full output, not a tail');
});

test('until-fail reports a check that never fails, and bad usage', () => {
  const out = execFileSync(process.execPath, ['tools/until-fail.mjs', 'tools/fixtures/until-fail/green.mjs', '--max', '2'],
    { cwd: REPO, encoding: 'utf8' });
  assert.ok(out.includes('did not fail in 2 runs'), out);
  const bad = (() => {
    try {
      execFileSync(process.execPath, ['tools/until-fail.mjs', '--max', '20'], { cwd: REPO, encoding: 'utf8' });
      return null;
    } catch (e) { return e; }
  })();
  assert.ok(bad && bad.status === 2);
});
