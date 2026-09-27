# 0011: what the Folio builder depends on

*Karigar (core), 24 September 2026, Wave 3. Status: accepted by the Sutradhar.*

The Folio builder (`packages/folio/build/`) runs at build time only. Nothing it depends on ships inside a document. Versions were checked against the npm registry on 24 September 2026.

| Need | Choice | Why |
|---|---|---|
| One script for the whole document | **esbuild 0.28.2** (dev dependency, MIT) | The library is ES modules with relative imports and dynamic `import()` of skins, which a sealed file cannot load. esbuild bundles them into one module in about 50 ms, inlines the dynamic imports, and needs no configuration. GOAL.md already allows "a bundler for the single-file build". A hand-written bundler would have to handle dynamic imports and circular graphs, which is not a good trade. |
| Fonts subset to the characters used | **subset-font 2.9.0** (dev dependency, BSD-3-Clause), which brings harfbuzzjs 1.6.2 and fontverter 2.0.0 | Subsetting a font properly, keeping its shaping tables so Devanagari and Kannada still join, is HarfBuzz's job. subset-font runs HarfBuzz's own subsetter as WebAssembly, reads and writes WOFF2, and needs no native build. Writing a subsetter by hand is out of the question. In the sample, Mukta's Devanagari face drops from 59.6 KB to 1.9 KB, the Kannada face from 45.8 KB to 22.4 KB, and the Latin faces from 17.8 to 48.1 KB down to 8.0 to 28.1 KB. |
| Images compressed | **none new**: WebP through Chromium's canvas (Playwright, already a dev dependency) | Chromium's `OffscreenCanvas.convertToBlob` encodes WebP. It cannot encode AVIF, and falls back to PNG when asked. The builder therefore uses WebP. If `sharp` happens to be installed, it tries AVIF first and keeps whichever is smaller. It does not add sharp, because a native image library is a heavy install for a small gain. In the sample, a 232 KB JPEG becomes an 81 KB WebP (a 1.15 MB PNG of the same picture became 74 KB). |
| PDF | **none new**: Chromium's print to PDF through Playwright | Print CSS decides the page, so the PDF matches what a reader's browser prints. |
| Integrity hash | **none**: Node's `crypto` at build time, Web Crypto in the page | Both are built in. |

Consequences: `npm install` adds esbuild (a native binary per platform, fetched as an optional dependency) and subset-font with its WebAssembly. Library code and documents stay dependency-free.
