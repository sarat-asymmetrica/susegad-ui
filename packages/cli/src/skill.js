import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliError, suggest } from './registry.js';
import { HARNESSES, HARNESS_NAMES } from './harnesses.js';

// susegad skill: put the library's own skill (SKILL.md plus references/) where
// an agent harness looks for skills. The skill lives in the repo this CLI came
// from; a standalone install (npm pack) ships it beside the CLI's src/ too.

const repoSkillDir = fileURLToPath(new URL('../../../', import.meta.url));

function sourceSkill() {
  const skill = join(repoSkillDir, 'SKILL.md');
  const refs = join(repoSkillDir, 'references');
  if (!existsSync(skill)) {
    throw new CliError(
      `I could not find Susegad UI's SKILL.md beside this CLI (${repoSkillDir}).\n` +
      `susegad skill needs the library's checkout, or an install that shipped it.`);
  }
  return { skill, refs: existsSync(refs) ? refs : null };
}

/** The skill's name, from the frontmatter of the SKILL.md we are installing. */
function skillName(skillFile) {
  const m = /^name:\s*(\S+)/m.exec(readFileSync(skillFile, 'utf8'));
  return m ? m[1] : 'susegad-ui';
}

/** ~/.x and %USERPROFILE%-style tilde paths become absolute under the user's home. */
function expandTilde(p) {
  return p === '~' ? homedir() : p.startsWith('~/') ? join(homedir(), p.slice(2)) : resolve(p);
}

/**
 * Where this skill should go, and how sure we are. Returns null when the
 * destination is the caller's to decide (an unverified harness without --dir).
 * @returns {{ dest: string, verified: boolean, source: string } | null}
 */
export function skillDestination(args, cwd) {
  if (args.dir) return { dest: resolve(cwd, args.dir), verified: true, source: 'given on the command line' };
  const h = HARNESSES[args.harness ?? 'claude'];
  const slot = args.global ? h.global : h.project;
  if (!slot || !slot.verified || !slot.path) return null;
  const base = slot.path.startsWith('~') ? expandTilde(slot.path) : resolve(cwd, slot.path);
  return { dest: base, verified: true, source: slot.source };
}

/** Copy SKILL.md and references/ into <dest>/<name>/, without stepping on an existing install. */
function install(source, name, dest, { overwrite = false, out }) {
  const target = join(dest, name);
  const landing = join(target, 'SKILL.md');
  if (existsSync(landing) && !overwrite) {
    out(`There is already a ${name} skill at ${target}, so I left it alone.`);
    out('Pass --overwrite to replace it, or delete it first if you want a clean copy.');
    return { target, copied: 0, skipped: true };
  }
  mkdirSync(target, { recursive: true });
  cpSync(source.skill, landing);
  let copied = 1;
  if (source.refs) {
    cpSync(source.refs, join(target, 'references'), { recursive: true });
    copied += readdirSync(source.refs).length;
  }
  return { target, copied, skipped: false };
}

export async function skill(args, ctx) {
  if (args.harness !== undefined && !HARNESSES[args.harness]) {
    const guess = suggest(args.harness, HARNESS_NAMES);
    throw new CliError(`I do not know the harness "${args.harness}".` +
      (guess ? ` Did you mean ${guess}?` : '') +
      `\nThe ones I know: ${HARNESS_NAMES.join(', ')}.`);
  }
  const harnessName = args.harness ?? 'claude';
  const source = sourceSkill();
  const name = skillName(source.skill);

  const where = skillDestination(args, ctx.cwd);
  if (!where) {
    const h = HARNESSES[harnessName];
    throw new CliError(
      `${h.label}'s documentation (${h[(args.global ? 'global' : 'project')]?.source ?? h.global.source}) describes no skills folder to install into,` +
      `${h[(args.global ? 'global' : 'project')]?.note ? ` and I will not guess one: ${h[(args.global ? 'global' : 'project')].note}` : ''}\n` +
      `Tell me where to put it: susegad skill --harness ${harnessName} --dir <folder>`);
  }

  const { target, copied, skipped } = install(source, name, where.dest, { overwrite: args.overwrite, out: ctx.out });
  if (!skipped) {
    const scope = args.dir ? '' : args.global ? ' (for all your projects)' : ' (for this project)';
    ctx.out(`Installed the ${name} skill into ${target}${scope}.`);
    ctx.out(`Copied SKILL.md${source.refs ? ', references/ and its files' : ''} (${copied} files).`);
    ctx.out(`Checked against ${harnessName === 'codex' ? 'the command line you gave me' : HARNESSES[harnessName][(args.global ? 'global' : 'project')].source}.`);
  }
  return 0;
}

/** For tests: does a table entry honestly carry a source URL and a verdict? */
export function harnessTable() {
  return Object.fromEntries(Object.entries(HARNESSES).map(([name, h]) => [name, {
    label: h.label,
    global: { ...h.global, path: h.global?.path ?? null },
    project: h.project ? { ...h.project, path: h.project?.path ?? null } : null,
  }]));
}
