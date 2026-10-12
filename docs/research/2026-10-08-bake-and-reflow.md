# The bake-and-reflow pattern, beyond text

*Sutradhar for the owner, 8 October 2026. Follows two earlier artifacts in the
same run: `2026-10-08-pretext-ecosystem.md` (the Pretext survey) and
`2026-10-08-ui-trends-and-awwwards.md` (the trend sweep). This one generalises
the question: does the prepare/layout split control anything besides text?*

## TL;DR

The prepare/layout split is not a text idea. It is a **general pattern with a
canonical prior art**: Yoga's `measureFunc`. The split generalises to every
surface that has an expensive, environment-dependent fact to read once and then
recompute by arithmetic. The two-part answer:

- **The split (bake once, reflow by arithmetic) — generalises fully.**
- **The oracle (what you actually "measure") — is per-surface.** Text measures
  the font engine; images measure the decoder; color does *not* measure at all,
  it *computes* a perceptual transform once and then interpolates by arithmetic.

## The canonical prior art: Yoga's `YGMeasureFunc`

The oldest, most battle-tested form of exactly this pattern is Facebook's Yoga
(flexbox engine, the layout core of React Native). Its design is the definitive
statement:

- Leaf nodes that hold opaque content (text, images, video frames) cannot state
  their own size from flex properties. Instead the host attaches a
  **measure function** to the node — `YGNodeSetMeasureFunc(node, func)`.
- Yoga calls that function only when it needs the leaf's preferred size, passing
  constraint modes: `YGMeasureModeUndefined` (no constraint), `AtMost` (up to),
  `Exactly` (must be this).
- Yoga **caches the measurement** keyed by `(width, widthMode, height,
  heightMode)` so a repeated compatible constraint never re-invokes the
  callback. Everything else in the layout pass is pure flexbox arithmetic.

This is byte-for-byte the architecture decision 0029 proposes for `measure.js` in
Susegad: an *injectable measure callback*, cached by the engine, with the hot
path as pure arithmetic. The discovery is honest and useful: decision 0029 is
not novel — it correctly rediscovers a ~decade-old prior art, which is *why* the
shape is right. (DeepWiki confirms Yoga's measure-func is "a first-class
extension point"; Ink and OpenClaude use the same `measureTextNode` against Yoga
for terminals, handling grapheme clusters and CJK width inline.)

## The image cousin: preimage (somnai-dreams)

The cleanest second proof that the split generalises. `somnai-dreams/preimage`
implements the exact pretext shape for images — and its own credits say so:

> "The two-phase prepare/layout split, the opaque prepared handle, and the
> cursor-driven streaming API are all pretext's design — preimage just follows
> its shape for the image side."

What it adds is the *oracle* swap. For images the expensive fact is the intrinsic
dimensions, and there are several ways to get it: `prepare(url)` (warmed `<img>`),
`dimsOnly: true` (Range-request probe, abort the transfer), `probeImageBytes` for
blobs, `recordKnownMeasurement` for dimensions that come from HTML attrs / CMS /
manifests, and `buildManifest` for build-time dimension manifests. Layout then
paints correct boxes before the bytes finish decoding. It also ships the split as
a composable layer: `PrepareQueue` (concurrency cap + `boost()` for
just-scrolled-into-view), `DecodePool` (off-main-thread decode), and adapters
(`flowColumnWithFloats`, `inlineImage`) that feed pretext's cursor loop directly.

Its caveats are the honest cost of owning the oracle: a word-joiner sentinel that
measures 0px in most fonts (but not guaranteed), EXIF orientation handling,
SVG-without-intrinsic-size returning `(0,0)`.

## The full-extreme: textura and geometra

- **textura** (Razroo) — Yoga WASM + Pretext = a DOM-free layout engine;
  `computeLayout(tree, { width })` → nested `{x, y, width, height}`. Also ships an
  **MCP server** giving an AI coding agent "layout vision" (`compute_layout`,
  `analyze_layout`, `validate_responsive`, `fix_layout`).
