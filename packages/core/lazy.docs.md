# sg-lazy

Show a poster first, and load the scene only when it is wanted. `<sg-lazy>` wraps a `<picture>` and a hidden `<sg-scene>`. The poster is the first paint, and it is also the finished still wherever the scene should not start: under reduced motion, with Save-Data, in the quiet register, and on a device that reports 2 GB of memory or less.

```html
<link rel="stylesheet" href="/packages/core/lazy.css">
<script type="module" src="/packages/core/lazy.js"></script>
<sg-lazy src="/packages/scenes/abri/index.js">
  <picture>
    <source type="image/avif" srcset="abri.avif">
    <source type="image/webp" srcset="abri.webp">
    <img src="abri.jpg" width="720" height="450" alt="A bus shelter in the rain" decoding="async">
  </picture>
  <sg-scene name="abri" seed="1" hidden></sg-scene>
</sg-lazy>
```

## What it does

- **The poster is the page.** The `<picture>` is ordinary content, so it shows with no JavaScript and under any Content-Security-Policy. `lazy.js` is small and imports no engine and no scene.
- **The scene is fetched when it can be seen.** When the element is within 200 px of the viewport and the page has loaded, `sg-lazy` imports `core/index.js` (which defines `sg-scene` and brings the engine) and the module named by `src`, unhides the scene under the poster, waits for its first frame (`sg-ready`), and fades the poster out.
- **It holds back when asked.** `holdReason()` in `lazy.core.js` decides, and `data-hold` shows the answer: `reduced-motion`, `save-data`, `low-memory` or `quiet`. A change while the page is open (the register switch, a media preference) is noticed: a held scene that becomes allowed starts when it is on screen.
- **A viewer can still ask.** `start()` fetches and starts the scene whatever the hold, and plays it. The element draws no button of its own; the page offers one, in its own words.

## Attributes, members, events

| | |
|---|---|
| `src` | The scene module (for example `/packages/scenes/abri/index.js`). Space-separated URLs are all imported. Resolved against the page. |
| `register` | As on any element: it applies to the scene inside, and to the hold. |
| `start({ play })` | Fetch and start now. Resolves `true` when the first frame is drawn, `false` if it failed. A held scene is played too, unless `play` is `false`: then it is drawn and stays as its own still (for a viewer who asked to look closer, not to watch it move). |
| `state` | `'poster'`, `'loading'`, `'live'` or `'failed'`. Also `data-state`. |
| `holding` | The reason the poster is kept, or `null`. `data-hold` shows it on the element. |
| `scene` | The `<sg-scene>` inside. |
| `sg-lazy` event | When `state` or the hold changes. Bubbles. `detail: { state, hold }`. |

## The poster

Make AVIF, WebP and JPG at build time, as decision 0023 says; `posterPicture({ stem, alt, width, height, eager })` in `lazy.core.js` writes the markup. The `<img>` always carries `alt`, `width`, `height` and `decoding`; the first poster on a page is `eager` (no `loading`, `fetchpriority="high"`), the rest are lazy. A browser takes the first `<source>` it supports and does not fall through to the next if that file fails to load, so a poster with a missing AVIF shows as a broken image: make all three files, and let the image check say when one is missing. The docs site's poster step (`apps/docs/posters.mjs`) shows one way to make them with `sharp`, and `node tools/images.check.mjs --root <built site>` checks that every poster has its siblings.

## Styles

Link `lazy.css`, as you would a component's CSS. It is the poster's layout: the picture fills its column and keeps its shape from the image's `width` and `height`, so nothing is wider than the screen and nothing moves when the script arrives, or when it never does (without it, a poster larger than the screen scrolls the page sideways until the script has run). `lazy.js` also adopts the same rules as one shared constructable stylesheet, with the fade, so a page that does not link the file still works under a strict `style-src 'self'`; the two are kept the same by a test. Every rule is inside `:where()`, so any CSS of yours wins. The poster sits on top of the scene in one grid cell and fades out when `data-state="live"`; under reduced motion there is no fade.

## Words, accessibility

The poster's `alt` is the image's name; give it the scene's `label`. While the poster is up, the hidden scene is not in the accessibility tree; once the scene is live the poster is hidden from it, so there is one image at a time. Put the scene's words beside the `<sg-lazy>`: words slotted inside a hidden scene are not on screen until it starts.

## Two memory thresholds

`<sg-scene>` steps its register down one when the device reports 1 GB of memory or less (`register.js`): a tiny phone still gets a scene, a calmer one. `<sg-lazy>` holds the poster at 2 GB or less: whether to fetch the engine and a scene at all is a bigger bill than how calmly it then draws, so the line for not starting is higher than the line for drawing more quietly. They are different questions, so they are not the same number; `LOW_MEMORY_GB` in `lazy.core.js` is the one to change for the second.

## Limits

A scene held back never runs its own still: the poster is the still, so make the poster from the scene's own still (the docs site shoots it under reduced motion). Playing a held scene is the page's offer; `sg-lazy` never starts it without one.
