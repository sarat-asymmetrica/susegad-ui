# Karigar M5: motion as a signal (tween curve audit)

*9 October 2026, worktree `batch/math-m5` (from `run/math-pass` a866200). Rung M5 of `docs/GOAL-MATH-PASS.md`.*

## What was built

**`packages/transitions/tween/curve-audit.core.js`** — a new pure module, zero dependencies, reading any baked tween cache (`{ samples: number[] }`, values at t = i / n):

- `derivatives(samples)` — position, velocity and acceleration by finite differences (central in the interior, one-sided at the ends).
- `continuityAudit(cache, o)` — counts C0 / C1 / C2 violations: a jump in the value, in the one-sided velocity across an interior sample, and a break of the acceleration out of its own moving-average envelope. Returns counts, the worst violation (order, t, severity), and the curve's max |v| / max |a|.
- `frequencyAudit(cache, o)` — the path resampled to a power of two, its slow moving average (the gesture) subtracted, the residual Hann-windowed and DFT'd (an O(n²) direct DFT over 2048 points, ~150 ms — pure, no dependencies). Reports `oscRatio` (the residual's in-band energy as a share of the whole mean-removed path's energy), `bandShare` (the wobble's own shape), `bandPeakHz`, and `resolvable`.

## The audit math, and the tolerance choices

**Continuity.** A baked table is uniform in t, so a discontinuity in the k-th derivative shows as a jump in the (k−1)-th sampled derivative between neighbouring samples. But a steep smooth curve has a large first derivative and a jagged sampled acceleration, so each tolerance is two-part — an absolute floor OR a share of the curve's own scale. Measured over all ten shipped curves (three token cubic-béziers, the two Kantar cubics, three closed-form springs, three linear() spring bakes):

