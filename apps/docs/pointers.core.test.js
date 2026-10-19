import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unfollowable } from './pointers.core.js';
import { loadPrivateList } from './private-list.mjs';

// The export's private list lives in tools/publish/, which is itself private, so the public
// tree runs these tests without it and says so rather than failing to load.
const { isPrivate, absent } = await loadPrivateList();
const PUBLIC_TREE = !absent ? false : 'tools/publish/ is private and absent from the public tree';
const run = text => unfollowable([{ file: 'x.md', text }], isPrivate);

test('a path to a private folder is red, with its file and line', { skip: PUBLIC_TREE }, () => {
  const found = run('fine\nper `docs/requests/2026-09-25-volume-iii-harvest.md`.\n');
  assert.equal(found.length, 1);
  assert.deepEqual([found[0].file, found[0].line, found[0].what], ['x.md', 2, 'docs/requests/2026-09-25-volume-iii-harvest.md']);
});

test('each folder the request names is red', { skip: PUBLIC_TREE }, () => {
  for (const p of ['docs/briefs/a.md', 'docs/reviews/a.md', 'docs/requests/a.md', 'docs/LEDGER.md', 'docs/GOAL-CONCLAVE.md', 'docs/LEDGER', 'docs/runs/conclave/rung-1.md']) {
    assert.equal(run(`see ${p} for more`).length, 1, p);
  }
});

test('a path a reader can open is fine', { skip: PUBLIC_TREE }, () => {
  for (const p of ['docs/decisions/0025-languages.md', 'docs/HANDOFF.md', 'docs/BROWSERS.md', 'docs/reference/accessibility.md', 'docs/contributing/touch-contract.md', 'tools/axe.mjs']) {
    assert.deepEqual(run(`see \`${p}\`.`), [], p);
  }
});

test('an agent named as credit is fine; its report or review is not', { skip: PUBLIC_TREE }, () => {
  assert.deepEqual(run("The story is Kathakar's. Kernels are in .claude/agents/."), []);
  assert.equal(run("Rasika's probe found it").length, 1);
  assert.equal(run("as in Kathakar's review").length, 1);
});

test('a word that only looks like a path is not one', { skip: PUBLIC_TREE }, () => {
  assert.deepEqual(run('the docs/ folder, and a/docs/requests-like name'), []);
});

// Absent is the public tree; present and broken is a fault, not a skip (Rasika, S3). Each case writes its own file, so the public tree runs them too.
test('the private list: absent is the public tree, and a present list must load', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-private-list-'));
  try {
    const at = (name, src) => { const p = path.join(dir, name); fs.writeFileSync(p, src); return p; };
    const none = await loadPrivateList(path.join(dir, 'missing.mjs'));
    assert.equal(none.absent, true);
    assert.equal(none.isPrivate('docs/briefs/a.md'), false);
    const good = await loadPrivateList(at('good.mjs', 'export const isPrivate = p => p.startsWith("docs/briefs/");'));
    assert.equal(good.absent, false);
    assert.equal(good.isPrivate('docs/briefs/a.md'), true);
    await assert.rejects(loadPrivateList(at('syntax.mjs', 'export const broken = ;')), SyntaxError);
    await assert.rejects(loadPrivateList(at('renamed.mjs', 'export const isPrivatePath = () => true;')), /does not export isPrivate/);
    await assert.rejects(loadPrivateList(at('imports.mjs', "import './not-there.mjs'; export const isPrivate = () => true;")), /not-there/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
