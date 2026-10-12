# Text gate fixtures

`gate-copy.js` is the copy the text gate (rung 4 of `docs/GOAL-TEXT-TIER.md`) lays into each drawn shape, in English (India), Konkani in Devanagari (`gom-Deva`), Konkani in Romi (`gom-Latn`) and Kannada (`kn`). It is plain data: `COPY`, `OVERFLOW` and `READER`.

Where each English source lives:

| Entry | English comes from | Shape |
|---|---|---|
| `tinto.board` | `packages/scenes/tinto/world.html` (the slotted heading and paragraph) | `BOARD` in `packages/scenes/tinto/model.js`, through `slateOf()` |
| `tinto.plaques` | `SHOPS` in `packages/scenes/tinto/model.js` (`info` and `detail`) | the plaques from `packages/type/junctions.js` |
| `vad.sky` | `packages/scenes/vad/world.html` (second section) | the sky beside the canopy |
| `veranda.matka` | `packages/scenes/veranda/words.html` (the `data-flow` paragraph) | the flow beside the pot |

Shop names (Mercado, Padaria, Taverna) stay as written in every language. They are painted on signs in the drawing, and Goan shop signs are in Roman letters.

`OVERFLOW` is a test fixture, not content. It is a Kannada board that is too long for the arch, and the gate must fail on it. Never add it to `COPY` or ship it.

`READER` is the native-reader flag. Every non-English string here is a first draft by a non-native writer, and no native reader has checked it: Konkani in both scripts, and Kannada. A release does not wait for the check, but a string counts as reviewed only when `reviewedBy` in `READER.needs` has a name and a date. `READER.doubts` lists the words most worth a second look.

`calibration.json` is not copy: it is the measured deviation of the text gate's HarfBuzz shaper from headless Chromium, per script, written by `node tools/text-gate.calibrate.mjs`. The gate's slack comes from it.
