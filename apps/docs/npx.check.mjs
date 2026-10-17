// Every `npx` command on the built site names a package that exists on npm.
//
//   node apps/docs/npx.check.mjs                  check out/docs (the build runs this itself)
//   node apps/docs/npx.check.mjs --out <dir>      check another build
//
// The list of names is pinned in npx-packages.json (no network). Exits 1 on any
// name that is not in it, printing the file and the command.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unknownNpx, unknownAddItems } from './npx.core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Checks every html, txt, md and json file under `dir`; returns the findings and how many files it read. */
export function checkBuiltNpx(dir) {
  const known = JSON.parse(fs.readFileSync(path.join(HERE, 'npx-packages.json'), 'utf8')).packages;
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(html|txt|md|json)$/i.test(e.name) || fs.statSync(p).size > 4e6) continue;
      files.push({ file: path.relative(dir, p).split(path.sep).join('/'), text: fs.readFileSync(p, 'utf8'), html: /\.html$/i.test(e.name) });
    }
  })(dir);
  // every item an `add` command names must be in the registry the site serves
  const regFile = path.join(dir, 'registry', 'registry.json');
  const names = fs.existsSync(regFile) ? JSON.parse(fs.readFileSync(regFile, 'utf8')).items.map(i => i.name) : null;
  const missing = names ? unknownAddItems(files, names).map(b => ({ ...b, notItem: true })) : [];
  return { bad: [...unknownNpx(files, known), ...missing], read: files.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const i = process.argv.indexOf('--out');
  const dir = path.resolve(i > 0 ? process.argv[i + 1] : path.join(HERE, '..', '..', 'out', 'docs'));
  const { bad, read } = checkBuiltNpx(dir);
  for (const b of bad.slice(0, 20)) console.error(`  ${b.file}: "${b.snippet}" (${b.notItem ? `${b.name} is not an item in the registry` : `${b.name} is not a package on npm`})`);
  console.log(`${bad.length ? 'FAIL' : 'pass'}  npx names: ${read} files read, ${bad.length} command(s) naming a package off the pinned list or an item the registry does not have`);
  process.exit(bad.length ? 1 : 0);
}
