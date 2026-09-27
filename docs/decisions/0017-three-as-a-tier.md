# 0017: three.js as a lazy tier, not a foundation

*26 September 2026. Sutradhar, at the owner's direction ("add it as a dep this early in the journey, for everything it unlocks").*

## Context

The core, the engine and the components are dependency-free ES modules (decision 0001), and the engine carries a small WebGL helper (`packages/engine/src/gl.js`) that Tollem and the player's treatments use. The Goan stories loop (`docs/requests/2026-09-26-goan-stories-loop.md`) needs things that helper doesn't do well: depth-driven parallax from a photograph, real 3D (cameras, lights, GLTF), and a path to WebGPU. three.js is the de facto standard for this, and every coding agent writes it fluently. That matters here, because every piece ships with the prompt that makes it: a prompt that says "three.js" can be reproduced by anyone's agent.

## Decision

1. **three.js is a dependency**, pinned exactly at **0.186.1**, the current stable release on npm on 26 September 2026. three.js changes its API most months, so an upgrade is a deliberate change with a perf check and its own ledger entry.
2. **It lives in its own tier**, `packages/stage3d/`. Core, engine, tokens and components never import it. A scene or a story imports the tier; the tier imports three.
3. **Lazily loaded.** A stage3d element calls `import('three')` only when it is about to be seen. A page with no 3D pays zero bytes for it.
4. **The fallback is non-negotiable** (charter, non-negotiable 4). Without WebGL, on the lite tier (Save-Data, low memory), under reduced motion, or before three.js has loaded, the element shows a finished still: a drawn frame or the graded photograph. Content never waits on the 3D.
5. **Distribution follows shadcn.** Registry items that need three declare `"dependencies": { "three": "0.186.1" }`. The CLI adds it to the consumer's `package.json` rather than copying three's source. The Folio builder inlines three only into documents that use a stage3d element.
6. **Budgets apart.** Like the pure cores (decision 0010), the stage3d tier is budgeted apart from the dependency-free layers. three's own bytes are recorded per story (what the bundler actually includes), and our tier code has its own JS budget. Frame time follows GOAL.md §4: within 10% of Paus on the same machine in the same run, or recorded as a residual with a reason.
7. **Renderer.** WebGL2 through `WebGLRenderer` is the baseline. `WebGPURenderer` with TSL may be used where it earns its place, and must fall back cleanly.
8. **Mediabunny 1.60.0**, pinned exactly, joins the export tier on the same terms: lazily loaded, used only when someone exports a video.

## Consequences

- The "dependency-free" line in the README and SKILL.md now reads "dependency-free core; optional stage3d and video-export tiers".
- The alternative considered was OGL (much smaller, good for 2.5D). It was not chosen, because it has a much smaller ecosystem and our own GL helper already covers the small cases.
- Reversible: the tier is isolated, so removing three means removing one package and its registry items.
