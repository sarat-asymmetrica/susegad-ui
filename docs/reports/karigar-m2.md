# Karigar M2: sampling schedules adopted in Tinto's words check

*10 October 2026. Rung M2 of `docs/GOAL-MATH-PASS.md`, the adoption half. Worktree `.worktrees/math-m2`, branch `batch/math-m2`, from the kernel commit `987137b`. Boundary: `packages/scenes/tinto/` and this report.*

## What was adopted

The kernel `tools/lib/frame-schedule.mjs` is unchanged. It already proves `requiredSamples`, `samplePhases` and the declaration guard in `tools/lib/frame-schedule.test.mjs`, and those tests still pass (8 of 8).

The only file changed is `packages/scenes/tinto/words.check.mjs`. Section 6, "calm follows the lines", used to freeze the scene at two ad hoc times (`frozenAt(4)` and `frozenAt(7)`) and compare the canvas under the words. That is the one frame sampling the rung asks to replace. It now:

1. Declares the duty cycle `p` and miss probability `δ` of the defect it samples for.
2. Computes `n = requiredSamples(p, δ)` and calls `assertDeclaration(...)`, so an under-declared count throws instead of passing quietly.
3. Builds `samplePhases(n, period, { seed })` over the scene's real animation period.
4. Freezes at every phase and takes the largest change in each region between neighbouring phases: under the line boxes, beside them (the gaps in the lines' own rectangle), and the square below.
5. Keeps both broken controls: rain that ignores the line boxes, and a whole-rectangle calm. Both are still caught.

The declaration is printed in every section 6 line's detail, so the claim is visible in the run output.

Note on paths: the goal cites the file as `tinto.words.check.mjs`, but the real path is `packages/scenes/tinto/words.check.mjs`. This report uses the real path.

## The declared values

| Value | Chosen | Why |
|---|---|---|
| period | 7.81 s | The sampled animation is the chalk rain. A drop falls the slate's height (`BOARD.h` less the frame twice, less 8: 142 units) at a speed from the renderer's seeded range `[18, 30]` a second, so one drop's cycle is between `142/30 ≈ 4.74 s` and `142/18 ≈ 7.81 s`. The speeds all differ, so the rain is quasi-periodic; the schedule runs over one full cycle of the slowest drop, which contains at least one full cycle of every drop. |
| seed | `'tinto-calm'` | A string seed for `samplePhases`, so the phases are reproducible frame for frame. |
| p | 0.2 | The defect is chalk rain drawn over a line box. A drop's suppression box (4 wide, up to 12 tall) overlaps a line box (18 px body, 26 px heading) over a vertical window of up to `26 + 12 + 2 = 40` units, which at the slowest speed lasts about `40/18 ≈ 2.2 s`, `p ≈ 2.2/7.81 ≈ 0.28`; the briefest crossing, a 6-unit drop over a body line at the fastest speed, is `26/30 ≈ 0.87 s`, `p ≈ 0.11`. We declare a defect visible for at least a fifth of a cycle. |
| δ | 0.05 | One miss in twenty runs is acceptable for a gate that runs once per rung. |
| n | 14 | `requiredSamples(0.2, 0.05) = ceil(log(0.05) / log(0.8)) = 14`. |

The phases for `seed 'tinto-calm'` are 0.213, 0.684, 1.551, 2.060, 2.483, 2.842, 3.628, 4.193, 4.535, 5.141, 5.830, 6.426, 7.220, 7.415 seconds. All fall inside `[0, 7.81)`.

The kernel's own test used `p = 35/60` and period 60 as an illustration ("the tinto bug"). That number is not derived from this scene, so it was not adopted. The period and p here are read from the rain's own geometry.

## The check's result

Command: `node packages/scenes/tinto/words.check.mjs` (Chromium, via `tools/lib/slots.mjs`; the machine was under load, two other checks held slots, so the run queued first). The frozen harness clock makes every frame deterministic, so load does not move the pixel numbers.

Result: all 41 checks pass.

Section 6 lines:

- calm: under the words 0.20%, beside them 3.72%, the square 6.3% over 14 phases of 7.81 s (tinto calm: 14 samples meet the declaration p=0.2, δ=0.05 (needs 14)). Pass.
- calm follows the lines: same detail. Pass.
- control, rain that ignores the line boxes: under the words 10.56%, beside them 13.73%, the square 6.3%. Caught.
- control, a whole-rectangle calm: under the words 0.00%, beside them 0.00%, the square 6.3%. Caught.

The kernel tests: `node --test tools/lib/frame-schedule.test.mjs`, 8 of 8 pass.

The slice gate `npm run gates`: 2544 tests pass; `registry/registry.json` up to date (138 items); `custom-elements.json` up to date (64 elements); `references/` up to date. No warnings introduced by this change.

## The covered-words outcome

Not present. The calm zones hold.

A separate sweep, run before the change to size the problem, froze the scene at 17 phases from 0 to 8 s in half-second steps and measured the share of pixels under the line boxes that changed against the first phase. The largest was 0.135% (at 4.5 s); most phases were 0.000%. Under the declared schedule (14 phases, neighbouring pairs) the largest is 0.20%, far under the 1% threshold. The rain is drawn only in the gaps: `chalkRain` skips any drop whose box overlaps a calm rect, and the calm rects are the line boxes padded by 2, so no drawn drop reaches a line box. The defect the rung names is fixed by the calm zones, not hidden by the sampling.

The broken control shows what the same probe does when the calm is removed: 10.56% of the pixels under the words change across the schedule. The probe can see the defect.

## Risks and findings

- The period 7.81 s is a constant read from the renderer's seeded rain, not derived at run time. If the rain's speed range or the slate's height changes, this constant goes stale. A future slice could import the engine's `rng` and compute it from `BOARD` in the check, at the cost of coupling the check to the renderer's internals.
- The declaration defends against a defect visible for at least a fifth of a cycle. A defect briefer than that (the fastest drop crossing a body line, `p ≈ 0.11`) could be missed with probability up to `(1 − 0.11)^14 ≈ 0.20`. Declaring `p = 0.11` would need 24 phases; the cost was judged not worth it, and the honest bound is written here.
- The schedule samples one animation, the rain. The people elsewhere in the square move on their own clocks; they are covered by the "square" region only as a motion control, not by the declaration.
- The controls sample the full schedule too, so section 6 opens 42 frozen pages (3 builds by 14 phases). That is the bulk of the check's cost. It ran to completion inside the suite.
- Not run: `npm run check` in WebKit and Firefox (the rung's whole-suite gate belongs to the Sutradhar on the merged integration branch; this slice ran the one check in Chromium). The change is to a check file only, no runtime code, so engine behaviour of the scene is untouched.

## Files

- `packages/scenes/tinto/words.check.mjs`: section 6 rewritten to the declared schedule, plus one import. 45 insertions, 12 deletions.
- `docs/reports/karigar-m2.md`: this report.
