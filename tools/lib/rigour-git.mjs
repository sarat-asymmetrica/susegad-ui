// The git half of the rigour runner and of `gate-tier --enforce`: the slices a run merged since a base,
// each with its paths, new paths, commits and the registry as it stood at the merge. The judging is pure and
// lives in gate-tier.core.js and rigour.core.js.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { classify } from '../gate-tier.core.js';

export function git(cwd, args, { allowFail = false } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').trim().split('\n')[0]}`);
  }
  return r.stdout.trim();
}
const lines = s => (s ?? '').split('\n').map(x => x.trim()).filter(Boolean);

/** Paths whose own first 4000 bytes declare `gate: full` (read through `read(path)`; null when it does not exist). */
export function gateFullIn(paths, read) {
  return paths.filter(p => /\.(md|html)$/.test(p) && (read(p) ?? '').slice(0, 4000).includes('gate: full'));
}

/** The registry at a revision, else the working tree's, else an empty one. */
export function registryAt(cwd, rev) {
  const shown = rev ? git(cwd, ['show', `${rev}:registry/registry.json`], { allowFail: true }) : null;
  if (shown) return JSON.parse(shown);
  const f = path.join(cwd, 'registry', 'registry.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { items: [] };
}

const MERGE_OF_MAIN = /^Merge (?:remote-tracking )?(?:branch )?'?(?:origin\/)?main\b/;

/**
 * The slices merged on `head`'s first-parent line since `base`, oldest first, each classified.
 * A merge of main into the branch is skipped (it brings no slice). Commits made straight on the branch
 * are one unit, "direct commits", so they cannot slip past. Each unit:
 *   { name, merge, refs, paths, added, tier, reasons }
 * where refs are what a review may call the slice by: its branch name and its commit hashes.
 */
export function mergedSlices({ cwd, base = 'main', head = 'HEAD' }) {
  const out = [];
  const range = `${base}..${head}`;
  const rows = lines(git(cwd, ['log', '--first-parent', '--reverse', '--format=%H%x09%P%x09%s', range]));
  const direct = { commits: [], paths: new Set(), added: new Set(), last: null };
  const unit = (name, merge, refs, rev, parent) => {
    const paths = lines(git(cwd, ['diff', '--name-only', '--no-renames', parent, rev]));
    const added = lines(git(cwd, ['diff', '--diff-filter=A', '--name-only', '--no-renames', parent, rev]));
    return { name, merge, refs, paths, added, rev };
  };
  for (const row of rows) {
    const [hash, parents, subject] = row.split('\t');
    const ps = parents.split(' ').filter(Boolean);
    if (ps.length < 2) {
      direct.commits.push(hash.slice(0, 7));
      for (const p of lines(git(cwd, ['diff-tree', '--no-commit-id', '--name-only', '-r', '--no-renames', hash]))) direct.paths.add(p);
      for (const p of lines(git(cwd, ['diff-tree', '--no-commit-id', '--name-only', '-r', '--diff-filter=A', '--no-renames', hash]))) direct.added.add(p);
      direct.last = hash;
      continue;
    }
    if (MERGE_OF_MAIN.test(subject)) continue;
    const branch = (/^Merge (?:remote-tracking )?(?:branch )?'?([A-Za-z0-9_./-]+)/.exec(subject) ?? [])[1] ?? hash.slice(0, 7);
    const own = lines(git(cwd, ['rev-list', '--abbrev-commit', '--abbrev=7', `${ps[0]}..${ps[1]}`]));
    out.push(unit(branch, hash.slice(0, 7), [branch, hash.slice(0, 7), ...own], hash, ps[0]));
  }
  if (direct.commits.length) {
    out.unshift({ name: `direct commits (${direct.commits.length})`, merge: null, refs: direct.commits, paths: [...direct.paths], added: [...direct.added], rev: direct.last });
  }
  const read = rev => p => git(cwd, ['show', `${rev}:${p}`], { allowFail: true });
  return out.map(s => {
    const registry = registryAt(cwd, s.rev);
    const { tier, reasons } = classify(s.paths, registry, { newPaths: s.added, gateFullPaths: gateFullIn(s.paths, read(s.rev)) });
    return { name: s.name, merge: s.merge, refs: s.refs, files: s.paths.length, tier, reasons };
  });
}

/** The documents a review can be found in: the ledger (by line) and every docs/reviews/*.md (by file). */
export function reviewDocuments(root, { ledger = 'docs/LEDGER.md', reviews = 'docs/reviews' } = {}) {
  const docs = [];
  const l = path.join(root, ledger);
  if (fs.existsSync(l)) docs.push({ source: ledger, kind: 'ledger', text: fs.readFileSync(l, 'utf8') });
  const dir = path.join(root, reviews);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.md')).sort()) {
      docs.push({ source: `${reviews}/${f}`, kind: 'review', text: fs.readFileSync(path.join(dir, f), 'utf8') });
    }
  }
  return docs;
}

/** The working diff of a slice in progress: committed since the merge-base, staged, unstaged and untracked. */
export function sliceDiff({ cwd, base = 'main' }) {
  const mergeBase = git(cwd, ['merge-base', 'HEAD', base]);
  const untracked = lines(git(cwd, ['ls-files', '--others', '--exclude-standard']));
  const changed = [...new Set([...lines(git(cwd, ['diff', '--name-only', '--no-renames', mergeBase])), ...untracked])].sort();
  const added = [...new Set([...lines(git(cwd, ['diff', '--diff-filter=A', '--name-only', '--no-renames', mergeBase])), ...untracked])].sort();
  return { mergeBase, changed, added };
}
