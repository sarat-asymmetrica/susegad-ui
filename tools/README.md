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

Runs the target and the Paus baseline in turn, twice each (`--rounds`), for 6 s in total each (`--seconds`). Reports mean, p95 and worst frame time, dropped frames, long tasks, and the JS bytes the page loaded, grouped by folder so each piece's own weight shows. It prints the ratio to Paus, the machine and how busy its CPU was. If Paus does not exist yet, it says so. `--baseline none` skips it.

Headless Chromium caps frames at 60 Hz, so anything that fits in a frame reads 16.7 ms. `--uncapped` lifts the cap and shows the cost of a frame instead. WebGL runs on the CPU in headless Chromium, so read the ratio, not the absolute numbers.

## diff

```
node tools/diff.mjs --scene kolam --seed 3 --at 2 --update   # make the baseline
node tools/diff.mjs --scene kolam --seed 3 --at 2            # compare with it
```

Shoots the scene with its clock frozen at `--at` seconds and compares it pixel by pixel with `tools/baselines/<scene>-<register>-<theme>.png`, in the browser, with no image library. A pixel counts as changed when its colour moves more than `--threshold` (0.02 on a 0 to 1 scale), and the check fails when more than `--max-ratio` of pixels change (0.001). The actual image and a diff image, with changes in vermilion over a faded copy, go to `.shots/diff/`. The JSON beside each baseline records the seed, params and size it was made with, and the tool tells you if they differ.

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

**`--json`** prints JSON alone on stdout (everything else goes to stderr): per cell its requested time, its actual clock time and frame, whether the piece was `playing`, mean luminance (0 to 1), and the changed-pixel share, count and bounding box against the cell before. A pixel counts as changed when its colour moves more than `--threshold` (0.02), the same rule as `diff.mjs`. An agent can then say "motion stops between 4 s and 6 s" from numbers.

**`--facts`** prints where motion happens (the bounding box of the changed pixels for each step, and their union) and flags two failures:

- a **frozen span**: a run of cells with no change (at most 0.02% of pixels) that lasts longer than `--still` seconds (default 1.5) while the scene's `playing` is true at every cell. The same run while it is not playing is listed as at rest and not flagged; a page with no `playing` reports it as unknown.
- a **jump**: a step that changes at least 5% of the picture and at least four times what the steps round it (two either side) change, counted no lower than 0.5%. The usual sign of a stage cut or a pop.

Both are sampled at the strip's spacing, and `--facts` says how long that is: a freeze or a jump shorter than one step can hide between two cells, so raise `-n` to look closer. Flagged cells get a vermilion frame and a tag on the sheet. The abri and chiro flakes in the ledger (a ratio measured across a stage change, or against rain still falling) are the family a strip shows at once: the step that straddles the change is the jump.

`tools/fixtures/motion-scene/` (`--scene motion`) is a dot orbiting a ring with two optional faults, `--param stall=3-5` (the dot stops while still playing) and `--param cut=7` (the picture changes at once), so the facts have something known to find. `node tools/strip.check.mjs` runs the gates by hand (it is not under `packages/`, so `npm run check` does not pick it up; `GATE=2` runs one): determinism against a real-clock control that must differ, the stall and the cut found and their absence reported on the plain fixture, stepped frames against `?freeze`, the onion's ghosts, and `--json`.

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

`npm test` runs `tools/**/*.test.mjs` along with the package tests. They cover the argument parser, target URLs, form sample values and verdicts, frame and byte statistics, the pixel maths, the contact sheet, the strip and onion layout and facts, and the server.
