// The five tools susegad-mcp exposes. add and diff call packages/cli's own
// code (src/commands.js) with a ctx that collects its output; they never
// reimplement what the CLI already knows how to do. Everything here is a pure
// function of its arguments plus a loaded registry, so the tests can run it
// in process, and the stdio server in server.mjs just passes messages through.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { targetPathFor } from '../../cli/src/paths.js';
import { add, diff } from '../../cli/src/commands.js';
import { loadRegistry, fetchRemoteFile, CliError } from '../../cli/src/registry.js';
import { resolveOrder } from '../../cli/src/graph.js';

// The registers and themes the docs site shoots posters in, and where the
// posters live on the live site. The naming scheme is apps/docs/posters.mjs's:
//   <out>/posters/<name>.<register>.<theme>.jpg
// which the built site serves as  /posters/<name>.<register>.<theme>.jpg.
export const REGISTERS = ['quiet', 'warm', 'playful'];
export const THEMES = ['light', 'dark'];
export const POSTER_BASE = 'https://susegad.asymmetrica.ai/posters/';
export const KINDS = ['package', 'scene', 'surface', 'component', 'recipe', 'adapter'];
const SITE = 'https://susegad.asymmetrica.ai';

// One load per registry location per process; the index is small and stable.
const cache = new Map();
export async function registryFor(location, cwd) {
  const key = `${location ?? ''}|${cwd ?? ''}`;
  if (!cache.has(key)) {
    const reg = await loadRegistry(location, cwd);
    cache.set(key, { reg, location: location ?? null });
  }
  return cache.get(key);
}

// search ----------------------------------------------------------------------

