# Poster-first scenes: what a scene page fetches, before and after

*6 October 2026, Karigar (Claude Sonnet 5.5), goal rung 3 item 1. Decision: `docs/decisions/0024-poster-first-scenes.md`. Formats: `docs/decisions/0023-image-formats.md`.*

## What changed on a scene page

Before: the page showed a poster image over the stage, and at once imported `core/index.js`, the scene module and the engine (31 files), drew the scene, and hid the poster at the first frame. After: the poster is a `<picture>` (AVIF, then WebP, then the JPG) inside `<sg-lazy>`, and the 31 files are fetched only when the scene is near the screen, the page has loaded, and nothing asks for stillness (reduced motion, Save-Data, the quiet register, a device with 2 GB of memory or less). Where the poster is kept, a single Play button lets the viewer start the scene.

## The exit-gate numbers: a plain `<sg-scene>` against `<sg-lazy>`, the same poster files

*Added after the review (S4), re-measured on the fixed head. The pair is the cleanest control there is: two minimal pages (`out/docs/_r/`), the same tokens and the same words, one with `<sg-scene name="abri">` and the other with `<sg-lazy>` around the same three poster files (AVIF 26 KB) and a hidden scene. Chromium, median of 3, uncompressed dev server (JS is raw bytes); the phone is 390 x 844 at 2x, 4x CPU, 1.6 Mbps and 150 ms; the machine was shared with other builders. The script is `scratchpad/pair.mjs` of this run (not committed); it writes the pages itself.*

| Cell | Page | First paint of the picture | Scene's first frame | JS fetched (raw) | CLS |
|---|---|---|---|---|---|
| Phone, warm | plain `<sg-scene>` | nothing in the frame's box; FCP 740 ms (the H1) | 2576 ms | 141.6 KB, 28 files | 0.015 |
| | `<sg-lazy>` | **LCP 936 ms, the AVIF** | 2854 ms (it starts after load) | 149.5 KB, 30 files | 0 |
| Phone, quiet | plain | blank box, FCP 996 | drawn anyway, 5892 ms | 141.6 KB, 28 files | 0.015 |
| | `<sg-lazy>` | LCP 1012 ms, the AVIF | never started | **13.6 KB, 4 files** | 0 |
| Phone, reduced motion | plain | blank box, FCP 640 | drawn anyway, 5314 ms | 141.6 KB, 28 files | 0.015 |
| | `<sg-lazy>` | LCP 848 ms, the AVIF | never started | **13.6 KB, 4 files** | 0 |
| Desktop 1280, warm | plain | FCP 96 ms (the H1) | 1929 ms | 141.6 KB, 28 files | 0.012 |
| | `<sg-lazy>` | LCP 124 ms, the AVIF | 840 ms | 149.5 KB, 30 files | 0.001 |

What this says: where the scene would have run, the picture is on screen at 0.94 s on the phone while the plain page has nothing in the frame until the scene's first frame at 2.6 s; the lazy page's own first frame comes about 0.3 s later than the plain one (it waits for `load`), and it costs 7.9 KB more JavaScript and two more files (the loader, its pure core). Where the scene is held, the page fetches a tenth of the JavaScript (13.6 KB against 141.6 KB) and never draws. The page's own text paints first on the plain page (LCP is the H1); on the lazy page the picture becomes the largest paint, which is the point. The docs-page comparison above stays as what the site itself gains, not as the exit gate.

## After the review: what changed and how it was checked

