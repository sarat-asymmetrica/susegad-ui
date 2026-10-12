# Rung M1's count, corrected

*10 October 2026, the math pass close-out. Measured by the Sutradhar on the same machine, on `run/math-pass` at `10815b7` with the working tree's `matka-view.js`. This addendum corrects one number in `karigar-m1.md`; the kernel, the wiring and the clearance it proves are not in question.*

## What the rung's report claims

`docs/reports/karigar-m1.md` reports the baseline at the default pose as three distinct line-break states per turn, and the new wiring as **two**, which it reads as meeting the goal's `<= 2` target.

## What the machine says

The two does not reproduce. Three sets of measurements, all on this branch:

**The kernel, against the view's real relation** (`pot-breaks.core.js` driven by the same harness as `pot-breaks.test.js`: `surfacePoints`, `flowShape`, `extentIn`, the paragraph's own measured widths, `hq = 78`, `px = 14.4`):

- with the paragraph's measured space term: **3** states, 6 critical angles;
- with the space term left at zero: **5** states, 40 critical angles;
- the band count (6, 12 or 24 bands) does not change either number.

**The live page** (Chromium, `words.html?register=warm`, reading the view's own `breakStatesPerTurn` and the line-break patterns off the spans at held poses): **4** states, 10 critical angles, and the same 4 patterns actually laid. The playful register agrees; the quiet register builds no map at all (it lays nothing), as it should.

So the honest count is 3 to 5 depending on the metrics and the pose, and 4 at the default pose in the live page. **The goal's `<= 2` target is not met.** The goal allows exactly this outcome in writing ("target: `<= 2`, or a written finding if the data says otherwise").

## What the rung does buy, measured

Both wirings, same page, 23 s of the pot's own turn (about two turns), reading `matka.stats.lays`, the distinct quantised steps and the distinct reader-visible patterns:

- **landed** (critical-angle steps): 20 layout runs, 10 distinct steps, 4 distinct patterns;
- **before the rung** (a fixed 1/16 step): 32 layout runs, 16 distinct steps, 4 distinct patterns.

The turn therefore re-lays 16 times before and about 10 after, a third fewer, and every re-lay now sits exactly where a break decision flips. That last part is the real gain: a pattern can no longer be stale across a flip, which the 1/16 grid could not promise. The reader-visible pattern count is 4 either way, because it is a property of the pot's silhouette and the paragraph's width, not of the wiring.

## Why the reported two was probably reached

An inference, marked as one: the report's own table gives 3 for the fine 720-sample truth at the default pose and says other sizes gave 1 to 5. A count of 2 is consistent with a wider column or a shorter paragraph than this page lands on, not with the default pose. It was not a measurement of 2 at the default pose, whatever produced it.

## The finding

1. Rung M1's exit gate closes on a **written finding**, not on its number: the target is missed (4 at the default pose, 3 to 5 across the range), while the thing the rung exists to give holds (the layout re-runs only where a break decision flips, and the corridor keeps its proven clearance).
2. If the `<= 2` number still matters to the owner, the only lever is geometry: a wider column or a shorter paragraph changes the flip count. The wiring cannot reduce the number of distinct patterns the silhouette produces; it can only stop re-laying where nothing flips, which it now does.
3. The gate asserts what is true and can fail: `flow.check.mjs` clause 6 requires the flip map to exist and the turn to re-lay at most once per critical angle over a full turn, and it goes red against the old 1/16 wiring.
4. A caution for the gate's future: **the count alone is a poor gate.** A constant-width corridor stub reports one state and sails past a `<= 2` bar while destroying the clearance the rung exists to give (measured: the stub reports 1 state and lays 1 pattern). The clearance clause is the tooth; the count is the record.

## How to reproduce

The three probes were scratch scripts under `.tmp/`, and they were removed after the run so the tree stops clean; what they printed is quoted above and in the ledger entry for this close-out. The permanent form of the same measurement is the gate clause 6 below, which reads the same numbers off the live page on every run of `flow.check.mjs`:

```text
node packages/scenes/veranda/flow.check.mjs      clause 6 reads the map's states, its critical
                                                 angles, and the re-lays a driven turn costs
```

The kernel-side count (3 states with the paragraph's measured space term, 5 with it at zero) is the last test in `packages/scenes/veranda/pot-breaks.test.js`.
