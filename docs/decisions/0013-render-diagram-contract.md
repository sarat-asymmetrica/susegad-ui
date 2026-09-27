# 0013: the renderDiagram contract between Folio's Markdown and the diagram

*Sutradhar, 24 September 2026, R0 of the resumed run. Status: accepted. Between karigar-core (owner of `packages/folio/md/` and `packages/folio/build/`) and karigar-engine (owner of `packages/folio/diagram/`). One owner per folder from here on.*

## Why this is written down

Commit `5f76caf` swept engine's in-progress `packages/folio/diagram/` into core's commit, and the contract between them lived only in messages that were lost at the usage limit. Engine's final report was never received, so this decision is written from the code at `5f76caf`, which already carried the contract in `render.js`'s header, and it fixes the three places where the two sides had drifted.

## The contract

**The function** (`packages/folio/diagram/render.js`), pure and synchronous, with no DOM, runs in Node and the browser:

```js
renderDiagram(src, { id, title, direction, register, steps, seed, lang }) → { html, text, errors }
```

- `src`: the diagram in the line grammar (`Guest -> Portal: books`).
- `html`: one `<sg-diagram>` element with `id`, `data-src` (the source), `data-opts` (JSON of title, direction and seed), `data-register-drawn`, `data-direction`, and optional `data-direction-set` and `data-steps`. Inside it is a `<figure class="sg-diagram">` with the caption, a static SVG (`role="img"`, named and described) and the text alternative. It uses no `style=""`.
- `text`: the text alternative as plain text.
- `errors`: `[{ line, message }]`, with lines counted from line 1 of `src`. It never throws on a bad source; what it can read still draws. A line with an arrow mark that isn't a whole connection, or with two arrows, is an error and never becomes a box.

**The builder** (`packages/folio/build/renderers.mjs`) calls `renderDiagram(source, { id, title, steps, register, direction })`, with `id` taken from the directive's `#id`. **The Markdown** (`packages/folio/md/index.js`) hands over the source from its first non-blank line and maps each error line back to its document line. The `:::diagram` directive takes `title`, `steps`, `register` and `direction` (`right` or `down`).

**Without a renderer** (Markdown rendered in a page, with no build), the Markdown writes the same element: `<sg-diagram data-src data-opts [data-steps] [data-direction data-direction-set] [data-register-drawn]>`, with the source in a `<pre>` as the reading without JavaScript. **The element** (`diagram.js`) draws itself from `data-src` when it finds no `.sg-diagram-svg`, and otherwise only adds life to what was built.

## What changed to match

- `md/index.js`: `direction` added to the directive; `id` passed on; the fallback markup changed from `<sg-diagram steps label>` (which the element could not read) to the `data-*` form above; flows (`=>`) and lines (`--`) count as arrows in the fallback's check.
- `diagram.core.js`: `A ->`, `-> B`, `A -->` and `A -> B -> C` are errors with their line (two new strings in `STRINGS`, for Kathakar to review).
- `diagram.js`: draws itself from `data-src`.
- Tests: two parser and renderer tests, two Markdown tests (the fallback's markup and the real renderer through the builder hook, with `id`, `direction`, steps and line numbers), and a browser check that a bare `data-src` element draws itself. `npm test` 515/515, `npm run check` 21/21, `diagram.check.mjs` 28/28.
