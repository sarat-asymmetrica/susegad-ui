// The file-reading half of the narrower `node tools/checks.mjs --changed`: what each check loads
// (its imports, followed file to file, and the npm packages behind them) and which dependencies the
// diff changed (package-lock.json and package.json against the merge-base). The choosing is pure:
// deps.core.js and changed.core.js.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { relativeRefs } from '../../packages/cli/src/imports.js';
import { changedFiles, itemNamesAt } from './changed.mjs';
import { selectChecks, selectNodeChecks } from './changed.core.js';
import { parseSpecifiers, resolveRelative, importClosure, packageClosure, lockChanges, manifestChanges, rootPaths, sceneNamePaths, pieceFiles } from './deps.core.js';

/**
 * What every check runs inside of, so a change to any file these load runs everything. Named by
 * what they are, for the reason --dry prints. The harness is component-check.mjs's harness().
 */
export const EVERY_ALL_ROOTS = [
  ['tools/serve.mjs', 'part of the server every check serves its page through'],
  ['tools/lib/component-check.mjs', 'part of the harness'],
  ['tools/lib/slots.mjs', 'part of the browser slots'],
  ['tools/lib/overflow.mjs', 'part of the overflow probe'],
  ['tools/lib/run-check.mjs', 'part of the runner that runs every check'],
];

/** Read a file's edges: the repo files it imports (that exist) and the packages it names. */
export function edgeReader(root) {
  const cache = new Map();
  // tools/fixtures/<name> (a folder) or tools/fixtures/<name>.mjs (a loose file), by the name a check writes
  const fixtureDir = path.join(root, 'tools', 'fixtures');
  const fixtures = fs.existsSync(fixtureDir) ? fs.readdirSync(fixtureDir).map(n => n.replace(/.mjs$/, '')) : [];
  return file => {
    if (cache.has(file)) return cache.get(file);
    let e = null;
    if (/\.(html|css)$/.test(file)) {
      // a page a check serves: what it loads by path (src, href, url()) and the scenes it names
      try {
        const text = fs.readFileSync(path.join(root, file), 'utf8');
        const files = [...rootPaths(text), ...sceneNamePaths(text), ...relativeRefs(file, text).map(r => r.target)].filter(f => f !== file && fs.existsSync(path.join(root, f)));
        e = { files: [...new Set(files)], packages: [] };
      } catch { e = null; }
    } else if (/\.(m?js|cjs)$/.test(file)) {
      try {
        const { relative, bare, repoPaths } = parseSpecifiers(fs.readFileSync(path.join(root, file), 'utf8'), { fixtures });
        const text = fs.readFileSync(path.join(root, file), 'utf8');
        // a check also loads by path: import('/packages/scenes/kolam/index.js'), a demo page it serves, a stylesheet it links
        const files = [...relative.map(s => resolveRelative(file, s)), ...repoPaths, ...rootPaths(text), ...sceneNamePaths(text), ...(file.startsWith('apps/docs/') ? pieceFiles(text, f => fs.existsSync(path.join(root, f))) : [])].map(f => (f.startsWith('tools/fixtures/') && !fs.existsSync(path.join(root, f)) && fs.existsSync(path.join(root, `${f}.mjs`)) ? `${f}.mjs` : f))
          .filter(f => f !== file && fs.existsSync(path.join(root, f)));
        e = { files: [...new Set(files)], packages: bare };
      } catch { e = null; }
    }
    cache.set(file, e);
    return e;
  };
}

function gitShow(cwd, ref, file) {
  const r = spawnSync('git', ['show', `${ref}:${file}`], { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null; // absent on that side
}
const json = text => { try { return text == null ? null : JSON.parse(text); } catch { return undefined; } };

/**
 * The context changed.core.js narrows with. changedPackages is null when a manifest changed but
 * could not be parsed on one side, which makes everything run.
 */
export function buildContext({ root, checks, mergeBase, files }) {
  const edgesOf = edgeReader(root);
  const locks = [], closures = new Map();
  let changedPackages = [];
  if (files.includes('package-lock.json') || files.includes('package.json')) {
    const read = f => json(fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), 'utf8') : null);
    const oldLock = json(gitShow(root, mergeBase, 'package-lock.json')), newLock = read('package-lock.json');
    const oldPkg = json(gitShow(root, mergeBase, 'package.json')), newPkg = read('package.json');
    if ([oldLock, newLock, oldPkg, newPkg].includes(undefined)) changedPackages = null;
    else {
      changedPackages = [...new Set([...lockChanges(oldLock, newLock), ...manifestChanges(oldPkg, newPkg)])].sort();
      locks.push(oldLock, newLock);
    }
  }
  if (!locks.length) locks.push(json(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')));
  const loads = check => {
    if (!closures.has(check)) {
      const c = importClosure(check, edgesOf);
      closures.set(check, { files: c.files, packages: packageClosure(locks, [...c.packages]) });
    }
    return closures.get(check);
  };
  const everyAll = new Map();
  for (const [start, what] of EVERY_ALL_ROOTS) {
    for (const f of loads(start).files.keys()) if (f.startsWith('tools/lib/') && !everyAll.has(f)) everyAll.set(f, f === start ? what.replace(/^part of /, '') : `${what} (${start} imports it)`);
  }
  const everyAllPackages = new Set(EVERY_ALL_ROOTS.flatMap(([s]) => [...loads(s).packages]));
  const browserPackages = new Set(checks.flatMap(c => [...loads(c).packages])); // for the note only
  return { loads, everyAll, everyAllPackages, browserPackages, changedPackages };
}

/** Select from the repo as it stands: the git diff, the registry, and what each check loads. */
export function selectForDiff({ root, checks, base, env }) {
  const diff = changedFiles({ cwd: root, base, env });
  const items = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'registry.json'), 'utf8')).items;
  const context = buildContext({ root, checks, mergeBase: diff.mergeBase, files: diff.files });
  return { ...diff, ...selectChecks({ changed: diff.files, checks, items, context, baseItemNames: itemNamesAt(root, diff.mergeBase) }), node: selectNodeChecks({ changed: diff.files, context }) };
}
