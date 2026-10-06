// The motif tier lint (docs/requests/2026-10-02-lighter-gate.md, C row 5).
//
//   node tools/motif-lint.mjs                 the real registry, as committed in the tree
//   node tools/motif-lint.mjs REGISTRY.json   a fixture run
//
// Reads the registry index, and the home hero's name from apps/docs/index.html (the
// sg-scene mounted with hero="true"), and prints every violation with its item.
// Exit 1 when anything violates; every hit is printed.
//
// The hero is read from the front door's own markup, not a hardcoded name, so when the
// hero changes the lint follows it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintMotifs } from './motif-lint.core.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The item names the front door mounts as its hero. */
export function heroNamesFromHtml(html) {
  const names = [];
  for (const m of html.matchAll(/<sg-scene\b[^>]*>/g)) {
    const tag = m[0];
    if (!/hero\s*=\s*["']true["']/.test(tag) && !/id\s*=\s*["']mast-stage["']/.test(tag)) continue;
    const n = /name\s*=\s*["']([^"']+)["']/.exec(tag);
    if (n) names.push(n[1]);
  }
  return names;
}

const argv = process.argv.slice(2);
const registryPath = argv[0] ?? path.join(REPO, 'registry', 'registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const heroFile = path.join(REPO, 'apps', 'docs', 'index.html');
const heroNames = fs.existsSync(heroFile) ? heroNamesFromHtml(fs.readFileSync(heroFile, 'utf8')) : [];
const findings = lintMotifs(registry, { heroNames });
for (const f of findings) console.log(`${f.item}  ${f.rule}  ${f.text}`);
console.log(`${registry.items?.length ?? registry.length} item(s) read, ${findings.length} finding(s), hero: ${heroNames.join(', ') || '(none)'}`);
process.exit(findings.length ? 1 : 0);
