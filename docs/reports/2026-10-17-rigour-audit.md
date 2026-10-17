# Rigour audit: the testing harness, the instruments and the process

*Command center, 17 October 2026, at the owner's request ("an assessment of the rigour itself, given how we're expanding"). Four read-only auditors in parallel, one per layer: the Node tests and gates, the browser check harness, the measuring instruments, and the process with CI. No browsers were run. One timed `npm test` was run on a quiet machine. Each auditor's scratch files are in the session scratchpad (`audit-1` to `audit-4`). The command center checked the headline claims: main red, `rasika.md:100`, and `checks.mjs:89`.*

## The verdict in one paragraph

The pieces that test are mostly good. Pure-core tests check invariants, not snapshots. The checks plant faults and must go red first, and the mutant guard bites. Adversarial review finds the real bugs. What is weak is **everything around them**. Nothing runs on its own: there is no CI on the private repo and no hook. The full three-engine suite has not finished on a merged head since about 10 October. `--changed` can miss checks it should select. Reviewers are told some things are gated that are not. Deferred verification has piled up to **45 open items**, at roughly one closed for every three added. The library grew faster than its rigour became automatic. The fix is less ceremony and more machinery, not more ceremony.

## The numbers

| Layer | Size | Cost |
|---|---|---|
| Node tests (`npm test`) | 2,862 tests (669 → 1,167 → 1,606 → 2,862 over the runs) | 137 s wall on 4 cores |
| `npm run gates`, the other steps | registry, cem, skill-inventory | about 12 s (the registry is built twice, about 21 s extra) |
| Browser checks | 144 `*.check.mjs`; 122 in the suite; 23,647 lines | Chromium 72 min, WebKit 72, Firefox 108 locally (4.2 h); about 29 min on CI's 12 runners |
| Chromium-only checks | 20 of 122 (button, tabs, link, page transitions, all 8 veranda) | They print `skip` in WebKit and Firefox |
| Fixed sleeps in checks | 599 sleeps in 98 of 122 checks, 492 s as written | The main source of flakes |
| Rasika reviews on file | 40: 18 changes needed, 20 pass with notes, 2 pass | Full: 14 of 22 needed changes (64%) |
| Open deferred items | 45, across 6 branches and `main` | see the debt list |

## Found today, needing action now

1. **`main` is red on `npm run gates`.**
   - `registry/registry.json` and `references/components.md` are stale, from the command center's own `3e0b799` (eight docs edited on main, gates not run). It is the same slip as on 12 October.
   - Separately, `apps/docs/headers.core.test.js:33` reads a gitignored `out/docs/_headers` from 8 October. It is a machine-dependent test, not a code bug.
2. **Rasika's kernel says some things are gated that are not.**
   - `.claude/agents/rasika.md:100` says the lints in `npm run check` cover reduced-motion stillness, idle rest, the copy rules and the motif tier, so reviewers should not check them by eye.
   - But `rest.check`, `copy-lint` and `motif-lint` are not in the suite (`tools/checks.mjs:89`: "the rest … are run by hand").
   - So reviewers skip what nothing checks.
3. **`--changed` misses checks it should select.** The registry `dependencies` miss 25 item-to-item edges. Confirmed slips:
   - a change to `field.js` does not select `form.check`;
   - `stamp.js` does not select postcard or site-nav;
   - `button.css` does not select tooltip, popover, action-menu or overlays;
   - `folio/md` does not select `proposal.check`.
4. **Yesterday's light rigour waived review in the tier that needs it most.**
   - By `gate-tier.core.js`, palm/maad, bunting/pataka, curtain and `type/layout.around` are **Full**; carrier is Standard.
   - Four Full slices got no first pass, in the tier where 64% of first passes asked for changes.

## Essential: keep, with the evidence

