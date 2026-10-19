# Tools

The eyes of the build. Every tool starts its own server and headless Chromium, so nothing else needs to be running. Output goes to `.shots/` (git-ignored) unless you pass `--out`.

Every tool takes a target in the same way:

- `--scene <name>` (or the name as the first word) opens `tools/harness/scene.html?name=<name>`, which mounts one `<sg-scene>` from `packages/scenes/<name>/`.
- `--url <path>` opens any page in the repo, such as `/apps/docs/index.html`. There is no wrapper page; the path is loaded as it is.
- `--register quiet|warm|playful`, `--theme light|dark`, `--palette <name>`, `--seed <n>`, `--param key=value` (repeatable, becomes an attribute on the scene) and `--content` (slots a sample heading and paragraph into the scene).

Component demo pages (`--url /packages/components/<name>/demo.html`) load `tools/harness/demo.js`, which reads `?register`, `?theme` and `?palette` before first paint. The tools pass those as query params to every `--url` page, set the same `data-*` attributes on `:root` after load, and wait for `window.__ready` when the page declares it. A page that declares `__ready` and never sets it fails as not ready. `tools/fixtures/demo-page/demo.html` is a stand-in demo page.

Screenshots hold every `requestAnimationFrame` loop for the moment of capture, through a hook the tools install before any page script. The piece itself is never paused, so its play/pause toggle shows its real state. CSS animations keep running.

`--scene fixture` is a small stand-in scene in `tools/fixtures/fixture-scene/`. It does not depend on `packages/core`, so the tools can be tested on their own.

On Git Bash for Windows, set `MSYS_NO_PATHCONV=1` before passing `--url /...`, or Git Bash rewrites the path into `C:/Program Files/Git/...`.

## serve

```
node tools/serve.mjs 5173
```

Serves the repo root with no caching and logs every 404. Open `http://127.0.0.1:5173/tools/harness/scene.html?name=kolam&register=playful&theme=dark&seed=3`. Other scripts use `startServer({ root, port })` from the same file.

## The harness

`tools/harness/scene.html` takes `name`, `register`, `theme`, `palette`, `seed`, `content=1`, and passes every other query param to the scene as an attribute. It loads `packages/tokens/tokens.css` if it exists, then `packages/core/index.js` and the scene. It sets `window.__piece` to the element and `window.__ready = true` after `sg-ready`. If anything fails to load, the page shows the error in a red box, logs it to the console, and sets `window.__error`.

`?freeze=<seconds>` makes a scene deterministic. It replaces `performance.now`, `Date.now` and the `requestAnimationFrame` timestamp with a clock that moves exactly 1/60 s per frame from the moment the scene mounts and stops at `<seconds>`. It also seeds `Math.random`. When the clock stops, the harness pauses Web Animations, calls `seek(time)` if the scene has one, and sets `window.__frozen = true`.

## shot

```
node tools/shot.mjs kolam 1 3 --register playful --seed 3
node tools/shot.mjs kolam 2 --width 390 --touch --dpr 3 --reduced
node tools/shot.mjs kolam 1 4 --click 0.3,0.6@2 --call reseed@3
node tools/shot.mjs --url /apps/docs/index.html 1 --selector main
```

Saves a PNG at each second you list (2 if you list none). `--move` and `--click` take fractions of the scene, `--call` calls a method on `window.__piece`. Also `--width`, `--height`, `--dpr`, `--touch`, `--selector` (default `#box` for scenes, the viewport for pages) and `--out`. Prints console errors, page errors and failed requests, and exits 1 if there are any, unless you pass `--allow-errors`.

## matrix

```
node tools/matrix.mjs --scene kolam --seed 3 --content
node tools/matrix.mjs --url /apps/docs/index.html
```

Fifteen cells: the three registers at desktop (1280 px) and phone (390 px, 3x, touch), in light and dark, plus a reduced-motion cell for each register. Each cell records a screenshot, errors, whether the page scrolls sideways, and at phone width whether a tap lands at the right place in the scene. For that check the scene has to expose `lastPointer` (`{ x, y }` in its own units) and `meta.W` and `meta.H`; if it does not, the check says "not run" and why. A page target gets the check when it exposes `window.__piece`, and "n/a" otherwise. `--at` sets how long the piece runs before the screenshot (2 s by default).

It writes `.shots/matrix/<target>/index.json` and a contact sheet, `index.html`, with every cell and its verdict. Open the sheet and look at it.

## axe

```
node tools/axe.mjs --scene kolam --content
node tools/axe.mjs --url /tools/fixtures/broken-page/index.html
```

Runs axe-core with the WCAG 2.2 AA tags (`wcag2a wcag2aa wcag21a wcag21aa wcag22aa`) in every register and theme (six runs; narrow it with `--register` or `--theme`, or use `--phone`). Prints each violation with the selectors it hit and exits 1 on any. Rules axe could not decide, such as text contrast over a canvas, are listed as "to review by hand". `--json` prints everything.

`tools/fixtures/broken-page/` is broken on purpose. axe must report five violations there.

## perf

```
node tools/perf.mjs --scene kolam
node tools/perf.mjs --scene tollem --uncapped --json
```

