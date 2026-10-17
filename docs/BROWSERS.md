# Browsers

Which browsers Susegad UI works in, what each one gets, how we check, and what to do when something is wrong.

This page is written for a front-end engineer and a compliance colleague who are meeting the library for the first time. Every claim names the file or check it comes from. Where we have not checked something, the page says so. The notes for people who maintain the checks are at the end, under "For maintainers".

## The short version

- Every component is a native element (a `<button>`, a `<dialog>`, a `<details>`, a `<select>`) with a skin on top. When the skin cannot run, the native element still works.
- Where a browser lacks a newer platform feature, the library uses a plainer way of doing the same job. Nothing is left blank. The list is under "What degrades, and how".
- We run the same automated checks in three engines: Chromium, WebKit (Safari's engine) and Firefox. Chromium must pass for a change to go in. WebKit and Firefox run on every change and their results are published, but they do not block it yet.
- We have not run the checks on a real phone. Phones are emulated by the engine at one size. The table says which rows that applies to.

## The support matrix

Three words are used in the last column of the table.

- **Full**: the checks run in this engine and the pass is required before a change goes in.
- **Works, with open findings**: the checks run in this engine on every change. A few fail for reasons we have written down below under "For maintainers". Everything a visitor needs still works, and the degraded extras are listed under "What degrades, and how".
- **Not checked**: no automated check runs for this browser. We say what we expect and why, and mark it as an expectation.

| Browser | Engine we check it with | Version we check | How it is checked | Status |
|---|---|---|---|---|
| Chrome on desktop | Playwright Chromium, which is Chrome for Testing | 153.0.8010.12 | Headless, at 1280 px wide, in CI and on a developer's machine | Full |
| Edge on desktop | Same Chromium engine | Same as Chrome | Not run as Edge. Edge is built on Chromium, so we expect the same result. | Not checked as Edge |
| Safari on desktop | Playwright WebKit | 26.6 | Headless, at 1280 px wide, in CI. This is Playwright's WebKit build, not the Safari app. | Works, with open findings |
| Firefox on desktop | Playwright Firefox | 155.0 | Headless, at 1280 px wide, in CI | Works, with open findings |
| Safari on iPhone | Playwright WebKit | 26.6 | The WebKit engine in a 390 by 844 window with touch and 3x pixel density. Emulated: no real iPhone, no iOS. | Works, with open findings |
| Chrome on Android | Playwright Chromium | 153.0.8010.12 | The same emulated phone window. No real Android phone. | Full for the engine, emulated for the device |
| Samsung Internet | None | None | Not run. It is built on Chromium, so we expect it to follow Chrome. | Not checked |
| A low-end Android phone | None on a real device | None | The rules that lighten the library for these phones are unit tested in Node. They are not run in a browser on a low-end device. | Not checked |

Where the versions come from: `playwright-core/browsers.json`, inside the pinned Playwright release (`package.json` asks for `^1.63.0`). When we update Playwright, the versions in the table change with it.

What "Safari on iPhone" and "Chrome on Android" mean here: the engine, with a phone-sized window and touch. This tests the layout, the touch contract (`docs/contributing/touch-contract.md`, checked by `tools/touch.check.mjs`) and the rules for small screens. It does not test the phone's own behaviours: the on-screen keyboard, the browser's address bar moving, the system haptic, or how a low-end phone copes with a heavy scene.

Version floor. This is the library's policy as of this release, not a checked fact. Fully supported means the current and previous major versions of Chrome, Edge, Firefox and Safari, on desktop and on iOS. We check that through the pinned engines above. An older browser that runs ES modules and custom elements gets the content and the controls without the newer extras listed under "What degrades, and how". We do not check those older browsers. The matrix is reviewed whenever the pinned engines move.

A browser with no support for ES modules or custom elements is not supported. The scripts are modules and every piece is a custom element. We have not run any check against such a browser; this is a plain reading of how the library is built.

### How the checks are run

- `tools/checks.mjs` runs every `*.check.mjs` file under `packages/` and `recipes/`, plus `tools/touch.check.mjs`, one after another, in the engine named by `--engine=<chromium|firefox|webkit>` or the `SG_ENGINE` variable. Chromium is the default (`tools/lib/engine.mjs`).
- The public repository's CI is `.github/workflows/ci.yml`. Its two kinds of job:
  - `test` runs the unit tests and the registry, manifest and skill checks on Node 22. It is a hard gate.
  - `check` runs `tools/checks.mjs` for each of the three engines in four shards each, as separate jobs, so one engine or shard failing never hides another's result (`fail-fast: false`). [CI on Linux](#ci-on-linux) below has the details. The Chromium job is a hard gate. The WebKit and Firefox jobs have `continue-on-error: true`, so they report but do not block.
- The browsers are installed in CI with `npx playwright install --with-deps <engine>` on an Ubuntu runner. WebKit and Firefox therefore run on Linux, not on macOS or iOS.
- Browser checks open their browser through one harness, `harness()` in `tools/lib/component-check.mjs`. It owns the dev server, the machine-wide browser slot, the engine named by `--engine` or `SG_ENGINE`, a page and context helper that is safe for the engine (`contextOptions`), axe-core with the WCAG 2.2 AA tags (scripts on and off, through `h.axe()` and `h.axeNoJs()`), counted skips (`h.skip()`, and `h.gpu()` for the live-tier clauses), and a `done()` whose closes are time-limited so a stuck browser close cannot hang the suite. A check that does not run axe either says why (`harness({ axe: '<reason>' })`) or gets a `note` line. Not every file is on it yet: the twenty that used to launch Chromium are (rung 2a, below), about forty still call `pickEngine()` themselves (rung 2b), and four docs-site checks in `apps/docs/` still launch Chromium (`tools/lib/chromium-only.core.test.mjs` lists them and fails if another file does).

To run it yourself:

```sh
npm run check                           # Chromium, the default
npx playwright install webkit firefox   # once, before the next two
node tools/checks.mjs --engine=webkit
node tools/checks.mjs --engine=firefox
```

### CI on Linux

The public repository's GitHub Actions run on Ubuntu runners with no GPU. What we found in WSL Ubuntu 24.04 (12 October 2026, Playwright 1.63), which stands in for a runner:

- **The jobs.** `test` runs the unit tests with a five-minute limit per test file, then the registry, manifest and skill checks. It installs Chromium because two unit tests drive it. `check` runs each engine in four shards (`tools/checks.mjs --shard=<i>/4`), and each shard installs Chromium as well as its own engine (below). Every job has `timeout-minutes`, and `SG_CHECK_TIMEOUT_S=600` kills a single check that runs too long. A `summary` job puts each shard's last lines on the run's summary page, including shards that failed.
- **WebGL is there, but it is software.** Chromium draws WebGL on SwiftShader with no extra flags (Playwright passes `--enable-unsafe-swiftshader` itself). Firefox draws it on Mesa's llvmpipe. WebKit reports its renderer as "Apple GPU" whatever is underneath. The depth photo, stage3d and the veranda check whether the renderer is a software one (`isSoftwareRenderer` in `packages/stage3d/stage3d.core.js`) and draw in 2D if it is, as they would for a person without a GPU. So in Chromium and Firefox the live tier never runs on a runner, and launch flags can't change that: their live-tier clauses skip (next bullet) instead of failing. In WebKit the depth photo does reach the live tier.
- **What the checks do about it.** A clause that asserts the live tier, or something only the live tier draws (a turning pot, a camera that leans, a GPU raster stall), prints `skip  <clause>  (no GPU: <renderer string>)` when the page's renderer is software, and does not run. It is neither a pass nor a red: the check's last line reads, for example, `17 of 17 pass, 5 skipped (no GPU)`, and `tools/checks.mjs` lists the skipped clauses per check under "Skipped, no GPU". The test is the library's own (`isSoftwareRenderer`, read from the same `WEBGL_debug_renderer_info` string), so a check skips exactly when the product would draw in 2D. The 2D clauses still run on those machines, because 2D is what a person without a GPU gets. The helper is `tools/lib/gpu.mjs`. `SG_FORCE_SOFTWARE_GL=1` makes it treat any renderer as software, to try the skip path on a machine that has a GPU (it changes what the check decides, not what the page draws).
- **Chromium GPU flags in other engines.** A check that asks `session()` for `--use-angle=d3d11` used to pass it to every engine, and WebKit would not start ("Unknown option"). `launchArgs` in `tools/lib/engine.mjs` now passes these switches to Chromium only.

#### The first real run on GitHub (12 October 2026, run 38240230506)

Everything was red: 1 unit test, 7 checks in Chromium, 34 in Firefox and 38 in WebKit (45 new reds once the known flakes were set apart). It came down to a few causes. Each was reproduced in WSL Ubuntu, in Chromium, Firefox and WebKit with only the browsers a shard installs, and then fixed or recorded. The ones that belong to the runner, not the library:

- **Twenty checks used to drive Chromium themselves, whatever `--engine` said. They no longer do (rung 2a, 17 October 2026).** They called `chromium.launch()` (thirteen files, and `veranda/quads` for its second browser) or opened their browser through `session()` in `tools/lib/scene-probe.mjs` (six; that function is gone). Under another engine's flag they would have printed Chromium's result as a Firefox or WebKit pass (`link` passed 21 of 21 and `dar` 7 of 7 in `SG_ENGINE=firefox` and `webkit` with only Chromium installed), so `tools/checks.mjs` skipped them and they counted as neither a pass nor a red. All twenty now open their browser with `harness()`: `components/button`, `components/link`, `components/scroll-section`, `components/tabs`, `recipes/site-shell`, `scenes/dar`, `scenes/ferry`, `scenes/nod`, `scenes/pahat`, `scenes/vaati`, `scenes/vahi`, `scenes/veranda/arrange`, `scenes/veranda/flow`, `scenes/veranda/notes`, `scenes/veranda/quads`, `scenes/veranda/stage`, `scenes/veranda/veranda`, `scenes/veranda/words`, `transitions/kantar` and `transitions/page`. Their Chromium pass counts are unchanged. The live-WebGL clauses of the veranda checks print a counted `skip  <clause>  (no GPU: <engine>: the live WebGL tier is read back in Chromium only)` in WebKit and Firefox. First WebKit runs of the twenty (they had never run there; Windows, Playwright WebKit): 15 pass (`arrange`, `flow`, `notes` and `quads` with counted skips), 5 stop on findings that are not the check's shell and are open: `link` (playful: the link's underline at rest covers 74 of 107 columns, the check wants 70%), `site-shell` and `kantar` (the WebKit page process crashes: going from Rooms back to Overview with the Paus scene mounted, and mid-song), `scenes/veranda/stage` (the control that a 3 px blur fails the pale-rim map reads "off at: none"), `scenes/veranda/words` (four clauses red in the lens and on release, and the file runs past 10 minutes). `tools/lib/chromium-only.core.test.mjs` fails if a check file other than the four docs-site ones calls `chromium.launch()`.
- **A date field's day and month order is the browser's own locale, not the context's.** `locale: 'en-IN'` on a context changes what the page is told; the native field follows the process locale, which on a runner is C. So `04102026` typed by hand read 10 April, not 4 October (`wa-order`, `food-order`). `localeEnv()` in `tools/lib/engine.mjs` launches those two checks with `LC_ALL=en_IN`, which Chromium and Firefox both read with no locale files installed.
- **A bare textarea has the platform's default font.** It is 13.3 px on Windows and 16 px in Linux WebKit, so a ceiling of `20em` is 266 px in one and 326 px in the other (`field/grow-press`). The check now measures against the em, the padding and the border the textarea has.
- **The public repository has no history.** `tinto/glass` compared with the core as it stood at commit 654935d, read with `git show`. That file is now a fixture in `tools/fixtures/tinto-glass/`.
- **WebKit on Linux will not start on a switch it does not know** (`export`: `--use-fake-ui-for-media-stream`). The check goes through `launchArgs`.
- **A page with JavaScript off hangs Firefox's harness.** `document.fonts.ready` never settles there and a `setTimeout` inside the page never fires, so `waitReady` hung every check that opens a no-JS page until the 600 s kill. That is `depth-photo` in Firefox, which this page had down as "runs past 15 minutes". `waitReady` now waits from outside the page, for a bounded time. `depth-photo` in Firefox went from killed at 600 s to 16 of 16 pass, 6 skipped (no GPU), in 45 s.

