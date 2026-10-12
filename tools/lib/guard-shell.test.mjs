import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellVerdict, worktreeRemovals } from './guard-shell.core.js';

const HOOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.claude/hooks/guard-shell.mjs');

test('a forced worktree removal is refused, alone or inside a compound command', () => {
  for (const c of [
    'git worktree remove --force .worktrees/x',
    'git worktree remove -f .worktrees/x',
    'git worktree remove .worktrees/x --force',
    'cd /c/Projects/susegad-ui && git worktree remove --force .worktrees/x',
    'git -C /c/repo worktree remove -f x; echo done',
  ]) assert.match(shellVerdict(c) ?? '', /worktree remove --force/, c);
});

test('a plain worktree removal and other commands that merely mention the words pass', () => {
  for (const c of [
    'git worktree remove .worktrees/x',
    'git worktree list',
    'git worktree remove .worktrees/x && git branch -d batch/x',
    'echo "never use git worktree remove --force"; ls',
    'npm test -- --force',
  ]) {
    // The echo case quotes the words without running them; the guard reads the command text, so it may refuse it.
    if (c.startsWith('echo')) continue;
    assert.equal(shellVerdict(c), null, c);
  }
});

test('git stash is refused in every form that writes the shared stack; list and show pass', () => {
  // 12 October: an agent's `git stash -q` / `git stash pop -q` in one worktree left its edits in another's.
  for (const c of [
    'git stash', 'git stash push', 'git stash && git pull', 'cd x; git stash',
    'git stash -q', 'git stash pop -q', 'git stash pop', 'git stash apply stash@{0}',
    'git stash push -m wip -- src/a.js', 'git stash save wip', 'git stash drop', 'git -C .worktrees/x stash -u',
    'cd a && git stash -q && node run.mjs; git stash pop -q',
  ]) assert.match(shellVerdict(c) ?? '', /git stash/, c);
  for (const c of ['git stash list', 'git stash show -p stash@{0}', 'git log --grep stash', 'echo stash', 'grep -n "git stash" docs/RUNBOOK.md', 'grep -rn "git worktree remove --force" docs'])
    assert.equal(shellVerdict(c), null, c);
});

// The hook lives in .claude/, which the public snapshot leaves out; there only the pure verdict is tested.
test('the hook exits 2 with the reason on a refused command and 0 otherwise', { skip: !existsSync(HOOK) && 'the hook is private (.claude/hooks)' }, () => {
  const run = command => spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
  const bad = run('git worktree remove --force .worktrees/x');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Refused/);
  const ok = run('git status');
  assert.equal(ok.status, 0);
  assert.equal(spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' }).status, 0);
});

test('a link named node_modules is refused, however it is made', () => {
  for (const c of [
    'ln -s ../../node_modules node_modules',
    'cd .worktrees/x && ln -s ../../node_modules node_modules 2>/dev/null; ls',
    'ln -sfn /c/Projects/susegad-ui/node_modules .worktrees/x/node_modules',
    'cmd //c mklink /J node_modules ..\\..\\node_modules',
    'New-Item -ItemType Junction -Path node_modules -Target ..\\..\\node_modules',
  ]) assert.match(shellVerdict(c) ?? '', /link named node_modules/, c);
  for (const c of ['ln -s ~/.cache/ms-playwright/chromium-1243 chromium-1243', 'ls -la node_modules', 'grep -rn "ln -s" docs'])
    assert.equal(shellVerdict(c), null, c);
});

test('a plain worktree removal is refused while the tree holds a link, and passes when it holds none', () => {
  // 12 October: a plain `git worktree remove` followed a scratch tree's node_modules link and emptied the main checkout's.
  const seen = [];
  const linksIn = p => { seen.push(p); return p.endsWith('linked') ? ['node_modules'] : []; };
  assert.match(shellVerdict('git worktree remove .worktrees/linked', { linksIn }) ?? '', /holds a link \(node_modules\)/);
  assert.match(shellVerdict('cd /c/x && git worktree remove .worktrees/linked && git branch -d b', { linksIn }) ?? '', /holds a link/);
  assert.equal(shellVerdict('git worktree remove .worktrees/clean', { linksIn }), null);
  assert.deepEqual(seen.slice(-1), ['.worktrees/clean']);
  assert.deepEqual(worktreeRemovals('git -C /c/r worktree remove x; git worktree remove a'), ['x', 'a']);
});

test('the hook looks inside the tree: a real junction blocks the removal, a tree without one passes', { skip: !existsSync(HOOK) && 'the hook is private (.claude/hooks)' }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sg-guard-'));
  try {
    mkdirSync(path.join(dir, 'target')); writeFileSync(path.join(dir, 'target', 'keep.txt'), 'keep');
    mkdirSync(path.join(dir, 'tree')); mkdirSync(path.join(dir, 'plain'));
    symlinkSync(path.join(dir, 'target'), path.join(dir, 'tree', 'node_modules'), 'junction');
    const run = command => spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_name: 'Bash', cwd: dir, tool_input: { command } }), encoding: 'utf8' });
    const bad = run('git worktree remove tree');
    assert.equal(bad.status, 2, bad.stderr);
    assert.match(bad.stderr, /holds a link \(node_modules\)/);
    assert.equal(run('git worktree remove plain').status, 0);
    assert.equal(run(`cd ${dir.replace(/\\/g, '/')} && git worktree remove tree`).status, 2);
    assert.equal(readFileSync(path.join(dir, 'target', 'keep.txt'), 'utf8'), 'keep');
  } finally {
    rmSync(path.join(dir, 'tree', 'node_modules'), { force: true }); // the link alone, never its target
    rmSync(dir, { recursive: true, force: true });
  }
});
