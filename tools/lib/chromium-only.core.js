// The guard behind "every check runs in the engine the run asked for". `checks.mjs --engine=firefox` sets SG_ENGINE, which only
// a check that opens its browser through the harness (tools/lib/component-check.mjs: pickEngine) reads. A check that calls
// chromium.launch() runs Chromium whatever the flag says, so under another engine's banner it would print `pass` for
// Chromium's result (12 October 2026: 20 of 117 checks). Rung 2a (16 October 2026) moved all twenty onto the harness; this
// source test is what keeps it so (chromium-only.core.test.mjs fails if a check file launches Chromium itself).
// It used to decide at run time which checks to skip; nothing needs skipping now.

import { lex } from './mutants.core.js';

/** Does this check's source launch a Chromium of its own, instead of asking the harness for the engine's browser? */
export const drivesChromium = source => /\bchromium\s*\.\s*(launch|launchPersistentContext|connect|connectOverCDP)\s*\(/.test(source.replace(/^\s*\/\/[^\n]*/gm, ''));

/**
 * Does this check's source open a browser by hand, whatever it is called (`pickEngine().launch()`, `webkit.launch()`, an aliased
 * `c.launch()`, a variable `E.launch()`)? Rung 2b (17 October 2026) moved the 38 files that did it with `pickEngine()` onto harness(),
 * which owns the server, the slot, the engine, the printer, axe and the guarded close; a file that goes back to the raw glue loses all of
 * them, and so does one that adds a second hand-opened browser beside harness(): `harness()` in the file is no excuse (Rasika, 18 October).
 * Any `.launch(`, `.launchPersistentContext(`, `.connect(` or `.connectOverCDP(` call is found, comments and strings left out, unless its
 * receiver is the harness's own object (`h.launch`, the one spelling that takes the slot and the engine). Known gap: a launch reached
 * through destructuring (`const { launch } = chromium`) or a computed name (`b['launch']()`) is not read.
 */
export const launchesWithoutHarness = source => {
  const toks = lex(source);
  return toks.some((t, i) => t.t === 'id' && LAUNCHERS.has(t.v) && toks[i + 1]?.v === '(' && ['.', '?.'].includes(toks[i - 1]?.v) && !HARNESS_OBJECTS.has(toks[i - 2]?.v));
};
const LAUNCHERS = new Set(['launch', 'launchPersistentContext', 'connect', 'connectOverCDP']);
const HARNESS_OBJECTS = new Set(['h', 'harness']);
