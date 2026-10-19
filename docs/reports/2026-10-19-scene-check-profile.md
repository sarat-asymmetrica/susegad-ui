# Where the scene-check minutes go

*Karigar, 19 October 2026, for decision 0031's "next lever: cheaper scene checks". Measurement only: nothing in a check
or in a scene was changed. The instrumentation is behind `SG_PROFILE=1` (`tools/lib/profile.mjs`, `tools/profile.mjs`),
branch `slice/r-profile`.*

## The answer in four numbers

For the five scene checks you named (shet, maun, mankurad, abri, chiro), Chromium, 441 s in all, one run each:

| What the time is | Share | Seconds |
| --- | --- | --- |
| **Repeated setup**: launch, context, navigation, waiting for a page to be ready (real clock or stepped), closing | **26.0%** | 114.9 |
| **Stepping virtual frames** after the page is ready | **66.0%** | 291.1 |
| **Real waiting**: sleeps, and `waitForFunction` that ran its whole timeout | **4.6%** | 20.5 |
| **Assertion work**: axe, pixel grabs, DOM reads, the check's own diff loops, key presses | **3.4%** | 14.8 |

The stepping is the story, and it splits by *what the frames were for* (30,253 frames in all):

| Frames | Count | Of all frames | About |
| --- | --- | --- | --- |
| to the page's ready | 2,352 | 7.8% | boot (counted as setup above) |
| **from ready to the first read** | **22,641** | **74.8%** | state building: the page is walked to the moment a clause looks at |
| between the first and the last read | 5,182 | 17.1% | the window a clause compares across ("unchanged over three seconds") |
| **after the last read** | **78** | **0.3%** | frames nobody reads at all |

So "frames that no clause reads" is almost nothing in the strict sense (0.3%, all in shet). The waste is not at the tail.
It is that 75% of the frames are drawn only to *arrive*, every one at full raster cost, to read one frame at the end.
That is a lever only for scenes whose state does not depend on how many frames were drawn (proposal 4).

And two findings that dwarf the five checks: **`vad/words` spends 79% of its time (221 s of 282) copying canvas pixels to
Node as a plain JavaScript array**, and **22 of the 34 scene checks are still on the real clock** (they are 87% of the scene
minutes in the CI duration table; two of them, profiled here, show it).

## How it was measured

`SG_PROFILE=1` wraps the methods of Playwright's `Browser`, `BrowserContext`, `Page`, `Locator`, `Keyboard` and `Mouse`
(by prototype, so a check that calls `browser.newContext` itself is seen too), plus the stepping and grab helpers in
`virtual-time.mjs`, and keeps **exclusive** time per category on a stack. Time on an empty stack is "node": the check's own
JavaScript. It also notes, per stepped page, the virtual-frame counter at ready, at each read and at close, and each
clause's time by category (`clauses` in the JSON). Overhead: chiro ran 71 s unprofiled and 77 s profiled in the same
load; I take it as noise, not as cost. `npm run gates` is green (two new unit tests, `tools/lib/profile.test.mjs`).

**Machine load, as asked.** Four cores, other agents running browsers. CPU busy over each run (all cores, from
`os.cpus()`): abri 83%, chiro 82%, mankurad 69%, maun 85%, shet 73%, vad 85%, vad/words 76%, tinto/words 72%,
tinto/glass 64%. Frame times therefore swing: mankurad's first run read 203 s at 96% busy, its second 83 s at 69%
(ms per frame 44 and 16). Percentages are steadier than seconds; I use the second run for the five, and say so.
A first shet run died at `page.goto` with `net::ERR_NO_BUFFER_SPACE` (a Windows socket buffer limit under load, not the
check); the table uses its clean rerun. Windows, not the CI's Linux: absolute seconds will differ, the shares much less,
except possibly the array copy in proposal 1 (CPU-bound in both, but I have not run it on Linux).

## The tables

Seconds by category, exclusive. `step-ready` and `wait-ready` are both "getting a page ready" (stepped, then real clock).
All figures are one Chromium run. Raw JSON: `.shots/profile/*.chromium.json` (not committed; regenerate with `SG_PROFILE=1`).