- **geometra** (Agent-Pattern-Labs) — the endpoint of the idea: layout computed
  server-side (Yoga WASM + Pretext), streamed as flat `{x, y, width, height}` JSON
  with **geometry diffs** (only changed rects), a thin client that just paints.
  It explicitly frames itself as replacing the browser render pipeline.

Both confirm the trajectory: once the measure step is hoisted behind a boundary,
the *layout* becomes a service — runnable headless, in CI, or server-side. That is
the strategic wedge decision 0029 already named for Susegad.

## Color: compute-cache, not measure

Color needs **no oracle** — sRGB→OKLCH→gamut is deterministic math, nothing the
browser knows and you don't. But it shares the *structure*. The evidence:

- **ColorAide** benchmark: gamut-mapping 250,000 colors; the cubic method is
  already fast (~4.4s), and enabling its **cache** pulls it further ahead
  (~3.0s). The bake-then-arithmetic win is real even where there is no DOM at all.
- **oklch-terminal-themes** (William Zujkowski) is the closest thing to a
  "pretext for color" in the wild: 545 terminal themes converted to OKLCH, then
  *derived* tokens (muted text, borders, accent, accent-hover) are produced by
  mixing foreground/background in OKLCH space with shortest-arc hue
  interpolation, every derived token gated against floors at build time. The
  author's own line is the thesis: "not that OKLCH computes contrast for you...
  but that colors nobody hand-picked stay predictable enough to gate a build on."
- The **OKLCH token ramp** itself is the bake: hold chroma + hue constant, walk
  lightness — the palette is a *prepared* cache, and every dark-mode flip /
  register-switch / contrast adjustment is arithmetic over it.

## What this means for Susegad

The generalisation is not "port more libraries." It is one abstraction:

> A **`bake()` contract** — a surface supplies a `bake(input)` that does its own
> expensive, environment-specific work once and emits an opaque cache; everything
> downstream (`layout`, `recolor`, `tween`, `drive`) is arithmetic over that
> cache.

The surfaces and their oracles:

| Surface | The "bake" | The "reflow" |
|---|---|---|
| text (pretext) | segment + `measureText` widths | line breaks |
| image (preimage) | intrinsic dims (early) | flow/box/rects |
| color (OKLCH tokens) | palette axes baked once | register/dark/theme recomposition |
| motion (easing) | keyframe curve + springs once | per-frame tween |
| sound (FFT) | AnalyserNode bins once | visual intensity per frame |
| geometry (Yoga) | measure-func per leaf, cached | flexbox arithmetic |

Two are true *measurement* problems (text, image) — they need a real oracle. The
rest are *compute-cache* — no oracle, but the same bake-then-arithmetic shape.

## Source index

Read directly:

- Yoga measure function (the canonical prior art) —
  https://deepwiki.com/facebook/yoga/5-advanced-features (also YGNode.h at
  https://github.com/facebook/yoga)
- Ink / OpenClaude measure-func against Yoga —
  https://claude-code-from-source.com/ch13-terminal-ui/
- somnai-dreams/preimage (the image cousin, self-described as pretext-shaped) —
  https://github.com/somnai-dreams/preimage
- textura (DOM-free Yoga+Pretext, MCP server) — https://razroo.github.io/textura/
- geometra (server-side layout, geometry diffs) —
  https://glama.ai/mcp/servers/Agent-Pattern-Labs/geometra
- ColorAide gamut-map cache benchmark —
  https://lists.w3.org/Archives/Public/public-css-archive/2026Jun/0602.html
- oklch-terminal-themes (the "pretext for color" in the wild) —
  https://williamzujkowski.github.io/posts/2026-07-19-oklch-terminal-themes/
- OKLCH token ramp reference — https://camoa.github.io/dev-guides/css/modern-css/oklch-color/