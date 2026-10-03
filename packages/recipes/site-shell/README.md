# Site shell

Proves that Wave 5's pieces work together, for a fictional homestay, Casa Aldona.

```sh
node tools/serve.mjs
# open /packages/recipes/site-shell/index.html
```

## What it composes

| Piece | Where |
|---|---|
| `<sg-tabs>` | the header's primary navigation (Overview, Rooms, Book), driving which `<section>` of `<main>` shows |
| `<sg-action-menu>` | the header's Account menu, wrapping an `<sg-button>` trigger |
| `<sg-dialog>` | "Ask the house", opened from a link in Overview |
| `<sg-drawer>` | the full room list, opened from a link in Rooms |
| `<sg-scroll-section>` | wraps `<sg-scene name="paus">` in Overview; the window's fog clears in step with real scroll |
| the Kantar interlude | plays between the two steps of the Book section's small booking flow |

Every one of these is a plain library part, imported and used exactly as its own docs describe; `recipe.js` adds no new theatre. The one thing a page can't do without a script is run the Kantar interlude between the booking flow's two steps, so `recipe.js` exports `mountSiteShell(root)` for that, and `site-shell.core.js` holds the two-step flow's own tiny state (`nextStep`, `isFirstStep`) as a pure, tested unit rather than a magic number in the page's own script.

Tabs' panels are **not** nested inside `<sg-tabs>` here: the `<nav>` lives in the header and the three `<section>`s live in `<main>`, connected only by `id`/`href`, which Tabs' own contract already supports (`tabs.js` looks inside itself first, then falls back to `document.getElementById`). This is the realistic shape of a real site's header, and it proves that fallback path.

## Registers

- **Quiet**: no curtain theatre for the Kantar interlude (a plain status line instead); Tabs' hairline underline; Dialog and Drawer's plain dimmed backdrop; the scroll section never scrubs (the scene shows its own still).
- **Warm**: the travelling ink underline; the Carepa surface behind Dialog and Drawer; the curtain, its pool, no singer; the scroll section's slow parallax.
- **Playful**: the same, brighter, with Menu's stamped list, the underline's bead, the Kantar curtain's singer silhouette, and Drawer's slide delayed by one Teental beat (`talaDelay(1)`, from Drawer's own build).

## No JavaScript

Every `<section>` shows (Tabs is a plain table of contents); `data-sg-dialog`/`data-sg-drawer` openers are real links to `no-js.html`, a real page, so nothing here is ever unreachable.

## Verification

```sh
node --test packages/recipes/site-shell/site-shell.test.js
node packages/recipes/site-shell/recipe.check.mjs
node tools/matrix.mjs --url /packages/recipes/site-shell/index.html
node tools/axe.mjs --url /packages/recipes/site-shell/index.html
node tools/perf.mjs --url /packages/recipes/site-shell/index.html --register warm
```
