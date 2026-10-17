import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivate } from '../../tools/publish/export.mjs';
import { unfollowable } from './pointers.core.js';

const run = text => unfollowable([{ file: 'x.md', text }], isPrivate);

test('a path to a private folder is red, with its file and line', () => {
  const found = run('fine\nper `docs/requests/2026-09-25-volume-iii-harvest.md`.\n');
  assert.equal(found.length, 1);
  assert.deepEqual([found[0].file, found[0].line, found[0].what], ['x.md', 2, 'docs/requests/2026-09-25-volume-iii-harvest.md']);
});

test('each folder the request names is red', () => {
  for (const p of ['docs/briefs/a.md', 'docs/reviews/a.md', 'docs/requests/a.md', 'docs/LEDGER.md', 'docs/GOAL-CONCLAVE.md', 'docs/LEDGER', 'docs/runs/conclave/rung-1.md']) {
    assert.equal(run(`see ${p} for more`).length, 1, p);
  }
});

test('a path a reader can open is fine', () => {
  for (const p of ['docs/decisions/0025-languages.md', 'docs/HANDOFF.md', 'docs/BROWSERS.md', 'docs/reference/accessibility.md', 'docs/contributing/touch-contract.md', 'tools/axe.mjs']) {
    assert.deepEqual(run(`see \`${p}\`.`), [], p);
  }
});

test('an agent named as credit is fine; its report or review is not', () => {
  assert.deepEqual(run("The story is Kathakar's. Kernels are in .claude/agents/."), []);
  assert.equal(run("Rasika's probe found it").length, 1);
  assert.equal(run("as in Kathakar's review").length, 1);
});

test('a word that only looks like a path is not one', () => {
  assert.deepEqual(run('the docs/ folder, and a/docs/requests-like name'), []);
});
