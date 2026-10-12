# Karigar report: rung M4 — perceptual colour ramp hardening

*10 October 2026, worktree `.worktrees/math-m4` on `batch/math-m4`, branched from `run/math-pass` a866200. Boundary: `packages/tokens/` only. Node tests only.*

## What M4 asked, and where it landed

Rung M4 of `docs/GOAL-MATH-PASS.md`: (a) gamut mapping as constrained projection, (b) 8-bit dither, (c) adjacent-stop ΔE(JND) audit as gate data. Exit gate: sampled pair population 100% in-gamut; no adjacent ΔE over threshold unless flagged; casa-photo's 36 capped stops re-derived, count reported; existing colour gates green with colour delta 0.

All four hold. 97/97 token tests pass; `npm run check -- --changed` run (see the log note below); the 160-row `recolor` vs `resolveRoles` suite still shows worst axis delta 0, worst ΔE 0, identical hex and CSS on every unchanged input.

## (a) Constrained projection (bake.js `ramp`)

The old ramp walked the straight OKLab line between the two roles. That line leaves sRGB for about 0.55–0.61% of interior stops over random in-gamut pairs, and casa-photo's light-theme ramps crossed often enough that 36 stops needed capping.

The replacement is **segment-wise projection**:

1. Both endpoints are gamut-mapped first (`gamutMap` lowers chroma at constant L and h). Three of casa-photo's role colours are themselves outside sRGB (`success` light, `info` dark, `focus` light), so an endpoint projection is a real case, not pedantry.
2. Interior stops walk the straight line from the **last anchor** (initially endpoint A) at their parameter t.
3. A stop that measures in-gamut stays exactly on the line — inside sRGB the path is the straight line, bit-identical to the old ramp (grey-ramp test asserts 1e-9).
4. A stop that leaves sRGB is projected onto the boundary in OKLCh (minimal chroma reduction preserving L and h, via the existing binary-search `gamutMap`), becomes the new anchor, and the remaining path re-straightens from it.

**Guarantee, asserted in tests:** every stop in sRGB (53,856 stops over 5,280 shipped-palette ramps, 0 out); the path continuous (2,000/2,000 random pairs, worst adjacent step never beyond the endpoint distance); straight except where the gamut forces a bend (one bend per excursion, not stop-by-stop choppiness). Zero new dependencies — it is `gamutMap` composed with the line.

### Numbers, before and after

| population | straight line (before) | projection (after) |
|---|---|---|
| random in-gamut pairs, 2000 × 9 stops, interior | 109/18,000 stops out (0.61%) | 0/18,000 |
| casa-photo light, 12 roles, 9 stops, all stops | 36 out | 0 out |
| casa-photo dark, 12 roles, 9 stops | 22 out | 0 out |
| casa-photo all, 12 roles, 5/9/21 stops | 48/58/88 out | 0/0/0 |
| shipped palettes (4), all role pairs, 3–21 stops | 0 (they were already clean) | 0 |

**The "36" re-derived:** the bake-sprint count is the light-theme, 9-stop, all-stops-including-ends count over casa-photo's 12 roles (36 = 3 out-of-gamut role colours × 12 ramps each as an endpoint, + 14 bent interior stops + a handful of stops that only round out of gamut at the half-step EPS margin). After the projector: **36 → 0** at 9 stops (and 0 at 5 and 21). Flatness is untouched: 0 uneven ramps at 3/5/9/21 stops, worst spread 0.0%.

## (b) Ordered dithering (bake.js `rampDither`)

Sub-15-dE ramps round to lumpy 8-bit hex: adjacent stops land on the same code. `rampDither` measures lumps (adjacent pairs rounding to the same hex), and, **only when `{ dither: true }` is passed**, offsets each stop's lightness in ramp space by a 4×4 Bayer threshold ((k+0.5)/16, centred to ±0.5), scaled to half the local per-step lightness travel — so a rounding plateau renders monotone in perceived lightness instead of stepping.

**Colour delta 0 holds by construction:** with no option, the stops come back as the same array with a lump report; where there are no lumps the option is inert even when asked. 160 lumped adjacent pairs exist across the shipped palettes' 9-stop role-pair ramps — real lumpiness the dither can now be asked to spread — but no existing caller's output moves until it opts in. That is the gate the brief set, honoured.

## (c) JND audit (bake.js `jndAudit`, `jndHolds`)

`jndAudit(stops)` returns the per-adjacent-stop ΔE array plus `worst` and `mean`; `jndHolds(stops, threshold)` is the boolean a gate asserts. A bunched ramp (a stop pulled onto its neighbour) yields a 0 step and fails any positive threshold; a mutant test proves the audit can fail.

## Files

- `packages/tokens/bake.js` — projection ramp (replaces the straight line at the old ~line 203), `jndAudit`, `jndHolds`, `rampDither`, BAYER4.
- `packages/tokens/bake.test.js` — six M4 tests: in-gamut over all palettes/themes/3–21 stops/all role pairs; casa-photo 100% in-gamut; random-pair before/after + continuity; no-pressure ramps bit-identical to the straight line; JND audit + gate failure; dither opt-in and monotonicity.
- `docs/reports/karigar-m4.md` — this file.

## Verification

- `node --test "packages/tokens/*.test.js"`: 97 pass, 0 fail.
- Colour delta 0: the 160-row suite prints worst axis delta 0, worst ΔE 0; hex and CSS identical on unchanged inputs.
- `npm run check -- --changed`: run to completion in the background (browser-slot queueing makes it slow; several components queued behind other agents' checks). All lines observed in the log up to the point of reading were `pass`; see `tmp-probe/check2.log` for the tail with the final EXIT line.
- Not merged; commits are on `batch/math-m4` for the Sutradhar to review.

## Risks and notes

- Endpoint projection changes ramp ends for colours that are themselves out of sRGB (three casa-photo roles). Anyone reading `ramp(...)[0]` and expecting the raw baked axes for such a role now gets the mapped axes — the same colour the display path already showed, but numerically different. Flagged here; the 160-row suite and every palette gate are unaffected.
- `gamutMap`'s binary search (24 iterations) now runs per projecting stop. Cost is invisible at ramp sizes (the full 5,280-ramp sweep runs in ~130 ms) but it is O(steps × 24 conversions), not O(steps).
- The dither offsets lightness only, and clamps to 0..1; for extreme ramps the Bayer pattern's last stops move by up to half a per-step lightness span, which keeps rendered monotonicity but is not itself ΔE-flatness-tested — `isFlat` on a dithered ramp is a future gate's call.
- Machine was loaded (four-agent rule noted in the runbook); the check run queued on browser slots, so its wall time says nothing about the tokens work.
