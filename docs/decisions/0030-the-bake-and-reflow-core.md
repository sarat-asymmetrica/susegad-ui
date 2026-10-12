# 0030: the bake-and-reflow core

*Sutradhar for the owner, 8 October 2026. Follows decision 0029 (Pretext is a
measurement oracle) and generalises it. Stands on two surveys:
`docs/research/2026-10-08-bake-and-reflow.md` and
`docs/research/2026-10-08-ui-trends-and-awwwards.md`.*

## The departure

Decision 0029 put Pretext behind an injectable boundary for *text*. This decision
generalises that boundary to every surface that has an expensive,
environment-dependent fact to read once and then recompute by arithmetic. The
name of the abstraction is the **bake-and-reflow core**:

> A surface supplies a `bake(input)` that does its own expensive work once and
> emits an opaque cache; everything downstream is arithmetic over that cache.

## What it is, in one line

The prepare/layout split is not a text idea. Yoga's `measureFunc` — the layout
core of React Native — is the canonical, decade-old form of precisely this
pattern: an injectable measure callback, cached by the engine, with a
pure-arithmetic hot path over the cache. Decision 0029 correctly rediscovers it
for text. This decision names it once, for the whole library.

## Bounds

- The split applies to six surfaces. Two are true *measurement* problems (they
  need an oracle), four are *compute-cache* (no oracle, same shape):

  | Surface | bake (once) | reflow (arithmetic) |
  |---|---|---|
  | text | segment + `measureText` widths (oracle: font engine) | line breaks |
  | image | intrinsic dims, early (oracle: decoder) | flow / boxes / rects |
  | color | OKLCH axes baked once | register / dark / theme recomposition |
  | motion | keyframe curve + springs once | per-frame tween |
  | sound | FFT bins once | visual intensity per frame |
  | geometry | measure-func per leaf, cached | flexbox arithmetic |

- The **boundary rule from 0029 carries over and widens**: `core`, `engine`, and
  `components` import the *pure reflow* halves and never the *oracle* halves.
  The oracle is per-surface and gated (live tier only), exactly as three.js and
  Pretext already are.
- Nothing here mandates porting Yoga, Curtains.js, or Rive. The core is a
  *contract*, not a dependency. A surface's `bake` may be a thin wrapper over a
  vendored oracle (Pretext today; Yoga *if* a full flexbox tier is ever justified)
  or entirely internal (color, motion, sound need no oracle at all).

## The cost

- One more named concept for contributors to hold: "bake and reflow" joins
  "oracle boundary" (0029) and "tier" (0017) as the three load-bearing words.
- The color/motion/sound surfaces already exist as `tokens`, `transitions`, and
  `sound`; adopting the contract means documenting their existing
  prepare-then-arithmetic shape, not rewriting them. The first true *new* work is
  the image surface (decision 0029, if taken).

## Why this shape

The trend sweep found the award world converging on Susegad's thesis — restraint,
accessibility, reduced-motion — while the ecosystem races toward "flat geometry,
faster." The bake-and-reflow core is what lets Susegad hold *both*: the same
prepared cache that serves a rich live tier is the thing that makes a **CI gate
run headless** (no browser, no oracle, pure arithmetic). That single property
— a prepared cache is CI-runnable by construction — is the moat, and it is the
reason to name the pattern rather than leave it implicit in three packages.

## Decisions already consulted

- 0017 — the three.js tier (lazy, never in core).
- 0019 — Pretext vendored.
- 0029 — Pretext is a measurement oracle behind an injectable boundary; this
  decision widens "text" to "surface".