Before anything, it samples the CPU for a second. Above 30% busy it measures nothing: it prints `not measured: the machine is N% busy` and exits 3 (neither pass nor fail); `--force` measures anyway and stamps the result `under load`. The run's own busy figure (the browser's work included) over 30% also stamps `under load`; it never refuses, because the margin for the browser's own share has not been measured on a quiet machine (owed). Then it runs the target and the Paus baseline in turn, four times each by default (`--rounds`), for 12 s in total each (`--seconds`). Reports mean, p95 and worst frame time, dropped frames, long tasks, and the JS bytes the page loaded, grouped by folder so each piece's own weight shows. It prints the ratio to Paus for each round, a bootstrap 95% interval of those ratios, and the verdict against the 10% budget: `WITHIN` only when the interval's upper bound is under the budget, `OVER` only when its lower bound is over it, otherwise `INCONCLUSIVE` (measure again on a quieter machine). It also prints the machine and how busy its CPU was. review-pack shows this line as advisory. If Paus does not exist yet, it says so. `--baseline none` skips it.

Headless Chromium caps frames at 60 Hz, so anything that fits in a frame reads 16.7 ms. `--uncapped` lifts the cap and shows the cost of a frame instead. WebGL runs on the CPU in headless Chromium, so read the ratio, not the absolute numbers.

### perf at a moment

```
node tools/perf.mjs --scene abri --register playful --content --at 33 --seconds 3 --rounds 1
node tools/perf.mjs --scene abri --register playful --content --at 33 --quality low --seconds 3 --rounds 1
node tools/perf.mjs --scene abri --register playful --content --at 18 --settle 13 --throttle 4 --rounds 1
```

Without `--at`, the window opens at the first frame after ready, so a cost that lands later (abri's drift, about 33 s in, with words slotted) is never seen. `--at S` brings the scene (and the Paus control, so the load matches) to S seconds of its own clock first. The scene element has no seek, so the page's `requestAnimationFrame` is wrapped (`tools/warp.core.js`): every frame still plays, back to back with a stepped timestamp and no vsync wait, then the real clock carries on from there. The output prints the moment at the window's start and end (the scene's stage and `u`, if it exposes them, as abri does) and the frame mean by second. `--content` slots words (the calm zone only costs anything with words). `--quality low` warps in 34 ms frames so the governor steps down to its floor first (it cannot be pinned from outside, and a fast machine climbs back after about 4 s). `--settle S` plays S more real seconds before the window, and `--throttle N` slows Chromium's CPU N times, for both the scene and the control. The scene's clock keeps running during a settle, so count it into `--at`.

## contact-sheet

The whole matrix on one PNG. Quiet, warm and playful down the side; across the top, the page at 1440 px (light and dark), at 390 px (light and dark) and with reduced motion. Fifteen cells, each labelled, with the console-error count in red where there is one. `matrix.mjs` shoots a piece at rest into many files; this one can first take the page to the moment the piece exists for with `--act` steps, then tiles the result.

```
node tools/contact-sheet.mjs --url /packages/components/drawer/demo.html --name drawer   --act "click:a[data-sg-drawer=rooms]" --act "wait-for:#rooms dialog[open]" --act settle
node tools/contact-sheet.mjs --url /apps/docs/index.html --name home --at 3
```

Steps: `click:SEL`, `press:KEY`, `hover:SEL`, `wait:MS`, `wait-for:SEL`, `settle` (every animation finished), `eval:JS`. A step that cannot run is named in that cell's label ("step failed") instead of passing as a blank shot. Output goes to `docs/shots/front/<name>-contact.png` beside a `.json` of per-cell errors. It exits non-zero if any cell had a console error, page error or failed request.

## strip and onion

Motion an agent can read. One screenshot at 2 s says nothing about how a scene moves; these two say it in one image and a few numbers. The idea is borrowed from fframes (MIT); the code is ours.

```
node tools/strip.mjs vad -n 12 --from 0 --to 45 --facts
node tools/strip.mjs tinto -n 12 --to 8 --content --param movable= --param "words-at=0.95 0.05" --facts --json
node tools/onion.mjs kolam --from 2 --to 6 -n 6
node tools/onion.mjs vad --from 0 --to 45 -n 8 --diff
```

**`strip`** lays N evenly spaced frames (`-n`, default 12, both ends included) between `--from` and `--to` seconds (default 0 to 8) on one PNG. Each cell is labelled with its time and how much of the picture changed since the cell before; the header gives the target, register, theme, seed, params and which clock it used. Options are `shot.mjs`'s (target, `--register`, `--theme`, `--seed`, `--param`, `--content`, `--width`, `--height`, `--dpr`, `--reduced`, `--selector`, `--out`, `--allow-errors`), plus `--cols`, `--cell-width`, and `--frames` to keep every frame as its own PNG. It writes `.shots/strip/<target>-<register>-<theme>-strip.png`.

**`onion`** blends the frames onto one PNG, older ones fainter, so a path and its easing show in one picture: evenly spaced ghosts are constant speed, ghosts crowding at one end are an ease. The still background stays exact (it is the per-pixel median of the frames) and each frame's moving pixels are laid over it, oldest first, at rising opacity. `--diff` shows only the pixels that change, each step's in vermilion over a faded last frame, older steps fainter; it says where things change, and older steps show only as a paler rim where the newest step has not painted over them. Where the picture changes everywhere (a growing tree, a season) the median has no still background to keep, and the diff fills in solid; read the order of growth from a strip, and use the onion for things that move through a still scene. It writes `<target>-<register>-<theme>-onion.png` (`-onion-diff.png`) to `.shots/onion/`.

