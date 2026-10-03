import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { resolveOrder, GraphError } from './graph.js';
import { hashContent } from './hash.js';
import { targetPathFor, toPosix } from './paths.js';
import { CliError, loadRegistry, suggest } from './registry.js';
import { LOCKFILE, lockedHashes, readLock, writeLock } from './lockfile.js';
import { diffLines, formatPatch } from './linediff.js';

export const DEFAULT_DIR = 'src/lib';
const TYPE_ORDER = ['package', 'scene', 'surface', 'component', 'recipe', 'adapter'];
const TYPE_HEADINGS = { package: 'Packages', scene: 'Scenes', component: 'Components', recipe: 'Recipes', adapter: 'Adapters' };
const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
const listing = names => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/** @typedef {{ cwd: string, out: (s?: string) => void, registry?: string }} Ctx */

function knownItem(reg, name) {
  if (reg.items.has(name)) return reg.items.get(name);
  const guess = suggest(name, [...reg.items.keys()]);
  throw new CliError(`I do not have anything called "${name}".` +
    (guess ? ` Did you mean ${guess}?` : '') + `\nRun susegad list to see everything on the shelf.`);
}

function order(reg, names) {
  try {
    return resolveOrder(reg.items, names);
  } catch (err) {
    if (err instanceof GraphError) throw new CliError(`${err.message}. The registry needs fixing: run node registry/build.mjs in ${reg.root} to see the details.`);
    throw err;
  }
}

// list ------------------------------------------------------------------------

export async function list(args, ctx) {
  const reg = await loadRegistry(ctx.registry, ctx.cwd);
  if (args.json) { ctx.out(JSON.stringify(reg.index.items.map(({ name, type, title, description, version, useFor }) => ({ name, type, title, description, version, ...(useFor ? { useFor } : {}) })), null, 2)); return 0; }
  if (!reg.index.items.length) { ctx.out('The shelf is empty for now: the registry has no items yet.'); return 0; }

  const width = Math.max(...reg.index.items.map(i => i.name.length)) + 2;
  ctx.out(`Here is what is on the shelf (${plural(reg.index.items.length, 'item')}).`);
  for (const type of TYPE_ORDER) {
    const items = reg.index.items.filter(i => i.type === type);
    if (!items.length) continue;
    ctx.out('');
    ctx.out(TYPE_HEADINGS[type]);
    for (const item of items) {
      const regs = item.registers.length ? `  [${item.registers.join(', ')}]` : '';
      const stab = item.stability && item.stability !== 'experimental' ? `  (${item.stability})` : '';
      const use = item.useFor?.length ? `  {${item.useFor.join(', ')}}` : '';
      ctx.out(`  ${item.name.padEnd(width)}${item.description || item.title || '(no description yet)'}${regs}${stab}${use}`);
    }
  }
  ctx.out('');
  ctx.out('Add one with: susegad add <name>    More about one: susegad info <name>');
  return 0;
}

// info ------------------------------------------------------------------------

export async function info(args, ctx) {
  if (!args.items.length) throw new CliError('Tell me which item you would like to know about, for example: susegad info scene-kolam');
  const reg = await loadRegistry(ctx.registry, ctx.cwd);
  const blocks = [];
  for (const name of args.items) {
    const item = knownItem(reg, name);
    const needs = order(reg, [name]).filter(n => n !== name);
    if (args.json) { blocks.push({ ...item, needs }); continue; }

    if (blocks.length) ctx.out('');
    blocks.push(item);
    ctx.out(`${item.title || item.name}  (${item.name} ${item.version}, ${item.type})`);
    if (item.description) ctx.out(item.description);
    ctx.out('');
    ctx.out(`Stability:   ${item.stability}${item.stabilityReason ? ` (${item.stabilityReason})` : ''}`);
    ctx.out(`Depends on:  ${item.dependencies.length ? item.dependencies.join(', ') : 'nothing'}`);
    if (needs.length > item.dependencies.length) ctx.out(`All it pulls in:  ${needs.join(', ')}`);
    if (item.registers.length) ctx.out(`Registers:   ${item.registers.join(', ')}`);
    if (item.useFor?.length) ctx.out(`Use for:     ${item.useFor.join(', ')}`);
    if (item.budget) {
      const parts = [];
      if (item.budget.jsBytes !== undefined) parts.push(`${item.jsBytes} of ${item.budget.jsBytes} JS bytes${item.jsBytes > item.budget.jsBytes ? ' (over budget)' : ''}${item.codeBytes !== undefined ? ` (${item.codeBytes} without comments)` : ''}`);
      if (item.budget.frameMs !== undefined) parts.push(`${item.budget.frameMs} ms per frame`);
      ctx.out(`Budget:      ${parts.join(', ')}`);
    } else {
      ctx.out(`Size:        ${item.jsBytes} JS bytes`);
    }
    if (item.prompt) ctx.out(`Prompt:      ${item.prompt}`);
    if (item.docs) ctx.out(`Docs:        ${item.docs}`);
    ctx.out('');
    ctx.out(`Files (${item.files.length}, ${item.bytes} bytes), and where susegad add puts them:`);
    const w = Math.max(...item.files.map(f => f.path.length)) + 2;
    for (const f of item.files) ctx.out(`  ${f.path.padEnd(w)}-> ${targetPathFor(f.path)}`);
  }
  if (args.json) ctx.out(JSON.stringify(blocks.length === 1 ? blocks[0] : blocks, null, 2));
  return 0;
}

