# The docs site

The front door of Susegad UI, built with the library itself. The home page has the masthead (a live Kolam), the three ideas from the charter, the scenes gallery and the pencil box.

## Run it

```sh
node tools/serve.mjs            # then open http://127.0.0.1:5173/apps/docs/
node apps/docs/build.mjs        # builds out/docs/ and checks the copy loads under /docs/
node apps/docs/check.mjs        # screenshots, axe, overflow, Look closer, persistence
node apps/docs/check.mjs --built  # the same checks against out/docs/
```

Screenshots and `report.json` go to `.shots/docs/` (or `.shots/docs-built/`).

## Files

| File | What it does |
|---|---|
| `index.html` | The page. Static copy lives here. |
| `prefs.js` | A classic script in `<head>`: reads register, theme and palette from `localStorage` (inside try/catch) and sets `data-register`, `data-theme` and `data-palette` on `:root` before first paint. |
| `docs.css` | The page's styles. Colour and type come from `packages/tokens/tokens.css`; the register is a set of inherited `--r-*` properties, so any element with `data-register` can differ from the page. |
| `docs.js` | The switches, the plates, the pencil box and Look closer. Every string it writes is in `STRINGS` at the top. |
| `techniques.js` | The pencil box table, ported from the Susegad sketchbook's `TOOLS`. |
| `manifest.js` | Scene order. `built` is `null` in development (the page asks the dev server which scenes exist); the build writes the list it copied. |
| `for-rafe.html`, `rafe.svg` | The dedication page and its drawing (see `DEDICATION.md`). The drawing is a CSS mask filled with `var(--ink)`, so it follows the theme; the footer links here. |
| `404.html` | The not-found page, with the same drawing. Its paths are relative, so a host that serves it for a missing page one folder down loses the styles; the words and links still work. |
| `build.mjs` | The build. See below. |
| `check.mjs` | The browser checks. |

## Adding a scene

Add its name to `order` in `manifest.js`. The page imports `packages/scenes/<name>/index.js` and reads the definition's `meta` (`title`, `word`, `gloss`, `caption`, `credit`, `techniques`, `prompt`, `map`, `W`, `H`). A scene that is not there yet is skipped, not fatal. Technique ids that are not in `techniques.js` still show as tags, under their id; add them to the table so the pencil box can explain them.

A page per scene can come later: `sceneHref()` in `docs.js` is the one place that decides where a scene links to (today, `#name` on the home page). A `scenes/<name>.html` page would sit one folder down; the build already rewrites package paths by folder depth.

## How the build works

No bundler. The library is plain ES modules with relative imports, so `build.mjs`:

1. copies the site's own files into `out/docs/`;
2. follows the import graph from them into `packages/` (static imports, literal dynamic imports, `new URL(..., import.meta.url)`, CSS `@import` and `url()`, HTML `src` and `href`), adding core and each scene as entries because the page imports scenes by a computed name, and copies every file it reaches with the tree intact;
3. rewrites the site's `../../packages/` prefix to `./packages/`;
4. writes `manifest.js` with the scenes it copied;
5. checks every relative reference in the copy resolves inside it, then serves `out/` and loads the site at `/docs/` in Chromium to prove it works under a base path.

`out/` is git-ignored.

## Fonts

The site uses the library's own self-hosted fonts. `index.html` links `packages/tokens/fonts.css` just before `tokens.css`, and the build follows its `url()` references and copies the WOFF2 files and their licences into `out/docs/`. The faces are split by script, so the page downloads only the Latin, Devanagari or Kannada files it shows. Nothing is loaded from anyone else's servers: `check.mjs` and the build's own check fail on any third-party request, and both confirm that Castoro loaded. Without the fonts, the token stacks fall back to system faces and the page still reads well.

## Look closer

The plate's running `<sg-scene>` is moved (with `moveBefore` where the browser has it) into a native `<dialog>`, and View Transitions morph it there and back. `<sg-scene>` defers its teardown by a microtask, so a move never restarts the drawing. Focus goes to Close; Escape and Close morph it home and return focus to the button that opened it. Reduced motion skips the morph.