**The clock.** A scene runs on the harness's frozen clock, played by hand a 1/60 s tick at a time, so the same seed gives byte-identical frames and a frame at 40 s costs the time to draw it, not 40 s of waiting. The page loads as it normally would and the tool takes over at the scene's own `sg-ready` (holding every `requestAnimationFrame` loop from the first script instead changed the order of a scene's real events and frame callbacks; Tinto's glass then settled a few pixels apart from load to load). It then waits for the network and fonts to go quiet with the clock standing still, and steps. Times are the scene's clock, counted from when it mounted, and a cell asked for before the scene was ready shows the first moment it can be seen and says so. A stepped frame equals what `?freeze=<t>` draws in the harness (checked pixel for pixel on the fixture, Tinto and Vad). Web Animations and CSS animations run on the real clock, so a scene made of them will not repeat; the tool notes when any were running. A page (`--url`) has no harness clock, so it is taken in real time, and `--real` does the same for a scene; the header says `real clock`, and two real strips are never the same twice.

**`--json`** prints JSON alone on stdout (everything else goes to stderr): per cell its requested time, its actual clock time and frame, whether the piece was `playing`, mean luminance (0 to 1), and the changed-pixel share, count and bounding box against the cell before. A pixel counts as changed when its colour moves more than `--threshold` (0.02, a redmean distance; the one pixel rule and its reasons are in the header of `tools/lib/pixels.mjs`, which `pixeldiff.mjs` and `strip.mjs` re-export). An agent can then say "motion stops between 4 s and 6 s" from numbers.

**`--facts`** prints where motion happens (the bounding box of the changed pixels for each step, and their union) and flags two failures:

- a **frozen span**: a run of cells with no change (at most 0.02% of pixels) that lasts longer than `--still` seconds (default 1.5) while the scene's `playing` is true at every cell. The same run while it is not playing is listed as at rest and not flagged; a page with no `playing` reports it as unknown.
- a **jump**: a step that changes at least 5% of the picture and at least four times what the steps round it (two either side) change, counted no lower than 0.5%. The usual sign of a stage cut or a pop.

Both are sampled at the strip's spacing, and `--facts` says how long that is: a freeze or a jump shorter than one step can hide between two cells, so raise `-n` to look closer. Flagged cells get a vermilion frame and a tag on the sheet. The abri and chiro flakes in the ledger (a ratio measured across a stage change, or against rain still falling) are the family a strip shows at once: the step that straddles the change is the jump.

`tools/fixtures/motion-scene/` (`--scene motion`) is a dot orbiting a ring with two optional faults, `--param stall=3-5` (the dot stops while still playing) and `--param cut=7` (the picture changes at once), so the facts have something known to find. `node tools/strip.check.mjs` runs the gates by hand (it is not under `packages/`, so `npm run check` does not pick it up; `GATE=2` runs one): determinism against a real-clock control that must differ, the stall and the cut found and their absence reported on the plain fixture, stepped frames against `?freeze`, the onion's ghosts, and `--json`.

## print-check

```
node tools/print-check.mjs /tools/fixtures/print-check/index.html [--query '&offset=80'] [--at 0,1] [--engine=webkit]
```

Does a page draw its print where its own model says it is? The page sets `window.__printCheck = { plan(), at(t) }` (the contract is in the header of `tools/print-check.mjs`): `at(t)` returns the frame with and without each layer as base64 RGBA, and the shapes it predicts for the layer. The tool diffs the frames (`tools/lib/pixels.mjs`, in Node), prints a line per layer and sample with the share of ink inside the prediction, on the layer under it, covered and spilled, and the control's: the prediction slid away, which must fall. Thresholds are fixed in the tool (inside 0.8, on 0.85, covered 0.85, spill 0.08, control below 0.6 and 0.5). It exits 1 on any failure, and a layer with under 200 ink pixels or a control that does not fall is a failure, not a pass. `node tools/print-check.check.mjs` is its red proof against the fixture page (`?offset=80`, `?cloth=60`, `?wide=1`, `?tiny=1` plant faults). Run it with `MSYS_NO_PATHCONV=1` in Git Bash, or the page path becomes a Windows path.

`tools/lib/pixels.mjs` is the one pixel module: `pixelDistance` (redmean on alpha-over-white) with two named thresholds, 0.02 for "did it move" and 0.08 for "is this a layer's ink", then the strip and onion frame maths and the print-agreement maths (`diffMask`, `rasterize`, `agreement`, ...). It has no imports, so it runs in Node and in a page. `lib/pixeldiff.mjs` and `lib/pixelcheck.mjs` re-export it.

## touch.check

`node tools/touch.check.mjs` is the microinteraction check (the rules are in `docs/contributing/touch-contract.md`; it also runs inside `npm run check`). For every interactive component in the registry, decided from its demo markup and scripts, it requires a press state in each register, a `:focus-visible` style and reduced-motion handling, and names the component and what is missing. A static CSS scan alone can be fooled by an `:active` rule that changes nothing, so a browser probe presses each control on its own demo and requires a computed-style change within a frame, no transition on press-in, no movement under reduced motion, a focus ring on Tab, and no transition on a held arrow key. It runs the fixtures in `tools/fixtures/touch/` first: each broken one must go red for the reason in its `expect.json`, and the good one must stay green. `--static` skips the browser, `--only tabs,toggle` picks components, `--fixtures` runs only the fixtures, `--json` prints the data. The pure half is `tools/touch.core.js`, tested in `touch.core.test.mjs`.

