# 0027: WebKit stays informational in CI until a Linux run says otherwise

*8 October 2026, by the maintainers (the browser floor work). Status: accepted. Making an engine a required CI gate is a decision for the maintainers, not a routine change.*

The question is whether WebKit can become a required gate (`continue-on-error` off in the `check` matrix of `.github/workflows/ci.yml`). The rule we set ourselves: flip only if WebKit is green on the suite apart from recorded skips; otherwise record what is left. This is that record.

## The numbers

All on Windows, Playwright 1.63.0 (WebKit 26.6), a machine that was busy with other work and allowed two browsers at a time. Timings are therefore long: the whole WebKit suite took about 2.5 hours against 72 minutes on a quiet machine.

| | 7 October | 8 October, whole suite | 8 October, red files re-run after the fixes |
|---|---|---|---|
| Chromium | 112 of 114 | not re-run whole; every file the browser floor work touched passes | |
| WebKit | 83 of 114 | **88 of 115** | **101 of 115** |
| Firefox | 101 of 114 | not re-run whole; `overlays` 103 of 103 and `arrive` 81 of 81 now | |

The WebKit run was taken part-way through the fixes, so the second WebKit figure is a re-run of the 27 files that were red, one by one, not a second whole-suite run. A check counts as passing in these totals when it exits 0, which includes files that skipped part of themselves with a recorded reason (`unsupportedIn`); the runner does not distinguish them. The skips are printed in each file's output.

## What is green that was red, and why

Six causes, none of them a hidden gate: links are not Tab stops in WebKit (a helper that is held to the engine's own Tab), a click gives a button no focus (asked from the keyboard instead), no date input and no `AudioContext` in this build (the checks skip, with the reason, what would otherwise pass at zero), a stale `:active` after a released press (the touch probe), and a handful of faults in checks that had only ever been run in Chromium (a missing charset, a sampler that read drawn frames, a font probe, a route that saw `blob:` URLs). Two were library bugs found by the engine and fixed: `wa-order` lost the first click on Send after typing (WebKit drops a click when the text node under the mouse-down is replaced), and `voice-note` lost arrow presses on the scrubber (WebKit completes older seeks late). The detail, with the evidence for each, is in `docs/BROWSERS.md`, "The browser floor (8 October 2026)".

## What is left, and why the answer is no for now

1. **WebKit is not green apart from recorded skips.** Still red after the browser floor work: `player` (load timeout on the WebM demo), `orient` (rects 18.96 px off after the turn), `field` (an SVG laid out 380 px to the right of its field), `depth-photo` (the 2D fallback does not blur without a canvas `filter`), `vad/words` (default dark button colours), `toran`, `enquiry` (an aborted import), `abri` (a load flake in every engine), and five scene checks that wait on a frozen clock the engine draws too slowly to reach (`maun`, `shet`, `vaati`, `veranda/arrange`, the touch probe for veranda), and `chiro`'s damp-print check. Each has a cause or a stated "not isolated" in BROWSERS.md.
2. **The CI that would gate is on Linux and we have not seen it.** The workflow runs `ubuntu-latest`. Playwright's Linux WebKit is a different build from the Windows one measured here. It may have `OffscreenCanvas`, an `AudioContext`, date inputs, faster drawing and different Tab behaviour; most of the skips above would then run. We have not been able to push this work, so we have not read that run.
3. **A gate that is red for the engine's own reasons teaches people to route around gates**.

## Decision

`continue-on-error` stays on for WebKit and Firefox. The workflow is unchanged.

Read the Linux WebKit result from the `check` matrix at two points: when this work is next pushed, and again at the next release. WebKit becomes required when a run is green apart from `skip` lines whose reasons are in BROWSERS.md. If it is not, the list in item 1 is the starting point, ordered by what a person could meet: `orient`, `field` and `depth-photo` first, because a Safari user could see them; then the frozen-clock family (one shared answer, probably a smaller virtual step for WebKit), which only costs us coverage.

Chromium stays the only required engine. One note for it: `tinto/words` "contrast (playful)" is red in Chromium on the commit before the browser floor work too; it is not new and not an engine difference.
