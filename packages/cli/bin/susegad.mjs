#!/usr/bin/env node
// The Susegad UI command line. No dependencies; Node 22 or later.
import { readFileSync } from 'node:fs';
import { parseArgs, HELP } from '../src/args.js';
import { add, diff, info, list } from '../src/commands.js';
import { CliError } from '../src/registry.js';
import { snapshotAt } from '../src/ref.js';

const COMMANDS = { list, ls: list, add, diff, info };

export function run(argv, { cwd = process.cwd(), out = s => console.log(s ?? ''), err = s => console.error(s ?? '') } = {}) {
  let snap = null;
  try {
    const args = parseArgs(argv);
    if (args.version) {
      const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
      out(pkg.version);
      return 0;
    }
    if (args.help || !args.command || args.command === 'help') { out(HELP); return args.command && args.command !== 'help' ? 1 : 0; }
    const command = COMMANDS[args.command];
    if (!command) {
      err(`I do not know the command "${args.command}". I can list, info, add and diff.`);
      err('Run susegad --help for the details.');
      return 1;
    }
    if (!args.ref) return command(args, { cwd, out, registry: args.registry });
    // --ref: run against the registry as committed, exported to a temporary folder
    snap = snapshotAt(args.ref, args.registry, cwd);
    out(`Reading the registry at ${args.ref} (${snap.commit.slice(0, 7)}), as committed.`);
    return command(args, { cwd, out, registry: snap.dir });
  } catch (e) {
    if (e instanceof CliError) { err(snap ? e.message.split(snap.dir).join(`${snap.top} at ${snap.commit.slice(0, 7)}`) : e.message); return 1; }
    err(`Something went wrong that I did not expect: ${e.stack ?? e}`);
    err('Please report it with the command you ran.');
    return 2;
  } finally {
    snap?.cleanup();
  }
}

if (import.meta.main ?? process.argv[1]?.replace(/\\/g, '/').endsWith('/bin/susegad.mjs')) {
  process.exitCode = run(process.argv.slice(2));
}
