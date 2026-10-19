// When each registry item joined the library, for the home page's Newest list.
//
// The date is the first commit that added the item's registry.json, read from git every time the site builds,
// so a new piece appears in Newest the day it lands and nothing is typed by hand. A build with no usable history
// (a shallow clone, where every file looks added on one day) falls back to joined.json, a snapshot that
// `node apps/docs/joined.mjs --write` refreshes from a full clone.
//
//   node apps/docs/joined.mjs            print the newest ten
//   node apps/docs/joined.mjs --write    refresh joined.json

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SNAPSHOT = path.join(HERE, 'joined.json');

const git = (root, args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** Pure: the output of `git log --name-only --format=%x01%aI` (newest first) to { path: earliest ISO date }. */
export function firstAdded(logText) {
  const out = {};
  for (const block of String(logText).split('\u0001').slice(1)) {
    const [date, ...files] = block.split('\n');
    for (const f of files.map(x => x.trim()).filter(Boolean)) out[f] = date.trim(); // newest first, so the last write is the oldest add
  }
  return out;
}

/** { registryName: ISO date } from git, or null when the history cannot say (no git, or a shallow clone). */
export function joinedFromGit(root, registry) {
  const shallow = git(root, ['rev-parse', '--is-shallow-repository']);
  if (shallow.status !== 0 || shallow.stdout.trim() !== 'false') return null;
  const log = git(root, ['log', '--no-renames', '--diff-filter=A', '--name-only', '--format=%x01%aI', '--', 'packages']);
  if (log.status !== 0) return null;
  const added = firstAdded(log.stdout);
  const out = {};
  for (const item of registry.items) if (added[item.manifest]) out[item.name] = added[item.manifest];
  return out;
}

/** What the build uses: git's dates, with the snapshot filling any item git cannot date. */
export function joinedDates(root, registry) {
  const snap = fs.existsSync(SNAPSHOT) ? JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) : {};
  const fresh = joinedFromGit(root, registry);
  return { dates: { ...snap, ...(fresh ?? {}) }, source: fresh ? 'git' : 'the joined.json snapshot' };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry', 'registry.json'), 'utf8'));
  const fresh = joinedFromGit(ROOT, registry);
  if (!fresh) { console.error('This clone has no full history, so git cannot date the items. Run this in a full clone.'); process.exit(1); }
  if (process.argv.includes('--write')) {
    const sorted = Object.fromEntries(Object.entries(fresh).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(SNAPSHOT, JSON.stringify(sorted, null, 1) + '\n');
    console.log(`joined.json: ${Object.keys(sorted).length} of ${registry.items.length} items dated`);
  }
  for (const [n, d] of Object.entries(fresh).sort(([, a], [, b]) => (a < b ? 1 : -1)).slice(0, 10)) console.log(`${d}  ${n}`);
}
