# 0023: each kind of image has one format, and generated art stays code

*Command center, on the owner's word, 6 October 2026. Status: accepted.*

Susegad ships almost no raster images, because its scenes are code: a seeded canvas or WebGL scene costs no image bytes at all. On 6 October the tracked files counted 162 WebP (all private review screenshots in `docs/shots/`), 32 JPG and PNG (README pictures, `apps/docs/og.jpg`, test fixtures), 2 SVG and 2 GIF. The two GIFs are the README's hero animations, about 2 MB each, and they are the largest images in the public tree.

That is about to change. Poster-first scenes (goal rung 3) put a raster poster in front of every scene, the greeting cards and Folio export images, and a team outside the studio will add its own. So the formats are settled now, by kind of image, before habits form.

| Kind | Format | Why |
|---|---|---|
| Generated art (scenes, patterns, motifs drawn at runtime) | **Code**, no file | Zero bytes, any size, any register, seeded and reproducible. A raster copy of a scene is a poster, not a replacement. |
| Drawn art (icons, logos, borders, line motifs, the kaavi frame's ornament, facades) | **SVG**, inline or as a file | Sharp at every size, themeable through `currentColor` and the tokens, small. Hand-drawn SVG is optimised before it lands. |
| Photographs and scene posters | **AVIF, then WebP, then JPG**, in `<picture>` | AVIF is usually the smallest at the same quality and works in every current engine (Safari from 16.4); WebP covers older phones; the JPG `<img>` inside `<picture>` is the fallback that always renders and carries the `alt`, `width`, `height`, `loading` and `decoding`. |
| Exports from a canvas (`packages/export/png.js`, the greeting cards) | **PNG** by default; WebP or JPG on request | PNG is lossless and universal. The export reports the type it actually produced: a browser that cannot encode the type asked for hands back PNG, and the file name must follow the bytes. |
| Images meant to be shared (greeting cards sent on WhatsApp) | **JPG** for sharing, PNG for saving | Messaging apps handle JPG predictably. WebP may be treated as a sticker; test before changing this. |
| Social preview images (`og:image`) | **JPG** (or PNG) | Link-preview crawlers do not handle AVIF and WebP consistently. `apps/docs/og.jpg` stays as it is. |
| Animation in docs and READMEs | **A short muted `<video>`** (AV1 or VP9, with H.264), or animated WebP where video cannot go | GIF is the heaviest way to show motion. A README on GitHub cannot autoplay video, so there it is animated WebP. |

**Rules that follow.**
- **No new GIF** anywhere in `packages/`, `apps/` or the README; the two README GIFs are converted to animated WebP.
- **Posters come from the build in all three formats.** The docs site already renders poster JPGs; the poster step writes AVIF and WebP beside each JPG, and `<sg-scene>`'s poster is a `<picture>`.
- **Every raster `<img>` declares its size** (`width` and `height`, or `aspect-ratio`), so nothing shifts when it loads.
- **A check guards it** (`tools/`, fail-first): it fails on a new GIF in the library or docs, on a raster above a size cap in `packages/`, and on a poster without its AVIF and WebP siblings. It warns, without failing, on an `<img>` with a JPG or PNG `src` that is not inside `<picture>`.
- **Encoding stays out of the library's runtime.** Formats are made at build time with the browser we already drive (as Folio does), or with `sharp` when it is installed. Nothing ships an encoder to the page.

**Not decided here:** JPEG XL (support is not yet in every engine; revisit when it is) and responsive `srcset` widths for posters (the poster step chooses them when it is built).

**Follows from this:** goal rung 3, item 1 (poster-first scenes) builds the poster formats and the check; Folio's existing WebP and AVIF re-encoding already follows this decision.
