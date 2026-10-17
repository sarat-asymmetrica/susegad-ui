# Runbook: how a run works here

*The standing method for every run. A goal file (`docs/GOAL-*.md`) holds only its ladder: what to build, in what order, and each rung's exit gate. Where `GOAL-OCTOBER.md` §1 and §3 to §6 or `GOAL-OCTOBER-RESUME.md` §2 say otherwise, this file holds.*

**The current goal: `docs/GOAL-RIGOUR.md`** (rigour as machinery, on `run/rigour`, from the rigour audit of 17 October). Deferred verification lives in `docs/DEBT.md`. `docs/GOAL-GRADUATION.md` is built on `run/graduation` (`a9f380b`); its rigour day runs on this goal's machinery. Then `docs/GOAL-GRADUATION-2.md` (the owner's word of 17 October). A fresh Sutradhar picks up from `docs/GOAL-RIGOUR.md`'s "State at handover". The Conclave postcard (`docs/GOAL-POSTCARD.md`) was parked on 14 October 2026; its backlog is `docs/requests/2026-10-14-postcard-parked.md`, and its branch `run/postcard` at a9d2aa5. The next goal comes from the owner's brainstorm on showing the library on screens at the event. The math pass, the text tier and bake-and-reflow are closed (`docs/LEDGER.md`). The conclave run is still parked at `run/conclave` a189ca4.

## 1. Read first, once

1. `C:\Projects\AGENTS.md`, then this repo's `AGENTS.md`.
2. `docs/CHARTER.md`: what the library is.
3. This file, then the current goal.
4. Your kernel in `.claude/agents/`. The Sutradhar also reads the other three.
5. `docs/LEDGER.md`, from the last "Run start" entry to the end.

Everything else (requests, research, reviews) is read when a rung cites it, not up front.

## 2. Who does what

| Seat | Who | Owns |
|---|---|---|
| Owner | Sarat | Rulings, real devices, anything public |
| Command center | an Opus session on `main` in the main checkout | Merging into `main`, deploying on the owner's word, pruning worktrees, talking with the owner, writing goals and requests |
| Sutradhar | a fresh session per goal | The goal's ladder, end to end, on its own integration branch |
| Karigar | a subagent | Code, in a slice |
| Rasika | a subagent | Review, at the slice's tier |
| Kathakar | a subagent | Words people read or hear |

## 3. Where you work

- The main checkout stays on `main`, and the command center works there. Agents read their kernels from it. Nobody else works there.
- The run's integration branch and its worktree are named in the goal (for example `run/conclave` in `.worktrees/conclave`). Each slice gets a branch and a worktree from it, under `.worktrees/`.
- At the start of each rung, merge `main` into the integration branch.
- **Generated files are rebuilt, never hand-merged:** `registry/registry.json`, `custom-elements.json` and `references/`. Run `node registry/build.mjs`, then `npm run gates`.
- `docs/LEDGER.md` merges by union (see `.gitattributes`): both sides' entries are kept with no conflict. If the order comes out wrong, move an entry; never drop one.
- Dependencies: `.worktrees/node_modules` is a junction to `.worktrees/run/node_modules`, and worktrees under `.worktrees/` resolve it without a link of their own. The `run` worktree holds the real folder, so it is never removed until the dependencies move. A worktree whose `package.json` differs runs its own `npm ci`.

## 4. The machine

The owner's machine has **4 cores and 16 GB**. In rung 3 of October, up to twelve agents ran browsers at once. As a result:

- reviews took two to three times their targets;
- perf checks failed on `main` too;
- every red had to be re-run on its own before anyone could believe it.

So:

- **Browsers take a slot.** `tools/lib/slots.mjs` allows two browser processes on the machine at a time (`SG_BROWSER_SLOTS`). Slots are first come, first served: a waiter takes a ticket and goes in ahead of anyone who asks after it, a runner that releases a slot and asks again included. Everything else waits its turn, and waiting is cheaper than thrashing. Never set the limit to 0 to get ahead.
- **At most four agents at a time.** A fifth agent only adds queueing.
- **A slice runs its own checks** (`npm run check -- --changed`); **a rung runs the whole suite**, once, on the merged integration branch (§6).
- **Timings and perf numbers come from a quiet machine**, with the load noted. A number taken under load is a guess.
- **The harness is set in `.claude/settings.json`**: subagents keep their prompt cache for an hour, a foreground command may run 10 minutes by default (30 at most), a long conversation compacts near 400k tokens, and a hook refuses `git worktree remove --force` and a bare `git stash`. Don't work around them per agent.
- **One round, one agent.** A build, each fix round and each re-review is a fresh agent, handed over through the report and the commit. A long-lived agent re-reads its whole context on every turn: from 1 to 11 October contexts reached 950k tokens, and the re-reading was about 57% of what the runs cost (`docs/runs/2026-10-12-harness-review/`).
- **Look at screenshots where they are judged, and report in words.** Every image read stays in the agent's context for every later turn. The builder looks at its contact sheet once; the Sutradhar asks for what is in named cells rather than reading the images again.

## 5. How a slice goes

1. **The brief.** The Sutradhar gives each agent:
   - the checkout's absolute path and the write boundary (the folders it owns);
   - the slice of the goal, and the gate it must pass;
   - the reminder that others work nearby;
   - the cells to describe.

   "Environment update" notices about working folders are the Sutradhar's own moves; agents ignore them. The registry index and `SKILL.md` belong to the Sutradhar alone.
2. **The build.** Karigar builds a full Susegad piece:
   - a pure core with Node tests;
   - three registers and a reduced-motion still;
   - the touch contract (`docs/contributing/touch-contract.md`) and a conformance table (`docs/contributing/conformance.md`);
   - a prompt, docs, a registry entry, a budget and a demo page.

   A new check goes red against a broken fixture before it counts. A planted fault that patches a file (a `--break` row, a `patch` pair, a `.replace` on a served body) uses a literal needle that the mutant guard (`tools/lib/mutants.test.mjs`, in `npm test`) can find in its target. If it can't use one, it goes on `tools/lib/mutants.allow.json` with a reason.
3. **The slice gate** is `node tools/rigour.mjs --scope=slice`, run by the builder before it reports. It runs `npm run gates:slice`, `npm run check -- --changed`, `npm run smoke -- --changed` (loads with no errors, axe clean, nothing sideways at 390 px) and gate-tier over the diff, and writes one JSON result. Add `--engines chromium,webkit` when the slice touches anything a person presses. On top of it:
   - axe on the open states (a dialog, drawer, popover or menu open), through the piece's check;
   - `node tools/review-pack.mjs --changed`. The builder looks at its contact sheet and cites the pack's path and commit.
4. **The review**, at the tier `node tools/gate-tier.mjs` gives (a request marked `gate: full` raises it; nobody lowers it). **The tier binds under every goal**, light rigour included: a goal may defer the suites, never a Standard or Full slice's review. `gate-tier --enforce` is the check, and it credits only the canonical line (`.claude/agents/rasika.md` §11): `Rasika: <pass | pass with notes | changes needed | blocked>. Tier: <tier>. Slice: <branch> (<hash>)`, one per unit, in `docs/reviews/`. A direct commit is its own unit (`Slice: <hash>`). `changes needed` never satisfies a tier.
   - **Light**: no review agent. The Sutradhar reads the diff and the pack.
   - **Standard**: Rasika works from the pack, with one strip if the piece moves and the keyboard if it's interactive, and reads every new string against the copy standards.
   - **Full**: Rasika does everything in its kernel.
   - gate-tier rates `tools/` and `*.check.mjs` paths Light. A slice that changes what a check *asserts* (not just its shell) is Standard: the Sutradhar raises it in the brief.
   - **Re-reviews** look at the findings and what their fixes touched, at Standard, unless a fix changed a shared primitive. When every fix is confined to Node-tested pure code (no rendering, styling or shared primitive), the re-review is Light: the Sutradhar reads the diff and the new tests, which went red first. Fixes to a browser lifecycle (loading, teardown, contexts, fonts) keep a Standard re-review: those are where fixes made new defects.
5. **The words.** Kathakar writes:
   - every string in a Full-tier slice;
   - all text in an Indian language (flagged for a native reader);
   - any page a visitor lands on.

   A Light slice's strings pass the copy lint (in `npm run gates`). A Standard slice's strings are read by Rasika in its review. There is no separate per-rung copy pass.