| check | total | CPU % | launch | ctx-new | nav | step-ready | wait-ready | step | wait-real | wait-fn | grab | axe | eval | pw-input | node | ctx-close | close |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shet | 117.4 | 73 | 0.3 | 3.1 | 2.0 | 25.7 | 16.4 | **57.4** | 7.4 | 0 | 0.7 | 3.1 | 0 | 0.1 | 0.3 | 0.8 | 0.3 |
| maun | 27.1 | 85 | 0.2 | 2.1 | 2.0 | 4.6 | 1.8 | 12.2 | 1.5 | 0 | 0.3 | 1.7 | 0 | 0.1 | 0.1 | 0.3 | 0.1 |
| mankurad | 83.2 | 69 | 0.2 | 1.8 | 1.7 | 3.3 | 4.0 | **61.6** | 2.3 | **5.0** | 0.5 | 2.1 | 0 | 0.1 | 0.2 | 0.3 | 0.1 |
| abri | 148.6 | 83 | 0.2 | 1.8 | 1.8 | 1.8 | 10.3 | **127.4** | 1.8 | 0 | 0.5 | 2.0 | 0 | 0.1 | 0.1 | 0.3 | 0.3 |
| chiro | 65.1 | 82 | 0.2 | 1.8 | 1.8 | 3.1 | **20.2** | 32.5 | 2.4 | 0 | 0.4 | 2.1 | 0 | 0.1 | 0.1 | 0.3 | 0.1 |
| vad/words | 281.9 | 76 | 0.2 | 4.1 | 5.9 | 0 | 22.9 | 0 | 3.3 | 18.2 | 0 | 2.5 | **223.2** | 0.2 | 0.7 | 0.4 | 0.1 |
| vad | 126.0 | 85 | 0.2 | 1.9 | 2.0 | 0 | 7.7 | 0 | **48.7** | 0 | 0 | 2.0 | **62.8** | 0.1 | 0.3 | 0.2 | 0.1 |
| tinto/words (not asked; for scale) | 266.1 | 72 | 0.5 | 9.5 | 11.1 | 0 | **211.5** | 0 | 5.2 | 7.9 | 0 | 3.2 | 10.9 | 1.0 | 3.7 | 1.6 | 0.1 |
| tinto/glass (not asked; for scale) | 230.1 | 64 | 0.2 | 8.7 | 7.6 | 0 | 61.2 | 0 | 30.2 | **73.8** | 0 | 3.0 | 25.9 | 5.8 | 2.7 | 0.9 | 0.1 |

(`shot` is left out: 0 everywhere except tinto/glass, 9.9 s, and tinto/words, 0.1 s.)

Opens, matrix, frames:

