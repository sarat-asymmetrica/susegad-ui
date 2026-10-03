// Run every browser behaviour check (*.check.mjs) under packages/ and recipes/, one at a time.
//   node tools/checks.mjs                    (or: npm run check; chromium, the default)
//   node tools/checks.mjs --engine=webkit
//   SG_ENGINE=firefox node tools/checks.mjs  (the flag and the env var do the same thing;
//                                              each check reads SG_ENGINE itself, see lib/engine.mjs)
// Each check is a standalone script that exits non-zero on failure. Prints a summary and
// exits non-zero if any check failed.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_NAMES, pickEngine } from './lib/engine.mjs';

const engineFlag = process.argv.find(a => a.startsWith('--engine='))?.slice('--engine='.length);
const engineName = (engineFlag ?? process.env.SG_ENGINE ?? 'chromium').trim().toLowerCase();
if (!ENGINE_NAMES.includes(engineName)) {
  console.error(`Unknown engine "${engineName}". Use one of: ${ENGINE_NAMES.join(', ')}.`);
  process.exit(2);
}
pickEngine(engineName); // just validates the name; each check launches its own browser

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const found = [];
const walk = dir => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.check.mjs')) found.push(p);
  }
};
for (const d of ['packages', 'recipes']) if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
found.sort();

console.log(`Running ${found.length} check${found.length === 1 ? '' : 's'} in ${engineName}.\n`);
const failed = [];
for (const f of found) {
  const rel = path.relative(root, f).replaceAll('\\', '/');
  const r = spawnSync(process.execPath, [f], { cwd: root, encoding: 'utf8', env: { ...process.env, SG_ENGINE: engineName } });
  const ok = r.status === 0;
  if (!ok) failed.push(rel);
  const tail = (r.stdout + r.stderr).trim().split('\n').slice(-1)[0] || '';
  console.log(`${ok ? 'pass' : 'FAIL'}  ${rel}  ${tail}`);
  if (!ok) console.log((r.stdout + r.stderr).trim().split('\n').slice(-15).join('\n'));
}
console.log(`\n${found.length - failed.length} of ${found.length} checks pass (${engineName})`);
process.exit(failed.length ? 1 : 0);