Three were the library's, and show only on a machine with no `Segoe Print` and a different default font:

- **`document.fonts.load()` rejects the moment one face of the stack fails, with the others still on their way.** The stacks name metric-matched fallbacks whose only source is `local('Segoe Print')`, which only Windows has. On every other machine `load()` rejected in 4 ms while the Kannada face was still being fetched. So `fontReady` (the type tier) returned early and the Tinto board was laid in the fallback (`tinto/words`, "a slow face": 69 of 132 frames laid early, in all three engines), and the bubble's first lay-out did the same (`bubble`). Both now wait for `document.fonts.ready` after a rejection. The same `.then(redraw, () => {})` shape sits in the canvas-text scenes (`chai`, `kairi`, `ghat`, `prahar`, `tinto/render`), `date-range` and `signature`. I did not find a symptom in them (a first attempt to see one was not a usable instrument, since the page differs after a redraw on Windows too), but a label drawn once and never repainted would stay in the fallback on a Mac or Linux machine. Worth a look by whoever next touches them.
- **WebKit on Linux accepts `ctx.filter = 'blur(2px)'` and draws the picture sharp.** `depth-photo`'s 2D tier read the property back to decide whether the filter worked, so its focus never moved there. It now draws a hard edge through the filter and looks. The fallback (a down-and-up scale) is not enough on its own: the plate goes from 588 to 1330 sharpness, 2.3 times, against the 5 times the check asks for. So `depth-photo` in WebKit on Linux still reads one red ("Focus on the plate", quiet) until the fallback blurs for real. The scenes that blur with `ctx.filter` (`dar`, `ferry`, `kantar`, `khazan`, `mosaico`, `nod`, `tollem`, `toran`) are sharp there too, and nothing checks it.
- **A race in `action-menu` that its check was right to catch.** After Escape the popover stops matching `:popover-open` a task before its `toggle` event reaches the component, which believes it is open (`aria-expanded`, `data-open`) until then. An `ArrowDown` in that gap moves focus inside a closed menu and nothing opens. A person cannot press that fast, so the check now waits for the component's own closed state and the component is unchanged.

Checks that waited a fixed time for something that depends on the machine now wait for the state: `menu` (the count's settle strip ended on the ninth timer tick, not on the finished animation), `core/csp` (the movable grip, after 600 ms), `tabs` (the second tablist's selection, after 60 ms; this check runs Chromium, it failed on a loaded WebKit shard only because it ignores the engine) and `bubble` (the arrival, after 2.5 s). The unit test `saving-footer/recipe.browser.test.js`, "the live connection is quiet on load and speaks only when it changes (R3)", lost an 8 s wait on the runner. It passed in every WSL run: alone, three times pinned to two cores, and inside the whole 2,657-test suite (59 s). Its wait is now 20 s and, if it runs out, the failure prints what the page showed. It is not root-caused: if it goes red again the message will say where it stood.

**What stays red on the runner, and why.** Each of these also fails on Windows against the same commit (run there on 12 October 2026), so none is the runner's and none is new:

