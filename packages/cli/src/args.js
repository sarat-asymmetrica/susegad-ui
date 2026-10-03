import { CliError } from './registry.js';

const VALUE_FLAGS = { '--dir': 'dir', '--registry': 'registry', '--ref': 'ref', '--base': 'base' };
const BOOL_FLAGS = {
  '--dry-run': 'dryRun', '--overwrite': 'overwrite', '--patch': 'patch', '--json': 'json',
  '--help': 'help', '-h': 'help', '--version': 'version', '-v': 'version',
};

/**
 * susegad <command> [items...] [flags]. Accepts --flag value and --flag=value.
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const args = { command: null, items: [] };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    let inline;
    if (a.startsWith('--') && a.includes('=')) [a, inline] = [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)];
    if (a in VALUE_FLAGS) {
      const v = inline ?? argv[++i];
      if (v === undefined || v === '' || (inline === undefined && v.startsWith('-'))) throw new CliError(`${a} needs a value, for example ${a} ${{ '--dir': 'src/lib', '--registry': '../susegad-ui', '--ref': 'main', '--base': 'site' }[a]}`);
      args[VALUE_FLAGS[a]] = v;
    } else if (a in BOOL_FLAGS) {
      args[BOOL_FLAGS[a]] = true;
    } else if (a.startsWith('-')) {
      throw new CliError(`I do not know the option ${a}. Run susegad --help to see the ones I understand.`);
    } else if (!args.command) {
      args.command = a;
    } else {
      args.items.push(a);
    }
  }
  return args;
}

export const HELP = `susegad: copy Susegad UI pieces into your project, where they are yours to change.

  susegad list                     everything on the shelf, by type
  susegad info <item...>           files, dependencies, budget and prompt for an item
  susegad add <item...>            copy items and everything they need into your project
  susegad diff [item...]           which copied files differ from the registry

Options
  --dir <folder>        where to put things (default src/lib; files land in <folder>/susegad/)
  --base <folder>       add: show the "to use it on a page" hint with paths relative to this
                        folder instead of the current one. Set it to your web root (often
                        the folder --dir is inside) when that differs from where you run
                        the command, so the hint matches what the page actually needs.
  --registry <path>     another registry: a repo folder, an index file, a file: URL, or an
                        http(s):// URL to an index (list and info only; add and diff still
                        need a local path or --ref)
  --ref <commit>        read the registry as committed at a commit, branch or tag (through
                        git archive), never the working tree: no uncommitted work, no stale index
  --dry-run             add: show what would happen and write nothing
  --overwrite           add: replace files even if you have changed them
  --patch               diff: show the changed lines too
  --json                list and info: print JSON, for scripts and agents

Examples
  susegad add scene-kolam
  susegad add scene-paus --dir app/vendor --dry-run
  susegad add scene-kolam --dir site/vendor --base site   # site/ is the page's web root
  susegad diff scene-kolam --patch
  susegad add enquiry date-range --dir public/vendor --ref main`;