- **Invariant tests on pure cores.** Examples: chai's divergence-free curl, bake's 53,856 in-gamut stops, qr against a reference encoder.
- **`type/boundary.test.js`**, the import boundary on a shared primitive.
- **The mutant guard** (`tools/lib/mutants.test.mjs`): 157 needles, 0 rotted, an allowlist that has not grown. It caught the dead `flow.check` mutant and four rotted faults.
- **`registry --check`.** It is the only thing that catches a stale index, and it caught one twice.
- **Tests of the tools that decide gates:** gate-tier, `changed`/`deps.core`, flakes, shard, text-gate, bake-gate. A bug in any of these quietly weakens every gate.
- **Behavioural checks with planted controls:** focus traps, Escape returning focus, Tab walks, pixel fractions.
- **The runner machinery:** `runCheck` (process-tree kill, timeouts), slots, `engine.mjs` skip accounting, the known-flake verdict, `virtual-time.mjs`. Virtual time made six checks 2 to 4× faster.
- **Instruments with real catches:**
  - `lib/overflow`: the honest-scroll fix;
  - `touch.check`: press states went from 2 of 39 to 40 of 40;
  - the axe helper;
  - `text-gate`: three real bugs;
  - matrix, contact-sheet and review-pack. Many bugs were "found by looking, not by the gates".
- **`perf.mjs`'s paired A/B against paus.** It caught the 1200 vs 1100 px harness mismatch and a real 1.48× cost in carepa.
- **The Full Rasika first pass.** About 24 of 30 must-fix findings came from adversarial probing while the builder's gate was green. It is about 13% of tokens.
- **Real Linux CI.** Its first run found 45 new reds, 2 product bugs and 20 false greens.
- **The shell-guard hook.** It exists because of three `node_modules` wipes.

## Non-essential or ceremony: cut, demote or fix

- **The `diff.mjs` and `tools/baselines` pair is dead.** It has one fixture baseline, nothing invokes it, and it has had no commit since wave 1. It suggests a visual-regression capability the repo does not have.
- **`check-durations.json` is stale.** It predates the hang fixes and is missing 30 of 122 checks, so the CI shards balance on wrong inputs.
- **"Compare every red with `main`"** found 0 new reds in about 50 comparisons. Expiring flake rows replace it.
- **Gate JSON blocks** (dials, `exemplar_verdict`) sit in 33 reviews and 3 ledger entries, and nothing reads them.
- **Three different evidence blocks** (Karigar, Rasika, Kathakar), plus a per-rung `loopcost` block that the 16 October entry skipped.
- **Tautologies and change-detectors in unit tests:**
  - `typeof STRINGS.close === 'string'`;
  - mankurad's "RAIN.length 320";
  - tinto's "17 vignettes";
  - `skill-spec`'s exact skill list.
- **`check-skill-coverage`.** A one-time guard for the SKILL.md reshape; its job is done.
- **About 37 slot-scheduler tests and other harness plumbing in every slice's `npm test`.**
- **Two Playwright tests in the unit layer** (`overflow.test.mjs`, `recipe.browser.test.js`): 33 s, and they take a browser slot.
- **`slots-race.mjs`**, a one-off investigation tool.
- **Running WebKit and Firefox locally at a rung gate.** It takes about 3 hours on a machine that keeps dying (ENOMEM, OOM, terminal crash, Firefox stopping at 21 of 115). CI is the place for it.

## Combine: separate things that should be one

1. **One check harness, not five.**
   - Today: 55 checks use `harness()`, 42 use raw `pickEngine` glue, 14 raw `chromium.launch`, 6 `scene-probe` and 4 `browser.mjs`. 54 start their own server, 59 their own printer, 60 call `process.exit`, and 1 uses `finish()`.
   - One `harness({ scene })` that owns the server, slot, engine, axe, `finish()` and close timeouts. That fixes the Chromium-only gap, the hangs on close, and the 65 checks that never run axe, in one move.
2. **One whole-repo check step in gates.** Registry, cem, skill-inventory, copy-lint, motif-lint, canvas-text-lint, conformance and mutants, each run once.
   - cem runs twice today, and the registry is built twice.
   - copy and motif lint run on the real tree nowhere automatic.
   - Extend copy-lint to `meta.js` and `STRINGS`, and delete the 26 copied "no em dash in meta" tests.