// add -------------------------------------------------------------------------

/**
 * Work out what `add` would do, touching nothing.
 * Each file is new, same (already identical), update (untouched since we copied it,
 * and the registry has moved on) or changed (the builder edited it).
 */
export function planAdd(reg, names, target) {
  for (const name of names) knownItem(reg, name);
  const lock = readLock(target);
  const baseline = lockedHashes(lock);
  const stale = [];
  const items = order(reg, names).map(name => {
    const item = reg.items.get(name);
    const files = item.files.map(f => {
      const src = join(reg.root, f.path);
      if (!existsSync(src)) { stale.push(`${f.path} is listed but missing`); return null; }
      const content = readFileSync(src);
      const hash = hashContent(content);
      if (hash !== f.hash) stale.push(`${f.path} has changed since the index was built`);
      const to = targetPathFor(f.path);
      const dest = join(target, to);
      let status = 'new';
      if (existsSync(dest)) {
        const current = hashContent(readFileSync(dest));
        if (current === hash) status = 'same';
        else if (baseline.get(to) === current) status = 'update';
        else status = 'changed';
      }
      return { from: f.path, to, dest, content, hash, status };
    });
    return { item, files, requested: names.includes(name) };
  });
  if (stale.length) {
    throw new CliError(`The registry index at ${reg.file} is out of date:\n` +
      stale.map(s => `  ${s}`).join('\n') +
      `\nRebuild it with node registry/build.mjs in ${reg.root}, then run this again.`);
  }
  return { items, lock };
}

