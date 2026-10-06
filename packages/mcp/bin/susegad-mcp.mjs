#!/usr/bin/env node
// The susegad-mcp stdio server. See packages/mcp/README.md for how to add it
// to Claude Code, Codex, Hermes or OpenCode.
//
//   node packages/mcp/bin/susegad-mcp.mjs [--registry <url-or-path>]
//
// Without --registry the server uses the repo's own registry when it runs from
// the repo, and the live site otherwise, exactly as the CLI does.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serveStdio } from '../src/server.mjs';
import { TOOLS, callTool } from '../src/tools.mjs';

const argv = process.argv.slice(2);
const registryArg = (() => {
  const i = argv.indexOf('--registry');
  if (i >= 0) return argv[i + 1];
  const inline = argv.find(a => a.startsWith('--registry='));
  return inline ? inline.slice('--registry='.length) : process.env.SUSEGAD_REGISTRY || null;
})();

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const env = { registry: registryArg, cwd: process.cwd() };

await serveStdio({
  name: 'susegad-mcp',
  version,
  instructions:
    'Susegad UI is a small library of hand-crafted Indian web pieces: scenes, components, recipes. ' +
    'Use search to see what is on the shelf, preview to show poster URLs from the live site, info for ' +
    'an item\'s files and its agent prompt, and add to copy pieces into the project the server was ' +
    'started in (they become the project\'s own code). diff reports how copied files have drifted. ' +
    'The add and diff tools run the susegad CLI\'s own code; the server must run from the Susegad UI ' +
    'repo, or beside a checkout of packages/cli.',
  tools: TOOLS.map(t => ({
    ...t,
    run: (args) => callTool(t.name, args, env),
  })),
});