6. **Deferrals go to `docs/DEBT.md`.** Anything a slice or rung does not verify (a review, a suite, an engine, a ruling) is a row there, with where, since and source. A ledger bullet alone is not a deferral; a gate deferred without a row is a failed gate.
7. **The merge** into the integration branch, by the Sutradhar, after reading the diff, then `npm run gates` on the merged tree. `npm test` alone misses a stale registry: on 12 October a merge that touched `packages/core` passed `npm test` and reached `main` with a stale `registry/registry.json`, and the public snapshot's CI was the first to fail on it. One line per slice goes into the rung's ledger entry (§8).

## 6. A rung's exit gate

1. The goal's own exit gate for the rung, item by item.
2. **The whole suite, once, on the merged integration branch**:
   - locally, on a quiet machine: `node tools/rigour.mjs --scope=rung --base <the rung's base>` (gates, gate-tier over the merges, smoke, and `npm run check` in Chromium and WebKit);
   - all three engines through the `ci/` lane, which runs the suite on Linux in about half an hour off this machine's four cores. From a clone of the public repo: `node tools/publish/export.mjs --ci-branch <clone>`, rename the branch to carry the head (`ci/<branch>-<sha>`, so a second push is never a rewrite: DEBT 65), push it and open a draft PR. The owner allows the Sutradhar and the command center to push `ci/*` branches and open draft PRs, and nothing else. Close the PR and delete its branch once the run is recorded.
   - Compare **per check and engine** against a baseline run of the rung's base (a `ci/` run of the base, never per shard).

   A red named by a live row of the known-flake table in `docs/BROWSERS.md` (per clause, unexpired; the runner marks it `known`) is recorded, not re-run. Any other red is new: it gets fixed, or it gets a DEBT row and a flake row with its cause (caught failing with `tools/until-fail.mjs`). A red that the baseline run shares is not new, and still gets its row.
3. The handover (§8).

A gate that did not run is written as "not run". It is never passed.

## 7. Authority zones (standing; a goal may add to them)

- **Green**, pre-approved:
  - everything inside this repo except the main checkout's working tree;
  - branches, worktrees and commits other than on `main`;
  - dev dependencies whose current stable version you checked;
  - scratch projects and cloned public repos under the session scratchpad.
- **Amber**, allowed with a reason in the ledger and a tight diff:
  - a runtime dependency of any piece (the default answer is no);
  - changes to the gate tooling itself;
  - changes to `tools/publish/export.mjs`'s PRIVATE list or DENY pattern;
  - making a browser engine a required CI gate.
- **Red**, never; record a blocker for the owner and carry on:
  - merging into `main`, pushing to any remote, pushing tags;
  - publishing to npm or anywhere public;
  - deploying the docs site;
  - creating or logging in to any account, or touching a real store or payment;
  - contacting anyone;
  - editing anything outside this repo, rewriting git history, changing global config.

## 8. The ledger and the handover

- **Run start** and **run stop**: one entry each, with the time (run `date`) and the heads of `main` and the integration branch.
- **One entry per rung**, written at its exit gate:
  - per slice, one line: the commit, the tier, Rasika's canonical line and timings;
  - the suite's numbers per engine, local and `ci/` (with the run IDs);
  - the reds the baseline shares, and the DEBT rows opened or closed;
  - the owner gates waiting;
  - the residual risks;
  - the next action;
  - the run's agent cost: the block `node tools/loopcost.mjs --since <run start>` prints (tokens per role, the cache-write share after gaps, polling, browser-check hours, peak context);
  - the Sutradhar's evidence block (below), once per rung.

  Add a mid-rung entry only for an incident (lost work, a broken gate, a dropped agent) or when the owner closes a thread.
