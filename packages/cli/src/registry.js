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

/** Is this --registry value a URL the CLI should fetch, rather than a local path? */
export function isHttpUrl(location) {
  return typeof location === 'string' && /^https?:\/\//i.test(location);
}

/**
 * @returns {{ file: string, root: string, index: object, items: Map<string, object>, remote: boolean }}
 */
function loadLocalRegistry(location, cwd) {
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
  return { file, root, index, items: new Map(index.items.map(i => [i.name, i])), remote: false };
}

/**
 * The same shape as loadLocalRegistry, fetched instead of read: rung 8 of
 * docs/requests/2026-09-28-open-the-door.md, "the registry over HTTP". Node
 * 22's global fetch, no dependency, same integrity shape as a local index.
 * `root` is the index's own base URL, resolved from `index.base` the same
 * way the local path is, for display and for a future file-fetching add/diff
 * to join a file's repo-relative path against.
 */
async function loadRemoteRegistry(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new CliError(`I could not reach ${url} (${err.message}). Check the URL and your network.`);
  }
  if (!res.ok) throw new CliError(`${url} answered ${res.status} ${res.statusText}. Check the URL.`);
  let index;
  try {
    index = await res.json();
  } catch (err) {
    throw new CliError(`${url} did not answer with valid JSON (${err.message}).`);
  }
  if (index.format !== 1 || !Array.isArray(index.items)) {
    throw new CliError(`${url} does not look like a Susegad UI registry index.`);
  }
  const root = new URL(index.base ?? '..', url).href;
  return { file: url, root, index, items: new Map(index.items.map(i => [i.name, i])), remote: true };
}

/**
 * @returns {Promise<{ file: string, root: string, index: object, items: Map<string, object>, remote: boolean }>}
 */
export async function loadRegistry(location, cwd) {
  return isHttpUrl(location) ? loadRemoteRegistry(location) : loadLocalRegistry(location, cwd);
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