## checks, --changed and browser slots

`node tools/checks.mjs` (also `npm run check`) runs every `*.check.mjs` under `packages/` and `recipes/`, plus `tools/touch.check.mjs`, one at a time, each in its own process with a timeout (`SG_CHECK_TIMEOUT_S`, default 900 s). `--engine=webkit|firefox` or `SG_ENGINE` picks the engine.

**Only what the slice needs.** `node tools/checks.mjs --changed` takes the files that differ from the merge-base with `main` (committed, staged, unstaged and untracked; `--changed=<ref>` or `SG_BASE=<ref>` names another base) and prints the checks it picked with a reason for each, then runs them. It picks:

- every check in a folder the diff touches (a check in a shared folder such as `packages/components/overlays.check.mjs` is chosen only by the pieces it covers, listed in `COVERS`, or by its own edit);
- the checks of every registry item that depends on a changed item, at any depth (the `dependencies` of `registry/registry.json` are item names, mapped to the folder of the item's manifest);
- `tools/touch.check.mjs` when a component changed;
- `apps/docs/site.check.mjs` (its all-pages loop: every item reachable, one live drawing per scene page) when `registry/registry.json` changed, which is what a new or removed piece does. The docs checks that name a piece (`door`, `embed`, `hero` and so on) follow that piece's folder and its dependents; an edit inside an existing piece does not select the site loop, since it cannot change which pages exist, and the rung's whole suite runs it once;
- everything, when the diff touches a shared primitive: `packages/core/`, `packages/engine/`, `packages/tokens/`, `tools/lib/`, `package.json`, and also `package-lock.json`, `tools/serve.mjs` and `tools/harness/`, which every check goes through. A changed signature in a shared function once broke a stage that only the whole suite saw, so there is no cleverness here.

`--dry` prints the selection and stops (on its own it lists every check). A full run stays the gate before a merge. The choosing is `tools/lib/changed.core.js` (pure, tested in `changed.core.test.mjs`); the git and registry reading is `tools/lib/changed.mjs`.

**Browser slots.** This machine has few cores, and a dozen browser suites at once made every timing check lie. A slot is a lock file made with the `wx` flag in `<tmp>/susegad-browser-slots/` (the lock holds the pid, the start time and a label); a process that wants a browser waits for a free one and prints `waiting for a browser slot (held by: ...)` once. A slot whose pid is gone is reclaimed. `runCheck` takes one slot per check process and holds it for the child's life (a child pid is recorded, so the slot outlives a killed parent while the check still runs), and puts `SG_SLOT_HELD=1` in the child's env so the helpers it calls (`session()` in `lib/browser.mjs`, `harness()` in `lib/component-check.mjs`) do not take a second one. Those helpers take a slot themselves when you run a tool or a check by hand. Settings:

| variable | meaning |
| --- | --- |
| `SG_BROWSER_SLOTS=<n>` | how many browsers at once; default `max(1, floor(cpus / 2))` (2 on a 4-core box); `0` means no limit |
| `SG_SLOTS_DIR=<dir>` | the shared directory (default `<os tmp>/susegad-browser-slots`); processes that should share slots must resolve to the same one |
| `SG_SLOT_HELD=1` | set by `runCheck` for its child; do not set it by hand |

Known limits: a check or tool that calls `chromium.launch` itself, outside `runCheck` and the two helpers (`lib/scene-probe.mjs` and a few older checks), is not limited when run by hand; a pid reused by an unrelated process keeps a dead slot looking alive; the slot is released on exit and on SIGINT, and a hard kill is cleaned up by the next taker through the stale check.

## Smoke tier

```
npm run smoke                       every demo page the registry lists
npm run smoke -- --changed          only the items the diff against main reaches (a shared primitive reaches all)
npm run smoke -- --only menu --json .shots/smoke.json
npm run smoke -- --engine=webkit    or --reduced for a third, reduced-motion pass; --jobs n for parallelism
```

Between `npm run gates` (seconds, no browser) and `npm run check` (an hour or more). One browser through a slot (`tools/lib/slots.mjs`), one dev server, a fresh context per pass of each page. The pages are every `.html` file an item lists plus its `demo.html` and `index.html` (the rule `apps/docs/build.mjs` ships demos by), so a new item is covered the day it has a demo. Per page:

- it loads with no console error, page error, failed request (a cancelled media or fetch request is the page going away, not a failure) or third-party request;
- every visible `<sg-scene>` on the page (a recipe or a component demo too) paints its first frame (`sg-ready`), counted scene by scene, so one painted scene does not vouch for a blank neighbour. Scenes a script adds after load are caught by a second look after axe, and a scene inside a closed `<details>` is held to the same rule once smoke opens it. A scene hidden by design is not waited for and is printed as `not checked: hidden  <page>  (<scene names>)`, with the count in the summary line, never passed in silence;
- axe is clean for WCAG 2.2 AA, once, at 1280 px in the page's default theme and register (`--registers` runs the other five cells, below; without it `tools/matrix.mjs` and `tools/axe.mjs` do them, so a dark-theme fault passes smoke);
- nothing scrolls sideways at 390 px (`tools/lib/overflow.mjs`).

It prints a table of failures with the page, the kind (`error`, `axe`, `viewport`, `sideways`, `not-ready`, `timeout`) and the message, ends with the time and the machine's CPU busy before and during the run, writes the full result with `--json`, and exits 1 on any failure. A time taken while other agents hold the CPU is a guess; the run says how busy the machine was.

`node tools/smoke.mjs --page /tools/fixtures/smoke/wide.html` runs exactly the pages named. `node tools/smoke.check.mjs` is the red proof (a page that throws, an axe violation, a 420 px element, a missing script, a missing viewport meta, a scene that never fires `sg-ready` (also one added late, at 0.7, 1.5 or 3 s, on a page that has another scene: a page with a scene is watched until 4 s after load and 1.5 s since the last scene was added, and a page with none is not held; one inside a closed `<details>`, and one painted scene beside a blank one), a hidden scene that must be listed and a page that never finishes each turn it red in its own kind, and the clean page stays green; the last two run with `SG_SMOKE_SCENE_MS` and `SG_SMOKE_PAGE_MS` shortening the 15 s and 60 s waits); it launches Chromium, so it runs by hand, not under `npm test`. The decisions are pure and tested in `tools/lib/smoke.core.test.mjs`.

### Accessibility depth

Three passes are on in every run and cost one page load each, no more axe. Two more are asked for. `tools/lib/a11y.core.js` holds the decisions (pure, tested in `a11y.core.test.mjs`); `tools/lib/a11y.mjs` gathers the facts in the page.

```
npm run smoke                              the tree, contrast over canvas and forced colours, with the rest
npm run smoke -- --registers               axe in all three registers and both themes (six cells a page, on the desktop pass)
npm run smoke -- --open                    axe on the open states (dialog, drawer, popover, action menu, menu with an order)
npm run smoke -- --a11y                    both of those
npm run smoke -- --record-a11y --only x    write tree baselines for the pages, after you have read them
npm run smoke -- --no-forced               (or --no-tree, --no-contrast, --no-a11y) leave a pass out
```

- **The tree** (`tree`, `tree-changed`, `tree-missing`). Playwright's `ariaSnapshot()` of the page, cut to a skeleton (running text goes, so a copy edit is not a change; every heading, link, button, field and image name stays) and held to what a reader relies on: every button, link, field and image has an accessible name, one `main` landmark, at least one heading. The baseline is one file per page in `tools/a11y-baseline/` (`<path with __ for />.aria.yml`); a page whose tree differs is red and the message names the lines that moved, and a page with no baseline is red too. Re-record with `--record-a11y` after reading the diff; it is the only way a change is accepted. A new page's first smoke is red (`tree-missing`) until you record its tree with `npm run smoke -- --record-a11y --page <path>`, and the reviewer reads the new `.aria.yml` in the diff. The baseline is Chromium's: WebKit and Firefox build a different tree for the same page (WebKit adds group, list and status nodes; 60 of 120 pages differed), so in those engines the tree is judged for names, one main and headings, and not compared. Text that changes per load is masked by a named rule in `MASK_RULES` (the dev server's port, the export demo's file sizes), printed with the page when it fires. A page that has no main or heading by design, or a known forced-colours finding, is in `tools/a11y-baseline/exempt.json` with its reason (a DEBT row where it is a defect), and every run prints it as `exempt`. A broken `exempt.json` is an error, not an empty list.
- **Contrast over canvas** (`contrast`). For every piece of DOM text that sits over a visible `<canvas>` (captions, labels, overlays, in shadow DOM too), the page is shot with every glyph made transparent, so the pixels are what really is behind the words (the canvas and any scrim or panel the page puts between them), and the WCAG ratio of the text colour against those pixels is taken: 4.5:1, 3:1 for large text. A box is scored at the lowest quarter of its pixels, so a strike-through scribble or a hatch line over a few of them does not fail a label, and half the words on a pale patch does. The run prints the worst box on each page that has words over a canvas. It reads one frame of a moving scene, does not model text shadows or outlines, and skips visually hidden text (the sr-only pattern).
- **Forced colours** (`forced`, Chromium only: Playwright's emulation does nothing in WebKit or Firefox). A third pass with `forcedColors: 'active'` that loads with no errors, is axe clean (without `color-contrast`: there the browser paints its own colours and axe reads the author's), and asserts two things that are visible in a screenshot: every focusable control keeps text, a border or outline, a graphic (an `<svg>`, an `<img>`, a pseudo-element glyph or box) or its native look, and no text ends up the same colour as its ground. Not asserted: text over a picture, a canvas or a video (the ground is not a colour), the track of a range slider styled through `::-webkit-slider-*` (taken as drawn), and anything WebKit or Firefox would do.
- **Registers and open states** (`axe-cell`, `axe-open`, `open-failed`). `--registers` sets `data-register` and `data-theme` on `:root` as `tools/lib/browser.mjs` does and runs axe in each of the six cells; a violation the page's own axe already named is not repeated. `--open` clicks through a small named list per page (`OPEN_ACTIONS` in `a11y.core.js`, and any `<meta name="smoke-open" content="name | open selector | expect selector">` a page declares), waits for the state, runs axe, presses Escape. An action whose trigger or state is missing is `open-failed`: a list that rots is red, not green.

`node tools/smoke.check.mjs` has a red proof for each of these against `tools/fixtures/a11y/` (an unnamed button, link and image; no main and no heading; a baseline that has drifted or is missing; grey words on a grey canvas; a button and white words that vanish under forced colours; a pale playful register; an unlabelled image in an open dialog; an open action that is gone), each with a control page that stays green.

## Soak and kiosk

```
npm run soak -- kolam                                   a scene at 1080p, quick (2 minutes)
npm run soak -- /apps/docs/index.html --mode rung       a page by path, 30 minutes
npm run soak -- kolam --profile 4k --mode release --json .shots/soak-kolam.json
npm run soak -- --playlist paus,tollem,kolam --dwell 20 --mode rung      cycle scenes
```

For a screen that runs for hours with nobody touching it (an event kiosk, a lobby TV): does anything grow, and do frames get slower? One browser through a slot, held for the whole run (two hours holds it two hours, so `release` belongs to a quiet machine; a run that has to queue for a slot starts its clock only when it gets one). Chromium only, because the counters and the forced collection are CDP.

- Profiles: `1080p` (1920x1080) and `4k` (3840x2160), one device pixel per CSS pixel, headless so no devtools or browser chrome.
- Modes (run, sample every, warm-up ignored): `quick` 2 min, 5 s, 20 s (tests and slices; catches a leak of megabytes a minute); `rung` 30 min, 30 s, 3 min (the rigour rung); `release` 2 h, 60 s, 10 min (the length of an evening event). `--duration`, `--interval` and `--warmup` (seconds) override a mode.
- `--playlist a,b,c --dwell S` replaces one iframe with the next scene every S seconds (`tools/fixtures/soak/playlist.html`), so a scene that does not clean up on unmount shows as growth across mounts. Each comparison window should span a whole pass of the playlist (the third of the run after warm-up, at least scenes x dwell), or the first and last windows hold different scenes; the tool says so when it does not.
- Each sample: JS heap after two forced collections, DOM nodes (detached ones included), documents, JS event listeners, live canvases and their megapixels (through shadow roots and same-origin frames), frame time mean and p95 since the last sample, long tasks (over 50 ms), and how busy the whole machine was.
- The verdict compares the median of the first third of the samples after warm-up with the median of the last third. A growth budget fails only when its percentage and its absolute floor are both exceeded: heap 10% and 1 MB, DOM nodes 5% and 50, documents 2, listeners 10% and 50, canvas 5% and 0.5 Mpx. Frame p95 fails at x1.15 and 2 ms together (one vsync step is noise). Long tasks fail past twice the first window plus 3. Errors (console, page, failed request, crash): none allowed. Each budget's reason is in `tools/lib/soak.core.js`. The report also gives the Theil-Sen slope of heap and nodes per hour.
- A number under load is a guess. Above 60% machine CPU busy (median after warm-up) a frame drift under x2.00 reads "not judged (machine busy)": the row prints `n/j`, the verdict is NOT-JUDGED and the exit code 3; a drift over x2.00 fails even so; the counts of things (heap, nodes, listeners) are still judged. The CPU stamp is always printed.
- Under 8 samples after warm-up reads `NOT-JUDGED`, never pass, its rows print `n/j` and no slope. Exit 0 for pass, 1 for fail, 3 for not judged (as `perf.mjs`), 2 for bad usage.

What it cannot see: memory outside the JS heap. A retained typed array, a decoded bitmap or a WebGL buffer is not in the heap number (the planted leak keeps plain arrays for that reason); canvas megapixels cover canvases, and nothing covers the rest. Headless Chromium draws WebGL on the CPU, so a 4K frame time says little about a real GPU.

`node tools/soak.check.mjs` is the red proof, run by hand (it launches Chromium and waits for a slot): `tools/fixtures/soak/leak.html` (keeps arrays, detached nodes with listeners and a canvas a second) must fail on heap, nodes, listeners and canvases, and `steady.html` (the same drawing, garbage and churn, all freed) must pass, on a 30 s clock. The verdict maths is tested on synthetic samples in `tools/lib/soak.core.test.mjs`, which runs under `npm test`.

## Rigour runner

```
npm run rigour -- --scope=slice                     before reporting a slice
npm run rigour -- --scope=rung --base run/start     at a rung's exit gate, after the merges since that ref
npm run rigour -- --scope=rung --base run/start --full   the whole suite, only on a quiet machine
npm run rigour -- --scope=debt                      the debt register, grouped
npm run rigour -- --scope=slice --dry               print the plan, run nothing
node tools/gate-tier.mjs --enforce --base <ref>     the tier, binding
```

One command for what a scope owes. The steps run one after another, and browsers go through the existing runners, which hold the machine's slots.

- **slice**: `npm run gates:slice`, `npm run check -- --changed`, `npm run smoke -- --changed` (each in every engine of `--engines`, default Chromium), then gate-tier over the working diff (committed, staged, unstaged and untracked since the merge-base with the base) and the review that tier owes.
- **rung**: `npm run gates`, gate-tier over every merge since `--base` (default `main`), then `npm run smoke -- --changed --base <base>` and `npm run check -- --changed=<base>` in each engine (default Chromium; the laptop never runs three engines, decision 0031). **`--full`** runs the whole smoke and check suites instead, in the engines given. The plan (`--dry`) and the JSON (`mode`: `changed` or `full`) say which ran. A `--changed` run that reaches nothing is `empty`, not failed; a whole-suite run of 0 still is. The tier step is red when a merged Standard or Full slice **on shared ground** has no review (below); a unit inside experimental items is `owed` (at promotion) instead. It does not stop the suite.
- **debt**: parses `docs/DEBT.md` and prints the open rows by Where and then Kind, oldest first, with counts and the cap verdict (more than 20 open is over; it warns, and `--strict` makes it exit 1).

Every scope writes a JSON result (`--json FILE`; by default `out/rigour/<scope>-<time>.json`, which is gitignored; a `--dry` run writes nothing unless you name a file). Each step carries `status`, `exitCode`, `durationMs` and `cpuBusyPct`, the machine's CPU while it ran, and the result carries the load before the run. A status is `passed`, `failed`, `not run`, `owed` or `empty`: after a failed step the rest are `not run` (`--keep-going` runs them anyway), and a dry run marks every step `not run`. `owed` is the slice's tier step when the tier owes a review that is not on file yet (`tier full: Rasika review owed, not yet checked`); `empty` is a `check` or `smoke` step that exited 0 but ran nothing (`No checks needed`, `nothing to run`, or 0 of 0), which is a failure in a rung's whole-suite run. An exit 0 whose summary line cannot be read at all (the tool's output drifted) is `failed` in every scope, not `empty`: it confirms nothing, and the run is red. Those two are never counted as passed: the summary says `ok` (nothing failed or left unrun) and `complete` (every step passed outright) separately, and prints `Not complete: ...` when they differ. A `check` or `smoke` step also records what its output said in `counts` (`ran`, `knownFlakes`, `skipped`) and in `note` (`130 of 132 checks pass; 2 known flakes red, recorded not counted; 4 clauses skipped`); `checks.mjs` has no JSON output, so its summary lines are read. Exit 0 when nothing failed or was left unrun, 1 otherwise, 2 on bad usage. A time taken above about 30% CPU busy is a guess; the output says so.

