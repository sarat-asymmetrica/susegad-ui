# 0019: Pretext as a lazy type tier, pinned to main

*28 September 2026. Sutradhar, at the owner's direction ("it adds superpowers, so the cost is well absorbed"; "instead of solving problems I wouldn't think to anticipate, apply his work").*

## Context

The owner wants information (words, numbers, labels) to live inside scenes rather than in panels laid over them (`docs/requests/2026-09-28-words-in-the-world.md`). That needs to know where every line of a paragraph falls, in any script, without measuring the DOM. Today:

- The element measures calm zones as whole rectangles with `getBoundingClientRect` (`packages/core/scene-element.js`, `#measure`). They go stale when only `--sg-reading-place` changes (harvest report, 2026-09-28).
- Scenes that draw text on the canvas wrap it word by word with `measureText` (for example `packages/scenes/tinto/render.js`, `wrap`). That is wrong for Devanagari and for any script that doesn't break at spaces.

Cheng Lou's Pretext (`@chenglou/pretext`, MIT) measures and lays out multiline text with arithmetic over cached segment widths. It can flow a paragraph through lines of changing width (`layoutNextLineRange`), shrink-wrap and balance text (`walkLineRanges`), and handle mixed-font inline runs (`@chenglou/pretext/rich-inline`). Since 0.0.9, main ports each browser's own line breaker and its data, so lines break where Chrome, Safari or Firefox break them.

## Decision

1. **Pretext is a dependency, pinned to main at `e73081fc409c49eaff47f58908abd73995c380cd`** (27 September 2026), not to npm 0.0.9. Measured with esbuild on 28 September: main is 112 KB minified / 56 KB gzipped for `layout`, and 0.0.9 is 47 KB / 16 KB. We take the larger build for its browser-exact line breaking, which Konkani, Marathi and Devanagari text needs. When a release on npm contains this work, we move to an exact npm pin in its own ledger entry.
2. **Distribution:** until that release exists, the tier vendors an ESM build of the pinned commit, with a provenance file giving the commit, the build command, the bundler version and the license. The CLI copies it, as it copies everything else. After the npm release, registry items declare `"dependencies": { "@chenglou/pretext": "<exact>" }`, as three does (decision 0017).
3. **It lives in its own tier, `packages/type/`.** Core, engine, tokens and components never import it. A scene or a recipe that sets words in the world imports the tier, and the tier imports Pretext.
4. **Lazily loaded.** Nothing pays for Pretext until an element that places words is about to be seen.
5. **The words stay real text.** Pretext decides where a line goes; the line is still DOM text (focusable when it acts, selectable, translatable, read in a sensible order). Canvas-painted text may only repeat words that also exist as DOM text.
6. **The fallback is the flat reading.** Without the tier, before it has loaded, in the quiet register, or where a drawn surface can't hold the text legibly (200% zoom, a narrow phone), the words sit in the ordinary panel, stacked as they are today.
7. **Budgets apart**, as with three (0017, point 6): Pretext's own bytes are recorded per item, and our tier code has its own JS budget.

## Consequences

- Upgrading Pretext is deliberate: a new commit or version is a change with a perf reading and a ledger entry.
- The stale-calm-rect bug gets a structural fix for scenes that adopt the tier: the scene computes its line boxes itself in logical coordinates, so there is no DOM measurement left to go stale. Scenes that don't adopt it keep today's behaviour, and the core bug still needs its own fix.
- Reversible: remove `packages/type/` and the items that use it; their words fall back to the panel.
