// Every custom element the packages define is in custom-elements.json, wherever it is defined.
//
//   node tools/cem-coverage.mjs [--root=<repo>]
//
// The manifest builder finds an element by reading the registry's component items and core's index.js; a define in
// any other file (sg-lazy, in core/lazy.js) was invisible to it, while `cem --check` said "up to date". This reads
// every package source for `customElements.define('sg-...')` / `defineComponent('sg-...')` and holds the tags
// against the manifest built from the same tree. Whole-repo, so it runs from tools/repo-check.mjs. Exit 1 on a gap.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildManifest } from './cem.mjs';

/** Tags defined under packages/, with the file that defines each. */
export function definedTags(root) {
  const found = new Map();
  const walk = dir => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'fixtures' || e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.m?js$/.test(e.name) && !/\.(test|check)\.m?js$/.test(e.name)) {
        const src = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        for (const m of src.matchAll(/(?:customElements\.define|defineComponent)\(\s*['"](sg-[a-z0-9-]+)['"]/g)) found.set(m[1], p);
      }
    }
  };
  walk(join(root, 'packages'));
  return found;
}

/** Tags that are defined but not listed in the manifest built from `root`. */
export function missingTags(root) {
  const listed = new Set(buildManifest({ root }).modules.flatMap(m => m.declarations.map(d => d.tagName)));
  return [...definedTags(root)].filter(([tag]) => !listed.has(tag)).map(([tag, p]) => `${tag} (${p.replace(root, '')})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = process.argv.find(a => a.startsWith('--root='));
  const root = arg ? resolve(arg.slice('--root='.length)) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const missing = missingTags(root);
  for (const m of missing) console.log(`defined but not in custom-elements.json: ${m}`);
  console.log(`${definedTags(root).size} element(s) defined under packages/, ${missing.length} missing from the manifest`);
  process.exit(missing.length ? 1 : 0);
}