export async function add(args, ctx) {
  if (!args.items.length) throw new CliError('Tell me what to add, for example: susegad add scene-kolam\nRun susegad list to see everything on the shelf.');
  const reg = await loadRegistry(ctx.registry, ctx.cwd);
  if (reg.remote) throw new CliError(`add cannot copy files from an HTTP registry yet (${reg.file}). list and info work against it; add and diff still need a local path or --ref.`);
  const target = resolve(ctx.cwd, args.dir ?? DEFAULT_DIR);
  const shown = p => toPosix(relative(ctx.cwd, p)) || '.';
  const { items, lock } = planAdd(reg, args.items, target);

  const extras = items.filter(p => !p.requested).map(p => p.item.name);
  ctx.out(`Adding ${listing(args.items)}` +
    (extras.length ? `, with the ${plural(extras.length, 'piece')} ${args.items.length === 1 ? 'it needs' : 'they need'}: ${listing(extras)}.` : '.'));
  ctx.out('');

  const conflicts = items.flatMap(p => p.files.filter(f => f.status === 'changed'));
  if (conflicts.length && !args.overwrite) {
    ctx.out(`You have changed ${plural(conflicts.length, 'file')} that this would replace, so I have left everything as it was:`);
    ctx.out('');
    for (const f of conflicts) ctx.out(`  ${shown(f.dest)}`);
    ctx.out('');
    const names = args.items.join(' ');
    ctx.out(`To see what differs:       susegad diff ${[...new Set(items.filter(p => p.files.some(f => f.status === 'changed')).map(p => p.item.name))].join(' ')}${args.dir ? ` --dir ${args.dir}` : ''}`);
    ctx.out(`To replace them anyway:    susegad add ${names}${args.dir ? ` --dir ${args.dir}` : ''} --overwrite`);
    return 1;
  }

  const w = Math.max(...items.map(p => p.item.name.length)) + 2;
  let written = 0;
  for (const p of items) {
    const count = s => p.files.filter(f => f.status === s).length;
    const bits = [];
    if (count('new')) bits.push(`${count('new')} new`);
    if (count('update')) bits.push(`${count('update')} updated`);
    if (count('changed')) bits.push(`${count('changed')} of yours replaced`);
    if (count('same')) bits.push(`${count('same')} already here`);
    ctx.out(`  ${p.item.name.padEnd(w)}${p.item.version.padEnd(8)}${bits.join(', ')}`);
    if (args.dryRun) for (const f of p.files) ctx.out(`      ${f.status.padEnd(8)}${shown(f.dest)}`);
    written += p.files.filter(f => f.status !== 'same').length;
  }
  ctx.out('');

  if (args.dryRun) {
    ctx.out(`Dry run, so nothing was written. Without --dry-run I would write ${plural(written, 'file')} into ${shown(join(target, 'susegad'))}.`);
    return 0;
  }

  for (const p of items) {
    for (const f of p.files) {
      if (f.status === 'same') continue;
      mkdirSync(dirname(f.dest), { recursive: true });
      writeFileSync(f.dest, f.content);
    }
    const before = lock.items[p.item.name];
    lock.items[p.item.name] = {
      version: p.item.version,
      type: p.item.type,
      hash: p.item.hash,
      requested: p.requested || !!before?.requested,
      files: Object.fromEntries(p.files.map(f => [f.to, f.hash])),
    };
  }
  mkdirSync(target, { recursive: true });
  writeLock(target, lock);

  if (written) ctx.out(`Copied ${plural(written, 'file')} into ${shown(join(target, 'susegad'))}. ${written === 1 ? 'It is' : 'They are'} yours now, so change anything you like.`);
  else ctx.out(`Everything was already here and up to date in ${shown(join(target, 'susegad'))}.`);
  ctx.out(`I noted what I copied in ${shown(join(target, LOCKFILE))}, so next time I can tell your edits from mine.`);

  const usage = usageHint(reg, items, target, ctx.cwd, args.base);
  if (usage.length) {
    ctx.out('');
    ctx.out(args.base ? `To use it on a page served from ${args.base}/:` : 'To use it on a page:');
    for (const l of usage) ctx.out('  ' + l);
  }
  return 0;
}

function usageHint(reg, planned, target, cwd, pageRoot) {
  const shown = planned.filter(p => p.requested && ['scene', 'component', 'recipe'].includes(p.item.type));
  if (!shown.length) return [];
  const dirOf = item => item.manifest.slice(0, item.manifest.lastIndexOf('/'));
  const own = (item, file) => item.files.find(f => f.path === `${dirOf(item)}/${file}`);
  const base = item => dirOf(item).split('/').at(-1);
  // index.js for packages and scenes, <name>.js for components, recipe.js for recipes
  const entry = item => own(item, 'index.js') ?? own(item, `${base(item)}.js`) ?? own(item, 'recipe.js');
  // --base names the page's own web root, when it differs from where the command was run
  // (a page served from site/ needs vendor/..., not ./site/vendor/...). Default: cwd itself.
  const from = pageRoot ? resolve(cwd, pageRoot) : cwd;
  const rel = p => { const r = toPosix(relative(from, join(target, targetPathFor(p)))); return r.startsWith('.') ? r : './' + r; };

  const imports = [];
  const core = planned.find(p => p.item.name === 'core');
  if (core && entry(core.item) && shown.some(p => p.item.type === 'scene')) imports.push(rel(entry(core.item).path));
  for (const p of shown) if (entry(p.item)) imports.push(rel(entry(p.item).path));
  if (!imports.length) return [];

  // Every copied component's stylesheet too, dependencies included: a recipe needs its pieces styled.
  const styled = planned.filter(p => shown.includes(p) || p.item.type === 'component');
  const links = styled.flatMap(p => p.item.files.filter(f => f.path.startsWith(dirOf(p.item) + '/') && /\.css$/.test(f.path) && !f.path.includes('/skins/')))
    .map(f => `<link rel="stylesheet" href="${rel(f.path)}">`);
  const lines = [...links, '<script type="module">', ...imports.map(i => `  import '${i}';`), '</script>'];
  for (const p of shown) {
    if (p.item.type === 'scene') lines.push(`<sg-scene name="${p.item.name.replace(/^scene-/, '')}"></sg-scene>`);
    if (p.item.type === 'recipe') {
      const readme = p.item.docs ?? own(p.item, 'README.md')?.path;
      const demo = own(p.item, 'index.html');
      if (readme) lines.push(`<!-- How to mount ${p.item.name}: ${rel(readme)} -->`);
      if (demo) lines.push(`<!-- A working page to start from: ${rel(demo.path)} -->`);
    }
  }
  return lines;
}

