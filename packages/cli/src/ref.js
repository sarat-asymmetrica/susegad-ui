import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { CliError, defaultRegistry, locateIndex } from './registry.js';
import { untar } from './tar.js';

// --ref <commit>: read the registry as it was committed, never the working tree.
// `git archive` exports the index and packages/ at that commit into a temporary
// folder, and the command runs against that. Uncommitted work never reaches a
// consumer, and a stale index in the working tree never blocks one.

function git(cwd, args, opts = {}) {
  return execFileSync('git', ['-C', cwd, ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 512 * 1024 * 1024, ...opts });
}

/**
 * Export the registry at `ref` into a temporary folder.
 * @param {string} ref a commit, branch or tag
 * @param {string|undefined} location --registry, as the other commands take it
 * @param {string} cwd
 * @returns {{ dir: string, commit: string, top: string, cleanup: () => void }}
 */
export function snapshotAt(ref, location, cwd) {
  const file = locateIndex(location ?? defaultRegistry, cwd);
  const start = [dirname(file), resolve(cwd, location ?? '.')].find(p => existsSync(p));
  let top;
  try { top = git(start, ['rev-parse', '--show-toplevel']).toString().trim(); }
  catch { throw new CliError(`--ref needs the registry to be a git repository, and ${start} is not in one.`); }
  let commit;
  try { commit = git(top, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).toString().trim(); }
  catch { throw new CliError(`I could not find ${ref} in ${top}. Give a commit, branch or tag that exists there.`); }
  let tar;
  try { tar = git(top, ['-c', 'core.autocrlf=false', 'archive', '--format=tar', commit, '--', 'registry/registry.json', 'packages']); }
  catch (err) {
    throw new CliError(`${ref} (${commit.slice(0, 7)}) has no committed registry index, so I cannot install from it.` +
      `\n${String(err.stderr ?? '').trim()}`.trimEnd());
  }
  const dir = mkdtempSync(join(tmpdir(), 'susegad-ref-'));
  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  try {
    for (const e of untar(tar)) {
      const to = join(dir, e.path);
      if (e.dir) { mkdirSync(to, { recursive: true }); continue; }
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, e.content);
    }
  } catch (err) { cleanup(); throw err; }
  return { dir, commit, top, cleanup };
}
