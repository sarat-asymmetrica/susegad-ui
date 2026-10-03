# 0020: scapes, and budgeting what the reader waits for

*28 September 2026. Sutradhar, at the owner's direction ("for scenes like shet, and even heavier ones, we should make an exception and see how to handle it").*

## Context

Decision 0003 lets a scene declare up to 64 KB of JS. Shet, ported on `batch/sketchbook-port`, is 88 KB (76 KB without comments): a year in a paddy field, with the rice months drawn in detail. It is on the home page's plates, but it is out of the registry because `registry/build.mjs` rejects any declared budget over the ceiling. The owner expects scenes to grow into larger scene-scapes that carry information, especially with three (0017) and Pretext (0019) available. A flat byte ceiling blocks that. It also measures the wrong thing: the reader doesn't wait for a scene's total bytes, only for the bytes needed before they see something finished.

## Decision

1. **Ordinary scenes keep 0003:** 40 KB by default, up to 64 KB with a reason.
2. **A scene may declare `"tier": "scape"`** in its `registry.json`. A scape:
   - **declares `budget.firstSightBytes`, at most 64 KB:** the JS that must load before its finished still is on screen. This is the gate that replaces 0003's ceiling for it.
   - **declares `budget.jsBytes` as its total, at most 256 KB, with a one-line `budget.reason`.** Everything past first sight loads lazily (dynamic `import()`, as the element approaches the viewport or when motion starts), never on the page's critical path.
   - **keeps every other gate unchanged:** frame time within 10% of Paus in the same run (or recorded as unresolved), the finished still under reduced motion and in quiet, Save-Data stepping down a register, pausing off screen, and axe clean.
3. **The build checks both figures.** `registry/build.mjs` counts first-sight bytes from the files a scape lists as its entry, and total bytes as today.
4. **Shet becomes the first scape.** If it can't show its still from a first sight of 64 KB or less today, it gets a split along its own seam (for example, the still and the early months first, the heavier months lazily), and its perf reading covers the rice months, which were not measured in the port.

## Amendment, 28 September 2026: first sight counts code bytes

Splitting Shet along its real seam left its first sight at about 67 KB raw, about 11.6 KB of which is comments (the plate's and the port's), and 56,788 bytes without them. `firstSightBytes` is therefore measured as **code bytes** (comments stripped, the registry's existing `codeBytes` measure), because this figure is about how long the reader waits, and comments are not what makes a scene slow to appear. Explanatory comments stay next to the code they explain, where the next reader and the next agent need them. The **total** `jsBytes` still counts raw source, comments included, as decision 0002 requires. Anyone shipping to production should minify; the figure is honest either way.

## Consequences

- The ceiling moves from "how big is it" to "how long before the reader sees it finished". That is the figure that matters on a phone on a slow connection.
- Scapes are labelled as such on the Components page, with both figures shown.
- The 256 KB total is a starting cap, not a target. Raising it takes a new decision.