/** Filter the index by words, kind and register. Pure. */
export function searchItems(index, { query = '', kind, register } = {}) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  return index.items.filter(item => {
    if (kind && item.type !== kind) return false;
    if (register && !(item.registers ?? []).includes(register)) return false;
    const hay = `${item.name} ${item.title ?? ''} ${item.description ?? ''}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}

const SUMMARY = ({ name, title, type, description, version, stability }) =>
  ({ name, title, type, description, version, stability: stability ?? 'experimental' });

// info ------------------------------------------------------------------------

/** The full dependency closure of one item, without the item itself. Pure. */
export function needsOf(index, name) {
  const map = index.items instanceof Map ? index.items : new Map(index.items.map(i => [i.name, i]));
  return resolveOrder(map, [name]).filter(n => n !== name);
}

async function promptText(reg, item) {
  if (!item.prompt) return null;
  try {
    const bytes = reg.remote ? await fetchRemoteFile(reg, item.prompt) : readFileSync(join(reg.root, item.prompt));
    return bytes?.toString('utf8') ?? null;
  } catch (err) {
    if (err instanceof CliError) return `The prompt could not be read: ${err.message}`;
    throw err;
  }
}

// preview ---------------------------------------------------------------------

/** What kind of poster the site takes for an item, from its own file list. Pure. */
export function posterSourceOf(item) {
  if (item.type === 'scene') return 'scene';
  const paths = new Set(item.files.map(f => f.path));
  const dir = item.manifest.slice(0, item.manifest.lastIndexOf('/') + 1);
  if (paths.has(`${dir}demo.html`)) return 'demo';
  if (paths.has(`${dir}index.html`)) return 'page';
  return null;
}

/** The poster URL for one register and theme. Pure. */
export function posterUrl(name, register, theme, base = POSTER_BASE) {
  return `${base}${name}.${register}.${theme}.jpg`;
}

/** All six poster URLs for an item, or null when the site shows no poster. Pure. */
export function posterSet(item, base = POSTER_BASE) {
  const source = posterSourceOf(item);
  if (!source) return null;
  return {
    source,
    base,
    posters: REGISTERS.flatMap(register => THEMES.map(theme => ({ register, theme, url: posterUrl(item.name, register, theme, base) }))),
  };
}

// add and diff, through the CLI's own code -------------------------------------

/**
 * Run the CLI's add or diff against a registry, collecting what it says.
 * @param {'add'|'diff'} command
 * @param {{ items?: string[], dir?: string, cwd?: string, registry?: string,
 *           dryRun?: boolean, overwrite?: boolean, patch?: boolean }} toolArgs
 */
export async function cliCommand(command, toolArgs = {}) {
  const cwd = toolArgs.cwd ?? process.cwd();
  const out = [];
  const args = {
    command,
    items: toolArgs.items ?? [],
    dir: toolArgs.dir,
    base: toolArgs.base,
    dryRun: !!toolArgs.dryRun,
    overwrite: !!toolArgs.overwrite,
    patch: !!toolArgs.patch,
  };
  try {
    const fn = command === 'add' ? add : diff;
    const code = await fn(args, { cwd, out: s => out.push(s ?? ''), registry: toolArgs.registry });
    return { code, text: out.join('\n') };
  } catch (err) {
    if (err instanceof CliError) return { code: 1, text: err.message };
    throw err;
  }
}

// the tool table the server exposes -------------------------------------------

export const TOOLS = [
  {
    name: 'search',
    description: 'Find Susegad UI pieces on the shelf. Searches names, titles and descriptions; narrow by kind (package, scene, surface, component, recipe, adapter) or register (quiet, warm, playful).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to look for in names, titles and descriptions.' },
        kind: { type: 'string', enum: KINDS },
        register: { type: 'string', enum: REGISTERS },
      },
    },
    run: async (args, { reg }) => ({
      results: searchItems(reg.index, args).map(SUMMARY),
    }),
  },
  {
    name: 'info',
    description: 'One Susegad UI piece in full: its files and where susegad add puts them, its dependencies, registers, stability, and the prompt an agent should read before using it.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'The registry name, for example scene-kolam.' } },
      required: ['name'],
    },
    run: async ({ name }, { reg }) => {
      const item = reg.index.items.find(i => i.name === name);
      if (!item) return { error: `I do not have anything called "${name}". Call search first to see the shelf.` };
      return {
        ...SUMMARY(item),
        dependencies: item.dependencies,
        needs: needsOf(reg.index, name),
        registers: item.registers,
        prompt: item.prompt ?? null,
        promptText: await promptText(reg, item),
        docs: item.docs ?? null,
        budget: item.budget ?? null,
        files: item.files.map(f => ({ path: f.path, bytes: f.bytes, copiedTo: targetPathFor(f.path) })),
      };
    },
  },
  {
    name: 'preview',
    description: 'The poster URLs for one piece, in each register (quiet, warm, playful) and theme (light, dark), so you can show a person what the piece looks like before adding it. Scenes and pieces with a demo page have posters.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'The registry name, for example scene-kolam.' } },
      required: ['name'],
    },
    run: async ({ name }, { reg }) => {
      const item = reg.index.items.find(i => i.name === name);
      if (!item) return { error: `I do not have anything called "${name}". Call search first to see the shelf.` };
      const set = posterSet(item);
      if (!set) return { error: `${name} has no poster: the site photographs scenes and pieces with a demo page, and this piece has neither.` };
      return { name, ...set, page: item.type === 'scene' ? `${SITE}/scenes/${item.name.replace(/^scene-/, '')}` : null };
    },
  },
  {
    name: 'add',
    description: 'Copy Susegad UI pieces into a project, with everything they depend on. Files become the project\'s own code. The target folder defaults to src/lib under the server\'s working directory; pass dir to choose another. The registry is the live site unless the server was started with --registry.',
    inputSchema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'string' }, description: 'Registry names, for example ["scene-kolam"].' },
        dir: { type: 'string', description: 'Target folder under the project (default src/lib).' },
        cwd: { type: 'string', description: 'The project folder. Default: the server\'s working directory.' },
        dryRun: { type: 'boolean', description: 'Show what would happen and write nothing.' },
        overwrite: { type: 'boolean', description: 'Replace files even if the project changed them.' },
        registry: { type: 'string', description: 'A registry URL or path, instead of the server\'s default.' },
      },
      required: ['items'],
    },
    run: async (args, { reg }) => {
      const r = await cliCommand('add', { ...args, registry: args.registry ?? reg.location });
      if (r.code !== 0) return { error: r.text, code: r.code };
      return { code: 0, output: r.text };
    },
  },
  {
    name: 'diff',
    description: 'Which copied files differ from the registry, and why: newer there, edited by you, gone. With no items it checks everything the project has added. Pass patch: true for the changed lines.',
    inputSchema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'string' }, description: 'Registry names. Default: everything in the project\'s lockfile.' },
        dir: { type: 'string', description: 'Target folder under the project (default src/lib).' },
        cwd: { type: 'string', description: 'The project folder. Default: the server\'s working directory.' },
        patch: { type: 'boolean', description: 'Show the changed lines too.' },
        registry: { type: 'string', description: 'A registry URL or path, instead of the server\'s default.' },
      },
    },
    run: async (args, { reg }) => {
      const r = await cliCommand('diff', { ...args, registry: args.registry ?? reg.location });
      if (r.code !== 0) return { error: r.text, code: r.code };
      return { code: 0, output: r.text };
    },
  },
];

export const TOOL_NAMES = TOOLS.map(t => t.name);

/** Run one tool by name with its arguments. Shared by the server and the tests. */
export async function callTool(name, args = {}, env = {}) {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) return { error: `I do not have a tool called "${name}". I have: ${TOOL_NAMES.join(', ')}.` };
  if (tool.name === 'search' || tool.name === 'info' || tool.name === 'preview') {
    const { reg, location } = await registryFor(env.registry, env.cwd);
    return { ...(await tool.run(args, { reg })), registry: reg.file };
  }
  const { reg, location } = await registryFor(env.registry, env.cwd);
  return tool.run(args, { reg: { location: location ?? reg.file } });
}