### `gate-tier --enforce`: how a review is recognised

`--enforce` lists every unit merged on `HEAD`'s first-parent line since `--base` (`--head REF` judges another branch), each with the tier its own diff gives (the registry as it stood at the merge), and exits 1 when a Standard or Full unit has no review at its tier. A merge of `main` into the branch is not a slice. A unit is a merged slice, or **one commit made straight on the branch** (`commit 0479f4f: ...`): each direct commit has its own tier and its own review, so a review of one is never a review of the others. Light needs no review agent, so it always passes.

**Lanes.** A unit whose every changed path belongs to an experimental registry item (its folder: code, docs, demo, words; its recorded tree in `tools/a11y-baseline`; generated files are neutral) is on the experimental lane (`laneOf` in `gate-tier.core.js`). If it lacks its review it is printed `PROMOTE ... owed at promotion (<items>)` and does not make the exit code 1; the summary line counts units passed, owed now (red) and owed at promotion, by item. A path that belongs to nobody, `packages/core*`, tokens, type, kernels, the engine, export, `tools/`, `apps/docs`, any item above experimental and any item other pieces import makes the unit shared ground, which binds as above. A `Gate: standard` or `Gate: full` trailer raises the tier owed; it does not pull a unit off the lane.

A review counts **only through the canonical line**: on a line of its own (a list bullet may lead it, up to three spaces of indent), in `docs/LEDGER.md` or a file in `docs/reviews/`, outside fenced code blocks, blockquotes (`>`, including lazy continuation lines), inline code and HTML comments. The grammar is exact (capitalisation, full stops, nothing after it):

