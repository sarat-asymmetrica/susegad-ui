// Which checks drive Chromium themselves. `checks.mjs --engine=firefox` sets SG_ENGINE, which only a check that
// opens its browser with pickEngine() reads. A check that calls chromium.launch() or opens its browser through
// scene-probe.mjs's session() runs Chromium whatever the flag says, so under another engine's banner it would print
// `pass` for Chromium's result (12 October 2026: 20 of 117 checks, Rasika's review of batch/ci-triage).

/** Does this check's source launch Chromium itself? */
export const drivesChromium = source => /chromium\.launch\(|scene-probe/.test(source);
