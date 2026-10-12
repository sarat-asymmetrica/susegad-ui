// The image leg of the bake gate: green on the real core, red on an empty input and on a planted fault.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import leg from './bake-gate.leg.js';

const root = fileURLToPath(new URL('../..', import.meta.url));

test('the leg passes on the real core and says how many checks it ran', async () => {
  const r = await leg({ root });
  assert.equal(r.status, 'pass', r.failures.join('\n'));
  assert.ok(r.checks > 1000, `${r.checks} checks`);
  console.log(`      image leg: ${r.checks} checks; ${r.notes[0]}`);
});

test('an empty input fails', async () => {
  const r = await leg({ root, dims: [] });
  assert.equal(r.status, 'fail');
  assert.equal(r.checks, 0);
});

test('a planted fault goes red: fitRect not clamping its focus point', async () => {
  const src = readFileSync(new URL('./layout.core.js', import.meta.url), 'utf8');
  const from = 'return clamp(room / 2 - f * size, room - size, 0);';
  assert.ok(src.includes(from));
  const dir = mkdtempSync(join(tmpdir(), 'sg-leg-'));
  try {
    writeFileSync(join(dir, 'm.mjs'), src.replace(from, 'return room / 2 - f * size;'));
    const core = await import(`${pathToFileURL(join(dir, 'm.mjs')).href}?${Math.random()}`);
    const r = await leg({ root, core });
    assert.equal(r.status, 'fail');
    assert.match(r.failures[0], /leaves a gap in its box/);
    console.log(`      planted fault: ${r.failures.length} failures, first: ${r.failures[0]}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