- *Firefox (7 of the 15 checks that run in it; before, 12 of 15):* `event-list/arrive` and `overlays` (`:active` does not match while the keyboard is the input), `stepper` (focus lands on `<body>`), `tile-band` and `tinto/glass` (frozen frames not repeatable pixel for pixel), `booking` (the right code does not move on). All are under "Open findings" above.
- *WebKit (11 of the 18 checks that run in it; before, 17 of 18):* `field-note`, `quote`, `tumble`, `wa-order` (the Tab walk and the typed date), `food-order` and `vel` (timeouts), `proposal` (a `blob:null` request), `vad/words` (axe on `#replay`, dark), `tinto/glass`, `image` ("the words are laid while neither picture has arrived", new to this page) and `depth-photo` (above).
- *Firefox, Linux only:* `tinto/words` "contrast (playful and warm, light and dark)". One plate label or line reads 1.7 to 3.4 against 4.5 in some frames and not in others (probed at 0, 1.5 and 3 s: worst 12.9, 12.9, then 2.9 on the last row), where Windows Firefox passes. Intermittent, not root-caused. It is not in the known-flake table because the table excuses a whole file, and that file's other Firefox gates ("a slow face") now pass and must stay able to fail.
- *Chromium, under load only:* `bubble`'s "a layout takes under 250 ms" (76 ms on a quiet machine; 549 and 897 ms with six busy loops beside it) and its arrival-flash probe (the first bubble reads 1, then 0 for a frame or two, then 1, as the second lay-out lands). Both pass on a quiet machine and pinned to two cores. Neither is in the known-flake table, for the same reason. If the Chromium shard shows them, re-run before believing it. The Firefox and WebKit checks that went red when two ran at once and not alone (`sound-switch`, `site-shell`, `tabs`, WebKit `booking`) are the same kind.

## What degrades, and how

Each row says what the library does where the browser has the feature, what it does where it does not, and where to read it in the code. "Checked" says whether a check in the repo forces the fallback and watches it work.

### Overlays: popover, tooltip, action menu, dialog, drawer

**Anchor positioning (placing a panel beside its trigger).**
- With it: CSS places the panel under its trigger and flips it above or across when it will not fit. No script runs for placement. The trigger is the panel's implicit anchor, so it works even before the script loads. See `packages/components/popover/popover.css`, `tooltip/tooltip.css`, `action-menu/action-menu.css` (inside `@supports (anchor-name: --a)`).
- Without it: the component measures the trigger and the window and sets `left` and `top` itself, and listens for scroll and resize while the panel is open. See `#place()` in `popover.js`, `tooltip.js` and `action-menu.js`, which return at once when anchors are available.
- Checked: yes. `packages/components/overlays.check.mjs` replaces `CSS.supports` so that anchor positioning reads as missing, and checks the panel still lands beside its trigger.

**Invoker commands (`commandfor` and `command` on a button).**
- With them: a `<button commandfor="id" command="show-modal">` opens a dialog or drawer with no script. The component still notices the opening, so the skin and the `sg-dialog-open` event still happen.
- Without them: the component gives those buttons a click handler that does the same. `dialog.docs.md` names iOS before 26.2 as the case. See `packages/components/dialog/dialog.js` and `drawer/drawer.js` (the `nativeCommands` test).
- Checked: yes. `overlays.check.mjs` deletes `commandForElement` from the button prototype and checks the open still works.
- The popover also accepts `commandfor` with `command="toggle-popover"`, but `popovertarget` is the form to use, since it works in older browsers too (`popover.docs.md`).

**Entry and exit transitions (`@starting-style`, and animating `display` and `overlay`).**
- With them: each overlay fades in and out of the top layer, in the timing of its register.
- Without them: the panel appears and disappears with no fade. It still opens, closes, takes focus and returns focus, because those are the native popover and dialog behaviours.
- Firefox and WebKit close dialogs and drawers at once, with no fade, because they do not yet animate `overlay` on the way out. Entries still animate there. Source: the 6 October review of the overlays, which found the dialog's `close` event and the return of focus pass in both engines. That review did not photograph the closing frame, so "at once" comes from how those engines handle `overlay`, not from a picture.
- Reduced motion removes the transition in every engine, so the first frame is the finished one (`overlays.check.mjs` reads the first frame).

### Lists that arrive one by one

**`sibling-index()` (the beat each item waits before arriving).**
- With it: the stylesheet works out each item's delay (`packages/components/action-menu/action-menu.css`, inside `@supports (animation-delay: calc(1s * sibling-index()))`).
- Without it: JavaScript sets the same delay on each item from `arrivalDelay()` in `packages/core/arrive.js`, which uses `talaDelay()` from `packages/tokens/tokens.js`.
- Checked: `packages/components/event-list/arrive.test.js` compares the CSS formula to the JavaScript function, so the two give the same beats. We have not forced the fallback in a browser.

### Forms

**`field-sizing` (a text box that grows as you type).**
- With it: a textarea grows with its words up to a ceiling, then scrolls (`packages/components/field/field.css`, `form/form.css`, inside `@supports (field-sizing: content)`).
- Without it: the textarea keeps its set number of rows, and scrolls when the text is longer.
- Checked: not forced. This is a reading of the `@supports` block.

**Customizable select (`appearance: base-select`).**
- With it: the picker list is drawn in the register's style.
- Without it: the browser's own select and picker show, with the hairline border on the closed select in every register (`packages/components/select/select.docs.md`). Everything works. It looks plainer.
- Firefox also has a keyboard finding with this control; see "For maintainers".

**`:has()`.**
- Used for small touches: a field's error colour, a file drop zone's layout, the combobox's invalid state (`field.css`, `file-drop.css`, `combobox.css`). A browser without `:has()` skips those rules. The field itself, its label and its native validation message still work.
- Not checked in a browser without `:has()`. This is a reading of the stylesheets.

### Colour, type and tokens

**`light-dark()`.** Tokens use it to switch between day and night. Where it is missing, the stylesheet states the same palettes in plain hex, with a day set and a night set under `prefers-color-scheme: dark` (`packages/tokens/tokens.css`, `@supports not (color: light-dark(#000, #fff))`). A `data-theme` attribute on `:root` still overrides it. Not checked in a browser without `light-dark()`.

**`linear()` easing.** The spring easing is a `linear()` curve. Where it is missing, a plain cubic-bezier with a small overshoot stands in (`tokens.css`, `@supports not (animation-timing-function: linear(0, 1))`).

**OKLCH colours and `color-mix()`.** The palettes are written in `oklch()` (`packages/tokens/palettes/`), and the pressed states and shadows use `color-mix()`. No hex fallback is planned, because every browser inside the version floor reads `oklch()` and `color-mix()`. An older browser drops those declarations and the element takes the colour it inherits. Text stays readable, and the palette is lost. No check runs in such a browser.

### Page transitions

**View Transitions (`packages/transitions`).**
- Across pages: `@view-transition { navigation: auto; }` cross-fades a same-origin navigation where the browser supports it, and is ignored elsewhere, where navigation is the ordinary instant kind (`page.docs.md`).
- Within a page: `sameDocumentTransition(update)` uses `document.startViewTransition` when it exists and reduced motion is off. Otherwise it runs `update()` directly, so the result is always correct (`packages/transitions/page.js`, `page.core.js`).
- Checked: `packages/transitions/page.check.mjs` and `page.test.js`.

### Scenes: WebGL, the governor and the still picture

- **WebGL missing or failing.** `createGL()` in `packages/engine/src/gl.js` returns `null` when the browser has no WebGL or the shader will not compile. The scene then draws its 2D version. A lost WebGL context is handled: the scene falls back, and tries again when the context comes back.
- **The governor.** `packages/engine/src/governor.js` watches the average frame time over a window of frames. When frames run slow for a whole window it lowers the drawing's detail by a quarter step, down to a quarter. When frames are calm for several windows in a row it raises it again. A fast machine stays at full detail. `glSurface()` shrinks the canvas to match. It uses frame timing only, so it works the same in every browser.
- **Hidden or off screen.** `<sg-scene>` pauses when it is off screen or the tab is hidden (`packages/core/scene-element.js`).
- **three.js scenes.** The 3D tier loads three.js only when a scene is about to be seen and is live. A page with a still register, reduced motion, Save-Data, no WebGL2 or a lightweight device downloads none of it and shows the 2D still (`packages/stage3d/stage3d.js`).
- **Poster-first scenes.** `<sg-lazy>` wraps a poster (a `<picture>` with AVIF, WebP and JPG) and a hidden `<sg-scene>`. The poster is the first paint. The scene is fetched only when the element is within 200 px of the screen and the page has loaded. It does not start by itself under reduced motion, Save-Data, the quiet register, or a device that reports 2 GB of memory or less. The poster stays as the picture there, and the page can offer a Play button that calls `start()`. With scripts off, the poster is the picture and the scene stays hidden. See `packages/core/lazy.docs.md`, `lazy.core.js` (`holdReason()`, `LOW_MEMORY_GB`) and decision `docs/decisions/0024-poster-first-scenes.md`. Checked in `packages/core/lazy.check.mjs`.

