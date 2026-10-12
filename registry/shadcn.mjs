// A shadcn-compatible view of the registry, so `npx shadcn add <url>/<item>.json` can install a piece.
//
// registry/schema.json and registry/registry.json stay the source of truth; this turns the built
// index into the two shapes shadcn reads (https://ui.shadcn.com/schema/registry.json and
// registry-item.json, checked 6 October 2026):
//
//   registry.json     the index: one entry per item, files without content
//   <name>.json       one item with every text file's content inlined
//
// Mapping decisions:
//   * Every file is `registry:file` with an explicit `target`. These are plain JS and CSS custom
//     elements, not React, so there is no `ui`/`components` alias to resolve against. The target is
//     the path the susegad CLI uses (packages/scenes/x/a.js -> susegad/scenes/x/a.js) behind shadcn's
//     `~/` (the project root; see SHADCN_ROOT), so the tree keeps the shape relative imports expect.
//   * The item's own `type` is the nearest shadcn kind: component -> registry:component, scene,
//     recipe -> registry:block, package, adapter -> registry:lib/registry:item, surface -> registry:theme.
//   * our `dependencies` become `registryDependencies` as absolute URLs under `baseUrl` (shadcn
//     resolves a URL, not a bare name, for a registry that is not its own).
//   * `npmDependencies` are NOT passed as `dependencies`: shadcn then runs the package manager itself, and
//     `npx shadcn add` hung on depth-photo (three) in two reviews and in a third try with `--yes` and 500 s. The
//     pins stay in `meta.npmDependencies` and the item's `docs` says to run `npm i name@pin`.
//   * cssVars is not used: tokens ship as CSS files (`:root` custom properties and @font-face), which
//     a file copy carries exactly; merging them into a Tailwind theme would change them.
//   * Templates (type `template`) are left out of the view: see shadcnView.
//   * Binary files (fonts, audio) cannot be carried as a JSON string, so they are left out and listed in
//     `meta.binaryFiles`; the item's `docs` says to fetch them with the susegad CLI.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { targetPathFor } from '../packages/cli/src/paths.js';

export const DEFAULT_BASE_URL = 'https://susegad.asymmetrica.ai/r';
export const SHADCN_ITEM_SCHEMA = 'https://ui.shadcn.com/schema/registry-item.json';
export const SHADCN_INDEX_SCHEMA = 'https://ui.shadcn.com/schema/registry.json';

// shadcn's `~/` means the project root. Without it, shadcn rewrites the first "src/" in a target with
// .replace("src/", "") (shadcn 4.21), which turns susegad/engine/src/noise.js into susegad/engine/noise.js
// and breaks the relative imports between the files. `~/` skips that rewrite.
export const SHADCN_ROOT = '~/';

export const SHADCN_TYPE = {
  component: 'registry:component',
  scene: 'registry:block',
  recipe: 'registry:block',
  package: 'registry:lib',
  surface: 'registry:theme',
  adapter: 'registry:item',
};

const BINARY = /\.(woff2?|ttf|otf|wav|mp3|ogg|m4a|png|jpe?g|webp|avif|gif|ico|mp4|webm|pdf|bin)$/i;

/** Text a JSON string can carry unchanged: not a known binary type, no NUL byte, valid UTF-8. Returns the LF text, or null. */
export function inlineText(path, buffer) {
  if (BINARY.test(path) || buffer.includes(0)) return null;
  const text = buffer.toString('utf8');
  if (text.includes('�')) return null;
  return text.replace(/\r\n/g, '\n');
}

const trimSlash = s => s.replace(/\/+$/, '');

/**
 * @param {object} item one entry of registry/registry.json
 * @param {{ root: string, baseUrl?: string, withContent?: boolean }} opts
 */