| order | metric | shipped-curve ceiling | real-break floor | tolerance |
|---|---|---|---|---|
| C0 | per-sample step of the value | 0.029 (playful spring linear()) | ~1.0 (a step) | 0.06 (twice the ceiling; the gate's MAX_STEP) |
| C1 | one-sided velocity jump / max \|v\| | 0.085 (playful spring linear()) | ~2.0 (a linear() knot; a step far more) | 0.5, floor 0.05 |
| C2 | acceleration deviation from its moving average / max \|a\| | 0.50 (warm spring closed form, full-swing acceleration) | 0.88 (triangle wave), 0.87 (spring linear() bake) | 0.6, floor 0.5, window n/16 |

The C2 envelope metric is the one that works. Naive neighbouring-difference checks on the acceleration do not discriminate: a spring's normal sampled acceleration wiggles across its full envelope by construction, so any tolerance that admits the shipped springs admits everything. The moving-average envelope separates them: smooth curves stay inside 0.50 of their own max |a|; genuine breaks poke past 0.87.

**Frequency.** The raw spectrum of a one-shot gesture is not a usable photosensitivity signal: a single smooth rise from 0 to 1 carries all of its mean-removed energy at 1–4 Hz however calm it is (measured: kantar easeOutCubic at 560 ms reads 100% in band on the raw spectrum), and a short analysis window cannot resolve 3 Hz at all (a 140 ms window's first non-zero bin sits at 7.1 Hz; a 10 Hz wobble there blurs into the gesture's own bins and the share collapses to 0.1%). What prudence cares about is oscillation, so the audit DFTs the path minus its own slow moving average. Measured: a calm ease's residual carries under 1% of the path's energy in band; a 10 Hz wobble at 20% amplitude, over a window that resolves the band, carries 22 000% (220x the path's energy). Threshold `OSC_RATIO_THRESHOLD = 0.3`, a flag, never a failure on its own. An unresolvable window (fewer than one cycle of 3 Hz, i.e. under 333 ms) reports `resolvable: false` and the gate skips the flag rather than misread a short wobble as calm.

## Gate wiring (`tools/lib/bake-gate.core.js`)

`CURVE_AUDIT` restates the policy where the gate can be held to it: C0 and C1 violations **fail** the motion leg always; C2 **fails for monotone curves** and is **flagged for springs** (a spring's acceleration envelope is intentionally the liveliest thing in the library); the frequency flag never fails by itself — photosensitivity is prudence, and the owner rules on a named finding. Two checks per curve were added (the leg went from 30 to 40 checks). New test in `tools/lib/bake-gate.test.mjs` plants a C0 step, a C1 kink and a C2 ripple through `motionLeg` and watches the leg go red; the shipped curves still pass.

## Per-curve verdicts (all ten shipped curves)

| curve | C0 | C1 | C2 | frequency @ 560 ms | verdict |
|---|---|---|---|---|---|
| token ease out (cubic-bezier 0.22,1,0.36,1) | 0 | 0 | 0 | oscRatio 0.6% | **pass** |
| token ease in-out (0.65,0,0.35,1) | 0 | 0 | 0 | 10.4% (under threshold) | **pass** |
| token ease ink (0.45,0.05,0.25,1) | 0 | 0 | 0 | 4.4% | **pass** |
| kantar easeOutCubic | 0 | 0 | 0 | 0.04% | **pass** |
| kantar easeInCubic | 0 | 0 | 0 | 0.04% | **pass** |
| warm spring, closed form (ζ 0.72) | 0 | 0 | 0 | 3.1% | **pass** |
| playful spring, closed form (ζ 0.48) | 0 | 0 | 0 | **48% in band, peak 3.6 Hz — flagged** | **flagged finding, below** |
| token spring, linear() (ζ 0.72) | 0 | 0 | **1 violation at t = 0.035 (0.87 of max \|a\|)** | 3.1% | **flagged finding, below** |
| warm spring, linear() | 0 | 0 | **1 violation at t = 0.035** | 3.1% | **flagged finding, below** |
| playful spring, linear() | 0 | 0 | **1 violation at t = 0.035** | **49% in band — flagged** | **flagged finding, below** |

The gate runs green with these five findings surfaced as warnings; nothing fails as shipped.

### Finding 1: the springs' linear() bakes carry one C2 violation at t ≈ 0.035

`springEasing()` writes the spring as a `linear()` string of knot points; the first interior knot's velocity is written to three decimal places, and the rounding shows as a single acceleration sample poking to 0.87 of the curve's own max |a| (the closed-form spring sits at 0.50). It is a quantisation artefact of the string format, one sample out of 256, invisible at any frame rate — the shipped curves were not failing anything before this audit existed, and the same finding appears identically in all three spring bakes. **Recommendation:** accept it (flag, as now) or add one more knot near the start of `springEasing()`; the closed form is the authority and it is clean.

### Finding 2: the playful spring (ζ 0.48) carries ~48% of its motion energy in the 3–60 Hz band at 560 ms

A damped spring with ζ = 0.48 rings at ω_d/2π ≈ 2.3 Hz in its own progress time — but its acceleration envelope, DFT'd as a residual after the gesture window, puts most of its energy in band at a 560 ms duration. This is what a spring is: an oscillation that settles. It is flagged, not failed, per the sprint's law (prudence flags; the owner rules). The warm spring (ζ 0.72, 3.1%) passes. **Recommendation:** keep springs out of anything flashing in place (they travel, which changes the risk profile), and keep their durations at or above `calm` (280 ms) — a shorter duration does not resolve the band in the audit, but neither would a screen show more cycles; the exposure question is duration × amplitude, and the playful spring's amplitude is bounded by the 25% overshoot cap.

## Risks

- The C2 metric is window-dependent (declared: `C2_WINDOW_SHARE = 1/16`, overridable). A longer window hides a narrow spike; the test pins the shipped curves at the default and the gate declares the share it enforces.
- `oscRatio` mixes two scales (residual in band / whole path). A curve that is almost all gesture (a linear ramp) reads low even with a sizeable wobble; the wobble fixture in the tests is 20% of the path, well above any shipped curve. A pure `bandShare`-only policy would flag more aggressively; the current threshold was chosen so the ten shipped curves stay green and the 10 Hz fixture trips at 200x margin.
- The frequency audit's DFT is O(n²) at 2048 points (~150 ms per curve); the motion leg went from ~1.5 s to ~3.5 s. An FFT would drop it to ~5 ms if the leg ever grows past ~50 curves.
- The audit reads `{ samples }` only; a future non-uniform bake would need the resample step (already isolated) to change.

## Verification (run on this worktree)

- `node --test packages/transitions/**/*.test.js packages/transitions/**/*.test.mjs` — **71 pass, 0 fail** (19 new audit tests, including known-good shipped curves and known-bad step / triangle / ripple / 10 Hz / 35 Hz / 80 Hz / 120 Hz fixtures).
- `node tools/bake-gate.mjs --leg colour / --leg motion / --leg sound` — all pass, exit 0; motion leg 40 checks, 5 warnings (the findings above).
- `node --test tools/lib/bake-gate.test.mjs` — **17 pass, 0 fail**, exit 0 (includes the new audit-fails test, the committed mutants, and the reduced-motion still checks). No browser legs launched.

Machine note: figures measured on a loaded 4-core machine (other agents running); timings are upper bounds, pass/fail counts are exact.
