// The mutant-rot guard over a whole tree (tools/lib/mutants.test.mjs holds the reader's own tests, on fixtures):
// every planted fault in every *.check.mjs must still have its needle in its target. A whole-repo step, so it runs
// from tools/repo-check.mjs, not from npm test.
//
//   node tools/lib/mutants.guard.mjs                           this repo
//   MUTANTS_ROOT=<a copy of the repo> node tools/lib/mutants.guard.mjs    the same guard over another tree
//
// Exit 1 when a needle has rotted or a computed one is off the allowlist (tools/lib/mutants.allow.json).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { audit } from './mutants.core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['node_modules', '.git', '.worktrees', '.shots', '.playwright-mcp', 'graphify-out']);

function* walk(dir, rel = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) yield* walk(path.join(dir, e.name), r);
    else yield r;
  }
}

/** The tree as the guard sees it: the checks, and the files a check may serve (code, not checks or tests). */
export function tree(root) {
  const all = [...walk(root)];
  const cache = new Map();
  const read = f => { if (!cache.has(f)) cache.set(f, fs.readFileSync(path.join(root, f), 'utf8')); return cache.get(f); };
  return {
    checks: all.filter(f => f.endsWith('.check.mjs')).sort(),
    files: all.filter(f => /\.(m?js|css|html|svg)$/.test(f) && !/\.check\.mjs$|\.test\.m?js$/.test(f)),
    read,
  };
}

/** Audit a tree against its allowlist. Returns the audit result plus the checks it saw. */
export function guard(root) {
  const allow = JSON.parse(fs.readFileSync(path.join(root, 'tools/lib/mutants.allow.json'), 'utf8'));
  const t = tree(root);
  return { ...audit({ ...t, allow }), checks: t.checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = process.env.MUTANTS_ROOT ? path.resolve(process.env.MUTANTS_ROOT) : path.resolve(HERE, '../..');
  const r = guard(root);
  const files = new Set(r.covered.map(m => m.check));
  console.log(`mutant guard over ${r.checks.length} checks in ${root}: ${r.covered.length} needles checked in ${files.size} checks; ${r.computed.length} computed and ${r.exempt.length} exempt on the allowlist; ${r.rotted.length} known rotted`);
  for (const m of r.rotted) console.log(`  rotted: ${m.check}:${m.line} ${JSON.stringify(m.needle.value).slice(0, 80)}`);
  for (const p of r.problems) console.log(`  problem: ${p}`);
  if (r.covered.length < 100) { console.log(`the guard should see the repo's needles, saw ${r.covered.length}`); process.exit(1); }
  process.exit(r.problems.length ? 1 : 0);
}
