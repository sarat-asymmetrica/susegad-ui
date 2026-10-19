// The git half of the rigour runner and of `gate-tier --enforce`: the slices a run merged since a base,
// each with its paths, new paths, commits and the registry as it stood at the merge. The judging is pure and
// lives in gate-tier.core.js and rigour.core.js.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { classify, gateTrailerTier, laneOf, LEGACY_BEFORE, TIER_RANK } from '../gate-tier.core.js';

export function git(cwd, args, { allowFail = false, raw = false } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').trim().split('\n')[0]}`);
  }
  return raw ? r.stdout : r.stdout.trim();
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

// Git's own subjects for merging main in: "Merge branch 'main'", "Merge remote-tracking branch 'origin/main'", each with
// an optional " of <url>" and " into <branch>". A branch that only starts with main (main-menu-fix) is a slice.
const MERGE_OF_MAIN = /^Merge (?:remote-tracking )?branch '(?:[^'\s/]+\/)?main'(?: of \S+)?(?: into \S+)?$/;

/**
 * The slices merged on `head`'s first-parent line since `base`, oldest first, each classified.
 * A merge of main into the branch is skipped (it brings no slice) and counted in the result's `skipped`. Each commit made straight on the branch is a unit
 * of its own (direct: true), at its own tier, so a review of one is never a review of the others and none can slip
 * past. Each unit:
 *   { name, merge, refs, direct, files, tier, reasons, lane, laneItems }
 * lane is 'experimental' when the unit stays inside experimental registry items (laneOf), else 'shared'.
 * where refs are what a review may call the slice by: its branch name and its commit hashes (a direct commit: its hash).
 */
export function mergedSlices({ cwd, base = 'main', head = 'HEAD' }) {
  const out = [];
  let skipped = 0;
  const range = `${base}..${head}`;
  const rows = lines(git(cwd, ['log', '--first-parent', '--reverse', '--format=%H%x09%P%x09%s', range]));
  const unit = (name, merge, refs, rev, parent) => {
    const paths = lines(git(cwd, ['diff', '--name-only', '--no-renames', parent, rev]));
    const added = lines(git(cwd, ['diff', '--diff-filter=A', '--name-only', '--no-renames', parent, rev]));
    return { name, merge, refs, paths, added, rev, direct: merge === null };
  };
  for (const row of rows) {
    const [hash, parents, subject] = row.split('\t');
    const ps = parents.split(' ').filter(Boolean);
    if (ps.length < 2) {
      const h = hash.slice(0, 7);
      out.push({
        name: `commit ${h}: ${subject.length > 56 ? `${subject.slice(0, 55)}...` : subject}`, merge: null, refs: [h], direct: true, rev: hash,
        paths: lines(git(cwd, ['diff-tree', '--no-commit-id', '--name-only', '-r', '--no-renames', hash])),
        added: lines(git(cwd, ['diff-tree', '--no-commit-id', '--name-only', '-r', '--diff-filter=A', '--no-renames', hash])),
      });
      continue;
    }
    if (MERGE_OF_MAIN.test(subject)) { skipped++; continue; }
    const branch = (/^Merge (?:remote-tracking )?(?:branch )?'?([A-Za-z0-9_./-]+)/.exec(subject) ?? [])[1] ?? hash.slice(0, 7);
    const own = lines(git(cwd, ['rev-list', '--abbrev-commit', '--abbrev=7', `${ps[0]}..${ps[1]}`]));
    const tip = own[0] ?? ps[1].slice(0, 7);
    out.push({ ...unit(branch, hash.slice(0, 7), [branch, hash.slice(0, 7), ...own], hash, ps[0]), tip });
  }
  const read = rev => p => git(cwd, ['show', `${rev}:${p}`], { allowFail: true });
  const units = out.map(s => {
    const registry = registryAt(cwd, s.rev);
    let { tier, reasons } = classify(s.paths, registry, { newPaths: s.added, gateFullPaths: gateFullIn(s.paths, read(s.rev)) });
    // A `Gate: standard` or `Gate: full` line in the merge's (or the direct commit's) message only raises the tier.
    const floor = gateTrailerTier(git(cwd, ['show', '-s', '--format=%B', s.rev], { allowFail: true }));
    if (floor && TIER_RANK[floor] > TIER_RANK[tier]) { tier = floor; reasons = [...reasons, `${floor}: the commit's message says Gate: ${floor}`]; }
    const { lane, items } = laneOf(s.paths, registry);
    return { name: s.name, merge: s.merge, tip: s.tip, refs: s.refs, direct: s.direct, files: s.paths.length, tier, reasons, lane, laneItems: items };
  });
  units.skipped = skipped;
  return units;
}

/**
 * The documents a review can be found in: the ledger (by line) and every docs/reviews/*.md (by file), in document order
 * (the ledger, then the files by name). With `head` they are read from that commit through git, so the verdict is a
 * function of the commit; without it, from the working tree (a review not yet committed counts).
 * Each file carries `legacy` and the ledger `legacyLines`: whether git already held it (the line) at the last commit
 * before LEGACY_BEFORE, on head's history. Nothing the author names or dates decides that.
 */
export function reviewDocuments(root, { ledger = 'docs/LEDGER.md', reviews = 'docs/reviews', head } = {}) {
  const snap = git(root, ['rev-list', '-1', `--before=${LEGACY_BEFORE}T00:00:00Z`, head ?? 'HEAD'], { allowFail: true }) || null;
  const heldThen = p => snap !== null && git(root, ['cat-file', '-e', `${snap}:${p}`], { allowFail: true }) !== null;
  const readAt = (rev, p) => git(root, ['show', `${rev}:${p}`], { allowFail: true, raw: true });
  const read = p => head ? readAt(head, p) : fs.existsSync(path.join(root, p)) ? fs.readFileSync(path.join(root, p), 'utf8') : null;
  const names = head
    ? lines(git(root, ['ls-tree', '--name-only', head, `${reviews}/`], { allowFail: true })).map(p => p.split('/').pop())
    : fs.existsSync(path.join(root, reviews)) ? fs.readdirSync(path.join(root, reviews)) : [];
  const docs = [];
  const text = read(ledger);
  if (text !== null) {
    const then = snap === null ? null : readAt(snap, ledger);
    const held = (then ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    docs.push({ source: ledger, kind: 'ledger', text, legacyLines: new Set(held) });
  }
  for (const f of names.filter(n => n.endsWith('.md')).sort()) {
    const p = `${reviews}/${f}`;
    docs.push({ source: p, kind: 'review', text: read(p) ?? '', legacy: heldThen(p) });
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
