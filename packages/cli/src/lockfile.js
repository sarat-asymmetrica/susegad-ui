import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CliError } from './registry.js';

// <target>/susegad.json remembers what the CLI copied, so later runs can tell
// the builder's own edits apart from files that are simply older.
//
// {
//   "registry": "susegad-ui",
//   "items": {
//     "scene-kolam": {
//       "version": "0.1.0", "type": "scene", "hash": "sha256-...", "requested": true,
//       "files": { "susegad/scenes/kolam/model.js": "sha256-..." }
//     }
//   }
// }
//
//   A template made by `susegad create` may also carry "written" and "skipped": the files create wrote
//   differently from the registry because of --register, --lang or --site, and the ones it left out,
//   so `diff` can tell create's choices from the builder's edits.
//
// No timestamps, keys sorted: adding the same thing twice leaves the file byte-identical.

export const LOCKFILE = 'susegad.json';

export function readLock(target) {
  const file = join(target, LOCKFILE);
  if (!existsSync(file)) return { registry: 'susegad-ui', items: {} };
  try {
    const lock = JSON.parse(readFileSync(file, 'utf8'));
    return { registry: lock.registry ?? 'susegad-ui', items: lock.items ?? {} };
  } catch (err) {
    throw new CliError(`${file} is not valid JSON (${err.message}). Fix it by hand, or delete it and run susegad add again.`);
  }
}

export function writeLock(target, lock) {
  const items = {};
  for (const name of Object.keys(lock.items).sort()) {
    const { version, type, hash, requested, files, written, skipped } = lock.items[name];
    items[name] = {
      version, type, hash, requested: !!requested,
      files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
      // create's own choices: files it wrote differently from the registry (path -> hash written), and files it chose not to write
      ...(written && Object.keys(written).length ? { written: Object.fromEntries(Object.entries(written).sort(([a], [b]) => a.localeCompare(b))) } : {}),
      ...(skipped?.length ? { skipped: [...skipped].sort() } : {}),
    };
  }
  writeFileSync(join(target, LOCKFILE), JSON.stringify({ registry: lock.registry, items }, null, 2) + '\n');
}

/** file path (relative to target) -> hash the CLI last wrote there. */
export function lockedHashes(lock) {
  const map = new Map();
  for (const item of Object.values(lock.items)) for (const [p, h] of Object.entries(item.files ?? {})) map.set(p, h);
  return map;
}
