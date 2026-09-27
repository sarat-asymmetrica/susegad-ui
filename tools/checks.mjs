// Run every browser behaviour check (*.check.mjs) under packages/ and recipes/, one at a time.
//   node tools/checks.mjs            (or: npm run check)
// Each check is a standalone script that exits non-zero on failure. Prints a summary and
// exits non-zero if any check failed.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const failed = [];
for (const f of found) {
  const rel = path.relative(root, f).replaceAll('\\', '/');
  const r = spawnSync(process.execPath, [f], { cwd: root, encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed.push(rel);
  const tail = (r.stdout + r.stderr).trim().split('\n').slice(-1)[0] || '';
  console.log(`${ok ? 'pass' : 'FAIL'}  ${rel}  ${tail}`);
  if (!ok) console.log((r.stdout + r.stderr).trim().split('\n').slice(-15).join('\n'));
}
console.log(`\n${found.length - failed.length} of ${found.length} checks pass`);
process.exit(failed.length ? 1 : 0);
