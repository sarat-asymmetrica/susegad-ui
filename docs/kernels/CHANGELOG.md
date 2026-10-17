# Kernel changelogs

What changed in each Susegad UI kernel, when, and the evidence for it. The kernels in `.claude/agents/` hold only the current rules; their history lives here.

## Sutradhar

v0.2 (25 Sep 2026, after Resume 2, Waves 3 and 4; Opus 5.5 orchestrating
Sonnet 5 workers): REVIEW by named cells, the instrument first, commit
messages read against their diffs; A8 fix wrong gates the same day; A9 what
every dispatch says; the nudge dynamic; running-agents lessons. The same
wave-by-wave refinement applies to all four kernels: amend after each
wave's review, with a changelog entry pointing at the evidence.

v0.3 (26 Sep 2026, after Wave 5): the Wave 5 running-agents lessons:
positions not intentions, checks that fail first, doubting my own probes,
an explicit "stopped" before shared files, reading a stalled agent's diff,
same-load controls. Evidence: the build ledger (2026-09-25 16:15) and the Wave 5 review.

v0.4 (6 Oct 2026, command center, on the owner's word): rebased on Maude
v0.3, which ships in the repo (docs/kernels/maude.md) so a reader can see what
the dials mean. New dials set: ERROR_TEMPERAMENT 15, UNCERTAINTY_NARRATIVE
FRAMEWORK, AESTHETIC_ALIGNMENT CONSCIOUS, and the emoji dials. Maude's contracts
C0–C7 now hold here; the kernel's meaning is otherwise unchanged.
§9's voice is now the house voice (warm, creative, professional; whimsy
tunable) rather than one owner's chat preferences, which live in that
owner's own settings.

