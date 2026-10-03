# Browsers

Susegad UI's checks (`npm run check`, or `node tools/checks.mjs --engine=<name>`)
run against three Playwright engines: **Chromium**, **WebKit** (Safari's
engine) and **Firefox**. `tools/lib/engine.mjs` picks the engine from
`--engine=` or `SG_ENGINE`, defaulting to Chromium.

```sh
npm run check                        # chromium (the default)
node tools/checks.mjs --engine=webkit
node tools/checks.mjs --engine=firefox
npx playwright install webkit firefox   # once, before either of the above
```

## Status (2026-09-28, WebKit 26.6 / Firefox 155)

| Engine | Checks passing | CI gate |
|---|---|---|
| Chromium | 58/58 | Required |
| WebKit | see the run this file's revision matches (rising from 18/58) | Informational (`continue-on-error`) |
| Firefox | see the run this file's revision matches (rising from 25/58) | Informational (`continue-on-error`) |

Chromium is the only hard gate today, because WebKit and Firefox both still
have real, open findings below. `.github/workflows/ci.yml`'s `check` job
runs all three as a matrix (`fail-fast: false`), so one engine's failure
never hides another's results; move an engine off `continue-on-error` once
its own section below has no open findings left.

## How a check tells the difference

- `tools/lib/engine.mjs`'s `contextOptions(engine, opts)` strips
  `browserContext.newContext()` options an engine is known to reject
  (Chromium-only permission grants like `clipboard-read`/`clipboard-write`;
  `isMobile`, which Firefox does not support) before they ever reach
  Playwright, so a check gets to run instead of crashing on `newContext()`.
- `grantsPermission(engine, name)` lets a check ask first, and
  `unsupportedIn(engine, thing, reason)` prints one recorded "skip" line
  (never a silent pass) when a check has to leave an assertion out because
  the engine genuinely cannot support it (no CDP session, no clipboard
  grant, no MediaRecorder, …).
- `dropBenignErrors(errors)` removes exactly one known-benign browser notice
  ("ResizeObserver loop completed with undelivered notifications.", WebKit
  only) from a collected error list before a check asserts on it, and
  nothing else — see the comment on `BENIGN_PAGE_ERRORS` in `engine.mjs`
  before adding to that list; it must be a *notice the browser itself
  produces*, confirmed to appear in one engine and not another for the
  identical page, never a catch-all.
- `tools/harness/scene.html`'s `sg-ready` wait takes `?readyTimeout=<ms>`
  (default 30000). Raise it for a specific slow check rather than lowering
  a check's patience elsewhere.

## Real differences found and fixed here

Each of these was reproduced directly against real WebKit 26.6 or Firefox
155 (not guessed), isolated from the library's own code where possible, and
is now either worked around with a real (if different) interaction, or
recorded with `unsupportedIn`. See each commit on `batch/cross-browser` for
the full evidence.

- **WebKit: no clipboard permission grant, no CDP session, no `isMobile`
  support gap on Firefox.** Fixed at the harness level
  (`tools/lib/engine.mjs`, `tools/lib/component-check.mjs`,
  `tools/lib/browser.mjs`); every check that was crashing on `newContext()`
  now runs.
- **WebKit: `window.AudioContext` is not always present at
  `addInitScript()` time** in the sound-scape checks' own instrumentation
  (no real audio device in this automated context) — `new Proxy(undefined,
  …)` threw. Guarded (`packages/sound/scapes/*.check.mjs`).
- **WebKit: no `MediaRecorder`**, so WebM export throws. The library
  already throws a clear, named error
  (`packages/export/webm.js`: `recordCanvasToWebm: this browser has no
  MediaRecorder`); `packages/export/demo.html` now catches it on its own
  (PNG and GIF do not depend on it) and `export.check.mjs` skips only the
  WebM-specific assertions.
- **WebKit: native `<input type="radio">` arrow-key navigation does not
  wrap past either end of a group.** Chromium and Firefox both wrap;
  WebKit does not. Pure platform behaviour, zero library JavaScript
  involved. `radio.check.mjs` asks the same real question (is the disabled
  radio skipped? does the last option end up chosen?) by a forward-only key
  sequence in WebKit instead of relying on the wrap.
- **WebKit: chat-thread's accessibility probe needs a CDP session**
  (`newCDPSession`, Chromium-only) to read the real accessibility tree,
  deliberately, because Playwright's own aria snapshot over-reports image
  children (see the comment above `heard()` in `chat-thread.check.mjs`).
  Skipped on WebKit and Firefox with `unsupportedIn()`; everything else in
  that check (axe, redaction, the reduced-motion bounce) still runs.
- **WebKit/Firefox: "ResizeObserver loop completed with undelivered
  notifications."** is the spec's own safety-valve notice (ResizeObserver
  §13.4). Verified directly: the identical `toast` and `sg-diagram` demo
  pages, at the identical 390px viewport, produce no console message at all
  in Chromium and a real `pageerror` in WebKit. `dropBenignErrors()`
  removes only this exact message before `toast.check.mjs` and
  `diagram.check.mjs` assert on their collected errors.