### With JavaScript off, or not yet loaded

- Every component wraps a native element, and the native element keeps its job. A button submits, a link follows, a `<details>` opens, a form posts, a date field is a date input, a table reads in its written order. The component docs say what each shows with scripts off; for example `accordion.docs.md`, `data-table.docs.md`, `date-range.docs.md` and `chat-thread.docs.md`.
- The quiet look applies, since the skins are loaded by script.
- A scene is a custom element, so without script it shows the words you put inside it (the `<h2>` and `<p>` in `packages/core/README.md`) and no picture.
- Checked: 49 check files open pages with scripts off and run axe on them (`js: false` or `javaScriptEnabled: false`, through `tools/lib/component-check.mjs`).

### Strict content security policy

Styles are built as one shared constructable stylesheet and adopted by the page or the shadow root, so a policy that blocks inline `<style>` has nothing to block (`packages/core/sheet.js`). A plain `<style>` element is added only where `adoptedStyleSheets` does not exist. Checked in `packages/core/csp.check.mjs`.

### Sound and haptics

- The sound switch is off until the person turns it on, and the choice is stored in `localStorage` (`packages/sound/switch.js`). If storage is blocked, the switch works but is not remembered. Sound plays only after a tap or key press.
- The switch control carries the native `switch` attribute (`packages/components/sound-switch/sound-switch.js`). In Safari on iPhone this gives the system's own small tap when it is flipped. Elsewhere the attribute is ignored. We have not tested the iPhone tap on a real device.
- Haptics use `navigator.vibrate`, only after sound is on and a gesture has happened, and only where the browser has it. Where it does not, `haptic()` does nothing and never throws (`packages/sound/switch.js`). Safari on iPhone does not offer `navigator.vibrate`; that is a platform fact we have not tested here. So on iPhone the only touch feedback is the switch's own.

### Announcements to screen readers

`announce(text, { priority, from })` in `packages/core/announce.js` says one sentence to a screen reader. Where the browser has `ariaNotify`, it uses that. Elsewhere it uses one shared, visually hidden polite live region (`role="status"`; an assertive `role="alert"` region is made only when asked for). A quick burst of changes, such as three presses on a plus button, is spoken once. Components whose live region is visible text, such as the menu's total, the toast and the form's status, keep their own on purpose, so nothing is spoken twice. Checked in `packages/core/announce.check.mjs`, with `ariaNotify` present and removed, and the doc says to run it in WebKit and Firefox too (`packages/core/announce.docs.md`).

## How the library answers your settings

| Setting | What happens | Where | Checked |
|---|---|---|---|
| Reduced motion (`prefers-reduced-motion: reduce`) | Movement is instant. Opacity may still fade. Scenes show their still picture and do not loop. Presses keep their colour change and drop the movement. | `packages/tokens/tokens.css` (the media query), `packages/core/register.js` (`resolveMotion` returns `still`), 46 stylesheets with their own rule | Yes. 62 check files open pages with reduced motion on. |
| Save-Data, or a device with 1 GB of memory or less | The register steps down one (playful to warm, warm to quiet). Three.js scenes show their 2D still and skip the download. | `packages/core/register.js`, `packages/stage3d/stage3d.js` | The rule is unit tested in Node (`packages/core/core.test.js`). No browser check sets Save-Data. |
| Forced colours (Windows high contrast) | The drawn art is hidden or replaced with system colours, and the native control shows. | 35 stylesheets have a `forced-colors: active` block, for example `packages/components/button/button.css` | Yes, in 10 check files (`forcedColors: 'active'`). |
| Browser zoom to 200% or 400%, and large text | The layout reflows. | | One check measures 200% zoom and 200% text (`packages/scenes/tinto/glass.check.mjs`). No library-wide zoom check. |
| 320 px wide | Not measured. | | The narrowest width any check uses is 390 px. At that width the register matrix looks for sideways scroll (`tools/matrix.mjs`) and 28 check files measure `scrollWidth`. There is no 320 px check. |

Two notes on the table:

- Save-Data and device memory come from `navigator.connection` and `navigator.deviceMemory`. We believe only Chromium-based browsers offer them (Chrome, Edge, Samsung Internet), so the step-down applies to Android phones running those and not to Safari or Firefox. This is platform knowledge that the repo does not check. Without the values, the library reads Save-Data as off and memory as 8 GB.
- The register is the library's own word for how much a piece moves and decorates (quiet, warm, playful). See `docs/CHARTER.md`.

## Reporting a browser bug

Open an issue on GitHub: https://github.com/sarat-asymmetrica/susegad-ui. <!-- owner: confirm the issue tracker is open on the public repo -->

A good report has:

- the browser, its exact version and the operating system, from the browser's About page;
- whether it is a real device or an emulator;
- the page or component and its register (quiet, warm or playful);
- what you expected, what happened, and a screenshot;
- whether it still happens with scripts off, and with reduced motion on.

---

# For maintainers

## Status (28 September 2026, WebKit 26.6 and Firefox 155)

