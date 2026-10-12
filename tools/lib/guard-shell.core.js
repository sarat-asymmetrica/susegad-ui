// What the PreToolUse shell guard (.claude/hooks/guard-shell.mjs) refuses, as a pure function.
// Commands RUNBOOK §10 says have cost this repo real work:
//   - removing a worktree that holds a link: on Windows the removal follows a junction or symlink and
//     empties its target. --force did it on 6 and 11 October; on 12 October a PLAIN `git worktree
//     remove` did it, through a scratch tree's `node_modules` link to the main checkout's node_modules,
//     and took packages/cli and packages/mcp with it (npm links them from node_modules/@susegad/).
//     So --force is refused outright, and any removal is refused while the tree holds a link (the hook
//     looks; `linksIn` is how it tells this function what it saw);
//   - making a link named node_modules at all, the way such a tree gets one;
//   - git stash in any form that writes the stack (push, pop, apply, drop, save, flags alone): the
//     stack is shared by every worktree, so one agent's pop can land in another's run (12 October,
//     a `git stash -q` / `git stash pop -q` pair left an agent's edits in another agent's worktree).
//     `git stash list` and `git stash show` only read, and pass.
// The permission deny rules in .claude/settings.json catch the plain forms; this also catches them
// inside compound commands. Returns the reason to show the agent, or null to let the call through.

const AT = String.raw`(?:^|[;&|(])\s*`; // a command in command position: the start, or after ; & | or (

/** The paths a command asks `git worktree remove` to remove. */
export function worktreeRemovals(command) {
  const c = ` ${String(command ?? '').replace(/\s+/g, ' ')} `;
  const out = [];
  for (const m of c.matchAll(new RegExp(String.raw`${AT}git (?:-C \S+ )?worktree remove ((?:-\S+ )*)([^\s;&|]+)`, 'g')))
    out.push(m[2].replace(/^["']|["']$/g, ''));
  return out;
}

/**
 * @param {string} command
 * @param {{ linksIn?: (path: string) => string[] }} [look] linksIn lists the links a worktree holds
 *   (its top level and its node_modules); without it the removal check is skipped.
 */
export function shellVerdict(command, { linksIn } = {}) {
  const c = `${String(command ?? '').trim()} `.replace(/\s+/g, ' ');
  if (new RegExp(String.raw`${AT}git (-C \S+ )?worktree remove\b[^;&|]*\s(--force|-f)(?=\s)`).test(c))
    return 'Refused: `git worktree remove --force`. On Windows it follows a node_modules junction and empties the target (RUNBOOK §10). Remove junctions first with `cmd //c rmdir <path>`, then `git worktree remove` without --force; if it still refuses, report the tree to the command center.';
  if (new RegExp(String.raw`${AT}ln (-\S+ )*\S+ (\S*/)?node_modules/? `).test(c) || /\bmklink \/[jd] \S*node_modules\b/i.test(c)
    || /\bNew-Item\b[^;&|]*-ItemType (Junction|SymbolicLink)\b[^;&|]*node_modules/i.test(c))
    return 'Refused: a link named node_modules. A worktree removal follows it on Windows and empties what it points at (12 October: the main checkout lost node_modules, packages/cli and packages/mcp this way). A tree under .worktrees/ already resolves the shared .worktrees/node_modules with no link of its own; elsewhere, run `npm ci` (RUNBOOK §10).';
  if (linksIn) for (const p of worktreeRemovals(command)) {
    const links = linksIn(p);
    if (links.length) return `Refused: ${p} holds ${links.length === 1 ? 'a link' : 'links'} (${links.slice(0, 4).join(', ')}${links.length > 4 ? ', …' : ''}). On Windows a worktree removal follows a link and empties its target, even without --force (12 October). Delete each link itself first with \`cmd //c rmdir <path>\`, then remove the tree.`;
  }
  for (const m of c.matchAll(new RegExp(String.raw`${AT}git (?:-C \S+ )?stash\b ?([^\s;&|]*)`, 'g')))
    if (!['list', 'show'].includes(m[1]))
      return 'Refused: `git stash` writes a stack every worktree shares, so a pop can land in another agent\'s run (RUNBOOK §10). Set work aside with a commit instead: git commit -m "wip" -- <paths>, and git reset --soft HEAD~1 to take it back.';
  return null;
}
