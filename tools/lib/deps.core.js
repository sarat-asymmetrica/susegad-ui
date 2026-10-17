// What a check loads: its imports (read from the source, followed file to file) and the npm
// packages behind them (followed through package-lock.json). The pure half of the narrower
// `node tools/checks.mjs --changed`; tools/lib/changed-deps.mjs reads the files and git.
import { builtinModules } from 'node:module';

const BUILTIN = new Set(builtinModules);
const VALID_NAME = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i; // not a template (`${p}`) or a stray string

/**
 * The module specifiers in one source file: static and literal dynamic imports, re-exports,
 * require() and require.resolve(), plus any 'tools/lib/…' path written as a string (a check that
 * spawns a tool by path still runs it). A superset is safe here: an extra edge selects one check
 * too many; a missing one would skip a check the diff needs.
 * A check reads its fixtures by path string, not by import. `fixtures` names what is in tools/fixtures/; a name written as
 * 'tools/fixtures/<name>' or as the pieces of a joined path ('fixtures', '<name>') is a repoPath.
 * @returns {{ relative: string[], bare: string[], repoPaths: string[] }}
 */
export function parseSpecifiers(source, { fixtures = [] } = {}) {
  const src = String(source);
  const specs = new Set();
  const patterns = [
    /\bimport\s*(?:[\w*{}\s,$]+?\s*from\s*)?['"]([^'"]+)['"]/g, // import x from '…', import '…'
    /\bexport\s*[\w*{}\s,$]*?\s*from\s*['"]([^'"]+)['"]/g, // export … from '…'
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // import('…')
    /\brequire(?:\.resolve)?\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // require('…'), require.resolve('…')
    /\bcreateRequire\([^)]*\)\.resolve\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // createRequire(import.meta.url).resolve('axe-core/…')
  ];
  for (const re of patterns) for (const m of src.matchAll(re)) specs.add(m[1]);
  const relative = [], bare = new Set();
  for (const s of specs) {
    if (s.startsWith('./') || s.startsWith('../')) relative.push(s);
    else if (!s.startsWith('/') && !/^[a-z]+:/i.test(s)) { const p = packageName(s); if (p) bare.add(p); }
  }
  const repoPaths = [...new Set([...src.matchAll(/['"`](?:\.\/)?(tools\/lib\/[\w.-]+\.(?:mjs|js|cjs))['"`]/g)].map(m => m[1]))];
  const named = fixtures.filter(n => src.includes(n) && new RegExp(`fixtures[/'"\`,\\s\\\\]+${escapeRe(n)}(?![\\w-])`).test(src));
  return { relative, bare: [...bare], repoPaths: [...repoPaths, ...named.map(n => `tools/fixtures/${n}`)] };
}

/**
 * Repo files a page or a check names by a root-absolute path: import('/packages/scenes/kolam/index.js'), a demo it
 * serves ('/packages/core/lazy.demo.html'), <sg-lazy src="/packages/...">, a stylesheet. A superset is safe; the caller
 * keeps the ones that exist.
 * @returns {string[]} repo-relative paths
 */
export function rootPaths(source) {
  const re = /(?:["'`(=])\/([\w@.-]+(?:\/[\w@.-]+)+\.(?:m?js|css|html|json))(?=[?#"'`)\s>])/g;
  return [...new Set([...String(source).matchAll(re)].map(m => m[1]))];
}

/** The scene entry files an `<sg-scene name="kolam">` in a page or a check's markup resolves to (the caller keeps the ones that exist). */
export function sceneNamePaths(source) {
  const names = [...String(source).matchAll(/<sg-scene[^>]*?name=["']([\w-]+)["']/g)].map(m => m[1]);
  return [...new Set(names)].map(n => `packages/scenes/${n}/index.js`);
}

/**
 * The registry pieces a docs-site check opens or names: a quoted name ('kantar') or a route segment
 * (/scenes/paus, /components/badge) that is a folder under packages/scenes|components|recipes. The site renders every
 * piece, but a check follows the ones it names; a superset is safe (the caller keeps the folders that exist).
 * @param {(rel: string) => boolean} exists is this repo-relative path a file or folder?
 * @returns {string[]} one entry file per piece found, repo-relative
 */
export function pieceFiles(source, exists) {
  const names = new Set([...String(source).matchAll(/['"`\/]([a-z][a-z0-9-]*)(?=['"`\/?#])/g)].map(m => m[1]));
  const out = [];
  for (const n of names) {
    for (const [kind, entry] of [['scenes', 'index.js'], ['components', `${n}.js`], ['recipes', 'recipe.js']]) {
      const f = `packages/${kind}/${n}/${entry}`;
      if (exists(f)) out.push(f);
    }
  }
  return out;
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 'axe-core/axe.min.js' -> 'axe-core', '@a/b/c' -> '@a/b'; a Node builtin -> null. */
export function packageName(spec) {
  const parts = spec.split('/');
  const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  return !VALID_NAME.test(name) || BUILTIN.has(name) ? null : name;
}

/** Repo-relative path from a file's path and a relative specifier ('tools/lib/a.mjs' + '../serve.mjs' -> 'tools/serve.mjs'). */
export function resolveRelative(from, spec) {
  const out = from.split('/').slice(0, -1);
  for (const part of spec.split(/[?#]/)[0].split('/')) {
    if (part === '..') out.pop();
    else if (part !== '.' && part !== '') out.push(part);
  }
  return out.join('/');
}

/**
 * Every file and package reachable from `start`. edgesOf(file) -> { files: string[], packages: string[] }
 * (repo-relative), or null for a file that cannot be read. Returns, for each file reached, the file
 * it was first reached from, so a reason can name the chain.
 * @returns {{ files: Map<string, string|null>, packages: Set<string> }}
 */
export function importClosure(start, edgesOf) {
  const files = new Map([[start, null]]), packages = new Set();
  const queue = [start];
  while (queue.length) {
    const f = queue.shift();
    const e = edgesOf(f);
    if (!e) continue;
    for (const p of e.packages) packages.add(p);
    for (const g of e.files) if (!files.has(g)) { files.set(g, f); queue.push(g); }
  }
  return { files, packages };
}

/** "node_modules/a/node_modules/@b/c" -> "@b/c"; a workspace key ("packages/cli") -> its entry's name. */
function lockName(key, entry) {
  const i = key.lastIndexOf('node_modules/');
  return i >= 0 ? key.slice(i + 'node_modules/'.length) : (entry?.name ?? key);
}

const depNames = e => Object.keys({ ...e?.dependencies, ...e?.optionalDependencies, ...e?.peerDependencies });

/**
 * Packages whose lock entries differ (added, removed, or a different version, source or
 * integrity), and the root's dependencies whose spec changed (package.json). Either lock may be
 * null (no file on that side).
 * @returns {string[]} sorted names
 */
export function lockChanges(oldLock, newLock) {
  const a = oldLock?.packages ?? {}, b = newLock?.packages ?? {};
  const changed = new Set();
  const sig = e => (e ? `${e.version}|${e.resolved}|${e.integrity}|${e.link ? 'link' : ''}|${depNames(e).sort().join(',')}` : '');
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key === '') continue;
    if (sig(a[key]) !== sig(b[key])) changed.add(lockName(key, b[key] ?? a[key]));
  }
  for (const n of manifestChanges(a[''], b[''])) changed.add(n);
  return [...changed].sort();
}

/** Dependency names whose spec differs between two package.json objects (or lock root entries). */
export function manifestChanges(oldPkg, newPkg) {
  const out = new Set();
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const x = oldPkg?.[field] ?? {}, y = newPkg?.[field] ?? {};
    for (const n of new Set([...Object.keys(x), ...Object.keys(y)])) if (x[n] !== y[n]) out.add(n);
  }
  return [...out].sort();
}

/**
 * Every package reachable from `roots` through the lockfiles' dependency lists (all locks given are
 * merged, so a dependency on either side of a diff counts). Followed by name, not by nesting: a
 * superset, which is the safe direction.
 */
export function packageClosure(locks, roots) {
  const deps = new Map();
  for (const lock of locks) {
    for (const [key, e] of Object.entries(lock?.packages ?? {})) {
      if (key === '') continue;
      const name = lockName(key, e);
      const set = deps.get(name) ?? deps.set(name, new Set()).get(name);
      for (const d of depNames(e)) set.add(d);
      if (e.link && e.resolved) for (const d of depNames(lock.packages[e.resolved])) set.add(d);
    }
  }
  const out = new Set(roots), queue = [...roots];
  while (queue.length) for (const d of deps.get(queue.shift()) ?? []) if (!out.has(d)) { out.add(d); queue.push(d); }
  return out;
}