3. **One pixel module.** `lib/pixeldiff` (redmean at 0.02), graduation's `pixelcheck` (RGB sum at 60, so the two rules disagree), `lib/strip`'s frame maths and the lab's `print-check`, merged into one. 39 checks call `getImageData` themselves and none use the libs.
4. **One rigour runner at three scopes.** The slice gate, the rung gate and the rigour day are the same command: `--scope=slice|rung|debt`, writing a machine-readable result.
5. **One debt register.** Ledger "Carried" bullets, run-doc backlogs and request backlogs, kept in one list.
6. **Copy review.** Fold Standard-tier copy into Rasika (who already reads every string). Keep Kathakar for Full slices, Indic text and landing pages.
7. **Conformance should cite `touch.check`'s results**, not prose an author typed.

## Lacking, ranked by risk

1. **No automatic gate anywhere private.**
   - No hook, no CI on `main` or `run/*`.
   - The public snapshot is 147 commits behind.
   - The result of CI run 38299049214 was never recorded.
2. **No finished full suite on a merged head since about 10 October**, and a lot has merged since.
3. **`--changed` misses checks it should select** (above). Also, changes under `tools/fixtures/*` select nothing, and the 7 docs-site checks are outside both the suite and `--changed`.
4. **No smoke tier** between gates (seconds) and the full suite (72 minutes or more).
5. **Nothing for event screens or kiosks:**
   - no soak test, no heap or long-run test, no 4K budgets;
   - nothing at 320 px, no real GPU, no real device.
   - The lab's reel `soak.mjs` is real: heap after GC, DOM nodes, detached documents, p95 drift, a 2-hour pass. It never graduated.
6. **The tier is advisory, and its calibration is off.**
   - `gate-tier` exits 0 by design.
   - Generated files push slices to Standard, and a README in a shared prefix makes a slice Full.
   - `engine` is exempt from the "others import it" rule, while `--changed` treats it as shared.
7. **Perf verdicts under load.** `perf.mjs` records CPU busy but never refuses. It uses 2 rounds × 3 s with no spread, and no check gates frame time (registry budgets are JS bytes only).
8. **The flake budget never expires.** Each of the 7 rows excuses a whole file. About 10 recurring reds are not even listed, so each costs a manual re-run.
9. **No type checking, no coverage, no dead-code lint, and no `npm audit`.**
   - There are 4 high advisories, in dev dependencies only.
   - `tsc --checkJs` on the cores and `node --test --experimental-test-coverage` would be cheap.
10. **Weaker spots:**
    - no accessibility-tree snapshot and no screen-reader pass;
    - contrast of text over a canvas is checked by eye (only 3 checks use `lib/contrast`);
    - no colour-blindness simulation;
    - property tests are hand-rolled sweeps (no shrinking for the geometry cores);
    - no shared "same seed gives the same model" contract across scenes.

## The deferred-debt list (45 items)

**`run/graduation` (`a9f380b`)**
1. The three-engine suite.
2. Rasika: Full on maad, pataka, curtain and `layout.around`; Standard on carrier.
3. Kathakar's pass, including pataka's Konkani and Romi lines.
4. Quiet-machine perf (maad playful at 1.21× paus).
5. `type` budget headroom.
6. The engine→type dependency, which has no decision record.
7. Kantar's church ghost and set overflow, then dropping the 24 KB fork in `curtain/stage.js`.
8. `print-check` onto `pixelcheck`.
9. The docs manifest.
10. The names (owner).
11. The rung's evidence lines.

**`run/postcard` (`a9d2aa5`)**
12. The rung 2 suite.
13. Rasika: Full on the recipe, Standard on the page.
14. The words pass.
15. Five owner defaults.
16. `postcard.check` is not wired into `checks.mjs`.
17. The bare `--engine` flag.
18. `plantFault` content types.
19. WebKit's 1 s first paint.

**Other branches**
20. `batch/kit-c`: unreviewed since 9 October.
21. `batch/bake-walk`: `sg-walk`, unreviewed.
22. `batch/reach`: five shadcn-view commits unmerged.

