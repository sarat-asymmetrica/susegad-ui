// What the PreToolUse shell guard (.claude/hooks/guard-shell.mjs) refuses, as a pure function.
// Two commands RUNBOOK §10 says have cost this repo real work:
//   - a forced worktree removal, which on Windows follows a node_modules junction and empties its
//     target (6 and 11 October: the main checkout lost node_modules, packages/cli and packages/mcp);
//   - git stash in any form that writes the stack (push, pop, apply, drop, save, flags alone): the
//     stack is shared by every worktree, so one agent's pop can land in another's run (12 October,
//     a `git stash -q` / `git stash pop -q` pair left an agent's edits in another agent's worktree).
//     `git stash list` and `git stash show` only read, and pass.
// The permission deny rules in .claude/settings.json catch the plain forms; this also catches them
// inside compound commands. Returns the reason to show the agent, or null to let the call through.

export function shellVerdict(command) {
  // Only a git in command position counts (the start, or after ; & | or (), so a grep or an echo that
  // quotes the words passes.
  const c = `${String(command ?? '').trim()} `.replace(/\s+/g, ' ');
  if (/(?:^|[;&|(])\s*git (-C \S+ )?worktree remove\b[^;&|]*\s(--force|-f)(?=\s)/.test(c))
    return 'Refused: `git worktree remove --force`. On Windows it follows a node_modules junction and empties the target (RUNBOOK §10). Remove junctions first with `cmd //c rmdir <path>`, then `git worktree remove` without --force; if it still refuses, report the tree to the command center.';
  for (const m of c.matchAll(/(?:^|[;&|(])\s*git (?:-C \S+ )?stash\b ?([^\s;&|]*)/g))
    if (!['list', 'show'].includes(m[1]))
      return 'Refused: `git stash` writes a stack every worktree shares, so a pop can land in another agent\'s run (RUNBOOK §10). Set work aside with a commit instead: git commit -m "wip" -- <paths>, and git reset --soft HEAD~1 to take it back.';
  return null;
}