- **B1, the poster's layout before script.** The review measured CLS 0.110 at 390 px (against 0.027 before) and a sideways scroll with script off (`scrollWidth` 712 against 390), because the poster's `width: 100%` lived in a sheet the script adopts. Now `packages/core/lazy.css` carries the layout (linked like a component's CSS; `lazy.js` still adopts the same rules, so strict CSP works without the link, and a test keeps the two equal), and `site.css` sets the poster's width. `lazy.check.mjs` has a no-JavaScript case at 390 px with the stylesheet linked (must fit and keep its shape: 374 x 196 for a 1200 x 630 poster) and a control without it (must overflow: 1208 px of scroll). `site.check.mjs` has a case that holds the loader back 2.5 s, as on a slow phone, and asserts the poster never outgrows the screen and CLS stays under 0.1 on three scene pages. Both were run red on the previous head first: the site check said "widest poster 688 px" on all three pages and failed. A plain CLS reading did not reproduce the review's 0.110 on this machine (0.027); the check watches the poster's box every frame, which does, so that is what it asserts.
- **S1, Play under the finger.** Play is the first button, then Look closer, Replay and New seed; the row is always there (its buttons are `visibility: hidden` until they apply), so nothing moves when the scene starts: Play stays at x 16, y 587 and the words below do not move. Between the press and the first frame the words say "loading the scene" and the row has `aria-busy`. `site.check.mjs` asserts this (x, y, the words' top, the label, the loading text). I did not run this one red against the old head, because the old build had been replaced by the time I wrote it; the review's measurements (x 16 to 197) are the red.
- **S2.** Every scene item lists `core-lazy` in its dependencies (33 manifests), so `npx susegad add scene-abri` brings the loader and its stylesheet; each scene's prompt has an "On a page" section with the poster-first markup. The least awkward cycle risk did not arise: `core-lazy` depends on `core` and `core-sheet`, and no scene is below them.
- **S3.** `tools/cem.mjs` now reads the define call of every registry item's own source, of any type, not only `core/index.js` and the component files; `custom-elements.json` goes from 53 to 60 elements (`sg-lazy`, and six that had been missing: `sg-toast-region`, `sg-diagram`, `sg-narration`, `sg-price-table`, `sg-timeline`, `sg-veranda-stage`). Two tests, both run red first: a fixture with a define outside `index.js` that was missing, and a scan of every `customElements.define` and `defineComponent` under `packages/` against the manifest.
- **S5.** The image check has a fixture with WebP and JPG and no AVIF, and one for an `<img>` with no size. With the AVIF requirement dropped in a scratch copy, the first one goes red where the six old fixtures stayed green.

## What the docs site itself gains

*(The earlier comparison, against the old scene page, which already showed a poster first.)*

## How it was measured

One built docs site (`out/docs`, built from this branch), served by `tools/serve.mjs` with no caching and no compression. The "before" page is the same built page with the previous markup (an `<sg-scene>` and an eager poster `<img>`) and the previous `scene-page.js` from the base commit, written beside it, so everything else (CSS, shell, fonts, the poster files) is identical: the control can only differ in what is being tested. Playwright Chromium, abri (a heavy scene: 30 files, 159 KB of source with the engine), the median of 3 runs per cell, 5 s on the desktop and 9 s on the phone before reading the numbers. The phone cells use a 390 x 844 viewport at 2x, 4x CPU throttling and a 1.6 Mbps, 150 ms network. JavaScript is counted gzipped (the dev server does not compress; images are counted as they are). The machine was shared with four other builders, so read the milliseconds as order of magnitude and the bytes as exact. FCP and LCP come from `PerformanceObserver`. A hold was set the way a visitor would set it: the site's own saved register (`sg-docs-prefs`), or Chromium's reduced-motion emulation.

| Cell | | FCP | LCP | Scene's first frame | JS fetched (gz, files) | Images | Whole page (gz) |
|---|---|---|---|---|---|---|---|
| Desktop 1280, warm | before | 444 ms | 444 ms | 1047 ms | 60.6 KB, 31 | 44.7 KB (JPG) | 276.5 KB |
| | after | 360 ms | 360 ms | 868 ms | 64.4 KB, 33 | 26.2 KB (AVIF) | 261.8 KB |
| Phone, warm | before | 1288 ms | 1296 ms | 4232 ms | 60.6 KB, 31 | 44.7 KB | 276.5 KB |
| | after | 1316 ms | 1316 ms | 4249 ms | 64.4 KB, 33 | 26.2 KB | 261.8 KB |
| Phone, quiet register | before | 1424 ms | 1440 ms | 8027 ms | 60.6 KB, 31 | 89.5 KB | 287.1 KB |
| | after | 1444 ms | 2464 ms | never started | **10.6 KB, 7** | 52.5 KB | **200.1 KB** |
| Phone, reduced motion | before | 1328 ms | 1336 ms | 7803 ms | 60.6 KB, 31 | 44.7 KB | 276.5 KB |
| | after | 1336 ms | 1336 ms | never started | **10.6 KB, 7** | 26.2 KB | **208 KB** |

## What it says, plainly

- **The first paint was already the poster on this page**, because the old scene page laid an eager poster over the stage. So FCP and LCP do not move for a visitor whose scene runs: 1.29 s and 1.32 s on the throttled phone are the same within the run to run spread, and the desktop's 444 to 360 ms is mostly the smaller AVIF and the noise of a busy machine. The honest gain on those pages is smaller and later work: the poster is 41% smaller (AVIF 26.2 KB against 44.7 KB of JPG), and nothing fetched for the scene competes with it.
- **Where the scene should not run, nothing of it is fetched.** On the phone in quiet or under reduced motion, JavaScript falls from 60.6 KB in 31 files to 10.6 KB in 7 (the page's own scripts and `sg-lazy`), and the whole page from about 276 KB to about 205 KB. The scene never starts, so the work the old page did to draw its first frame (7.8 to 8.0 s on the throttled phone in these two cells) is not done at all.
- **A viewer who gets the scene pays 3.8 KB more** (gzipped) and two more requests, the loader and its pure core, and the first frame arrives at the same time as before (868 against 1047 ms on the desktop, 4249 against 4232 on the phone).
- **LCP in quiet moved from 1440 to 2464 ms, and that is the instrument, not a regression, with a cause worth fixing.** The docs site swaps a poster to the visitor's register and theme after load (`shell.js`), which fetches a second poster (89.5 KB of images before, 52.5 KB after). On the new page Chromium counted the swapped-in AVIF as the LCP candidate; on the old page it did not report the swapped JPG at all. The visitor sees the same thing in both: the warm poster at about 1.4 s, then the quiet one. The cure is for the page to name the right poster in the HTML, which the static build cannot do for a stored preference; it is not done here.
- **LCP's element is a paragraph, not the poster, in two of the new cells** (`P` at 1316 and 1336 ms): with 4x CPU throttling the text beside the poster was painted and counted first, and the poster's AVIF never became the larger candidate. I did not chase it. FCP agrees with the old page to within 30 ms.

## Cells, in words (390 x 844, abri; `.shots` are in the scratchpad of this run, not committed)

- **Before the scene is visible** (warm, the scene's files held back 6 s): the page header and the register, theme and palette switches fill the first screen, then the frame: a dark walnut mount with the poster inside it, the marbled paper in indigo, ochre and madder, 342 x 245 px at (24, 319.5) in a 358 px mount. The state is `loading`; no controls are shown yet, and the next text begins just below. A canvas count of 0 says the scene has not drawn; the picture is the poster.
- **Quiet register**: the same frame in its hairline version (a 1 px edge, the poster 356 x 255 at (17, 312.5)), state `poster`, held for `quiet`, zero engine requests. Below it, one `Play` button and the words "a still frame; press Play to run it".
- **Reduced motion, scrolled into view** (scrolled down 1600 px, then `scrollIntoView`): the poster at (24, 15.5), 342 x 245, after 3 s still `poster`, held for `reduced-motion`, zero requests for the engine or the scene; `Play` below it. Pressing Play fetches 24 files, the state becomes `live`, the poster is hidden, and the row becomes Replay, New seed, Pause, Look closer.

## What else was checked

- `packages/core/lazy.check.mjs`, under `style-src 'self'`: below the fold nothing is fetched until it is scrolled near; held for each of the four reasons the poster stays and nothing is fetched; `start()` plays a held scene; quiet to warm at run time starts it; a bad `src` leaves the poster and a state of `failed`; with JavaScript off the poster is on the page and the scene is not. A mutation (`holdReason` returning `null`) made nine of its checks fail, so the held checks can fail.
- axe-core 4.13.0 on the abri page, WCAG 2.2 AA: 0 violations in 24 cells (1280 and 390 px, three registers, two themes, poster state and live state). `color-contrast` is "incomplete" on every cell, because the page's text sits next to a picture; it was not judged.
- `node tools/images.check.mjs --root out/docs` on the built site: 0 errors (606 posters, each with its AVIF and WebP).

## Known limits

- The poster for a register or theme other than warm and light is fetched after the first one (above). The docs site's home page, index pages and cards are unchanged apart from their posters being `<picture>`s.
- The measurements are one scene (abri) on one machine under load; the AVIF saving varies by scene (flat-colour scenes shrink more).
