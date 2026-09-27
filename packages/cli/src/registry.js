import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The index in the repo this CLI lives in: packages/cli/src -> registry/registry.json. */
export const defaultRegistry = fileURLToPath(new URL('../../../registry/registry.json', import.meta.url));

export class CliError extends Error {}

/**
 * Find the index file from --registry: a file URL, an index file, or a folder
 * (a repo root with registry/registry.json, or a folder holding registry.json).
 */
export function locateIndex(location = defaultRegistry, cwd = process.cwd()) {
  let p = location.startsWith('file:') ? fileURLToPath(location) : resolve(cwd, location);
  if (existsSync(p) && statSync(p).isDirectory()) {
    const candidates = [join(p, 'registry', 'registry.json'), join(p, 'registry.json')];
    p = candidates.find(c => existsSync(c)) ?? candidates[0];
  }
  return p;
}

/**
 * @returns {{ file: string, root: string, index: object, items: Map<string, object> }}
 */
export function loadRegistry(location, cwd) {
  const file = locateIndex(location, cwd);
  if (!existsSync(file)) {
    throw new CliError(
      `I could not find the registry index at ${file}.\n` +
      `If this is the Susegad UI repo, build it with: node registry/build.mjs\n` +
      `Or point me at another one with --registry <path>.`);
  }
  let index;
  try {
    index = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new CliError(`The registry index at ${file} is not valid JSON (${err.message}). Rebuild it with node registry/build.mjs.`);
  }
  if (index.format !== 1 || !Array.isArray(index.items)) {
    throw new CliError(`${file} does not look like a Susegad UI registry index. Rebuild it with node registry/build.mjs.`);
  }
  const root = resolve(dirname(file), index.base ?? '..');
  return { file, root, index, items: new Map(index.items.map(i => [i.name, i])) };
}

/** The closest known name, for "did you mean". */
export function suggest(name, names) {
  let best = null, bestD = Infinity;
  for (const n of names) {
    const d = name.length >= 3 && (n.includes(name) || name.includes(n)) ? 1 + Math.abs(n.length - name.length) / 100 : distance(name, n);
    if (d < bestD) { bestD = d; best = n; }
  }
  return bestD <= Math.max(2, name.length / 3) ? best : null;
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}
