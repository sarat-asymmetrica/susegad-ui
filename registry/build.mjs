#!/usr/bin/env node
// Build registry/registry.json from every packages/**/registry.json, and <name>.registry.json
// where one folder holds more than one item.
//
//   node registry/build.mjs                 write the index for this repo
//   node registry/build.mjs --check         fail if the written index is out of date
//   node registry/build.mjs --strict        treat missing fields and thin manifests as errors
//   node registry/build.mjs --root <dir> [--out <file>]   build another tree (the tests use fixtures)
//
// Each manifest is validated against registry/schema.json, every file it lists must exist,
// dependencies must exist and must not loop, and each item gets its source bytes and a
// content hash. Byte budgets are a gate (decisions 0002 to 0004): going over a declared
// budget fails the build, and a scene gets 40 KB unless it declares up to 64 KB with a reason.
// Output is sorted and has no timestamps: the same sources give the same bytes.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../packages/cli/src/validate.js';
import { checkGraph, resolveOrder } from '../packages/cli/src/graph.js';
import { absoluteRefs, relativeRefs } from '../packages/cli/src/imports.js';
import { hashContent, hashParts } from '../packages/cli/src/hash.js';
import { stripComments } from '../packages/cli/src/strip.js';
import { insidePackages, resolveManifestPath, toPosix } from '../packages/cli/src/paths.js';

const here = dirname(fileURLToPath(import.meta.url));
export const schema = JSON.parse(readFileSync(join(here, 'schema.json'), 'utf8'));
const SKIP_DIRS = new Set(['node_modules', 'fixtures']);
const JS = /\.(m?js)$/;
// registry.json, or <name>.registry.json when one folder holds more than one item
// (packages/core/component.registry.json beside core's own). Paths stay relative to the folder.
const MANIFEST = /^([a-z0-9-]+\.)?registry\.json$/;
// Decision 0003: scenes default to 40 KB of source and may declare up to 64 KB with a reason.
export const SCENE_BUDGET = { default: 40 * 1024, max: 64 * 1024 };
// Decision 0020: a scape is gated on what the reader waits for, its first sight (at most 64 KB of
// code, comments stripped as in codeBytes: amended 28 September), and may total up to 256 KB of raw
// source with a reason (0002); everything past first sight loads lazily.
export const SCAPE_BUDGET = { firstSight: 64 * 1024, max: 256 * 1024 };

// Static imports only: `import x from './a.js'`, `export … from './a.js'`, `import './a.js'`. A dynamic
// import() is the seam a scape loads lazily across, so it is not followed.
const STATIC = [/\b(?:import|export)\s[^'"`;()]*?\bfrom\s*(['"])(\.{1,2}\/[^'"]+)\1/g, /\bimport\s+(['"])(\.{1,2}\/[^'"]+)\1/g];

/**
 * The item's own files a first sight needs: the entry files and every own
 * file they reach by static imports. Returns the paths, sorted.
 */
export function firstSightFiles(root, item, entry) {
  const own = new Set(item.files.map(f => f.path)), seen = new Set(), queue = [...entry];
  while (queue.length) {
    const p = queue.shift();
    if (seen.has(p) || !own.has(p)) continue;
    seen.add(p);
    if (!JS.test(p)) continue;
    const text = stripComments(readFileSync(join(root, p), 'utf8'));
    for (const re of STATIC) for (const m of text.matchAll(re)) queue.push(toPosix(join(dirname(p), m[2])));
  }
  return [...seen].sort();
}

/** Every packages/**\/registry.json and *.registry.json under root, repo-rooted and sorted. */
export function findManifests(root) {
  const found = [];
  const walk = rel => {
    const abs = join(root, rel);
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const child = rel + '/' + entry.name;
      if (entry.isDirectory()) walk(child);
      else if (MANIFEST.test(entry.name)) found.push(child);
    }
  };
  if (existsSync(join(root, 'packages'))) walk('packages');
  return found.sort();
}

/** Manifests in top-level folders that the CLI cannot copy from (recipes/ before the move). */
export function findStrayManifests(root) {
  const found = [];
  for (const top of ['recipes', 'components', 'scenes']) {
    const dir = join(root, top);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(dir, entry.name, 'registry.json'))) found.push(`${top}/${entry.name}/registry.json`);
    }
  }
  return found.sort();
}

/**
 * @param {{ root: string, out?: string, strict?: boolean }} opts
 * @returns {{ index: object | null, errors: string[], warnings: string[], notes: string[] }}
 */
