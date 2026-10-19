# 0031: rigour at promotion, not at integration

*Command center for the owner, 19 October 2026. The owner's word, 18 October, after
the rigour run: "all the rigour is hurting the utility of the library because of how
effortful it is for each component to integrate and any changes". Follows the
rigour audit (`docs/reports/2026-10-17-rigour-audit.md`) and `docs/GOAL-RIGOUR.md`.*

## The problem, in numbers

- The browser suite is about 150 minutes of CI runner time, about 50 per engine
  (Chromium 49, WebKit 50, Firefox 51; `tools/lib/check-durations.json`, from the
  12 October CI run). On the owner's machine (4 cores, 16 GB, two browser slots)
  it is several times that, and agents sharing the machine slow each other.
- Scenes are 84 of those 150 minutes (56%). The heaviest scene checks are
  `tinto/words` and `tinto/glass` (about 3 to 4 minutes per engine), then
  `vad/words`, `abri` and `veranda/words` (1 to 3 minutes).
- *Corrected 19 October after Rasika's review (D1): the first draft read the
  durations file wrongly and said 113 minutes, 78% and 6 to 11 minutes a check.
  The profile of the same night (`docs/reports/2026-10-19-scene-check-profile.md`,
  on `slice/r-profile` until the speed-up slice merges) measured five heavy scene
  checks (shet, maun, mankurad, abri, chiro): 66% stepping frames, 26% repeated setup;
  and across the suite,
  pixels copied as arrays in `vad/words`, and 22 scene checks never ported to
  virtual time.*
- The process grew as fast as the tests: review tiers that bind under every goal,
  the canonical line, `gate-tier --enforce`, a debt register near a hundred rows.
  The rigour run itself added machinery. Integrating one component costs
  ceremony as well as CPU.

A faster machine would help with the first point only.

## The decision

**Every registry item already carries `stability`** (`experimental`, `beta`, ...;
`registry/build.mjs`, and anything above experimental needs a `stabilityReason`).
That field now decides how much rigour a change owes.

1. **Experimental items integrate cheaply.** A slice whose diff stays inside
   experimental items (their folders, demos, docs and words) owes:
   - `npm run gates` (unit tests, registry, CEM, skill inventory, copy lint);
   - `npm run check -- --changed` in Chromium, and `npm run smoke -- --changed`;
   - WebKit for that piece's own check when people will press it on a phone;
   - the Sutradhar reading the diff and the contact sheet, and the owner's eye.

   No Rasika tier, no three-engine suite, no Kathakar pass, no DEBT row for what
   it skips. What it skips is owed **at promotion**, all at once.

2. **Promotion is where rigour lives.** Moving an item from `experimental` to
   `beta` (or higher) owes, in one pass for everything promoted together:
   - the three-engine suite through the `ci/` lane, compared per check and engine
     with a baseline run;
   - Rasika at the tier `gate-tier` gives the item (Full for a new scene,
     component or recipe);
   - Kathakar's pass on its strings, a native reader for any Indian language;
   - quiet-machine perf against its budget.

   The `stabilityReason` names that pass (the review file and the `ci/` run).
   Promotions are batched, for example after an event or at the end of a goal.

3. **Shared ground keeps its rigour.** Anything everyone stands on still binds at
   the tier `gate-tier` gives, whatever the goal: `packages/core`, the engine,
   tokens, type, export, the server, the check harness and the files that decide
   outcomes, any item already above experimental, any path no registry item
   owns, and any experimental item another item depends on. 141 of 143 items
   are experimental today, so the last two rules carry most of the weight
   (`laneOf` in `tools/gate-tier.core.js`). One wrong primitive breaks
   every piece; one wrong experimental scene breaks one demo.

4. **The laptop never runs three engines.** Local scopes run Chromium, plus
   WebKit for the piece in hand when people press it. The three-engine suite runs
   only in the `ci/` lane (rung gates and promotions), off this machine.

5. **A public page is never shipped on the cheap lane alone.** If an experimental
   piece goes in front of the public (a deploy, an event, a client), what people
   see gets one Rasika pass at Standard and Kathakar's words first. The library
   internals behind it can stay experimental.

6. **The machinery is frozen.** No new gate, tier rule or register until the
   scene checks are cheaper (below). What exists stays; DEBT rows for experimental
   items are folded into their promotion instead of growing the register.

## The next lever: cheaper scene checks

Rung 3c (`slice/r-sleeps`) takes fixed sleeps out of the fifteen heaviest checks,
and virtual time (`tools/lib/virtual-time.mjs`) already makes stepped checks 2 to 4
times faster. The next slice measures where the scene minutes still go (real-time
waits, frames run that no clause reads, settling loops) and moves the time-driven
clauses onto stepped time or onto the scene's pure model in Node, where a clause is
about numbers rather than pixels. Each move keeps the clause's power: a planted
fault must still turn it red.

## Known gaps (Rasika, 19 October; DEBT rows 101 to 106)

- Promotion is not yet enforced by a tool: `stabilityReason` only has to be
  non-empty, and units owed at promotion never turn red. Nothing is promoted
  yet; the first promotion batch closes this by hand, and a tool waits until the
  machinery freeze lifts.
- The commands a builder runs (plain `gate-tier`, the slice scope's tier step)
  are lane-blind, so a lane slice reads "review owed" there.
- `laneOf` does not read `checkDeps` or folio's string-mapped loads, so a few
  items other pages load count as leaves; and it reads the registry at the
  merge, so a slice that demotes and edits an item in one merge passes as lane
  work.
- Nothing treats a sacred motif as shared ground (none exists today).

## What this is not

- Not a lowering of the bar. The bar is the same; it is paid once, at promotion,
  instead of on every change while a piece is still being found.
- Not a licence for silence. Experimental is shown as experimental: in the
  registry, on the docs site and in `SKILL.md`, so a builder knows what they are
  standing on.
