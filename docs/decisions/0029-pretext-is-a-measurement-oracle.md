# 0029: Pretext is a measurement oracle behind an injectable boundary

*Sutradhar for the owner, 8 October 2026. Follows the Pretext ecosystem survey in
`docs/research/2026-10-08-pretext-ecosystem.md`.*

## The departure

Pretext has been used inside `packages/type` since decision 0019, but as an
*internal* of the type package. Scenes (`tinto`, `vad`) reach past the type
package wall to use its prepared-handle + line-layout machinery. This decision
promotes the text tier from a type-package internal into a first-class, shared
**surface contract**: every scene and component gets line boxes through one door,
and nothing vendor-specific leaks past that door.

## What it is, in one line

> Pretext is the measurement device. Susegad owns the geometry. A scene declares
> *shapes*; the text tier turns (text, shape, font) into *line boxes*; the
> renderer turns line boxes into pixels or quads.

Three roles, never blurred:

1. **Measurement (the oracle).** Pretext answers one question: how wide are
   these segments, and where do the breaks go. It is the width oracle. Gated, and
   only the live tier touches it.
2. **Geometry (the engine).** Pure functions over shapes and text: where is the
   room, where do lines go, and the higher operators (fit, clamp, pack, place,
   distribute). No canvas, no DOM, an injectable measurer, tested in Node.
3. **Painting (the renderer).** The same line boxes, three outputs: DOM spans
   (`surface.js`), canvas fills, or stage3d textured quads.

## Bounds

This mirrors decision 0017 (the three.js tier):

- `core`, `engine`, and `components` import the pure geometry core
  (`layout.core.js`), **never** `measure.js` or the vendored Pretext.
- Only the live render surface of a scene and `measure.js` itself touch the
  oracle (`vendor/pretext.js` + canvas).
- The pure core runs in Node with a fake measurer. This is a hard invariant: any
  function that cannot run without a browser does not belong in the core.
- Pretext starts only in the live tier, never in quiet, reduced motion,
  js-disabled, no-WebGL (the 9 October amendment below allows one layout on a still under reduced motion). The still path does not measure.

## The cost

- One new module boundary (`measure.js`) a scene or component author must respect.
  Existing authors of `tinto` and `vad` will see their import paths change once.
- The pure core must keep Pretext's caveats in mind (whole-px sizes, named fonts
  per script, re-prepare on `lang` change), but these are *edges* of the oracle,
  not of the geometry.
- A named-font-per-script discipline becomes an authoring rule, not a free choice.
  This is a cost, and it is the point: it is what makes the CI text gate truthful.

## Why this shape

The Hacker News thread's strongest lesson was that soft hyphens, emoji, and
non-Latin scripts are not bolt-on edge cases; they are foundational. Putting the
oracle behind a boundary keeps those rules in exactly one place, and keeps the
geometry pure enough to run in CI. That CI runnable purity is the strategic wedge:
it is what lets a `node tools/checks.mjs` step flag a Kannada label that
overflows its shape, before a screenshot exists: a gate class no peer in the
pretext ecosystem has.

## Decisions already consulted

- 0010: component pure cores get 12 KB (the text core is a shared core, not a
  component core; its budget is declared like any core).
- 0017: the three.js tier: lazy load, never in core. This decision applies the
  same discipline to Pretext.
- 0019: Pretext vendored into the repo. This decision does not move the vendor;
  it adds the boundary around it.
## Clarification, 9 October 2026: how a component reaches the oracle (Sutradhar)

Rung 3 of the text tier (`sg-bubble`) is the first *component* that paints live text, and the rung 1 guard (`packages/type/boundary.test.js`, transitive) correctly refused it. The rule, so the next one (rung 5, text over stage3d) needs no exemption:

- A file named **`*.live.js`** is a declared live surface. It may import the type door (`type/index.js`, `type/operators.js`) statically.
- A guarded file (core, engine, components, tokens, any `*.core.js` or scene model) may reach a live surface **only by a dynamic `import()`**, made in the live tier only. In the guard's walk, a dynamic edge into a `*.live.js` file ends the chain as allowed; a static edge into one fails, with its chain.
- The static guard cannot see *when* the import runs, so every live surface's browser check also proves Pretext is never requested in the quiet register, under reduced motion or without JavaScript (as `tinto/words.check.mjs` already does).

## Amendment, 9 October 2026: reduced motion (Sutradhar; default, awaiting owner)

"Never in reduced motion" was written for things that move. One surface predates it and is still on purpose: tinto's chalk board. It is a still object, and in warm or playful with reduced motion it lays its words once, through Pretext, and never moves. So the rule is now:

- Pretext never runs in the quiet register, without JavaScript, or on a still that stands in for a failed or missing live tier (no WebGL).
- Under reduced motion, a surface may measure **once** to lay still words (no relayout per frame, no motion of the words). Each such surface says so in its docs, and its browser check proves the one layout. Today that is the tinto board only. `sg-bubble` and veranda's pot use a CSS `shape-outside` still and measure nothing.
- Bake-and-reflow (decision 0030) removes the case: a baked board's lines are written at build time, so the still path stops measuring at all.
- No WebGL is not the same as no live tier (rung 5, Sutradhar ruling). With motion on and WebGL missing, veranda's pot paints its one layout as DOM spans: that is the type tier's live 2D painter, and it measures. The "no WebGL" lines above mean a scene's *still* that stands in for a missing 3D tier, not the words' live painter.
