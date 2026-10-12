// The image check (decision 0023): which formats go where.
//
//   node tools/images.check.mjs                 the fixtures first (each must go red), then the repo
//   node tools/images.check.mjs --fixtures      only the fixtures
//   node tools/images.check.mjs --root <dir>    check another tree, such as the built docs site (out/docs)
//   node tools/images.check.mjs --json
//
// Fails on a GIF in packages/, apps/, docs/readme/ or a README; on a raster above 300 KB in packages/;
// on a poster without its AVIF and WebP beside it. Warns, without failing, on an <img> with a JPG or PNG
// src that sits outside <picture>, and on one that declares no size. Rules and their words are in
// images.core.js. Exits 1 on any error.
//
// The fixtures are tools/fixtures/images/<case>/ (a small tree each) and one built at run time: a
// raster over the cap is 300 KB of nothing, which is not worth keeping in git.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkImages, CAP_BYTES } from './images.core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.worktrees', '.shots', '.cache', 'out', 'dist', 'shots']);
const SKIP_PATHS = ['tools/fixtures/']; // the fixtures are broken on purpose, and are checked by runFixtures
const TEXT = /\.(html?|md)$/i;

/** Every file under `root` as { path, size }, and the text of the HTML and Markdown ones. */
export function scan(root) {
  const files = [], texts = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !SKIP_PATHS.includes(`${rel}${e.name}/`)) walk(path.join(dir, e.name), `${rel}${e.name}/`); continue; }
      const full = path.join(dir, e.name), p = `${rel}${e.name}`;
      files.push({ path: p, size: fs.statSync(full).size });
      if (TEXT.test(e.name)) texts.push({ path: p, text: fs.readFileSync(full, 'utf8') });
    }
  })(root, '');
  return { files, texts };
}
export const checkTree = root => checkImages(scan(root));

/** What each fixture is, and the rule it must trip (null: it must pass clean, with nothing to warn about either). */
export const FIXTURES = [
  { dir: 'new-gif', rule: 'no-gif' },
  { dir: 'gif-in-readme', rule: 'no-gif' },
  { dir: 'poster-bare', rule: 'poster-siblings' },
  { dir: 'poster-no-avif', rule: 'poster-siblings', needs: '.avif' }, // WebP and JPG, no AVIF: the one rule a drop of the AVIF requirement would let through
  { dir: 'img-size', rule: 'img-size', warning: true },
  { dir: 'outside-picture', rule: 'img-outside-picture', warning: true },
  { dir: 'clean', rule: null },
];

/** Run the fixtures. Returns [{ name, ok, detail }]; a fixture passes when the check says what it should. */
export function runFixtures(log = () => {}) {
  const out = [];
  const record = (name, ok, detail) => { out.push({ name, ok, detail }); log(`${ok ? 'pass' : 'FAIL'}  fixture ${name}  ${detail}`); };
  for (const f of FIXTURES) {
    const { errors, warnings } = checkTree(path.join(HERE, 'fixtures', 'images', f.dir));
    const hits = (f.warning ? warnings : errors).filter(x => x.rule === f.rule && (!f.needs || x.message.includes(f.needs)));
    if (f.rule === null) record(f.dir, !errors.length && !warnings.length, errors.length || warnings.length ? `expected nothing, got ${[...errors, ...warnings].map(x => x.rule).join(', ')}` : 'green, as it should be');
    else record(f.dir, hits.length > 0 && (f.warning ? !errors.length : true), hits.length ? `red on ${f.rule}: ${hits[0].message}` : `expected ${f.rule}, got ${[...errors, ...warnings].map(x => x.rule).join(', ') || 'nothing'}`);
  }
  // a raster over the cap: built here, so the repo does not carry 300 KB of nothing
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-images-'));
  try {
    fs.mkdirSync(path.join(tmp, 'packages', 'x'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'packages', 'x', 'big.jpg'), Buffer.alloc(CAP_BYTES + 1024));
    fs.writeFileSync(path.join(tmp, 'packages', 'x', 'fits.jpg'), Buffer.alloc(CAP_BYTES - 1024));
    const { errors } = checkTree(tmp);
    const caps = errors.filter(x => x.rule === 'raster-cap');
    record('over-cap', caps.length === 1 && caps[0].path === 'packages/x/big.jpg', caps.length ? `red on raster-cap: ${caps.map(c => c.path).join(', ')}` : 'expected raster-cap, got nothing');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), flag = n => args.includes(`--${n}`);
  const rootArg = args.indexOf('--root') >= 0 ? args[args.indexOf('--root') + 1] : null;
  const json = flag('json'), say = json ? () => {} : console.log;
  let failed = false;
  const fx = flag('fixtures') || !rootArg ? runFixtures(say) : [];
  if (fx.some(f => !f.ok)) failed = true;
  let result = { errors: [], warnings: [] };
  if (!flag('fixtures')) {
    const root = path.resolve(rootArg ?? REPO_ROOT);
    result = checkTree(root);
    for (const w of result.warnings) say(`warn  ${w.rule}  ${w.path}: ${w.message}`);
    for (const e of result.errors) say(`FAIL  ${e.rule}  ${e.path}: ${e.message}`);
    if (result.errors.length) failed = true;
    say(`${result.errors.length ? 'FAIL' : 'pass'}  images: ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}, ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'} in ${root.replaceAll('\\', '/')}`);
  }
  if (json) console.log(JSON.stringify({ fixtures: fx, ...result }, null, 2));
  process.exit(failed ? 1 : 0);
}
