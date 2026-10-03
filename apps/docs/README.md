# The docs site

The front door of Susegad UI, built with the library itself. The home page is short: the masthead (a live Kolam, the only drawing that runs on it), doors into each kind of piece, the newest pieces, and the three ideas from the charter. Everything else has a page of its own.

## Where things live

Served at the root (Workers serves `x.html` at `/x`):

| URL | Page |
|---|---|
| `/` | the home page (`index.html`, hand-written; the build fills in its doors) |
| `/scenes` | the scenes by volume, then the studio and the scapes, as posters |
| `/scenes/<name>` | one scene: the drawing live, its words, its prompt and word map folded away, prev/next |
| `/components`, `/recipes`, `/foundations` | the other kinds, as posters (foundations as words), with a search |
| `/components/<name>` and so on | one piece: its docs rendered from Markdown, its prompt, its install line, what it stands on, prev/next |
| `/pencil-box` | the techniques, each with the scenes that use it |

Index pages run nothing live: each card shows a poster captured at build time in every register and theme. A drawing runs only on its own page. Old links (`/#paus`, `/#paus-prompt`, `/#pencil-box`, `/#t-wobble`, `/components.html`) still land. Decision and gates: `docs/requests/2026-09-29-site-map.md`.

## Run it

```sh
node apps/docs/build.mjs --no-verify   # builds out/docs/ (posters come from .cache/posters/ when nothing changed)
node tools/serve.mjs --root=out/docs   # then open http://127.0.0.1:5173/
node apps/docs/build.mjs               # the same, then checks the copy loads (under /docs/, and at the root)
node apps/docs/site.check.mjs          # the site map's gates: lengths, nothing live on indexes, every item reachable, Look closer, axe
node apps/docs/check.mjs               # the home page across registers, themes and widths; reduced motion; the switches persisting
```

The generated pages exist only in `out/docs`; `node tools/serve.mjs` from the repo root still shows the home page at `/apps/docs/`, with its doors unfilled.

The first build shoots every poster (a few minutes); later builds re-shoot only the pieces whose files changed. Bump `VERSION` in `posters.mjs` to re-shoot everything.

## Files

| File | What it does |
|---|---|
| `index.html` | The home page. Static copy lives here; the build replaces what sits between the `site:doors` markers. |
| `site.core.js` | Pure: the site map (kinds, paths, scene groups, prev/next) and every generated page as an HTML string. Tested by `site.core.test.js`. |
| `pages.mjs` | The edge that reads scene metas, docs and prompts from disk and writes the generated pages into `out/docs`. |
| `posters.mjs` | Takes the posters with Playwright, cached in `.cache/posters/` by a content key. |
| `shell.js` | Every page: the switches, posters that follow them, copy buttons, a `#hash` opening its fold. |
| `scene-page.js` | A scene's page: the drawing into its stage, the controls, Look closer. |
| `index-page.js` | An index page's search. |
| `docs.js` | The home page: old anchors sent on, the masthead kolam. |
| `prefs.js` | A classic script in `<head>`: reads register, theme and palette from `localStorage` (inside try/catch) and sets them on `:root` before first paint. |
| `docs.css`, `site.css` | Styles. Colour and type come from `packages/tokens/tokens.css`; the register is a set of inherited `--r-*` properties. `site.css` holds the index, scene, item and door styles. |
| `gallery.core.js` | Pure: a registry item's card facts (its demo, docs and prompt paths). |
| `techniques.js` | The pencil box table, ported from the Susegad sketchbook's `TOOLS`. |
| `manifest.js` | Scene order and groups. `built` is `null` in development; the build writes the list it copied. |
| `llms.core.js` | `llms.txt` and `llms-full.txt`, from the registry. |
| `for-rafe.html`, `rafe.svg`, `404.html` | The dedication and the not-found page (see `DEDICATION.md`). |

## Adding a scene

Add its name to a group in `manifest.js` (a sketchbook volume numbers its plates; a group with `plates: false` doesn't). Its page is written from `packages/scenes/<name>/meta.js` (`title`, `word`, `gloss`, `caption`, `after`, `credit`, `techniques`, `prompt`, `map`, `W`, `H`, `alt`), and its poster from its own still (`stillTime`). A scene in the registry but in no group still gets a page, under "More scenes". Other HTML pages beside it (Tinto's `world.html`) are listed on its page under "More of it", by their `<title>`.

## How the build works

No bundler. The library is plain ES modules with relative imports, so `build.mjs`:

1. takes the posters and writes the generated pages into `out/docs/`;
2. copies the site's own files, filling in the home page's doors;
3. follows the import graph from all of them into `packages/`, and copies every file it reaches with the tree intact;
4. rewrites the site's `../../packages/` prefix by folder depth, and writes `manifest.js` with the scenes it copied;
5. checks every reference in the copy resolves inside it (a pretty link `/scenes/paus` resolves to `scenes/paus.html`, as on Workers; markup shown inside `<code>` or `<pre>` is prose, not a reference), then loads the copy in Chromium under `/docs/` and at the root.

`out/` and `.cache/` are git-ignored.

## Fonts

The site uses the library's own self-hosted fonts, split by script, so a page downloads only the Latin, Devanagari or Kannada files it shows. Nothing is loaded from anyone else's servers: the checks fail on any third-party request.

## Look closer

On a scene's page, the running `<sg-scene>` is moved (with `moveBefore` where the browser has it) into a native `<dialog>`, and View Transitions morph it there and back. `<sg-scene>` defers its teardown by a microtask, so a move never restarts the drawing. Focus goes to Close; Escape and Close morph it home and return focus to the button that opened it. Reduced motion skips the morph.
