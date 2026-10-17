// The guard behind "every check runs in the engine the run asked for". `checks.mjs --engine=firefox` sets SG_ENGINE, which only
// a check that opens its browser through the harness (tools/lib/component-check.mjs: pickEngine) reads. A check that calls
// chromium.launch() runs Chromium whatever the flag says, so under another engine's banner it would print `pass` for
// Chromium's result (12 October 2026: 20 of 117 checks). Rung 2a (16 October 2026) moved all twenty onto the harness; this
// source test is what keeps it so (chromium-only.core.test.mjs fails if a check file launches Chromium itself).
// It used to decide at run time which checks to skip; nothing needs skipping now.

/** Does this check's source launch a Chromium of its own, instead of asking the harness for the engine's browser? */
export const drivesChromium = source => /\bchromium\s*\.\s*(launch|launchPersistentContext|connect|connectOverCDP)\s*\(/.test(source.replace(/^\s*\/\/[^\n]*/gm, ''));