| check | contexts | navigations | distinct cells | frames | to ready | ready to first read | first to last read | after last read | ms / frame | sleeps (n, s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shet | 24 | 25 | 11 | 7,826 | 1,038 | 5,912 | 798 | 78 | 10.6 | 5, 7.3 |
| maun | 18 | 19 | 11 | 7,433 | 642 | 3,036 | 3,755 | 0 | 2.2 | 1, 1.5 |
| mankurad | 14 | 15 | 11 | 4,150 | 192 | 3,492 | 466 | 0 | 15.7 | 3, 2.3 |
| abri | 15 | 16 | 11 | 7,116 | 252 | 6,720 | 144 | 0 | 18.2 | 4, 2.4 |
| chiro | 14 | 15 | 11 | 3,734 | 234 | 3,481 | 19 | 0 | 9.6 | 4, 2.4 |
| vad/words | 34 | 34 | 15 | real clock | | | | | | 2, 3.3 |
| vad | 15 | 16 | 11 | real clock | | | | | | 13, 48.5 |
| tinto/words | 74 | 74 | 11 | real clock | | | | | | 5, 5.1 |
| tinto/glass | 77 | 77 | 15 | real clock | | | | | | 79, 29.5 |

"Distinct cells" is the count of different (page, register, theme, viewport, motion) combinations. Every one of the
five opens **11** cells; each opens a page 14 to 24 times, so 3 to 13 opens are a cell opened again (the "twice" stills,
the with-words and bare-control pairs). Every check runs the same 3 registers x 2 themes of axe at 1280 x 900. The 390 px
phone cell is not in any of the five (only `vad/words` and glass open it).

## Per check: where the minutes are, and why

**shet (117 s).** 49% stepping, 22% `step-ready` (13 page boots at ~2 s: shet's boot is slow, 1,038 frames), 14% real-clock
boots, 6% sleeps. The calm clause alone is 33 s: two stepped pages walked to 40.7 s (2,442 frames each) for a pair of
grabs 0.5 s apart (`shet.check.mjs:105,106`: 26 s). The resize clause is 13 s of stepping.

**maun (27 s).** Already cheap (2.2 ms a frame). 45% stepping, 41% setup. Nothing to take but the pairs.

**mankurad (83 s; 203 s in the loaded run).** 74% stepping, and 54 s of it is one pair of pages stepped to 25.05 s
(`mankurad.check.mjs:99,100`: 1,503 frames each, with words and without). **5.0 s of dead wait**: line 68,
`waitForFunction(... status !== '')` with the default polling, which is `requestAnimationFrame`. On a held page rAF
never fires, so the predicate is checked once, is false, and the call runs its whole 5 s timeout (the `.catch(() => {})`
hides it). Reproduced in isolation: a predicate that turns true after 0.8 s took **6.01 s and timed out** with default
polling and **0.82 s** with `polling: 50`. This is a trap in `openStepped`, not in mankurad: any `waitForFunction` on a
stepped page pays its full timeout unless the predicate is already true.

**abri (149 s).** 86% stepping, and 115 s of that is one helper, `drift` (`abri.check.mjs:78`), called three times: each
call walks a fresh page ~2,000 frames to the drift window, then grabs. Calls 1 and 3 are the same page (playful, seed 1,
with words); only a `__q` set between the grabs differs.

**chiro (65 s).** 50% stepping (the rain pair, 25 s of it, 1,440 frames each, and the Enter test's 1,500 growth frames),
**31% real-clock boots**: 10 real pages at ~2 s to `__ready`, 6 of them just to run axe (3.2 s a page to boot, 0.3 s of
axe). A stepped boot of the same scene is 0.72 to 0.87 s.

**vad/words (282 s).** 79% in one place: `words.check.mjs:225`, in the "calm follows the lines" clause, `Array.from(getImageData(...).data)`
for a 1240 x 827 canvas, ~15 M numbers over the wire, six times (~37 s each). Isolated in a scratch script on the same
canvas: **43.9 s as an array, 0.18 s as base64 bytes, bytes identical.** The next biggest items: one `waitForFunction` that
ran its 15 s timeout (the "minimum is zero" control never settles, by design), then 34 real-clock page loads.

**vad (126 s).** Real clock throughout: 13 sleeps (48.5 s) and `grab` returning a plain `new Array(w * h * 3)`, ~5 s a grab
(62.8 s in all).

**tinto/words (266 s) and tinto/glass (230 s)**, run because the CI table ranks them highest. tinto/words: 63% (169 s) is 42
pages each waiting for `window.__frozen` on the real clock (`words.check.mjs:354`): the freeze sweep that virtual time
replaces. glass: 74 s in `waitForFunction`, 61 s in the same `__frozen` waits, 30 s in 79 sleeps.

## Findings that are bugs of the harness, not of the checks

1. **Pixels cross the wire as arrays.** `grabPixels` was fixed once (its comment: 2.3 to 3.5 s a grab); `vad/words.check.mjs:225`
   and `vad/vad.check.mjs:26` still do it the slow way, and seven more scene checks match the pattern (`chai`, `kairi`,
   `khazan`, `mosaico`, `neel`, `tinto/glass`, `tinto/tinto`).
2. **`waitForFunction` on a stepped page stalls to its timeout** (mankurad: 5 s every run).
3. **A control that waits for something that never happens waits its full timeout** (`vad/words`: 15 s, "a build whose
   minimum is zero").
4. **22 of 34 scene checks never moved to virtual time.** In the CI duration table (12 October, before rung 3c, so stale in
   absolute terms), the scene checks sum to 1,868 s of Chromium; the 12 that import `virtual-time.mjs` are 241 s of that, the
   other 22 are **1,626 s (87%)**. The heaviest are all among them: tinto/words 213, tinto/glass 179, vad/words 143,
   veranda/words 135, tinto 84, vad 83, veranda/quads 67, saanj 64, vaati 56, mosaico 56.

## Proposals, ranked by minutes saved per unit of risk

Savings are in the seconds of the runs above (one machine, 64 to 85% busy). The five checks' total is 441 s.

### 1. Send pixels as bytes, never as arrays (zero risk, the biggest single saving)

Put one shared reader (`grabPixels` already is one; add a `readCanvas(page, selector)` that returns the full-resolution
bytes) in `virtual-time.mjs`, and replace every `Array.from(...getImageData...)` and `new Array(w*h*3)`.
- **Saves:** vad/words 221.5 s -> ~2 s (the clause code is unchanged; `px` becomes a `Uint8Array`, indexed the same):
  282 -> ~62 s. vad 62.8 s -> ~3 s before anything else. Seven more checks have the pattern; unmeasured (tinto/glass
  `eval` is 25.9 s, tinto/words 10.9 s, some of it this).
  Measured 43.9 s -> 0.18 s on one grab.
- **Could lose power:** none, if the bytes are the same: the scratch comparison found them identical, byte for byte.
- **Planted fault:** the three controls already in `vad/words` "calm follows the lines" (look-ahead removed, whole-rectangle
  hold, and the growth control) must stay red after the change, and a one-time test compares the new reader's bytes to
  `Array.from` on a fixture canvas. Nothing here touches what a clause decides.

### 2. Take out the dead waits (near-zero risk, ~20 s here and a trap removed everywhere)

- Default `polling` in `openStepped`'s page (`page.waitForFunction` with `polling: 50` unless given): mankurad **-5.0 s**
  (6% of 83), and no stepped check can lose a timeout to it again.
- `vad/words` "minimum is zero": cap the wait on the control at 3 s (the positive paths settle in 0.1 s of wait): **-12 s**
  (4% of 282).
- **Could lose power:** the capped control passes for the wrong reason on a very slow machine (not settled yet, read as
  "caught"). Mitigate: the control also reads the state it expects to be different, not only "did not settle".
- **Planted fault:** mankurad's `said === ''` still fails if the status is never spoken (plant: break the status);
  the capped control must stay red when run on a throttled CPU.

### 3. Move the unported 22 scene checks to virtual time (largest by minutes, medium risk, one check at a time)

The profile says what it buys: tinto/words is 63% real-clock `__frozen` waits (169 s of 266), tinto/glass 27% (61 s) of the
same plus 79 sleeps (30 s) plus 74 s of `waitForFunction`. The earlier measured factor for stepping against the real clock is
2 to 4 times (shet 342 -> 107 s). Estimate for the two profiled: tinto/words 266 -> ~120 s, glass 230 -> ~120 s (**-256 s**),
with proposal 1 on top. For the CI table: the 22 unported checks are 1,626 s of Chromium; at 2x that is **~800 s a run, ~13
minutes per engine** (stale base: the table predates rung 3c).
- **Could lose power:** a stepped clause reads exact frames where the real clock read "about three seconds"; a clause that
  was loose becomes tight and may redden (that is information, not loss). The real risk is the other way: a clause that
  watches a timer or the network moved onto stepped time and stops seeing it (virtual-time's own note lists what must stay real).
- **Planted fault:** every ported check keeps its `--break` rows, the mutant guard (`tools/lib/mutants.core.js`) still reads
  them, and the port is accepted only when the same set of `--break` clauses go red before and after (the same procedure as
  rung 3c).

### 4. Step coarsely to the moment, finely through the window (medium risk; opt-in per scene, with an equivalence gate)

The engine's loop clamps `dt` to 0.1 s, so a rAF callback may advance **six frames' worth** of time at once; the held page
can do it today by moving its fake timestamp 100 ms per step. I measured it (scratch script, same machine):

| scene, moment | 1 frame a step | 6 frames a step | pixels differ (exact / within 24) | state data |
| --- | --- | --- | --- | --- |
| mankurad warm, 12 s | 9.0 s | 1.9 s | 0.00% / 0.00% | same |
| mankurad playful, 25 s | 21.4 s | 4.2 s | 1.05% / 0.76% | same |
| shet warm, 20 s | 6.3 s | 3.3 s | 85% / 0.26% | same |
| maun warm, 12 s | 1.3 s | 1.2 s | 9.7% / 0.10% | same |
| chiro warm, 24 s | 10.2 s | 2.9 s | 37% / 6.8% | **differs** (frame-counted growth) |
| abri playful, 30 s | 25.9 s | 3.7 s | 24% / 14% | **differs** (stage by frame count) |

So it is exact for mankurad warm, near-exact for mankurad playful, shet (dither noise only) and maun, and **wrong for
chiro and abri**, whose state advances per frame drawn. It would apply, per scene, to the walk to the first read
(75% of all frames), then fine steps (stride 1) for the last ~30 frames and the window itself.
- **Saves:** approach frames are 75% of all; mankurad 61.6 s x 0.81 x 0.8 = **-40 s** (of 83), shet 57.4 x 0.75 x 0.8 =
  **-34 s** (of 117), maun 12.2 x 0.45 x 0.8 = **-4 s**: about **-78 s of 441 (18%)**. A real `seek(t)` on `<sg-scene>` (shared
  core, not in this slice's reach) would take the approach to near zero for pure-in-time scenes; the table says which
  scenes qualify.
- **Could lose power:** the page arrives at the read moment by a path no viewer's machine takes (dt of 100 ms); a bug that
  shows only at 60 fps frames could be missed in the walk, though not in the final window, which stays fine-stepped.
- **Planted fault:** an opt-in scene must pass an equivalence clause first (the read moment grabbed both ways, differing under
  the clause's own threshold; this is the table above made a check), and every `--break` of that check must still go red
  under coarse stepping.

### 5. Open fewer, cheaper pages (small each, adds up; low to medium risk)

- **Axe and the "no request leaves" clause on a held page.** The axe clauses are 49 s of 441 (11%), of which axe itself is
  11 s: **38 s is booting six pages per check** on the real clock (chiro 3.2 s a boot against 0.8 s for a stepped boot of the
  same scene). Boot them with `openStepped` (axe reads the DOM; the scene need not run). Estimate: chiro -14 s, shet -6 s,
  abri -6 s, maun -2 s, mankurad -2 s: **~-30 s (7%)**.
- **Run one prefix once.** abri's `drift` is called three times; calls 1 and 3 share the page up to the grab. Run call 1
  with the (inert until `__q` is set) governor route, grab, step 30, grab, then set `__q` and step 30 more for the low-quality
  pair: **-38 s of abri's 149 (26%)**. The same shape applies to any with-words and bare-control pair that differ only after the
  walk (they do not in chiro and shet, where `content=1` changes the walk itself).
- **Could lose power:** axe on a never-stepped page could see a DOM the animating page would not (verify: the same violations
  in all 6 cells, real against held). The merged abri clause compares a moment one second later in the drift (check the
  stage is `drift` at both reads, which the clause already asserts).
- **Planted fault:** a contrast fault planted in a skin (as `plantFault` does) must redden `axe` on the held page; abri's
  `sizeMoves` and `veinsGo` plants must stay red on the merged page.

### Not worth doing

Fixed sleeps are 15.9 s of the five (3.6%), and the biggest, 1.5 s per check for "no request leaves the page", exist to
watch the network over real time. Axe itself is 11 s of 441. Pixel diffs in Node are under 1% in every check. The assertion
work (3.4%) is not where the minutes are.

## What this does and does not say

- It is one run per check, on a busy Windows machine, in Chromium only. The shares are firm; the seconds are not (the
  mankurad rerun alone moved 203 -> 83 s). The array-copy cost may be smaller on Linux; I have not measured it there.
- The CI duration table is from 12 October and predates rung 3c; "87% of scene minutes are unported" is a share of that
  table, and the heaviest entries are real-clock checks whichever date it is.
- "Frames no clause reads": 0.3% strictly. If you mean frames whose pixels no one inspects, that is nearly all of them
  (a clause inspects one frame in thousands), and the fraction that could be skipped is the part proposal 4 can reach (75%),
  for the scenes whose state does not depend on the number of frames drawn.
- Spans assume one awaited call at a time; abri's one `Promise.all` (the three stills, `abri.check.mjs:62`) shares the
  clock between them (it shows in `wait-ready`, 10.3 s, not in the stepping figures).

## To run it again

```
SG_PROFILE=1 node packages/scenes/chiro/chiro.check.mjs      # table at the end; JSON in .shots/profile/<folder>.<check>.<engine>.json
node tools/profile.mjs                                         # one markdown table over a folder of them
```
