# Lazy

*A poster first, and the scene only when it is wanted: a wrapper element, and not a mode of the scene.*

A custom element that holds a `<picture>` poster and a hidden `<sg-scene>`. The poster is ordinary light-DOM content, so the page reads and looks right with no JavaScript. When the element is near the viewport and the page has loaded, it fetches the scene's engine and module, unhides the scene under the poster, and fades the poster out at the scene's first frame. It refuses to start the scene by itself under reduced motion, Save-Data, the quiet register and low-memory devices; there the poster is the finished still. It draws no control of its own and exposes `start()` for a page that offers one.

```html
<script type="module" src="/packages/core/lazy.js"></script>
<sg-lazy src="/packages/scenes/abri/index.js">
  <picture>…poster in AVIF, WebP and JPG…</picture>
  <sg-scene name="abri" hidden></sg-scene>
</sg-lazy>
```

## The prompt

Build a small, dependency-free custom element, `sg-lazy`, that makes a scene poster-first. Keep the decision in a pure module, `lazy.core.js`: `holdReason({ reducedMotion, saveData, register, deviceMemory })` returns `'reduced-motion'`, `'save-data'`, `'low-memory'` (a reported memory of 2 GB or less; a browser that does not report it is not low) or `'quiet'`, in that order, or `null` when the scene may start; `parseSrc(value, base)` turns a space-separated `src` into absolute module URLs against the page, since a dynamic import resolves against the importing module and not the document; `posterPicture({ stem, alt, width, height, eager })` writes the `<picture>` of decision 0023, an AVIF source, a WebP source, then the JPG `<img>` carrying `alt`, `width`, `height`, `decoding="async"` and either `loading="lazy"` or, for the first poster on the page, `fetchpriority="high"`. Put the element in `lazy.js`, importing only `register.js` and `sheet.js`: it observes itself with an IntersectionObserver and a 200 px margin and the window's `load`, reads the effective register and Save-Data with `registerState` and watches them with `observeRegister`, and when nothing says no it starts. Starting listens for the scene's `sg-ready` before anything can happen, unhides the scene under the poster so its first frame draws at the real size, imports `./index.js` and the `src` modules together, waits for the first frame, then sets `data-state="live"` and plays the scene only if it had been held and a viewer asked. `start()` does this regardless of the hold; a failure, or no first frame in 20 seconds, hides the scene again, sets `data-state="failed"` and leaves the poster, so the page is never worse than the poster. Expose `state`, `holding` and `scene`, set `data-state` and `data-hold`, and dispatch a bubbling `sg-lazy` event with `{ state, hold }`. Style it with one constructable stylesheet adopted onto the document, so a strict Content-Security-Policy has nothing to block, every rule inside `:where()` so the page's own CSS wins: a grid with one cell, the poster above the scene, the poster fading out when live and not fading under reduced motion. Never put the scene's words in the wrapper's care: they belong beside it. Degrade honestly: with no JavaScript the poster is shown, unchanged and readable.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| the poster is the first paint | light-DOM `<picture>` | The `<picture>` is plain content; the hidden `<sg-scene>` is `hidden`. Nothing runs for it to show. |
| AVIF, then WebP, then JPG | `posterPicture()` | Two `<source>`s and the JPG `<img>` with `alt`, `width`, `height`, `decoding` and `loading` or `fetchpriority` (decision 0023). |
| only when it can be seen | IntersectionObserver | `sg-lazy` observes itself with a 200 px margin, and waits for the window's `load`, before `start()`. |
| not under reduced motion, Save-Data, quiet or a small device | `holdReason()` | The pure function in `lazy.core.js` returns the reason; `data-hold` shows it and the poster stays. |
| the scene's engine arrives only now | dynamic import | `start()` imports `./index.js` and the `src` modules, resolved against the page by `parseSrc()`. |
| fades the poster out at the first frame | `sg-ready` | `start()` listens for the scene's first frame, then sets `data-state="live"`; the CSS fades the picture and hides it from the accessibility tree. |
| a viewer can still ask | `start()` | Fetches and plays the scene whatever the hold; the page offers the button. |
| it never breaks the page | `data-state="failed"` | A failed import or a missing first frame hides the scene again and leaves the poster. |