The pinned versions are unchanged since this section was written (`browsers.json` still reads Firefox 155.0 and WebKit 26.6). The findings below were first reproduced on 28 September and re-run on 7 October, when the ones still open (player, stepper, enquiry, field and field-note) failed the same way. The last whole-suite counts, on 7 October 2026 with 114 checks, were Chromium 112, WebKit 83 and Firefox 101 (WebKit was re-measured on 8 October: 88 of 115, and 101 of 115 after the fixes, see [the browser floor](#the-browser-floor-8-october-2026)); [the whole suite in every engine](#the-whole-suite-in-every-engine-7-october-2026) below says which failed and why we think so. Read newer numbers from the CI run, not from this page. The latest per-engine count for a single piece is the overlays check: 105 in Chromium, 103 in Firefox, 103 in WebKit.

| Engine | CI gate |
|---|---|
| Chromium | Required |
| WebKit | Informational (`continue-on-error`) |
| Firefox | Informational (`continue-on-error`) |

Chromium is the only hard gate, because WebKit and Firefox both still have open findings below. The `check` job in the public CI runs all three as a matrix with `fail-fast: false`. Move an engine off `continue-on-error` once its own section below has no open findings left.

## How a check tells the difference

- `tools/lib/engine.mjs`'s `contextOptions(engine, opts)` strips `browserContext.newContext()` options an engine is known to reject (Chromium-only permission grants like `clipboard-read` and `clipboard-write`, and `isMobile`, which Firefox does not support) before they reach Playwright, so a check runs instead of crashing on `newContext()`.
- `grantsPermission(engine, name)` lets a check ask first. `unsupportedIn(engine, thing, reason)` prints one recorded "skip" line, never a silent pass, when a check has to leave an assertion out because the engine cannot support it (no CDP session, no clipboard grant, no MediaRecorder).
- `dropBenignErrors(errors)` removes exactly one known-benign browser notice ("ResizeObserver loop completed with undelivered notifications.", WebKit only) from a collected error list before a check asserts on it, and nothing else. Read the comment on `BENIGN_PAGE_ERRORS` in `engine.mjs` before adding to that list. An entry must be a notice the browser itself produces, confirmed to appear in one engine and not another for the identical page, never a catch-all.
- `tools/harness/scene.html`'s `sg-ready` wait takes `?readyTimeout=<ms>` (default 30000). Raise it for a specific slow check rather than lowering a check's patience elsewhere.

## Real differences found and fixed

Each was reproduced directly against real WebKit 26.6 or Firefox 155, isolated from the library's own code where possible, and is now either worked around with a real (if different) interaction, or recorded with `unsupportedIn`. See each commit on `batch/cross-browser` for the evidence.

- **WebKit: no clipboard permission grant, and no CDP session.** Fixed at the harness level (`tools/lib/engine.mjs`, `tools/lib/component-check.mjs`, `tools/lib/browser.mjs`). Every check that was crashing on `newContext()` now runs. Firefox has the same clipboard gap and the same fix (`grantsPermission()` and `unsupportedIn()` in `reach.check.mjs` and `otp.check.mjs`), and Firefox rejects `isMobile`.
- **WebKit: `window.AudioContext` is not always present at `addInitScript()` time** in the sound-scape checks' own instrumentation (no real audio device in this automated context), so `new Proxy(undefined, …)` threw. Guarded in `packages/sound/scapes/*.check.mjs`.
- **WebKit: no `MediaRecorder`**, so WebM export throws. The library throws a clear, named error (`packages/export/webm.js`: `recordCanvasToWebm: this browser has no MediaRecorder`). `packages/export/demo.html` catches it on its own (PNG and GIF do not depend on it), and `export.check.mjs` skips only the WebM-specific assertions.
- **WebKit: native `<input type="radio">` arrow-key navigation does not wrap past either end of a group.** Chromium and Firefox both wrap. This is platform behaviour with no library JavaScript involved. `radio.check.mjs` asks the same question (is the disabled radio skipped? does the last option end up chosen?) with a forward-only key sequence in WebKit.
- **WebKit: chat-thread's accessibility probe needs a CDP session** (`newCDPSession`, Chromium only) to read the real accessibility tree, because Playwright's own aria snapshot over-reports image children (see the comment above `heard()` in `chat-thread.check.mjs`). It is skipped on WebKit and Firefox with `unsupportedIn()`. Everything else in that check (axe, redaction, the reduced-motion bounce) still runs.
- **WebKit and Firefox: "ResizeObserver loop completed with undelivered notifications."** is the spec's own safety-valve notice (ResizeObserver §13.4). Verified directly: the identical `toast` and `sg-diagram` demo pages, at the identical 390 px viewport, produce no console message in Chromium and a real `pageerror` in WebKit. `dropBenignErrors()` removes only this exact message before `toast.check.mjs` and `diagram.check.mjs` assert on their collected errors.
- **Firefox: Customizable Select's keyboard navigation is incomplete.** Firefox opens a CSS-customised native `<select>`'s popover on Space, but does not route `ArrowDown` or `Enter` into it: focus stays on the `<select>`, the value never changes, and the popover does not close on `Escape`. Confirmed directly, isolated from the component (the element is entirely native). `select.check.mjs` records this with `unsupportedIn()` and sets the value with `selectOption()` so the drawing and form checks that follow still run.
- **Firefox: the `.autocomplete` IDL property does not recognise `"one-time-code"`.** `otp.check.mjs` read `input.autocomplete`, which Firefox returns `''` for even though the HTML attribute is present and Firefox's own SMS autofill honours it. It now reads `getAttribute('autocomplete')`, which is what autofill keys off.

## The browser floor (8 October 2026)

Playwright 1.63.0 with WebKit 26.6, Firefox 155 and Chromium, on Windows, on a machine that was busy with other work and allowed two browsers at a time (the whole WebKit suite took about 2.5 hours, against 72 minutes on a quiet machine). `node tools/checks.mjs --engine=webkit` ran 115 checks (the 114 of 7 October, plus the new `tools/lib/tab.check.mjs`) and **88 passed**, against 83 of 114 on 7 October. That run was taken part-way through the fixes below; the files that were red in it were then run again one by one, after the fixes: **101 of 115 pass**. That second number is a re-run of the red files, not a second whole-suite run. The runner now marks a file that passed but skipped part of itself `pass*` and ends with "N of M checks pass; K of those passed with skips", so these totals do not read as cleaner than they are; the 88 and 101 above were counted before that, and several of the passes include skips. The CI that matters runs on Linux, where we have not run WebKit; see decision 0027.

**Fixed, with the cause**

- **WebKit leaves links out of Tab (Safari reaches them with Option+Tab).** Seven component checks (event-card, person-card, site-footer, event-list, postcard, site-nav, wa-order) and the food-order recipe pressed Tab to a link and found nothing. `tools/lib/tab.mjs` (also exported from `tools/lib/component-check.mjs`) gives them `tab()`, `tabTo()` and `tabWalk()`. Where the engine tabs to links these are plain Tab presses. Where it does not, and the next stop by the HTML focus order is a link, they focus that link; every other stop is still a real Tab, and the helper throws if the real Tab lands anywhere other than where the DOM order promised. Each check has a control (the same probe with the target out of the tab order, or with one field out of the walk) that reads red in all three engines. `tools/lib/tab.check.mjs` holds the helper to account with controls of its own: a link with `tabindex=-1`, no `href`, `display:none`, `visibility:hidden`, inside `inert`, a disabled button, a radio group, a positive tabindex, and a stop the DOM walk cannot see. The helper prints one `skip` line saying it substituted.
- **wa-order: WebKit dropped the first click on Send after typing in a field (a library bug).** The stamp check, "the written line stamps in once", read red in WebKit. Cause, bisected: `wa-order.js` rewrote the Send link's `textContent` on every update, so on the field's `change` (which fires on mouse-down) the text node under the pointer was replaced before the mouse-up, and WebKit then makes no click. A bare page shows the same loss when a link's text is replaced between mouse-down and mouse-up, and none when only its `href` or position changes. The fix writes the text only when it differs (two lines in `wa-order.js`). Red before (no animation seen), green after, in WebKit and Chromium. Safari may have shown the same loss; we have not run Safari itself.
- **voice-note: a run of arrow presses on the waveform slid back in WebKit (a library bug).** Twenty ArrowRight presses moved the range by 5 and left the audio at 0.19 s; a bare `<input type="range">` moves 20 of 20 in the same engine. Cause: WebKit finishes an older seek late and reports its time, and the component wrote that time back to the range. The fix keeps the range where the person put it for 600 ms after each move and says the target again once they stop. After: range 20, audio settles. Chromium unchanged.
- **Chromium: the cross-document view-transition flake (about 1 run in 10, more under load).** Caught with `until-fail` on `transitions/page.check` (failed on run 12): `InvalidStateError: Transition was aborted because of invalid state. ViewTransition opt-in disabled`, raised as an uncaught rejection in the incoming page. Logging `pageswap` and `pagereveal` showed the outgoing page opted in, and in the failing runs the incoming page was revealed at `readyState` "interactive" with no transition; in passing runs it was revealed at "complete". Making the page ready sooner made it worse (no `demo.js`: 28% of runs), making it later made it better. Cause (we think, from the pattern, not from Chromium's source): Chromium reads the `@view-transition` opt-in from resolved styles, and a page that is ready to show before its styles have been resolved once is revealed without it. A one-line classic script after `page.css`, `getComputedStyle(document.documentElement).color`, resolves them first. Without it, 11 of 150 navigations failed (23 and 27 of 150 under heavier load); with it, 0 of 150, then 0 of 450 with three runs in parallel, then 30 clean `page.check` runs. The line is in the demo pages, the site-shell recipe, `page.docs.md` and `page.prompt.md`. A site that links `page.css` should add it too.
- **touch.check's good fixture read red in WebKit.** Bisected: only the last cell (playful, reduced motion, the radio) failed, only in a second browser context, and only when it ran after another register. In that cell the "before" snapshot was taken with the label and its whole chain up to `<html>` already matching `:active`: after an earlier press released away from the control, moving the mouse back over it finds it still pressed, so the press seems to change nothing. The probe now releases the mouse where nothing is, once, if anything matches `:active` before the press (it did so nine times in one fixture run). Every fixture goes red for its own reason and the good one stays green, in WebKit and Chromium. The library's WebKit count went from 9 of 41 components missing the contract to 2 (the player and veranda probes cannot load their demos in time; see below).
- **OffscreenCanvas (five scene checks) and AudioContext (three).** Playwright 1.64.0 is the current stable and ships WebKit 27.2; installed in a scratch folder, it has neither (`typeof OffscreenCanvas` and `typeof AudioContext` are `undefined` on a blank page), so the repo stays on 1.63. The five scene checks (`tinto/glass`, `tinto/words`, `vad/words`, `veranda/words`, `depth-photo`) used `OffscreenCanvas` only as a scratch surface in their own page code; they now use it where it exists and a DOM canvas where it does not, so they run in WebKit instead of being skipped (`glass` 49 of 49). `vel` was never an `OffscreenCanvas` case: see the slow-frame family below. The three audio checks (`sound-switch`, `paus-rain`, `rampon-koel`) ask `pageHas(browser, "typeof AudioContext === 'function'")` first and, where there is none, print a `skip` with the reason for every check that would pass at a count of zero, and run what can still be asked. `finish()` now says "no check ran" rather than "all 0 checks pass".
- **A mouse click gives a button no focus in WebKit (Safari's behaviour).** `menu` (Start again) and `popover` (no JavaScript) asked where focus goes after a click. `clickFocusesButtons(browser)` asks the engine on a bare page; where it says no, the check presses the same button from the keyboard, as the action-menu check already did, and the click form prints a `skip`.
- **No `<input type="date">` in this WebKit build.** The element's `type` reads back `text`, and typed digits stay as typed. `wa-order` and `food-order` (a date typed by hand), `date-range` (the minimum) and `field-note` ("Choose 16 October 2026 or later") skip those assertions with the reason.
- **WebKit-only faults in the checks, fixed:** `quote` (the broken-on-purpose page had no `<meta charset>`, and WebKit ignores the charset header of a fulfilled response: mojibake); `toast` (two error checks did not use `dropBenignErrors`); `tumble` (the bounce was sampled from the frames the engine drew, four across the fall; it is now stepped by hand at 60 Hz, and the late-font probe reads `document.fonts.status`, because in WebKit `fonts.check()` says true and the face reads "error" while the file is still coming); `data-table` (read the skin before its dynamic import finished); `proposal` (the check's route saw the page's own `blob:` URLs, which never leave the machine); `tinto/glass` (clipboard read-back skipped where there is no `clipboard-read` grant).
- **Firefox: `:active` while a key is held.** On a bare page with one button and one `:active` rule, holding Space puts the button at `outline-width: 7px` in Chromium and WebKit and leaves it at 1px in Firefox as Playwright drives it; a mouse press styles it in all three. So the "press with an arrow held" probes in `overlays` and `arrive` could never read `:active` there. `keyHeldActivates(browser)` asks the engine; where it says no, the check prints a `skip` and still asks that nothing moves. Red before (`arrive`, run on the commit before: "data-table playful: with an arrow held ... a press does not move", active false), green after (`arrive` 81 of 81, `overlays` 103 of 103). Whether a real keyboard in a real Firefox does the same we have not checked. (`Element.matches(':active')` reads false in every engine here, even while the style is applied, so the probe reads the style.)
- **Firefox: frames that do not repeat pixel for pixel.** Cause narrowed, not removed. A bare canvas draws the same bytes every time in Firefox (six kinds of drawing, five repeats each, and across two documents), so it is not the canvas. For `tinto/glass`, two page loads frozen at the same virtual second differ in 198 of 807,000 pixels, by at most 27 of 255 on a channel, all inside one 150 by 44 pixel patch at the end of the heading drawn over the picture. That is text rasterisation (glyph placement or anti-aliasing over a canvas), not the scene. `tile-band`'s "same seed, same bytes" compares `toDataURL()` across two page loads; its demo page repeated exactly in Firefox in our probe (0 of 54,000 pixels differ), so we could not reproduce that failure outside the check and leave it open.

**Reported as skipped, not run (with the cause)**

- `vel`, `chiro` and `mankurad` freeze their virtual clock at 20 to 25 seconds and look at the picture. Headless WebKit draws these scenes at a few frames a second (vel: 25 s of real time to reach 2 s of virtual time, and over 240 s without reaching 17 s), so a frozen frame cannot be waited for. Those sections printed a `skip`, and the rest of each check ran. **Since 12 October the skips are gone:** the three checks step scene time by hand (`tools/lib/virtual-time.mjs`), so a frozen frame is reached by stepping, not waited for. In WebKit on 12 October: `vel` 24 of 24 (a 5 m 50 s run, in the review of the change), `chiro` 14 of 14. `mankurad` now reaches the 25 s rain section and stops there: `page.evaluate: InvalidStateError: The object is in an invalid state` from `grabPixels` (`tools/lib/virtual-time.mjs`) on the first frozen grab, after 5 passes. One run, under load, not isolated; it is open, not skipped. Before 12 October, `maun`, `shet`, `vaati`, `veranda/arrange` and the touch probe for veranda failed for the same slow-frame reason (30 to 120 s waits, a 1,150 ms frame stall); `maun` and `shet` are stepped now too and have not been run in WebKit since.

**Still open in WebKit, with the cause as far as we know it**

- `player`: `page.goto` times out waiting for `load` on the demo, and the touch probe's player demo does not load in 8 s. Not root-caused; unchanged from 7 October.
- `chiro` (playful, "Enter leaves a damp print where the keyboard hand is, and nowhere else"): the region far from the hand changes in 99.9% of its pixels between the two frames, so the rain is falling in the second frame; we think it is the timing under slow frames (the wait is in real seconds, the rain's clock is the scene's), not isolated.
- `vaati`: `page.goto` times out at 30 s on a loaded machine; the same slow-frame family.
- `orient` (text integrity): after the turn, `unproject()` hands back rects 18.96 px from the flat ones where Chromium is within 1 px. A perspective-maths difference between engines, or in how `getBoundingClientRect` reports a 3D-turned box; not isolated.
- `field`: at 1280 px in warm and playful one `sg-field` has `scrollWidth` 736 against `clientWidth` 356: the SVG grain inside it is laid out 380 px to the right of the field in WebKit (not in Chromium). The page does not scroll sideways. Not fixed.
- `depth-photo` (quiet, the 2D tier): "Focus on the plate" does not sharpen the plate (sharpness 1339 to 1330). WebKit has no canvas `filter`; `depth-photo.2d.js` detects that and falls back to a down-and-up scale, and the fallback leaves the plate as sharp out of focus as in it. Probably a real gap for Safari's 2D tier.
- `vad/words` (dark, three registers): axe `color-contrast` on `#replay`, an unstyled `<button>`. In dark, this WebKit gives it white text on a light grey face (192) where Chromium's face is 107. The demo page styles nothing for its button. Platform default control colours; the fix, if wanted, is to style the demo's button.
- `toran`: "a hard brush swings the left strand much further than the breeze alone" (18.4 units brushed, 16.5 breeze only). We think it depends on the frame rate; not isolated.
- `enquiry`: "recipe.js alone: no page errors": the lazy import of `loader.js` is aborted by the form's navigation (as in Firefox); unproven.
- `abri` calm check: the known load-sensitive flake, in every engine.
- `tinto/words` contrast (playful) is red in **Chromium** too, on the commit before the browser floor work (light, 1 of 38; light and dark in another run). It is not an engine difference and not new.

## Open findings (as of 7 October; the floor section above supersedes the WebKit entries where it says so)

Each was looked at directly and not swept under a blanket filter, but was not fixed in that pass: either the fix needs more investigation, or it is undecided whether the answer is a library fix, a per-engine assertion, or accepting a real capability gap.

- **WebKit: `player.check.mjs` times out on `page.goto` (30 s, waiting for `load`)** with the player demo page, which embeds a WebM sample clip. Not root-caused. A `<video>` with an unsupported codec should not normally block `load`, so it is not yet fair to call it "WebKit has no WebM" the way the MediaRecorder gap is. It may be an adjacent issue in the demo page or the check.
- **Firefox: `stepper.check.mjs`, "Enter in a field moves to the next step, focus on its legend" (playful).** The step advances (the right fieldset becomes visible), but focus lands on `<body>` instead of the new step's `<legend>`. Not yet understood whether this is a timing issue in `packages/components/stepper/stepper.js`'s `legend.focus()` call (it runs right after the fieldset's `hidden` attribute changes, which Firefox may not have finished reflowing) or a Firefox `<input type="date">` Enter-key quirk. Left failing, because a real focus-management regression for keyboard and screen-reader users would be worse to hide than to leave visibly red.
- **Firefox: `enquiry.check.mjs`, "recipe.js alone: no page errors" is flaky.** It failed and passed across three consecutive runs, always with the same message (`TypeError: error loading dynamically imported module: .../components/loader/loader.js`). Working theory: the check's form submission navigates to `sent.html` while `sg-form`'s lazy `import('./loader.js')` is still in flight, and Firefox reports the aborted import as an unhandled page error that Chromium and WebKit do not. Not filtered, because the theory is not proven and a wrong filter could hide a real regression in this recipe's module graph.
- **WebKit: several components show small register- or viewport-specific differences** (`field.check.mjs` and `field-note.check.mjs` field-note wrap counts at 1280 px; one failing assertion each in `postcard.check.mjs` and `quote.check.mjs`) that were not individually triaged. Likely text-metrics or box-model rounding between engines rather than functional bugs, but that is an inference. Run `node tools/checks.mjs --engine=webkit` (or the individual `*.check.mjs` files) and read each failure's detail line before assuming any two share a cause.
- **`abri.check.mjs`'s calm-check pixel-drift assertion** was a known flake under load in every engine (first found under Chromium on 28 September 2026; it reappeared once in WebKit). **Fixed 12 October 2026 (`batch/vtime`):** the check now steps the scene's time on virtual frames, so two grabs half a second apart are always half a second of scene time apart and cannot straddle a stage change. Before: red 5 of 5 runs in Chromium under load (23% to 39% under the words); after: green 5 of 5, and its row is gone from the table below. It was never an engine difference. What stepped frames do not exercise is the quality governor (every step is 16.7 ms, so it stays at 1); the check forces a low level itself (`forceQuality` in `tools/lib/virtual-time.mjs`) for the veins-under-the-words clause.
- **WebKit: `action-menu.check.mjs`, two differences, both now asked in a way WebKit can answer (7 October 2026).**
  - *Escape after a mouse open*: WebKit does not give a button focus when the mouse clicks it (Safari's long-standing behaviour), so after a click the active element is `BODY` and the native popover has no focus to return. The mouse variant prints `skip` in WebKit (`unsupportedIn`); "opened from the keyboard: Escape closes the menu and returns focus to the trigger" asks the same question by focusing the trigger and pressing Enter, and passes in all three engines. A gap for pointer users who then reach for the keyboard.
  - *(JavaScript off) Tab to the first item*: WebKit's default leaves links out of the tab order (Safari reaches them with Option+Tab). Playwright's `Alt+Tab` does not do that on this build (it stopped on `mi-signout`, then an unnamed button), so the check probes the engine on a scratch page (a link and a button, one Tab) and asks for the first item the engine tabs to: `mi-profile` where links are tab stops, `mi-signout` in WebKit, with a `skip` line saying so. A control serves a copy of the demo with Sign out moved to the front of the list and requires the walk to land there, so an out-of-order list still reads red. Minimal repro: `a, button, a` then Tab four times is `a1 > b1 > a2` in Firefox and Chromium and `b1` only in WebKit. A Safari user with default settings and scripts off needs Option+Tab to reach the links; with scripts on, ArrowDown moves between items.
  - *Fixed in the same pass, also an engine difference in the check:* `venue/recipe.check.mjs` "the link shows a focus ring" failed in WebKit and Firefox. The link's ring is fine there (2px solid, `:focus-visible` matches, screenshots in `.shots/walk/focus-webkit.png` and `focus-firefox.png`); the check walked away and back with Shift+Tab / Tab, and that walk loses a link in WebKit (not a tab stop) and moved off it in Firefox. It now presses Tab, focuses the link, and reads the ring and `:focus-visible`, with a control that reads red when the outline is removed. `speakers/recipe.check.mjs`'s talk-link check had the same walk and got the same fix.
  Found by a cold walk-through of the handover, which also saw `accordion` fail in WebKit: that one was a race in the check (it read the playful transition before the skin had set `data-motion`) and is fixed.

### The whole suite in every engine (7 October 2026)

The full `npm run check` ran on a quiet machine on the branch of 7 October: **Chromium 112 of 114** in 72 minutes, **WebKit 83 of 114** in 72, **Firefox 101 of 114** in 108. Each failing file was then run alone, once on that branch and once on `main` as it stood before that work. Every failure below fails the same way on `main` (same check, same count), so none is new. The one exception was `speakers/recipe.check.mjs`, which was new in that work and walked Shift+Tab / Tab like venue did; it is fixed (see above). Files that passed when run alone are marked *flaky*. Grouped by what we think the cause is; "we think" means it has not been isolated from the library yet.

**Chromium**
- `transitions/page.check.mjs` was *flaky* (about one run in three, on `main` as well): Chromium aborts the cross-document view transition with `InvalidStateError: Transition was aborted because of invalid state. ViewTransition opt-in disabled`. **Root-caused and fixed on 8 October**; see the browser floor section above.

**WebKit** (the list below is the 7 October state; the browser floor section above says which of these are now fixed, skipped with a reason, or still open)
- *Links are not tab stops by default* (Safari's Option+Tab, see action-menu above). Checks that walk to a link with Tab find nothing: `event-card` (Save my seat, the sold-out alternative, the playful tear on focus), `person-card`, `site-footer`, `event-list` (the empty state's call to action), `postcard` (Tab walks the cards), `site-nav` (narrow: Tab into the open menu), `wa-order` (Tab walk order, three registers). The fix is the one action-menu uses: probe the engine, then ask for the first stop the engine really tabs to. Done on 8 October, each with its own control.
- *No `OffscreenCanvas` in the checks' own page code* on this WebKit build: `tinto/glass`, `tinto/words`, `vad/words` and `stage3d/depth-photo` crash in `page.evaluate` before asserting anything. (`vel` used to time out waiting for `?freeze` here; since 12 October it runs, on stepped frames.) Safari has shipped `OffscreenCanvas` since 16.4, so this is likely the Playwright build, not Safari.
- *No `AudioContext` in the automated context* (no audio device; the same gap as the guard above): `sound-switch` (the click makes no context), `paus-rain` and `rampon-koel` (no context, no voices).
- *Timeouts*: `player` (`page.goto`, see above), `food-order` (`browserContext.waitForEvent('page')` waits 30 s for a new page and none comes).
- *One check each, not triaged*: `data-table` (reduced motion: the playful skin check reads 0 animations), `date-range` (with JavaScript off, a date before the window is not refused by the input itself), `popover` (JavaScript off: focus does not return to the trigger, likely the click-focus gap above), `quote` (the control reads `â€œ`, so the check decodes the page in the wrong character set), `toast` (the ResizeObserver notice still reaches the error list), `tumble` (late web font: the font is already loaded when the check looks), `menu` (Start again: focus is lost, three registers), `wa-order` (a date typed by hand, and the written-line stamp), `core/orient` (the turn moves text rects 16.95 px), `proposal` (a `blob:null` request with every request blocked), `enquiry` (the import flake, as in Firefox above), `field` and `field-note` (above).
- `tools/touch.check.mjs`: 9 of 41 miss (button, empty, event-list, gallery, player, reach, site-nav, tabs, wa-order), and its own "good" fixture reads red in WebKit, so the probe itself does not yet work in this engine. Read it as unproven, not as nine broken components.

**Firefox**
- *`:active` while the keyboard is the input*: the press-with-an-arrow-held probes read `active false` in `overlays` (action-menu item and dialog button, three registers each) and `arrive` (data-table playful).
- *Pixels not repeatable*: `tinto/glass` draws the same frozen frame twice with 64 to 202 pixels different, and `tile-band`'s same seed does not paint the same bytes. The comparisons that rely on it fail.
- `tools/touch.check.mjs` is *flaky* here: 11 to 14 of 40 miss across runs on `main` and on the branch, and the list changes run to run, always "pressing it changes nothing within a frame" with reduced motion.
- `stepper` and `enquiry`: as above. `booking`: the right OTP code does not move on to the hold (timeout). `khazan`: Firefox reports an aborted Kalam font download as a console error. `menu` (playful): the count's settle sampled one frame differently. `depth-photo` runs past 15 minutes and is killed (fixed on 12 October: the harness hung on a page with JavaScript off, see "CI on Linux").
- `sound-switch` and `themb` are *flaky* (both pass alone).

### Chromium, text tier rung 2 (9 October 2026)

The full `npm run check` ran in Chromium on `run/text-tier` (`fd16f23`): **110 of 114**. The four failing files were then run three times each, interleaved, on `main` (`d63e3f9`) and on the branch. The branch passed all twelve runs, so none of the four is new:

- `abri.check.mjs`, the calm-check drift: failed on `main` in 2 of 3 runs (23.39% and 2.64% under the words), the known flake above. (Fixed 12 October 2026: see *Open findings*, the abri entry.)
- `veranda.check.mjs`, "the crowns have no pale dotted rim": failed on `main` in 1 of 3 runs (3 of 22 edge rows, worst 40 against a limit of 28). The threshold sits at the edge of the noise; it passes alone at 33 to 36.
- `studio-home/recipe.check.mjs`, playful dark, one piece not skinned: passed alone 3 of 3 on both. Load only.
- `prahar.check.mjs`, `net::ERR_NO_BUFFER_SPACE` in quiet dark: a Windows socket-buffer error under load; passed alone 3 of 3 on both.

Not one of the four, but worth knowing: `tinto/glass.check.mjs` passed in the suite and is *flaky* on `main` too: in interleaved runs `main` failed 1 of 7 and the rung 1 branch 0 of 7, both on the same two warm frozen-frame checks (26 pixels changed in a 1100 by 734 frame that should not change at all).


### WebKit, text tier (9 October 2026)

The full `npm run check` in WebKit on `run/text-tier` (`5ce3732`): **85 of 117** (7 October: 83 of 114). Each of the 32 failing files was then run alone in WebKit on `main` (`d63e3f9`) and on the branch. 30 fail on both, the same way; `field` and `veranda/arrange` passed alone on both (load). `toran.check.mjs` failed on the branch run alone and passed once on `main`, then failed on `main` in 2 of 3 more runs ("a hard brush swings the left strand much further than the breeze alone", 13.6 against 7.8 to 8.9 units): a flake on both, and toran is untouched by the run. None is new.

New this run, and the same on `main`: `tinto/words`, `tinto/glass` and `vad/words` crash in their own check code in Playwright's Windows WebKit, which has no `OffscreenCanvas` (`ReferenceError: Can't find variable: OffscreenCanvas`). So there is no WebKit evidence yet for the live words in those scenes. Being fixed in the text tier: the oracle gets a document-canvas stand-in when `OffscreenCanvas` or its 2D context is missing (Safari before 17), and the checks stop assuming it.

## Known flakes

`node tools/checks.mjs` reads this table. A row excuses one failing line of one check in one engine, for a limited time. When a check listed here goes red in the engine named, and every failing line it printed (each indented problem under a `FAIL`, or the `FAIL` line itself when it has none) is named by a live row's clause, the runner prints `FAIL (known: <cause>)`, counts it apart from new reds in its summary, and leaves it out of the exit code: **the exit code counts only new reds.** A listed check that passes prints `pass` as usual. A known red is recorded, not re-run (RUNBOOK §6.2); any red not named by a row is a new red, and is compared with `main` before anyone believes it.

**What makes a row.** It goes in only when the flake has been seen failing on `main`, with the evidence cited in the last column (catch it with `tools/until-fail.mjs` first). A check that fails every time is not a flake: it stays red until it is fixed (`veranda/words.check.mjs` since the M1 merge, for one). Take a row out when its cause is fixed.

- **Clause.** The failing line the row excuses. The runner matches it against each printed red: the `FAIL  <name>  (<detail>)` line and the indented lines under it. Write `/regex/` (flags after the closing slash), or plain text (a case-insensitive substring), or `*` for the whole file. `*` is the escape hatch for a flake whose failing line cannot be named; it expires like any other row. A red in a listed file whose line the clause does not name is a **new red**, and so is a red that printed no `FAIL` line at all (a crash) unless the row is `*`.
- **Added and Until.** `Added` is the date the row went in (YYYY-MM-DD). `Until` is empty, which means 14 days after `Added`, or an explicit date. After that day the row stops excusing, the runner prints `expired flake row: <check> (<engine>) "<clause>" (added <date>, expired <date>)` at the start and in the summary, and the red counts as new. To renew a row, reproduce the flake again on `main`, cite it, and change `Added`; do not just move `Until`.
- **Engine** is `chromium`, `webkit`, `firefox` or `all`. The runner reads the first six columns, so keep `|` out of the cells (a regex that needs alternation is two rows).

| Check | Engine | Clause | Cause | Added | Until | Recorded |
|---|---|---|---|---|---|---|
| `packages/scenes/veranda/veranda.check.mjs` | chromium | the crowns have no pale dotted rim | the threshold sits at the edge of the noise (worst 40 against 28) | 2026-10-09 | | above, *Chromium, text tier rung 2* (`main` 1 of 3; alone 33 to 36) |
| `packages/transitions/page.check.mjs` | chromium | InvalidStateError | the cross-document view transition aborts (InvalidStateError: ViewTransition opt-in disabled), about one run in three; not root-caused. The abort surfaces in "no console or page errors across the navigation" | 2026-10-07 | | above, *The whole suite in every engine* (on `main` as well); the exit gate of 7 October |
| `packages/scenes/tinto/glass.check.mjs` | chromium | the frozen warm frame is repeatable | two warm frozen-frame checks see 26 pixels change in a frame that should not change | 2026-10-09 | | above, *Chromium, text tier rung 2* (`main` 1 of 7); the exit gate of 9 October. Clause read from the check file: these are the two warm frozen-frame comparisons; confirm on the next catch |
| `packages/scenes/tinto/glass.check.mjs` | chromium | without movable, Tinto warm is pixel for pixel | two warm frozen-frame checks see 26 pixels change in a frame that should not change | 2026-10-09 | | above, *Chromium, text tier rung 2* (`main` 1 of 7); the exit gate of 9 October. Clause read from the check file: these are the two warm frozen-frame comparisons; confirm on the next catch |
| `packages/scenes/toran/toran.check.mjs` | webkit | a hard brush swings the left strand | reads 13.6 against 7.8 to 8.9 | 2026-10-09 | | above, *WebKit, text tier* (`main` 2 of 3) |
| `tools/touch.check.mjs` | firefox | /changes nothing in .* within a frame/ | reduced motion: 11 to 14 of 40 "pressing it changes nothing within a frame", a different list each run | 2026-10-07 | | above, *The whole suite in every engine* (on `main` and the branch) |
| `packages/recipes/enquiry/enquiry.check.mjs` | firefox | recipe.js alone: no page errors | the form navigates while loader.js is still importing, and the aborted import is reported as a page error | 2026-10-07 | | above, *Open findings* (failed and passed in three runs) and *The whole suite in every engine* (the same on `main`) |
| `packages/recipes/enquiry/enquiry.check.mjs` | webkit | recipe.js alone: no page errors | the same aborted loader.js import as in Firefox | 2026-10-07 | | above, *The whole suite in every engine*, WebKit (the same on `main`) |

Rows added on 7 October expire on 21 October and rows added on 9 October on 23 October, unless someone has caught the flake again and renewed them.

## Adding a new engine-aware check

1. Reach for `harness()` in `tools/lib/component-check.mjs` if the check can use it. It already routes through `contextOptions()`.
2. If the check builds its own `browser.newContext()` calls, wrap the options in `contextOptions(engine, opts)`. Get `engine` from `engineName()`, called once near the top of the file, the way every check in this repo does.
3. If an assertion needs something only some engines provide, guard it and call `unsupportedIn(engine, thing, reason)` rather than letting it throw or silently pass.
4. Before assuming something is "just how the engine is", reproduce it in isolation (a bare page, not the whole check) and try to understand why before writing the workaround. Every fix in this file exists because that step turned up the real cause.