```
Rasika: <pass | pass with notes | changes needed | blocked>. Tier: <Light | Standard | Full>. Slice: <branch> (<hash>)
Rasika: <pass | pass with notes | changes needed | blocked>. Tier: <Light | Standard | Full>. Slice: commit <hash>
```

The verdict, tier and slice come from that line alone; no prose anywhere can raise a tier or create a pass, so nothing needs to be block-listed ("still owed", "dropped", "unverified" and the next phrasing nobody thought of all fail the same way: they are not the line). The first form reviews a merged slice: the branch name must be the slice's (a whole token) and the hash (seven or more hex digits) must be the merge or one of the slice's own commits. The second reviews one direct commit; write one line per commit. A bare hash (`Slice: 0479f4f`) is neither form. Only a **pass** (pass, pass with notes) satisfies the requirement. `changes needed` and `blocked` are reviews that were done and did not pass: they are listed beside the unit (`changes needed, standard at ...`), and the re-review that passes is what clears it. A review at a higher tier satisfies a lower one, not the reverse.

**Legacy.** Reviews dated before 2026-10-17 (`LEGACY_BEFORE` in `gate-tier.core.js`) keep the older pattern reading, so history still reads: a heading naming the slice with `Rasika, pass. Tier: Standard`, a ledger bullet such as `slice/palm: Full; Rasika pass with notes.`, with the old vetoes for "still owed". A review file is dated by its name (`YYYY-MM-DD-...md`; the historical `wave-N.md` files count as old), a ledger bullet by the nearest `## YYYY-MM-DD ...` heading above it. Anything dated on or after the cutoff, or with no date, is canonical-only. The cutoff is a fixed day, not "today", so a review written in the old words today does not start to count tomorrow.

