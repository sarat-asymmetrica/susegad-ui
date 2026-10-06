// susegad check: the lighter gate, one command (docs/requests/2026-10-02-lighter-gate.md, F).
//
//   susegad check scene-mithagar     the named pieces
//   susegad check                    your diff's pieces (gate-tier names them)
//
// It runs gate-tier, the lints (motif, canvas text, copy) and review-pack against the
// library's checkout this CLI lives in, and prints a plain summary. Only meaningful inside
// the susegad-ui repo (or a checkout of it): the consumer's copied files have no harness.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CliError, loadRegistry } from './registry.js';

/** Run one repo tool, streaming nothing: output comes back whole. */
function runTool(root, tool, args, timeout = 900000) {
  const r = spawnSync(process.execPath, [join('tools', tool), ...args], { cwd: root, encoding: 'utf8', timeout, env: process.env });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || ''), status: r.status };
}

export async function check(args, ctx) {
  const reg = await loadRegistry(ctx.registry, ctx.cwd);
  const root = reg.root ? resolve(reg.root) : null;
  const tools = ['gate-tier.mjs', 'motif-lint.mjs', 'canvas-text-lint.mjs', 'copy-lint.mjs', 'review-pack.mjs'];
  if (!root || !tools.every(t => existsSync(join(root, 'tools', t)))) {
    throw new CliError('check runs the library\'s own gate tools, so it needs the susegad-ui checkout: run it from the repo (or pass --registry <repo folder>), not against a remote or copied-out registry.');
  }

  const out = ctx.out;
  let failed = 0;

  // 1. the tier, read from the diff
  const tier = runTool(root, 'gate-tier.mjs', ['--json']);
  let tierInfo = null;
  try { tierInfo = JSON.parse(tier.out.slice(tier.out.indexOf('{'), tier.out.lastIndexOf('}') + 1)); } catch {}
  if (tierInfo) {
    out(`Tier: ${tierInfo.tier}, ${tierInfo.changed} changed file(s) against main.`);
    for (const r of tierInfo.reasons) out(`  ${r}`);
  } else out(tier.out.trim());
  if (!tier.ok) failed++;

  // 2. the lints
  const lints = [
    ['motif-lint.mjs', [], 'the motif tier'],
    ['canvas-text-lint.mjs', [], 'text on a canvas'],
    ['copy-lint.mjs', [], 'the copy rules'],
  ];
  for (const [tool, argv, label] of lints) {
    const r = runTool(root, tool, argv);
    out(r.ok ? `Lint ok: ${label}.` : `Lint FAIL: ${label}.\n${r.out.trim()}`);
    if (!r.ok) failed++;
  }

  // 3. the evidence pack
  const packArgs = args.items.length ? args.items : ['--changed'];
  const pack = runTool(root, 'review-pack.mjs', packArgs, 1800000);
  const packLine = /pack [\w-]+: (\S+)/.exec(pack.out);
  out('');
  if (packLine) {
    out(`Pack at ${packLine[1]}`);
    out('Open the contact sheet and look at it before you open a PR.');
  } else {
    out(pack.out.trim());
  }
  if (!pack.ok) failed++;

  if (failed) out(`\n${failed} step(s) failed; look at them before you open a PR.`);
  else out('\nEverything green. Look at the contact sheet before you open a PR.');
  return failed ? 1 : 0;
}