export function shadcnItem(item, { root, baseUrl = DEFAULT_BASE_URL, withContent = true }) {
  const base = trimSlash(baseUrl);
  const files = [], binary = [];
  const npm = Object.entries(item.npmDependencies ?? {}).map(([n, v]) => `${n}@${v}`);
  for (const f of item.files) {
    const content = withContent ? inlineText(f.path, readFileSync(join(root, f.path))) : (BINARY.test(f.path) ? null : '');
    if (content === null) { binary.push(f.path); continue; }
    files.push({ path: f.path, type: 'registry:file', target: SHADCN_ROOT + targetPathFor(f.path), ...(withContent && { content }) });
  }
  const docs = [
    `Copied into susegad/ at the project root. ${item.docs ? `Read ${targetPathFor(item.docs)}` : ''}${item.prompt ? `${item.docs ? ' and ' : 'Read '}${targetPathFor(item.prompt)}` : ''}${item.docs || item.prompt ? ' for how to use it.' : ''}`.trim(),
    npm.length ? `Run \`npm i ${npm.join(' ')}\` yourself: shadcn is not asked to install it, because that step hung when we tried.` : '',
    binary.length ? `${binary.length} binary file${binary.length === 1 ? '' : 's'} (fonts or audio) cannot travel in a shadcn registry item: run \`npx @susegad/cli add ${item.name}\` to copy ${binary.length === 1 ? 'it' : 'them'} too.` : '',
  ].filter(Boolean).join('\n\n');
  return {
    $schema: SHADCN_ITEM_SCHEMA,
    name: item.name,
    type: SHADCN_TYPE[item.type] ?? 'registry:item',
    title: item.title,
    description: item.description,
    ...(item.dependencies.length && { registryDependencies: item.dependencies.map(d => `${base}/${d}.json`) }),
    files,
    ...(item.useFor?.length && { categories: [...item.useFor] }),
    docs,
    meta: {
      susegadType: item.type, version: item.version, stability: item.stability, hash: item.hash,
      ...(item.registers.length && { registers: item.registers }),
      ...(npm.length && { npmDependencies: item.npmDependencies }),
      ...(binary.length && { binaryFiles: binary }),
    },
  };
}

/**
 * The whole view: Map of file name -> text. `registry.json` is the index, the rest are items.
 * @param {{ items: object[] }} index the built registry/registry.json
 */
export function shadcnView(fullIndex, { root, baseUrl = DEFAULT_BASE_URL }) {
  const out = new Map();
  const base = trimSlash(baseUrl);
  // A template is a whole site whose files land at a project's root (index.html, package.json, README.md), so
  // offering it to `shadcn add` would offer to overwrite the project's own. `susegad create` is how it is started.
  const index = { ...fullIndex, items: fullIndex.items.filter(i => i.type !== 'template') };
  const list = index.items.map(item => {
    const { $schema, docs, ...rest } = shadcnItem(item, { root, baseUrl, withContent: false });
    return rest;
  });
  out.set('registry.json', JSON.stringify({ $schema: SHADCN_INDEX_SCHEMA, name: 'susegad-ui', homepage: base.replace(/\/r$/, ''), items: list }, null, 2) + '\n');
  for (const item of index.items) out.set(`${item.name}.json`, JSON.stringify(shadcnItem(item, { root, baseUrl }), null, 2) + '\n');
  return out;
}

const ITEM_TYPES = new Set(['registry:lib', 'registry:block', 'registry:component', 'registry:ui', 'registry:hook', 'registry:theme', 'registry:page', 'registry:file', 'registry:style', 'registry:base', 'registry:font', 'registry:item']);

/**
 * What `--check` asks of a view built in memory, from shadcn's registry-item schema (required name and type;
 * a registry:file needs path, type and target) and from our own promises: every file has its content and a
 * ~/ target, every registryDependency is a URL under baseUrl that names an item in the view, and the index
 * lists exactly the items. Returns problems; empty means good.
 * @param {Map<string,string>} view from shadcnView
 */
export function validateView(view, { baseUrl = DEFAULT_BASE_URL } = {}) {
  const problems = [], base = trimSlash(baseUrl), names = new Set();
  const index = JSON.parse(view.get('registry.json') ?? 'null');
  if (!index?.name || !Array.isArray(index.items)) return ['registry.json: needs a name and an items array'];
  for (const [file, text] of view) if (file !== 'registry.json') names.add(file.replace(/.json$/, ''));
  const listed = index.items.map(i => i.name).sort();
  if (listed.join() !== [...names].sort().join()) problems.push('registry.json: lists different items from the <name>.json files');
  for (const name of names) {
    const item = JSON.parse(view.get(`${name}.json`));
    const say = m => problems.push(`${name}.json: ${m}`);
    if (item.name !== name) say(`name is "${item.name}"`);
    if (!ITEM_TYPES.has(item.type)) say(`type "${item.type}" is not a shadcn registry type`);
    if (!Array.isArray(item.files)) { say('has no files array'); continue; }
    for (const f of item.files) {
      if (!f.path || f.type !== 'registry:file') say(`file ${f.path}: needs a path and type registry:file`);
      if (typeof f.target !== 'string' || !f.target.startsWith(SHADCN_ROOT)) say(`file ${f.path}: target must start with ${SHADCN_ROOT}`);
      if (typeof f.content !== 'string') say(`file ${f.path}: has no inlined content`);
    }
    for (const dep of item.registryDependencies ?? []) {
      const m = dep.startsWith(base + '/') && dep.slice(base.length + 1).match(/^(.+).json$/);
      if (!m) say(`registryDependency ${dep} is not a URL under ${base}`);
      else if (!names.has(m[1])) say(`registryDependency ${dep} names no item in the view`);
    }
  }
  return problems;
}
