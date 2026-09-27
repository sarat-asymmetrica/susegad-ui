# Folio: build, seal and print

Folio turns a page into one sealed `.html` file. The file works offline, loads nothing, prints cleanly, and says in its footer how to check that nobody has changed it.

```sh
npm run folio -- build packages/folio/samples/stay-note.html --budget 1.5MB --pdf
npm run folio -- verify packages/folio/samples/stay-note.folio.html
```

## `folio build <page.html>`

| Option | What it does |
|---|---|
| `--out <file>` | Where to write it. Default: `<page>.folio.html` beside the page. |
| `--budget <size>` | Fail when the file is larger, for example `1.5MB`. Default `3MB`. The table printed after every build lists each part, largest first. |
| `--page A4\|Letter` | The printed page. Default A4. |
| `--pdf [file]` | Also print it to PDF through Chromium, the way a reader's browser would. |
| `--no-check` | Skip opening the result with the network blocked. |

What happens, in order:

1. **Read.** The page is opened in Chromium to learn which characters it shows, including inside shadow roots, alt text, labels and link addresses, and which font draws each one.
2. **Scripts.** Every `<script type="module">`, with a `src` or inline, is bundled by esbuild into one module, so shared code runs once. Classic scripts are inlined. Anything under `/tools/` is a dev helper and is left out, with a note.
3. **Styles.** Stylesheet links become one `<style>`, with `@import` inlined.
4. **Fonts.** Each `@font-face` keeps only the characters it actually draws: every character goes to the first family in its text's stack whose face covers it, as the browser does. A face that draws nothing is left out. Latin faces that are used also keep printable ASCII, for typed input and the seal. Subsetting is HarfBuzz's (through subset-font), so Devanagari and Kannada still shape correctly. `local()` fallback faces are kept as they are.
5. **Images.** `<img>` and CSS images become data URIs. Raster images are re-encoded to WebP through Chromium (or AVIF, if `sharp` is installed), keeping the original when it is smaller, and capped at 2000 pixels wide.
6. **Print and seal.** `folio-print.css`, a page rule for the size, the running header (the title) and page numbers, `folio-print.js`, and the seal footer are added.
7. **Policy.** A `Content-Security-Policy` meta goes first in `<head>`. It allows every inline script and style by its hash, and nothing else: no network, no forms sent, images, fonts and media only from `data:` and `blob:`. The file is then opened in Chromium (normally, with reduced motion, and as print), and any style the page adds while it runs (a scene's shadow styles, for one) is added by hash, with `'unsafe-hashes'` so hashed style attributes work too, until nothing new is asked for.
8. **Sealed.** The SHA-256 of the whole file is written into it (see below).
9. **Proved.** The result is opened with every network request refused and logged. The build reports requests, errors and policy violations, all of which should be zero, and how many scenes drew.

A remote script, stylesheet or image fails the build with a plain message: a sealed document cannot load from the internet. A link (`<a href="https://...">`) is fine, because it is not loaded.

## The seal

The hash covers every byte of the file, with each place the hash is written (the `folio-integrity` meta and the footer) replaced by 64 zeros. That is how the hash can sit inside the file it describes.

- `folio verify <file.html>` prints whether the file matches, and exits 0 when it does and 1 when it does not. Changing any byte, even one character of the printed hash, makes it fail.
- In the document, the footer has a file chooser: pick the file and it is hashed on the device with Web Crypto and compared. Nothing is sent. On paper, the footer says to run `folio verify` instead.

## Print

`folio-print.css` gives a clean page: light colours whatever the screen theme, no buttons or inputs, scenes kept whole and at most 130 mm wide, link addresses after the links, headings kept with what follows, and table rows kept whole. `folio-print.js` makes every `<sg-scene>` draw its finished still before printing and carry on afterwards if it was moving. The PDF is printed at twice the screen density, so scenes are sharp.

## Pure parts and tests

`build/assets.mjs` (sizes, `unicode-range`, `@font-face`, urls, which face draws which character, the budget table) and `build/seal.mjs` (the policy, the hash, verify) are pure and tested in `folio.test.js`. `build/browser.mjs` holds everything that needs Chromium.

## Known limits

- HTML is read with patterns, not a full parser. That is fine for pages written for Folio, but not for arbitrary HTML.
- A dynamic `import()` with a computed path (as `<sg-empty>` uses for its scene) cannot be bundled. The builder notes it; import the scene directly in the page.
- Markdown sources arrive with `packages/folio/md`. Until then, build from an `.html` page.
- The in-page check needs the reader to choose the file, because a sealed document cannot read itself.

## Markdown with directives (`md/`)

`folio build doc.md` turns Markdown into a Folio page (`toDocument`), then builds and seals it as above. Front matter sets `title`, `lang`, `register`, `theme` and `description`.

```markdown
---
title: Restoring the house at Balcão
register: warm
---
# Restoring the house at Balcão

:::scene{name=kolam seed=7}
## Where we start
Markdown inside a scene sits over the drawing.
:::

:::note{tone=warning}[Before you sign]
The rate card is provisional.
:::

::price-table{from=kernels-booking arrival=2026-11-16 departure=2026-11-20 guests=2}

:::timeline{scrub}
- 2026-11-02: Survey the roof
- 2027-02: New roof on
:::

:::diagram{title="How a guest books" steps}
Guest -> Portal: chooses dates
:::

::signature{name="The owner" role="for the family" required}
```

| Directive | Form | Takes | Without its element |
|---|---|---|---|
| `scene` | leaf or container | `name` (required), `register`, `seed`, `label`, `progress`, `paused`, and any scene parameter | the container's Markdown still reads |
| `note` | container | `tone` = info, tip, warning, success; `[label]` | a plain aside |
| `diagram` | container | `title`, `steps`, `register`; one line per connection | the lines, as written |
| `price-table` | leaf | `from=kernels-booking`, `arrival`, `departure` (real dates, departure after arrival, at most 90 nights), `guests` (1 to 20), `room` | a sentence saying which dates the prices are for |
| `timeline` | container | `title`, `scrub`; lines of `- when: what` (YYYY-MM-DD, YYYY-MM or a label) | an ordered list with dates written out |
| `signature` | leaf | `name`, `role`, `label`, `field`, `required` | a labelled input to type a name |

Attributes are written `{key=value key="a value" #id .class flag}`, and a `[label]` goes before or after them. Containers close with a line of the same number of colons; nest them with more colons. Every mistake is reported at once with its line number, and the build stops:

```
proposal.md has 2 problems to fix:
  line 3: ::scene: needs name, like ::scene{name=...}
  line 5: ::price-table: departure must be after arrival
```

A directive's element is imported only if its module is in the project. Otherwise its plain version stands, and the build notes it. The parser is our own and has no dependency (decision 0012).
