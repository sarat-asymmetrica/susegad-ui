# Trial: the new Standard gate on mithagar

*3 October 2026, rung D1 of the lighter gate (docs/requests/2026-10-02-lighter-gate.md,
§6: measure it). Run by the D1 karigar in .worktrees/atelier-lighter-gate at commit
ac7dfbf. The reviewer here is the karigar itself, reading the pack it gathered; the
timings are real wall-clock (IST) and say so where the reader is a model, not a person.*

## The command and the gate lines

    node packages/cli/bin/susegad.mjs check scene-mithagar

The piece's own tier, as gate-tier.core.js classifies its diff path:

    {"tier":"standard","reasons":["standard: packages/scenes/mithagar/render.js is a rendering file of scene-mithagar"]}

(The branch as a whole classifies Full, because its diff touches apps/docs/index.html,
the front door. That is the branch's tier, not mithagar's.)

## What the run printed (abridged)

    Tier: full, 279 changed file(s) against main.     (the branch's own tier)
    Lint ok: the motif tier.
    Lint ok: text on a canvas.
    Lint ok: the copy rules.

    Pack at .shots\pack\mithagar/
    Open the contact sheet and look at it before you open a PR.

    Everything green. Look at the contact sheet before you open a PR.

## The pack (.shots/pack/mithagar/)

- matrix: 15 cells, 0 failed; one picture, mithagar-sheet.png
- warm strip with facts: no frozen spans, no jumps
- axe: 6 register/theme runs, no violations
- perf: 0.99x mean ratio to Paus, within budget (p95 1.006), CPU busy 45%, SwiftShader
- tests: pass
- commit of the run: ac7dfbf7e2ff

## What the look found

- The contact sheet: all 15 cells read clean, every cell's verdict `ok`; the reduced-motion
  cells are finished stills; no sideways scroll, no errors.
- The warm strip: motion honest and continuous, change share steady at 8.7 to 8.9 percent
  a frame across the whole 8 s window, no freeze, no jump. The strip window shows no rest
  because the scene's show is longer than the strip; the idle rest (zero changed pixels,
  two moments 3 s apart, after the declared settle) is checked by tools/rest.check.mjs,
  green on the fixture that honours it and red-proven on the one that does not.
- A note for the next Rasika pass: run the idle-rest read on mithagar itself once a
  per-scene runner exists (the fixture-scene runner is what D1 built; extending it to
  every scene is the natural next slice).

## Per-phase timings (the review's own ledger, §6)

| phase | start | end | spent | note |
|---|---|---|---|---|
| gather | 19:36:01 | 19:36:51 | 50 s | `susegad check scene-mithagar`: gate-tier + 3 lints + the whole pack, one command, unattended (matrix 16 s, strip 11 s, axe 4 s, perf 16 s, tests 0.3 s) |
| look | 19:38:20 | 19:40:10 | 2 min | two pictures read: the 15-cell contact sheet and the warm strip |
| find | 19:40:10 | 19:41:00 | 1 min | one note (the idle-rest read on mithagar itself), no findings |
| write | 19:41:00 | 19:41:40 | 1 min | this file |

Total reviewer time: about 4 and a half minutes, against the Standard target of 15.
Gathering, once, was 50 seconds; looking was two pictures.

The honest caveat: the reader of the two pictures was a model reading pixels
(vision_analyze), not a human eye. The timings hold for the shape of the work; a human
reviewer's look may be slower and truer.