### Where the tier is calibrated (`tools/gate-tier.core.js`)

- Generated files (`registry/registry.json`, `references/components.md`, `references/scenes.md`, `custom-elements.json`, `docs/reference/accessibility.md`) are neutral: they never raise a tier. The other files in `references/` are hand-written and are what the shipped skill tells an outside agent, so they are Standard.
- Documentation under `packages/` (`README.md`, `docs.md`, `PROVENANCE.md`, `CHANGELOG.md`, `*.docs.md`, `*.prompt.md`) is Light, even inside a shared prefix. Other markdown there (a story, a proposal sample, Konkani for a reader) is words a demo renders or a native reader checks, and takes the tier its item demands. A decision record and a file that declares `gate: full` stay Full.
- The engine is shared: `tools/lib/changed.core.js` selects every check for it, so a change to it that is not a test or prose is Standard, never Light. A test beside it no longer makes it Light. It is not Full: that stays for core, tokens, type and kernels. A test in `gate-tier.test.mjs` fails if a package that `--changed` treats as shared is Light here.
- The binding itself is at least Standard, never Light: `tools/gate-tier*` (the tier, the review recognition and their tests), `tools/rigour.mjs`, `tools/lib/rigour*` and `tools/fixtures/rigour/`. A change to how a review is recognised cannot show in its own tier, so the floor does it.
- A new package imported only by new pieces in the same diff is Standard; once an older piece imports it, it is Full.