**`main`**
23. The three-engine suite at `208394f`.
24. Conclave rung 2's exit gate.
25. Re-run alone the Chromium reds (abri, chiro, veranda/arrange, event-card) and Firefox's four, then the Firefox suite to the end.
26. `hero.check` on a quiet machine.
27. The wa-order Send timeout in WebKit.
28. The update-visit stall.
29. Bake rung 1's Rasika review.
30. scene-race findings 4 and 5.
31. The quads "stacked" red at 300% text.
32. The WebKit blur fallback (8 scenes).
33. Eight scenes still use the swallowed `fonts.load`.
34. The 20 Chromium-only checks.
35. saving-footer R3.
36. Firefox-on-Linux `tinto/words`.
37. M1's `<= 2` target.
38. M2's five sibling frame checks.
39. M4's JND threshold and its dither fixture.
40. M5's self-declared spring `kind`.
41. M3's registers, never looked at.
42. CI run 38299049214's result.
43. The public snapshot sync.
44. A native Konkani reader.
45. A legal read of the consent notice.

## Recommended plan, in order

**Phase 0: today, small, on `main`**
- Refresh the registry and `references/`, and make `headers.core.test` stop reading `out/`.
- Correct `rasika.md:100`, or put the lints it names into the suite. The second is better.
- Add a **pre-push hook running `npm run gates`**, so main cannot go red silently a third time.
- Write `docs/DEBT.md` with the 45 items, each with branch, source and date.

**Phase 1: the machinery** (one goal, a run on its own branch)
1. **CI for private branches.** Push each integration branch's export to a CI branch (CI already runs on PRs), or add a private workflow. The 4.2 h local suite becomes about 30 min off the owner's 4 cores. Regenerate `check-durations.json` from that run.
2. **A smoke tier, about 5 minutes.** Every demo and scene in Chromium: loads with no errors, axe, nothing sideways at 390 px. Start from `apps/docs/build.mjs`'s 111-demo verify. Run it at every slice and merge.
3. **Close `--changed`'s gaps.** Derive item dependencies from demo and page imports, or fail the registry build on an undeclared edge. Bring the docs-site checks and `tools/fixtures` into the selection.
4. **One check harness.** Migrate the 20 Chromium-only and 42 raw checks first.
5. **One whole-repo check step in gates;** split `test:unit` from `test:tools`. Per-slice `npm test` drops from about 137 s to about 60–70 s.
6. **`tools/rigour.mjs --scope=slice|rung|debt`**, which reads `DEBT.md` and prints the tiers owed.

**Phase 2: tune the rules**
- **The tier binds**, even under light rigour. Suites can wait; a Full slice's first Rasika pass cannot. `gate-tier --enforce` fails when the ledger lacks the review.
- **Recalibrate gate-tier, with tests:**
  - generated files are neutral;
  - a README in a shared prefix is Light;
  - `gate-tier` and `--changed` agree about the engine.
- **Flake rows expire after 14 days and are per clause, not per file.** Drop "compare every red with main".
- **`perf.mjs` refuses above about 30% CPU busy**, takes at least 4 rounds and prints a spread. review-pack's perf becomes advisory.
- **Cut the ceremony:** gate JSON, the three evidence blocks (merge them into one), the tautology tests, `check-skill-coverage` and `slots-race`. Retire `diff.mjs` and its baselines, or seed per-scene baselines on purpose.

**Phase 3: what the next goal needs (event screens)**
- Graduate the reel's `soak.mjs` into `tools/`, with 1080p and 4K kiosk profiles, a 30-minute rung run, a 2-hour pre-release run, and budgets for memory and frame time.
- Merge the pixel helpers into one module and port `print-check` onto it.
- Replace fixed sleeps with state waits or virtual time, starting with the heaviest 15 checks and the recurring flakes.
- Then, at leisure: `tsc --checkJs` on the cores, report-only coverage, an accessibility-tree snapshot in the harness, contrast sampled over canvas, and `npm audit` in CI.

**Then the rigour day itself** runs on that machinery: graduation, then main, then postcard. It will be about half automatic, instead of a day of babysitting a 4-core machine.