export function buildRegistry({ root, out = join(root, 'registry', 'registry.json'), strict = false }) {
  root = resolve(root);
  const errors = [], warnings = [], notes = [];
  const soft = strict ? errors : warnings;
  const exists = p => { try { return statSync(join(root, p)).isFile(); } catch { return false; } };
  const libraryDeps = existsSync(join(root, 'package.json')) ? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies ?? {} : {};

  const items = new Map();
  const owners = new Map(); // file -> item that lists it

  for (const manifestPath of findManifests(root)) {
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(join(root, manifestPath), 'utf8'));
    } catch (err) {
      errors.push(`${manifestPath}: is not valid JSON (${err.message})`);
      continue;
    }
    const problems = validate(manifest, schema);
    if (problems.length) {
      for (const p of problems) errors.push(`${manifestPath}: ${p.replace(/^\$\.?/, '') || 'the manifest'}`.replace(/: :/, ':'));
      continue;
    }
    const dir = manifestPath.slice(0, manifestPath.lastIndexOf('/'));
    const { name } = manifest;
    if (items.has(name)) {
      errors.push(`${manifestPath}: the name "${name}" is already used by ${items.get(name).manifest}`);
      continue;
    }

    const place = (p, field) => {
      const r = resolveManifestPath(dir, p, exists);
      if (r.repoRooted) notes.push(`${manifestPath}: ${field} "${p}" is repo-rooted; write it relative to the manifest as "${toPosix(relative(join(root, dir), join(root, r.path)))}"`);
      if (!insidePackages(r.path)) { errors.push(`${manifestPath}: ${field} "${p}" points outside packages/`); return null; }
      if (!exists(r.path)) { errors.push(`${manifestPath}: ${field} "${p}" does not exist (looked for ${r.path})`); return null; }
      return r.path;
    };

    const files = [];
    for (const p of manifest.files) {
      const path = place(p, 'file');
      if (!path) continue;
      if (owners.has(path) && owners.get(path) !== name) warnings.push(`${manifestPath}: ${path} is also listed by ${owners.get(path)}`);
      owners.set(path, name);
      const content = readFileSync(join(root, path));
      files.push({ path, bytes: content.length, hash: hashContent(content) });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));

    const item = {
      name,
      type: manifest.type,
      title: manifest.title ?? '',
      description: manifest.description ?? '',
      version: manifest.version ?? '0.0.0',
      stability: manifest.stability ?? 'experimental',
      manifest: manifestPath,
      files,
      dependencies: [...(manifest.dependencies ?? [])].sort(),
      ...(manifest.npmDependencies && { npmDependencies: Object.fromEntries(Object.entries(manifest.npmDependencies).sort(([a], [b]) => a.localeCompare(b))) }),
      registers: ['quiet', 'warm', 'playful'].filter(r => manifest.registers?.includes(r)),
    };
    if (manifest.stabilityReason) item.stabilityReason = manifest.stabilityReason;
    if (manifest.useFor?.length) item.useFor = [...manifest.useFor].sort();
    if (manifest.motif) item.motif = { ...manifest.motif };
    if (manifest.budget) item.budget = { ...manifest.budget };
    if (item.type === 'scene' && item.budget?.jsBytes === undefined) item.budget = { ...item.budget, jsBytes: SCENE_BUDGET.default };
    for (const field of ['docs', 'prompt']) {
      if (manifest[field]) { const p = place(manifest[field], field); if (p) item[field] = p; }
    }
    item.bytes = files.reduce((n, f) => n + f.bytes, 0);
    const js = files.filter(f => JS.test(f.path));
    item.jsBytes = js.reduce((n, f) => n + f.bytes, 0);
    item.codeBytes = js.reduce((n, f) => n + Buffer.byteLength(stripComments(readFileSync(join(root, f.path), 'utf8'))), 0);

    const absent = ['title', 'description', 'version', 'stability'].filter(f => !manifest[f]);
    if (absent.length) {
      const said = absent.length === 1 ? absent[0] : `${absent.slice(0, -1).join(', ')} or ${absent.at(-1)}`;
      const notes = [];
      if (absent.includes('version')) notes.push('listed as 0.0.0 for now');
      if (absent.includes('stability')) notes.push('listed as experimental for now');
      soft.push(`${manifestPath}: has no ${said}${notes.length ? ` (${notes.join('; ')})` : ''}`);
    }
    // Decision 0017: the CLI hands these pins to the consumer, so they must be the pins the library runs on.
    for (const [pkg, pin] of Object.entries(item.npmDependencies ?? {})) {
      const runs = libraryDeps[pkg];
      if (runs !== pin) errors.push(`${manifestPath}: npmDependencies: ${pkg} is pinned at ${pin} here but the library runs ${runs ?? 'none'} (package.json dependencies); make them agree`);
    }
    // A surface is a backdrop some registers choose not to use (Carepa: quiet keeps a plain dim), so it is exempt (decision 0016).
    if ((item.type === 'scene' || item.type === 'component') && item.registers.length < 3) {
      soft.push(`${manifestPath}: a ${item.type} should list all three registers, this one lists ${item.registers.join(', ') || 'none'}`);
    }
    if (item.stability !== 'experimental' && !manifest.stabilityReason) {
      errors.push(`${manifestPath}: is "${item.stability}", which needs a one-line stabilityReason saying why`);
    }
    const declared = manifest.budget?.jsBytes;
    const scape = manifest.tier === 'scape';
    if (scape) {
      item.tier = 'scape';
      if (item.type !== 'scene') errors.push(`${manifestPath}: only a scene can be a scape (decision 0020)`);
      const entry = (manifest.entry ?? []).map(p => place(p, 'entry')).filter(Boolean);
      const stray = entry.filter(p => !files.some(f => f.path === p));
      if (!entry.length) errors.push(`${manifestPath}: a scape lists its entry, the files its first sight loads from (decision 0020)`);
      if (stray.length) errors.push(`${manifestPath}: entry ${stray.join(', ')} is not one of its files`);
      item.entry = entry.sort();
      const first = firstSightFiles(root, item, entry);
      // code bytes, comments stripped (0020 as amended): comments stay beside the code and do not slow the still
      item.firstSightBytes = first.filter(p => JS.test(p)).reduce((n, p) => n + Buffer.byteLength(stripComments(readFileSync(join(root, p), 'utf8'))), 0);
      const firstBudget = manifest.budget?.firstSightBytes;
      if (firstBudget === undefined) errors.push(`${manifestPath}: a scape declares budget.firstSightBytes, at most ${SCAPE_BUDGET.firstSight} (decision 0020)`);
      else if (firstBudget > SCAPE_BUDGET.firstSight) errors.push(`${manifestPath}: declares a first sight of ${firstBudget} JS bytes, and a scape may declare at most ${SCAPE_BUDGET.firstSight} (decision 0020)`);
      if (item.firstSightBytes > Math.min(firstBudget ?? Infinity, SCAPE_BUDGET.firstSight)) {
        errors.push(`${manifestPath}: its first sight is ${item.firstSightBytes} bytes of code (${first.join(', ')}), over ${Math.min(firstBudget ?? Infinity, SCAPE_BUDGET.firstSight)}. Load what the finished still does not need with a dynamic import()`);
      }
      if (declared > SCAPE_BUDGET.max) errors.push(`${manifestPath}: declares a total of ${declared} JS bytes, and a scape may declare at most ${SCAPE_BUDGET.max} (decision 0020)`);
      else if (!manifest.budget?.reason) errors.push(`${manifestPath}: a scape needs a one-line budget.reason for its total (decision 0020)`);
    } else if (manifest.entry || manifest.budget?.firstSightBytes !== undefined) {
      errors.push(`${manifestPath}: entry and budget.firstSightBytes belong to a scape ("tier": "scape", decision 0020)`);
    }
    if (scape) { /* the scape's own gates above replace decision 0003's ceiling */ } else if (item.type === 'scene' && declared > SCENE_BUDGET.max) {
      errors.push(`${manifestPath}: declares a budget of ${declared} JS bytes, and a scene may declare at most ${SCENE_BUDGET.max} (decision 0003)`);
    } else if (item.type === 'scene' && declared > SCENE_BUDGET.default && !manifest.budget.reason) {
      errors.push(`${manifestPath}: declares ${declared} JS bytes, over the ${SCENE_BUDGET.default} default, so it needs a one-line budget.reason (decision 0003)`);
    }
    if (item.budget?.jsBytes !== undefined && item.jsBytes > item.budget.jsBytes) {
      errors.push(`${manifestPath}: ${item.jsBytes} JS bytes is over its budget of ${item.budget.jsBytes}${declared === undefined ? ' (the scene default)' : ''}. Trim it, or record a new budget decision`);
    }
    items.set(name, item);
  }

  const graph = checkGraph(items);
  for (const [from, dep] of graph.missing) errors.push(`${items.get(from).manifest}: depends on "${dep}", and no manifest has that name`);
  for (const cycle of graph.cycles) errors.push(`dependency loop: ${cycle.join(' -> ')}`);

  if (errors.length) return { index: null, errors, warnings, notes };

  // A copied item must only point at files that are copied with it: its own, or its dependencies'.
  for (const item of items.values()) {
    const reachable = new Set();
    for (const name of resolveOrder(items, [item.name])) for (const f of items.get(name).files) reachable.add(f.path);
    for (const f of item.files) {
      const text = readFileSync(join(root, f.path), 'utf8');
      for (const abs of absoluteRefs(f.path, text)) {
        warnings.push(`${item.manifest}: ${f.path} loads "${abs}", a root path that works on the dev server but not in a builder's project`);
      }
      for (const { spec, target } of relativeRefs(f.path, text)) {
        if (reachable.has(target)) continue;
        // A folder reference ('./fixtures/') is copied when a file inside it is: the folder then exists in the copy.
        if (target.endsWith('/') && [...reachable].some(p => p.startsWith(target))) continue;
        const owner = [...items.values()].find(i => i.files.some(x => x.path === target));
        errors.push(`${item.manifest}: ${f.path} refers to "${spec}", which ` + (owner
          ? `belongs to ${owner.name}; add "${owner.name}" to dependencies`
          : insidePackages(target) && exists(target)
            ? `no manifest lists (${target}); add it to files`
            : `would not be copied (${target})${target.startsWith('packages/') ? '' : ', because it is outside packages/'}`));
      }
    }
  }

  // Recipes and other items belong under packages/, so the copied tree matches the repo one to one.
  for (const stray of findStrayManifests(root)) {
    soft.push(`${stray} is outside packages/, so the CLI cannot copy it. Move its folder to packages/${stray.slice(0, stray.lastIndexOf('/'))}/ and change "../../packages/" to "../../" in its imports`);
  }
  if (errors.length) return { index: null, errors, warnings, notes };

  const sorted = [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const item of sorted) {
    item.hash = hashParts([
      item.name, item.version, item.dependencies.join(','),
      ...(item.npmDependencies ? [Object.entries(item.npmDependencies).map(([n, v]) => `${n}@${v}`).join(',')] : []),
      ...item.files.map(f => `${f.path}\0${f.hash}`),
    ]);
  }
  const index = {
    name: 'susegad-ui',
    format: 1,
    base: toPosix(relative(dirname(resolve(out)), root)) || '.',
    items: sorted,
  };
  const selfCheck = validate(index, schema.$defs.index, schema);
  if (selfCheck.length) errors.push(...selfCheck.map(p => `the built index is malformed at ${p}`));
  return { index: errors.length ? null : index, errors, warnings, notes };
}

