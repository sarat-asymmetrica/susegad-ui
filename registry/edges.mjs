// The edges the install graph does not carry: an item's demo page, page modules, stylesheets and
// checks that load another item's files. `dependencies` is what a builder installs, so it lists
// only what the item's listed files need (build.mjs fails the build on a listed file that reaches
// a file it does not own). A demo is not installed, so a demo reaching into another item is not a
// reason to ship that item with this one. It still means a change to the other item can break this
// item's demo, and so its checks. These edges are DERIVED here, from the files, and written into
// the index as `checkDeps` (sorted, only when non-empty, and not part of the item's hash). The
// selection in tools/lib/changed.core.js follows `dependencies` and `checkDeps` alike.
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { absoluteRefs, relativeRefs } from '../packages/cli/src/imports.js';
import { toPosix } from '../packages/cli/src/paths.js';

const SKIP_DIRS = new Set(['node_modules']);
const SCANNED = /\.(m?js|html|css)$/;
// Unit tests import for their own sake and never load in a browser page.
const UNIT_TEST = /\.test\.(m?js)$/;
/** Folders every check loads whatever it covers: a change there already selects everything (SHARED in tools/lib/changed.core.js). */
export const EVERYTHING_FOLDERS = ['packages/core/', 'packages/engine/', 'packages/tokens/'];

function walk(root, rel, out) {
  for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const child = `${rel}/${e.name}`;
    if (e.isDirectory()) walk(root, child, out);
    else if (SCANNED.test(e.name) && !UNIT_TEST.test(e.name)) out.push(child);
  }
  return out;
}

/** Every repo path a file's text loads: relative ones (src, href, import, url()) and root-absolute ones ("/packages/x/y.js"). */
export function loadedPaths(path, text) {
  const out = relativeRefs(path, text).map(r => r.target);
  for (const abs of absoluteRefs(path, text)) out.push(posix.normalize(abs.split(/[?#]/)[0]).replace(/^\//, ''));
  return out;
}

/**
 * @param {string} root repo root
 * @param {Map<string, { name: string, manifest: string, files: { path: string }[], dependencies: string[] }>} items
 * @param {(names: string[]) => string[]} closureOf an item's declared dependencies, at any depth
 * @returns {Map<string, { to: string, from: string, spec: string }[]>} item name -> edges to items its declared dependencies
 *   do not already reach, one per (item, file) pair, with the file and the reference that made it
 */
export function deriveEdges(root, items, closureOf) {
  const listed = new Map(); // file -> item that lists it
  const dirs = []; // [dir, item], deepest first
  for (const it of items.values()) {
    for (const f of it.files) listed.set(f.path, it.name);
    dirs.push([it.manifest.slice(0, it.manifest.lastIndexOf('/')), it.name]);
  }
  dirs.sort((a, b) => b[0].length - a[0].length);
  const ownersOf = file => {
    if (listed.has(file)) return [listed.get(file)];
    const hit = dirs.find(([d]) => file.startsWith(`${d}/`));
    return hit ? dirs.filter(([d]) => d === hit[0]).map(([, n]) => n) : [];
  };
  const out = new Map();
  const seenDirs = new Set();
  for (const [dir] of dirs) {
    if (seenDirs.has(dir) || EVERYTHING_FOLDERS.some(f => `${dir}/`.startsWith(f))) continue; // a change to these selects every check already
    seenDirs.add(dir);
    for (const file of walk(root, dir, [])) {
      const owners = ownersOf(file);
      if (!owners.length) continue;
      const text = readFileSync(join(root, file), 'utf8');
      for (const target of loadedPaths(file, text)) {
        if (EVERYTHING_FOLDERS.some(f => target.startsWith(f))) continue;
        const to = ownersOf(toPosix(target));
        for (const name of owners) {
          if (listed.get(file) === name) continue; // an installed file: build.mjs fails the build on an undeclared reach, so none are missing
          const reached = closureOf([name]);
          for (const t of to) {
            if (t === name || reached.includes(t)) continue;
            (out.get(name) ?? out.set(name, []).get(name)).push({ to: t, from: file, spec: target });
          }
        }
      }
    }
  }
  return out;
}