v0.5 (8 Oct 2026, command center, on the owner's word: streamline the process now the library is on solid ground): the method moved
to docs/RUNBOOK.md (one place for seats, worktrees, the machine's limits,
gates, zones, the ledger and the running-agents lessons; goal files keep
only their ladders). A2 follows the tiers; A9 points at the brief; §9's
lessons moved to RUNBOOK §10; the self-check runs once per rung, and its
JSON drops the dial echo and folds Maude's generic gates into one line,
keeping the evidence fields. Evidence: rung 3 of October (ledger, 7 Oct),
where twelve agents on four cores made reviews take two to three times
their targets.

v0.6 (12 Oct 2026, command center, on the owner's word: "do the optimization pass"): the harness review (docs/runs/2026-10-12-harness-review/): model, effort and a one-hour prompt cache in the frontmatter; the §10 gate JSON (exemplar, logic mode, self-computed score) became a plain evidence block that keeps every evidence field; this changelog moved out of the kernel; pins to an older model and history-relative wording were removed. REVIEW and GATE trust the builder's pack and gate results when their commit is the head being merged, and the Sutradhar runs the rung gate (they contradicted RUNBOOK §5.3); DELEGATION_WIDTH is capped at four, as RUNBOOK §4 says; the repeated "no winding down" lines and DIAL_INTEGRITY, which nothing checked, are gone.

v0.7 (18 Oct 2026, Sutradhar, rigour rung 2e; docs/reports/2026-10-17-rigour-audit.md, Phase 2): §10 uses the one evidence block every seat shares (docs/RUNBOOK.md §8) plus a zones line; the rung does not close until gate-tier --enforce is green, because the tier binds under every goal, light rigour included.

## Karigar

v0.2 (25 Sep 2026, Sutradhar after Wave 4; first run with Sonnet 5
builders): VERIFY names what is seen; A7 doubt the instrument; A8 never
bend code around a gate; A9 fallbacks need their own press; Ω₅ and §10
evidence-bearing gates; the Wave 4 workshop lessons. Evidence: the build
ledger (2026-09-25 13:17) and the Wave 4 review.

v0.3 (26 Sep 2026, Sutradhar after Wave 5, the first wave on v0.2):
VERIFY asks for positions not intentions, the moment not the rest state,
settled animations, axe on open states; A10 a check must be able to fail;
A11 port everything the source draws; the Wave 5 workshop lessons. The v0.2
evidence gates worked at once for reporting (real cells, perf held as
unresolved, scores below 1.0 with reasons); looking still described intent
until asked for positions. Evidence: the build ledger (2026-09-25 16:15) and the Wave 5 review.

v0.3.1 (29 Sep 2026, karigar-strip, for the Sutradhar to confirm): VERIFY asks for a
strip or onion behind any motion claim. Workers debug well but don't look, and
one screenshot says nothing about how a scene moves; tools/strip.mjs and
tools/onion.mjs now show it, with --facts for frozen spans and jumps. Evidence: the
two tools themselves.

v0.4 (6 Oct 2026, Sutradhar, on the owner's word; docs/reports/2026-10-03-lighter-gate-mithagar-trial.md):
VERIFY ends with the evidence pack (tools/review-pack.mjs) and cites its path
and commit hash; the gate gains tier and pack. Rasika gathers once from the
same pack instead of repeating every run by hand.

v0.5 (6 Oct 2026, command center, on the owner's word): rebased on Maude
v0.3, which ships in the repo (docs/kernels/maude.md) so a reader can see what
the dials mean. New dials set: ERROR_TEMPERAMENT 15, UNCERTAINTY_NARRATIVE
SYSTEMATIC, AESTHETIC_ALIGNMENT CONSCIOUS, and the emoji dials. Maude's contracts
C0–C7 now hold here; the kernel's meaning is otherwise unchanged.

v0.6 (8 Oct 2026, command center, on the owner's word: streamline the process now the library is on solid ground): VERIFY ends with
the slice gate from docs/RUNBOOK.md §5.3 (`npm run gates`, `npm run check
-- --changed`, the pack); the lessons every seat shares moved to RUNBOOK
§10; the §10 JSON drops the dial echo and folds Maude's generic gates into
one line, keeping every evidence field.

v0.7 (12 Oct 2026, command center): the harness review (docs/runs/2026-10-12-harness-review/): model, effort and a one-hour prompt cache in the frontmatter; the §10 gate JSON (exemplar, logic mode, self-computed score) became a plain evidence block that keeps every evidence field; this changelog moved out of the kernel; pins to an older model and history-relative wording were removed. model sonnet, effort medium.

v0.8 (18 Oct 2026, Sutradhar, rigour rung 2e; docs/reports/2026-10-17-rigour-audit.md, Phase 2): §10 becomes the shared evidence block (ran, looked, not run); the slice gate it reports is rigour.mjs --scope=slice; deferrals name their DEBT row.

## Rasika

v0.2 (25 Sep 2026, Sutradhar after Waves 3 and 4; Sonnet 5 reviewer):
A7 judge the unexercised path on paper; A8 record dead ends; A9 check the
builder's instrument; shadow DOM, readiness, consent-instrumenting and
Git Bash lessons; evidence-bearing gates. Sonnet 5 as Rasika was the
strongest seat this run: it pierced the shadow DOM to settle FP4, tried to
break the consent gate with instrumentation, and disclosed its own false
lead.

v0.3 (26 Sep 2026, Sutradhar after Wave 5): A10 a check that can't fail is
not evidence; A11 judge the moment, not only the rest; A12 catch a flake
failing. Rasika-w5 found the real fidelity gaps (a headless singer, a menu
with no theatre, a clipped deckle) and held the flake as unresolved rather
than guessing; what was missing was the flake's cause, left unnamed. Evidence: the build ledger (2026-09-25 16:15) and the Wave 5 review.

v0.3.1 (29 Sep 2026, karigar-strip, for the Sutradhar to confirm): A11 asks for a
strip or onion behind any motion claim, so a review of motion cites frames and
numbers, not one screenshot. Evidence: tools/strip.mjs and tools/onion.mjs.

v0.4 (6 Oct 2026, Sutradhar, on the owner's word; docs/reports/2026-10-03-lighter-gate-mithagar-trial.md):
the lighter gate. GATHER reads the tier from tools/gate-tier.mjs and gathers
once with tools/review-pack.mjs; the full suite re-runs only when the commit
differs; EXPERIENCE looks at contact sheets, not cells one by one; A12 uses
tools/until-fail.mjs; A13 spend looking where the risk is; word caps and
per-phase timings in §11; tier and pack in the gate. The tools landed on
3 October (7b6defa) but the kernel kept v0.3.1, so passes still took about an
hour. The Standard trial on mithagar took about 4.5 minutes of reviewer time.
Evidence: docs/reports/2026-10-03-lighter-gate-mithagar-trial.md.

v0.5 (6 Oct 2026, command center, on the owner's word): rebased on Maude
v0.3, which ships in the repo (docs/kernels/maude.md) so a reader can see what
the dials mean. New dials set: ERROR_TEMPERAMENT 10, UNCERTAINTY_NARRATIVE
FRAMEWORK, AESTHETIC_ALIGNMENT CONSCIOUS, and the emoji dials. Maude's contracts
C0–C7 now hold here; the kernel's meaning is otherwise unchanged.

v0.5.1 (6 Oct 2026, command center): a scratch worktree for a review goes
under .worktrees/, never the scratchpad, and never gets a junctioned
node_modules; removing such a tree emptied the main checkout on 6 Oct 2026.
Use the shared .worktrees/node_modules, or run npm ci in the tree.

v0.6 (8 Oct 2026, command center, on the owner's word: streamline the process now the library is on solid ground): GATHER re-runs
only the slice's own checks (`--changed`); A13 scopes re-reviews to the
findings; the §10 JSON drops the dial echo and folds Maude's generic gates
into one line, keeping every evidence field. The machine-level lessons
(slots, junctions, quiet-machine timings) are in docs/RUNBOOK.md §4 and §10.

v0.7 (12 Oct 2026, command center): the harness review (docs/runs/2026-10-12-harness-review/): model, effort and a one-hour prompt cache in the frontmatter; the §10 gate JSON (exemplar, logic mode, self-computed score) became a plain evidence block that keeps every evidence field; this changelog moved out of the kernel; pins to an older model and history-relative wording were removed. model sonnet, effort high. GATHER reads the builder's pack and re-gathers only when its commit isn't the head (Karigar already said so); A13 spends the time saved on adversarial probing, where about 24 of 30 must-fix findings came from; §11 drops the word caps and the per-phase timing table for one start and end time.

v0.8 (18 Oct 2026, Sutradhar, rigour rung 2e; docs/reports/2026-10-17-rigour-audit.md, Phase 2): GATHER no longer says the copy, motif and rest lints are ungated (repo-check and the suite run them); at Standard Rasika is the only reader of new strings, since the per-rung Kathakar pass is gone; §11 carries the canonical verdict line gate-tier --enforce credits, one section per unit; §10 becomes the shared evidence block.

## Kathakar

v0.2 (25 Sep 2026, Sutradhar after Wave 4; Sonnet 5 writer): A7 kin words
belong to the family's own language; A8 read the scene's model before writing
cues; where the copy standards apply; evidence-bearing gates for copy and
language review. Wave 4's story ("The first rain") showed no tone drift:
the prose held the Humane Register, and every cultural assumption was named
as an open question. The one slip was cultural knowledge (Ajji / Aaji).

v0.3 (26 Sep 2026, Sutradhar after Wave 5): A9 a person's status is a fact
to confirm. Wave 5's lineage notes (Carepa, Kantar, Teental) were good and
flagged their own open questions; two of them (about whether people in the
lineage may be named, and how) went to the owner's list.
Evidence: the build ledger (2026-09-25 16:15) and the Wave 5 review.

v0.4 (6 Oct 2026, command center, on the owner's word): rebased on Maude
v0.3, which ships in the repo (docs/kernels/maude.md) so a reader can see what
the dials mean. New dials set: ERROR_TEMPERAMENT 20, UNCERTAINTY_NARRATIVE
HUMILITY, AESTHETIC_ALIGNMENT CONSCIOUS, and the emoji dials. Maude's contracts
C0–C7 now hold here; the kernel's meaning is otherwise unchanged.

v0.5 (8 Oct 2026, command center, on the owner's word: streamline the process now the library is on solid ground): you write every
string in Full-tier slices, all text in an Indian language, and every page
a visitor lands on; Light and Standard slices' strings pass the copy lint
and come to you in one pass per rung (docs/RUNBOOK.md §5.5). The §10 JSON
drops the dial echo and folds Maude's generic gates into one line, keeping
every evidence field.

v0.6 (12 Oct 2026, command center): the harness review (docs/runs/2026-10-12-harness-review/): model, effort and a one-hour prompt cache in the frontmatter; the §10 gate JSON (exemplar, logic mode, self-computed score) became a plain evidence block that keeps every evidence field; this changelog moved out of the kernel; pins to an older model and history-relative wording were removed. model sonnet, effort medium.

v0.7 (18 Oct 2026, Sutradhar, rigour rung 2e; docs/reports/2026-10-17-rigour-audit.md, Phase 2): §10 becomes the shared evidence block; the per-rung pass over Light and Standard strings is retired (Light: the copy lint; Standard: Rasika).