- **Firefox: no clipboard permission grant either** (same fix as WebKit,
  `grantsPermission()`/`unsupportedIn()` in `reach.check.mjs` and
  `otp.check.mjs`).
- **Firefox: Customizable Select's keyboard navigation is incomplete.**
  Firefox opens a CSS-customised native `<select>`'s popover on Space, but
  does not route `ArrowDown`/`Enter` into it: focus stays on the `<select>`
  itself, the value never changes, the popover never closes on `Escape`
  either. Confirmed directly, isolated from the component (the element is
  entirely native). `select.check.mjs` records this with `unsupportedIn()`
  and sets the value the rest of the block needs with `selectOption()`
  instead, so the drawing and form checks that follow still run
  meaningfully.
- **Firefox: the `.autocomplete` IDL property doesn't recognise
  `"one-time-code"`.** `otp.check.mjs` read `input.autocomplete` (the IDL
  property), which Firefox returns `''` for even though the HTML attribute
  is present and Firefox's own SMS-autofill honours it. Chromium and WebKit
  both reflect it correctly, which is why this was invisible until now.
  Fixed to read `getAttribute('autocomplete')` instead -- the more honest
  and more portable thing to test, since that is what autofill actually
  keys off.

## Open findings (real, not yet resolved)

These are genuine, each looked at directly, not swept under a blanket
filter, but not fixed in this pass -- either the fix needs more
investigation than this session had time for, or it's genuinely
undecided whether the right answer is a library fix, a per-engine
assertion, or accepting a real capability gap.

- **WebKit: `player.check.mjs` times out on `page.goto` (30s, waiting for
  `load`)** with the player demo page (which embeds a WebM sample clip).
  Not yet root-caused: a `<video>` element with an unsupported codec should
  not normally block the page's own `load` event, so this needs more
  digging before it's fair to call it "WebKit has no WebM" the way the
  export check's MediaRecorder gap is -- it may be a different, adjacent
  issue in the demo page or the check itself.
- **Firefox: `stepper.check.mjs`'s "Enter in a field moves to the next
  step, focus on its legend" (playful).** The step genuinely advances
  (confirmed: the right fieldset becomes visible), but focus lands on
  `<body>` instead of the new step's `<legend>`. Reproduced directly; not
  yet understood whether this is a timing issue in
  `packages/components/stepper/stepper.js`'s own `legend.focus()` call (it
  runs synchronously right after the fieldset's `hidden` attribute changes,
  which Firefox may not have finished reflowing yet) or a Firefox
  `<input type="date">` Enter-key quirk. Left failing rather than guessed
  at or silently accepted, because a real focus-management regression for
  keyboard and screen-reader users would be worse to hide than to leave
  visibly red.
- **Firefox: `enquiry.check.mjs`'s "recipe.js alone: no page errors" is
  flaky**, not consistently failing: reproduced both failing and passing
  across three consecutive runs, always with the identical message
  (`TypeError: error loading dynamically imported module:
  .../components/loader/loader.js`) when it fails. Best working theory: the
  check's own native form submission navigates to `sent.html` while
  `sg-form`'s lazy `import('./loader.js')` may still be in flight; Firefox
  reports the aborted dynamic import as an unhandled page error that
  Chromium and WebKit do not surface the same way. Not filtered, because
  the theory isn't proven and a wrong filter here would risk hiding a real
  future regression in this recipe's own module graph.
- **WebKit: several components show small, register- or viewport-specific
  differences** (`field.check.mjs` and `field-note.check.mjs`'s field-note
  wrap counts at 1280px; `postcard.check.mjs` and `quote.check.mjs` each
  have one failing assertion) that were not individually triaged in this
  pass -- likely text-metrics or box-model rounding differences between
  engines rather than functional bugs, but that is an inference, not
  something confirmed the way the findings above are. Run `npm run check
  -- --engine=webkit` (or target the individual `*.check.mjs` files) and
  read each failure's own detail line before assuming any two of these
  share a cause.
- **`abri.check.mjs`'s calm-check pixel-drift assertion** is a known flake
  under load in every engine (`docs/LEDGER.md`, 2026-09-28, originally
  found under Chromium); it reappeared once in a WebKit run in this batch
  too. Not an engine difference -- see the ledger entry for what a real fix
  looks like (compare frames within one stage, not across a load-sensitive
  boundary).

## Adding a new engine-aware check

1. Reach for `tools/lib/component-check.mjs`'s `harness()` if the check can
   use it; it already routes through `contextOptions()`.
2. If the check builds its own `browser.newContext()` calls, wrap the
   options in `contextOptions(engine, opts)` (get `engine` from
   `engineName()`, called once near the top of the file, the same way
   every check in this repo does).
3. If an assertion needs something only some engines provide, guard it and
   call `unsupportedIn(engine, thing, reason)` rather than letting it throw
   or silently pass.
4. Before assuming something is "just how the engine is": reproduce it in
   isolation (a bare page, not the whole check) and try to understand *why*
   before writing the workaround. Every fix in this file exists because
   that step turned up the real cause, not a plausible-sounding guess.
