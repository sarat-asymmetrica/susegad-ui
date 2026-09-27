# Susegad UI: instructions for agents

You are working on Susegad UI, a front-end library for interfaces and documents that are beautiful and comfortable at once. It is MIT licensed and grew out of the Susegad sketchbook and a Goan villa redesign.

If you are *using* the library in your own project, read `SKILL.md`. It is written for you.

## Read first

1. `docs/CHARTER.md`: what the library is, its layers, the register, the contracts and the non-negotiables.
2. `docs/decisions/`: why things are the way they are. Some decisions mention the build's private working notes; those aren't in this repository.
3. The piece you're touching: its `*.docs.md`, `*.prompt.md` and tests.

## Ground rules

- Native elements and platform APIs first. The components are dependency-free ES modules; dev tooling may use dependencies whose current stable versions have been checked.
- Every piece has a pure core with tests, three registers (quiet, warm, playful), a reduced-motion still, an accessibility pass, a performance budget, and its prompt and words-to-code map.
- Look at your own screenshots. Frame times from headless Chromium are only meaningful next to a baseline measured at the same time, and WebGL numbers from it say little about a real GPU.
- Never commit secrets. The narration layer reads its Sarvam key from `SARVAM_API_KEY` in the environment.
- Run `npm test`, `node registry/build.mjs --check` and `npm run check` before you call something done.

## Copy

In copy people will read: plain, warm and specific, in sentence case, with no em dashes. See `docs/CHARTER.md`, Copy standards. Never announce honesty or transparency. Just be accurate.
