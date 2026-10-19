// The git half of `node tools/checks.mjs --changed`: which files differ from the base, and the
// registry's items. The choosing itself is pure and lives in changed.core.js.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { selectChecks, selectNodeChecks } from './changed.core.js';

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').trim()}`);
  return r.stdout.trim();
}

/**
 * Files that differ from the merge-base of HEAD and `base`: committed, staged, unstaged and untracked
 * (not ignored). Both sides of a rename are listed. base: the argument, else SG_BASE, else "main".
 * @returns {{ base: string, mergeBase: string, files: string[] }}
 */
export function changedFiles({ cwd, base, env = process.env }) {
  const ref = base || env.SG_BASE || 'main';
  const mergeBase = git(cwd, ['merge-base', 'HEAD', ref]);
  const lines = out => out.split('\n').map(s => s.trim()).filter(Boolean);
  const tracked = lines(git(cwd, ['diff', '--name-only', '--no-renames', mergeBase]));
  const untracked = lines(git(cwd, ['ls-files', '--others', '--exclude-standard']));
  return { base: ref, mergeBase, files: [...new Set([...tracked, ...untracked])].sort() };
}

/** The item names in the registry index at `ref`, or undefined when it cannot be read (the caller then treats any index change as a new item). */
export function itemNamesAt(cwd, ref) {
  try { return JSON.parse(git(cwd, ['show', `${ref}:registry/registry.json`])).items.map(i => i.name); } catch { return undefined; }
}

/** Select from the repo as it stands: git for the diff, registry/registry.json for the items. */
export function selectForDiff({ root, checks, base, env }) {
  const diff = changedFiles({ cwd: root, base, env });
  const items = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'registry.json'), 'utf8')).items;
  return { ...diff, ...selectChecks({ changed: diff.files, checks, items, baseItemNames: itemNamesAt(root, diff.mergeBase) }), node: selectNodeChecks({ changed: diff.files }) };
}