## No JavaScript

`matrix.mjs` and `axe.mjs` take `--no-js` for pages (`--url`). Chromium then builds the page with JavaScript off, so `<noscript>` content renders and no page script runs. The page counts as ready at load plus fonts. The tools still set `data-register`, `data-theme` and `data-palette` on `:root`, standing in for what a server would render, because `demo.js` cannot run. axe needs timers, which do not run with JavaScript off. So `axe.mjs --no-js` takes the DOM the no-JS page produced (with `<noscript>` content, declarative shadow roots, and scripts and inline handlers removed) and checks it in a scripted copy served at the same URL. The matrix writes to `.shots/matrix/<target>-nojs/`. `perf.mjs` refuses `--no-js`, because nothing animates. A scene cannot run without JavaScript, so `--scene` with `--no-js` is an error.

## form-check

```
node tools/form-check.mjs --url /tools/fixtures/form-page/index.html
node tools/form-check.mjs --url /packages/components/form/demo.html --no-js --form "#booking"
```

Loads each form on the page twice. First it blanks every required field and presses submit. Then it fills every required field with a valid sample for its type and presses submit again. The samples fit `min`, `max`, `step`, `minlength`, `maxlength`, `pattern` and the field's name or autocomplete hint (see `tools/lib/forms.mjs`). It presses what a person would press: the submit button, or a plain button when there is none, or Enter in a text field. It never calls `requestSubmit()`, which would hide a form nobody can submit. Before each press it records whether every field is valid, and every invalid field's flags and message. It reads each field's `validity` rather than calling `checkValidity()`, because that fires `invalid` events and a stepper answers them by changing step.

Some forms have rules the tool cannot guess: a minimum stay, a code the page shows after you press a button. Such a page keeps valid values in a `form-check.json` beside it (or pass `--samples <file>`). It maps a field's name or id to a value: a string for text, dates, selects and radio groups, `true` or `false` for a checkbox, or an object that presses a button first and reads the value from the page's text:

```json
{
  "about": "A stay the rate card accepts, and the code the page shows.",
  "values": {
    "arrival": "2026-11-16",
    "room": "whole",
    "rules": true,
    "code": { "press": ".booking__send", "read": ".booking__code", "match": "is (\\d{3}) (\\d{3})" }
  }
}
```

`match` is a regular expression; the value is its groups joined, or the whole match. Fields the file names are filled even when optional; a field the page does not show (the code box with JavaScript off) is left alone unless it is required. Unknown keys are an error, so a typo never passes quietly. The format is documented at the top of `form-check.mjs`.

A form with an `<sg-stepper>` is walked as a person walks it, with JavaScript on: fill the fields on the step that shows, press Next, wait for the next step, and submit on the last. The empty phase presses Next on the first step and fails if the stepper moves on. If a filled step will not let you on, the report names the step and the browser's message. After the press, every navigation and every non-GET fetch or XHR is answered with a stub, so nothing reaches a server, and the report shows the method, the URL and the fields sent. With JavaScript on, it also records whether a script took over the submit event. If a script takes over, sends nothing and marks no field `aria-invalid`, the submit is counted as "handled by a script".

A form fails if it goes through with its required fields blank (unless it has `novalidate`, which gets a note instead), if it does not go through once filled, if it is a GET form with personal fields (a `tel` or `email` input, or a name, phone, email or signature by name or autocomplete, which would land in the address bar), or if the page logs errors. A `<form>` with no button and nothing required is skipped. `tools/fixtures/form-page/` must pass both ways. `tools/fixtures/form-broken/` must fail both of its forms.

The pages to check, each with and without `--no-js`:

| Page | Samples |
|---|---|
| `/tools/fixtures/form-page/index.html` | the tool's own |
| `/packages/components/form/demo.html` | the tool's own; with JavaScript on, the "Sending" example (`#sending`) is a still whose button is `aria-disabled` on purpose, so expect 4 of 5 |
| `/packages/recipes/booking/index.html` | `form-check.json`: a four-night shoulder stay and the code the page shows |
| `/packages/recipes/enquiry/index.html` | `form-check.json`: a guest's enquiry, the number written with a hyphen |

The file-upload recipe has no `<form>` (the drop zone uploads as files are chosen), so it is not a form-check target; its checks are in `packages/recipes/file-upload/recipe.check.mjs` and the matrix.

## Tests

`npm test` runs `tools/**/*.test.mjs` along with the package tests. They cover the argument parser, target URLs, form sample values and verdicts, frame and byte statistics, the pixel maths, the contact sheet, the strip and onion layout and facts, the server, the browser slots (including separate processes racing for one slot) and the `--changed` selection.
