# 0024: poster-first scenes are `<sg-lazy>`, a small wrapper, and not a mode of `<sg-scene>`

*Karigar, for the Sutradhar, 6 October 2026, rung 3 item 1. Status: accepted by the build, for the command center to confirm.*

Until now every page that shows a scene pays for it before anyone has seen it: `<sg-scene>` imports the engine, its scene module and its renderer on load, and draws. A scene's page on the docs site had a poster, but only as a sibling image laid over the stage, hidden at the first frame; the JavaScript was fetched and run regardless. Shopify and any page behind a slow phone cannot use that (research, "Shared building blocks" 2).

**What we chose.** A new element, `<sg-lazy>` (`packages/core/lazy.js`, with the pure `lazy.core.js`), wraps a poster and a hidden `<sg-scene>`:

```html
<sg-lazy src="/packages/scenes/abri/index.js">
  <picture>
    <source type="image/avif" srcset="abri.avif"><source type="image/webp" srcset="abri.webp">
    <img src="abri.jpg" width="720" height="450" alt="…" decoding="async">
  </picture>
  <sg-scene name="abri" hidden></sg-scene>
</sg-lazy>
```

- The poster is the first paint, and the whole thing reads without JavaScript: the `<picture>` is plain light-DOM content, and the scene is `hidden`.
- The scene starts when `sg-lazy` is within 200 px of the viewport (IntersectionObserver) and the page has loaded. Then it imports `core/index.js` (which defines `sg-scene` and brings the engine) and the module named by `src`, unhides the scene under the poster, waits for `sg-ready` (the first frame), and fades the poster out.
- It never starts by itself under **reduced motion, Save-Data, the quiet register, or a device reporting 2 GB of memory or less**. The poster stays as the finished still. `holdReason()` is the pure decision, with tests. The register and Save-Data come from `registerState`, so a change at run time (the docs site's register switch, a media preference) is noticed: a held scene starts when the hold lifts and it is visible.
- `start()` starts it anyway, for a viewer who asks. The element draws no button of its own (so it carries no touch contract and stays small); the page offers one. The docs site's scene page shows a single Play while the scene is held, and `start()` then runs it, playing.
- `data-state` is `poster`, `loading`, `live` or `failed`, and `data-hold` says why the poster is kept. A scene that fails to load leaves the poster, with a console warning; nothing breaks.
- Styles are one shared constructable stylesheet, adopted onto the document with `adopt()` (strict-CSP safe, `csp.check.mjs`), every rule inside `:where()` so a page's own CSS wins.

**Why a wrapper and not a mode of `<sg-scene>`.**
1. *The bytes.* `core/index.js` is about 120 KB of source, almost all the engine, before any scene. If the poster logic lived inside `sg-scene`, a held page would still have to download and parse that to learn that it is held. `sg-lazy` imports only `register.js` and `sheet.js` (about 5 KB of source with its pure core); the engine is fetched when, and only when, the scene starts. That is the Shopify sketch's `sg-lazy`, and it is also the whole saving on the docs site (the report has the numbers).
2. *The blast radius.* `sg-scene` is used by about forty pages, recipes and components, and its core budget is tight (31 KB). Leaving it untouched means no caller changes behaviour: a bare `<sg-scene>` still mounts at once. Opting in is a wrapper and a poster.
3. *One place for the policy.* The hold rules sit in one pure function in one small file, which a Liquid snippet, the CLI's templates and the docs site all share.

**What it costs.** One more element to write, and a rule for authors: words that belong with a scene go beside the `<sg-lazy>` and not inside the scene, because the hidden scene's slotted words are not on screen until it starts. (A scene with slotted words is a scene that wants to be read; it can use the poster for its picture and put the words in the page.)

**The poster.** It follows decision 0023. `packages/core/lazy.core.js` has `posterPicture()`, which writes the AVIF, WebP and JPG `<picture>` with the `<img>`'s `alt`, `width`, `height`, `loading` and `decoding` (`fetchpriority="high"` and no `loading` for the first poster on a page). The docs site's poster step (`apps/docs/posters.mjs`) shoots each poster once as a PNG and encodes it three ways at build time with **`sharp`**: AVIF at quality 55, WebP at 78, JPG at 72. We use `sharp` because Chromium's canvas cannot write AVIF, and a build-time encoder keeps encoding out of the page, as 0023 asks. `sharp` was already in the tree through the Cloudflare tooling's dependencies; it is now declared as a dev dependency. If it is missing, the step writes the JPG alone and says so, and the image check fails the build's output loudly, so a site cannot ship without its AVIF and WebP by accident.

**The check** (`tools/images.check.mjs`, pure core `tools/images.core.js`, tests in `tools/images.core.test.mjs`) is built red first: it must fail on its fixtures (a new GIF, a GIF named in a README, a poster without its AVIF and WebP, a raster over 300 KB in `packages/`) and pass on a clean one before it is allowed to run on the repo. It runs in `npm test`. It warns, without failing, on an `<img>` with a JPG or PNG `src` outside `<picture>`, and on one with no declared size. Point it at the built site with `--root out/docs`.

**Not decided here.**
- Responsive `srcset` widths for posters (0023 left them to this step: a poster is one size per register and theme for now, and the AVIF is small enough that a second width has not earned its files).
- Giving `sg-scene` itself a poster attribute. If a page cannot add a wrapper, it can wait for a use that asks.
- Whether the home page's hero (a scene running at the top of the page, so always in view) should use `sg-lazy`. It is above the fold and wanted at once; the wrapper would only add the poster's fade. Left alone.

**Follows from this:** every scene item depends on `core-lazy`, so `npx susegad add scene-abri` brings the loader and the stylesheet (a bare `<sg-scene>` still mounts at once, and each scene's prompt shows the poster-first markup under "On a page"). The Shopify theme emitter and `npx susegad create`'s event page put their hero scenes behind `<sg-lazy>`; the docs site's scene pages are already built on it. The poster's layout is `lazy.css`, linked like a component's CSS, because a layout rule delivered by script made the poster 688 px wide on a 390 px screen until the script ran (review B1).