// diff ------------------------------------------------------------------------

export async function diff(args, ctx) {
  const reg = await loadRegistry(ctx.registry, ctx.cwd);
  if (reg.remote) throw new CliError(`diff cannot read files from an HTTP registry yet (${reg.file}). list and info work against it; add and diff still need a local path or --ref.`);
  const target = resolve(ctx.cwd, args.dir ?? DEFAULT_DIR);
  const lock = readLock(target);
  const names = args.items.length ? args.items : Object.keys(lock.items).sort();
  if (!names.length) {
    ctx.out(`Nothing from Susegad UI has been added to ${toPosix(relative(ctx.cwd, target)) || '.'} yet. Start with: susegad add <name>`);
    return 0;
  }

  let differs = 0;
  for (const [n, name] of names.entries()) {
    const item = knownItem(reg, name);
    const locked = lock.items[name];
    if (n) ctx.out('');
    if (!locked) {
      ctx.out(`${name} has not been added to ${toPosix(relative(ctx.cwd, target)) || '.'} yet. Add it with: susegad add ${name}${args.dir ? ` --dir ${args.dir}` : ''}`);
      differs++;
      continue;
    }
    ctx.out(locked.version === item.version ? `${name} ${item.version}` : `${name}: yours is ${locked.version}, the registry has ${item.version}`);
    const rows = [];
    const seen = new Set();
    for (const f of item.files) {
      const to = targetPathFor(f.path);
      seen.add(to);
      const dest = join(target, to);
      const src = join(reg.root, f.path);
      if (!existsSync(dest)) {
        rows.push(to in locked.files
          ? ['missing', to, 'not in your project; susegad add puts it back']
          : ['added', to, 'new in the registry; susegad add brings it in']);
        continue;
      }
      const mine = readFileSync(dest);
      const hash = hashContent(mine);
      if (hash === f.hash) { rows.push(['same', to, '']); continue; }
      const theirs = existsSync(src) ? readFileSync(src, 'utf8') : '';
      const d = diffLines(theirs, mine.toString('utf8'));
      const counts = `+${d.added} -${d.removed} lines`;
      if (!(to in locked.files)) rows.push(['differs', to, `new in the registry, and your file there is different; ${counts}`, d]);
      else if (hash === locked.files[to]) rows.push(['older', to, `the registry has moved on; ${counts}`, d]);
      else rows.push(['edited', to, `you changed this; ${counts}`, d]);
    }
    for (const to of Object.keys(locked.files)) {
      if (!seen.has(to)) rows.push(['gone', to, 'no longer in the registry; safe to delete if nothing imports it']);
    }
    const off = rows.filter(r => r[0] !== 'same');
    const same = rows.length - off.length;
    const w = Math.max(0, ...off.map(r => r[1].length)) + 2;
    for (const [status, to, note, d] of off) {
      ctx.out(`  ${status.padEnd(9)}${to.padEnd(w)}${note}`);
      if (args.patch && d?.ops) for (const l of formatPatch(d.ops)) ctx.out(`      ${l}`);
    }
    differs += off.length;
    if (!off.length) ctx.out(`  All ${plural(same, 'file')} match the registry.`);
    else if (same) ctx.out(`  ${plural(same, 'other file')} match${same === 1 ? 'es' : ''} the registry.`);
  }
  return differs ? 1 : 0;
}