- **`docs/runs/<goal>/rung-N.md`** is for the command center: what to look at first, the decisions that depart from the goal, and the merge notes.
- **One evidence block, for every seat.** Every report, review and delivery ends with it, and the rung entry carries the Sutradhar's. It is prose, never a JSON block (nothing reads one, so none goes into a review or the ledger):

  ```
  ran:     each gate or command, the commit it ran at, and its last line (pass counts, axe, perf with its baseline and CPU busy)
  looked:  what you looked at yourself, by name (cells, pages, files, diffs), and what is in it
  not run: each gate, engine or path that did not run, and why; a deferral names its DEBT row
  ```

  A seat's kernel says what its `looked` line must name. A line that can't be filled with evidence makes the gate false: say which and why.
- The command center merges rung by rung on its own clock. Carry on to the next rung; wait only when a rung depends on the owner.

## 9. Owner rulings

A goal lists the rulings it needs, each with a **default**. Build to the default and mark it "default, awaiting owner" in the run doc. A ruling that arrives later is a one-line change. Never stop a rung only to wait for a ruling that has a default.

## 10. Running agents: what past runs taught

These were paid for once. They live here instead of in four kernels.

- **Never junction or symlink `node_modules` into a worktree.** On Windows a worktree removal follows a junction or symlink and empties the target, **with or without `--force`**: on 6 October the main checkout lost `node_modules` and 34 tracked files. On 12 October a reviewer's scratch tree held `ln -s ../../node_modules node_modules`, which pointed at the main checkout's own `node_modules`, not the shared one. A plain `git worktree remove` then emptied it, and with it `packages/cli` and `packages/mcp`, which npm links from `node_modules/@susegad/`. The shell guard now refuses both a link named `node_modules` and the removal of a tree that holds any link. Delete a junction itself with `cmd //c rmdir` first. A scratch worktree (for a review, say) goes under `.worktrees/`, never in the session scratchpad, and gets no link of its own: it resolves the shared `.worktrees/node_modules`, or runs its own `npm ci`.
- **No `git stash` at all** (`list` and `show` only read, and pass). Every worktree shares one stash stack, so one agent's pop can land in another's run: on 12 October a `stash -q` / `stash pop -q` pair around a baseline run left an agent's edits in another agent's worktree. Set work aside with a commit (`git commit -m "wip" -- <paths>`, then `git reset --soft HEAD~1`), or take a baseline from a scratch worktree of `main`. The shell guard refuses the rest.
- **Don't end your turn while one of your background runs is in flight, and wait on it with one call, not a polling loop.** An agent that ends its turn to wait for a notification can sit idle for hours. Run a check in the foreground when it fits the command timeout (up to ten minutes). For a longer run, start it in the background and wait once: a single Monitor call, or a single command that blocks until the output file's last line says done. Repeated `sleep; tail` calls each cost a tool call and a page of log, and tell you nothing new. Commit work in progress before any long run.
- **Stop only your own processes, by the PID you started.** Never kill by name or command line (`tools/checks.mjs`, `node`, `chrome`): other agents run the same commands on this machine (9 October, a builder stopping its own run matched `tools/checks.mjs` and may have killed two other runs).
- **Messages cross.** Check `git log` before nudging, say "if this crossed with your reply, ignore it", and get an explicit "stopped" before touching a file an agent may be editing.
- **An agent that stops at a usage limit or drops (ECONNRESET) leaves its commits.** Read its diff, then resume it with "your work is at <hash>, carry on".
- **If the auto-mode classifier refuses an agent's `git merge`**, the Sutradhar does that merge.
- **Ask for positions, not intentions.** "Name the cell", "give me the pixel gap". "Did you look?" gets a yes; "what is in this cell?" gets looked at.
- **Doubt the instrument first.** Before explaining a surprising number, check that the page loaded and the target and baseline match in size and params. A perf ratio needs Paus measured in the same run.
- **Consent needs reasoning in every fallback.** "When X fails, do Y" can turn Y into autoplay.
- **A red is new unless a live flake row names its clause.** Comparing every red with `main` found no new red in about 50 tries (rigour audit, 17 October); expiring per-clause rows in `docs/BROWSERS.md` replace it. Catch a flake failing with `tools/until-fail.mjs` before adding its row.
- **Fix a wrong gate the same day, in the open, with a test.** A known-false gate teaches every agent to route around gates.
- **Kernels improve after each rung.** Put a lesson that changes how a seat works into that seat's kernel, with a line in `docs/kernels/CHANGELOG.md`. Put one that every seat needs here.