export const serialise = index => JSON.stringify(index, null, 2) + '\n';

function main(argv) {
  const arg = flag => { const i = argv.indexOf(flag); return i === -1 ? undefined : argv[i + 1]; };
  const root = resolve(arg('--root') ?? join(here, '..'));
  const out = resolve(arg('--out') ?? join(root, 'registry', 'registry.json'));
  const strict = argv.includes('--strict');
  const check = argv.includes('--check');

  const { index, errors, warnings, notes } = buildRegistry({ root, out, strict });
  for (const n of notes) console.log(`note: ${n}`);
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (errors.length) {
    console.error(`\nThe registry did not build. ${errors.length} problem${errors.length === 1 ? '' : 's'} to fix:\n`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error('\nFix the manifests above and run node registry/build.mjs again.');
    return 1;
  }

  const text = serialise(index);
  const shown = toPosix(relative(process.cwd(), out)) || out;
  if (check) {
    const current = existsSync(out) ? readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : null;
    if (current !== text) {
      console.error(`${shown} is out of date. Run node registry/build.mjs to refresh it.`);
      return 1;
    }
    console.log(`${shown} is up to date with ${index.items.length} item${index.items.length === 1 ? '' : 's'}.`);
    return 0;
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  const total = index.items.reduce((n, i) => n + i.files.length, 0);
  console.log(`Wrote ${shown}: ${index.items.length} item${index.items.length === 1 ? '' : 's'}, ${total} file${total === 1 ? '' : 's'}.`);
  console.log(`  ${'item'.padEnd(16)}${'type'.padEnd(10)}${'files'.padStart(5)}  ${'JS bytes / budget'.padStart(19)}  ${'code'.padStart(7)}  ${'all bytes'.padStart(9)}`);
  for (const item of index.items) {
    const budget = item.budget?.jsBytes !== undefined ? ` / ${String(item.budget.jsBytes).padStart(6)}` : ' '.repeat(9);
    const first = item.tier === 'scape' ? `  scape: first sight ${item.firstSightBytes} / ${item.budget.firstSightBytes}` : '';
    console.log(`  ${item.name.padEnd(16)}${item.type.padEnd(10)}${String(item.files.length).padStart(5)}  ${String(item.jsBytes).padStart(10)}${budget}  ${String(item.codeBytes).padStart(7)}  ${String(item.bytes).padStart(9)}${first}`);
  }
  console.log('  JS bytes are the .js and .mjs files the budget counts; code is the same without comments; all bytes include prompts, CSS and fonts.');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
