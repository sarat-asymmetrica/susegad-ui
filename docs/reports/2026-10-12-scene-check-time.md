# Scene checks on virtual time: the shet probe

12 October 2026, Karigar, branch `batch/scene-time` (from `main` at ee24ff3). The question is finding 9 of
`docs/runs/2026-10-12-harness-review/README.md`: do the slow scene checks wait for animation in real time, and
can they step it instead?

**Short answer: yes, and there is a second cost the hypothesis did not name.** On this machine `shet.check.mjs`
went from 342 s to 107 s in Chromium with the same 26 clauses passing, the same percentages, and every planted
fault caught. Two thirds of the saving is virtual frames; a quarter is how the pixels come back from the page.

## Where shet's 342 s went (Chromium, before)

One run, timed by section in a scratch copy. Other agents had browsers open (30 Chrome processes, CPU 71% at the start).

| Cost | Seconds | What |
|---|---|---|
| Clause 3, the calm zone | 196 | four `?freeze` pages (40.2 s, 40.7 s, with and without words), 47 to 52 s each: the harness clock moves 1/60 s per *real* frame, so 2,412 frames take about 45 s |
| Pixel grabs, all clauses | about 60 | each `grab()` returned a plain array of 2.6 M numbers: 2.3 to 3.5 s per grab to serialise, about 20 grabs |
| Clause 6, the scape | 74 | nine page visits with `waitForTimeout(2500)` each (22.5 s), two resize runs with 4 × 600 ms |
| Clauses 1 and 2 | 47 | `freeze=2` (9.8 s), stills, and 8 s of `waitForTimeout` around the held and free year |
| axe, six pages | 14 | (unchanged) |

Browser launch was 0.2 s. Page loads were 1.3 to 2.6 s each to `sg-ready` and are not the problem.

## What changed

- **Virtual frames.** An init script queues `requestAnimationFrame` callbacks and runs them when the check steps, each
  step 1/60 s, with a message-channel settle between steps so promises, network and module loads still land. It is the
  idea of the hold script already in `tools/lib/browser.mjs`. Under `?freeze` the harness clock advances once per
  step just as it does once per real frame. **The pixels are identical:** fast against real at `freeze=2` and
  `freeze=40.2`, 0 channels differ; 40.2 s taken on the way to a 40.7 s freeze against `?freeze=40.2` alone, 0 of
  603,900 differ. So clause 3 now loads two pages, not four.
- **"Three seconds" are 180 frames of the scene's time** in clauses 2 and 4 (held year, free year, the gust), not wall time.
- **Pixels come back as base64** (`Uint8Array` + `btoa`), the same stride-2 samples: about 0.1 s a grab.
- **Kept on the real clock, on purpose:** the stills; "no request leaves the page" and "the still never loads
  year.js" (they watch the network over 2.5 s); axe; and the held month with the year blocked (see the finding below).
- **`--break`** is new. It plants three faults: the model ignores `progress`, the calm zone is never held, and
  Enter does nothing. The two render.js mutants in clause 6 still run every time.

## Results

| Run | Wall | Clauses |
|---|---|---|
| Chromium, before | 342 s | 26 pass |
| Chromium, after (one run, CPU 17% at the start) | 107 s (three runs before the base64 grab: 167, 205 and 220 s) | 26 pass, same numbers (16.64% elsewhere, 10.69% control, 40.6% free year) |
| Chromium, after, `--break` | 121 s | 4 of 27 FAIL as intended: the held month is never drawn, the canvas changes 100%, 8.33% under the words, wind −0.75 then −0.75 |
| WebKit, after (CPU 77% at the start) | 448 s | 26 pass. No WebKit "before" was run |

Chromium with `--disable-frame-rate-limit --disable-gpu-vsync` ran `freeze=40.2` in 36.5 s against 43.4 s, the same
pixels. Native frames still cost about 15 ms here against about 6.5 ms for a virtual frame, so that flag is not
the lever. It is also Chromium-only.

## A finding for core (not changed: outside the boundary)

On virtual frames, `progress=0.2` with year.js blocked never fires `sg-ready`. The scene goes to sleep (settled) inside
a loop tick while its layers are still painting. The frame its renderer asks for in that tick is dropped, because
`scene-element.js` `#invalidate()` returns while the loop is playing. After that, nothing is queued (I measured 0
callbacks over 1,800 frames), and a viewport resize does not wake it either. On the real clock it is ready in 1.2 to
2.4 s, so something in the real frame order rescues it; I did not prove what. Virtual frames run outside the
rendering steps, so they change the order of rAF callbacks against ResizeObserver and IntersectionObserver
callbacks. That is the honest limit of the instrument. It may also be a real race in core. Core should look at it
before the helper is used on held scenes.

## The other slow checks (read, not run)

| Check (CI, Linux) | Same pattern? | Estimated saving |
|---|---|---|
| maun 3.0 min | yes: nine `?freeze` pages (164 s of scene time); pairs 3/4, 20/21, 14/44 share pages | 1.5 to 2 min |
| mankurad 2.6 | yes: four freezes at 25 and 25.05 (100 s), plus 17.9 s of waits, plain-array grabs | 1.5 to 2 min |
| chiro 2.5 | yes: freezes 2, 24 and 24.05 (98 s), plain-array grabs | about 1.5 min |
| abri 2.0 | yes: live pages wait for real scene time to reach 31.8 s, with up to three retries "because a frozen clock is too slow" | about 1 min |
| vel 2.7 | partly: 26 s of waits (14 s for the vine) and about 35 s of freezes; screenshots, not arrays | 0.5 to 1 min |
| vad/words 2.5 | no: it already holds and steps (`__tools`); 3.3 s of waits | under 0.2 min |
| veranda/stage 3.3 | no: WebGL and screenshot decoding; its 4.5 s wait is a deliberate load race | about 0 |

If these hold, that is about 7 to 9 minutes off each engine's run, before shet's own saving of about 3 minutes.

## Proposal: `tools/lib/virtual-time.mjs` (the next slice)

```js
export const VIRTUAL_FRAMES;                                 // init script: __fast.step(n), __fast.toTime(t), __fast.frames
export async function openStepped(h, path, { reduced, routes, setup }) // → { ctx, page, errors, pageErrors }, stepped to sg-ready
export const frames = (page, n) => …;                        // n virtual frames
export async function until(page, cond, { arg, ms, batch }) // step until a page predicate holds; false on timeout
export async function frozenAt(h, query, times, opts)       // one ?freeze page, a grab at each time on the way
export async function grabPixels(page, { stride })          // base64 transfer, { w, h, kx, ky, px: Buffer, words, local }
```

Fold `browser.mjs`'s `HOLD_SCRIPT` into it, so there is one virtual clock. With it, converting a check is mechanical:
`frozen(q)` becomes `frozenAt`, and `waitForTimeout(ms)` on a moving page becomes `frames(page, ms * 0.06)`. Each
conversion still needs one pixel-identity run against the real clock, and its own `--break`. Network claims stay on
real time.
