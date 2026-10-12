# Pretext ecosystem survey

*Reconnaissance for the Sutradhar and the owner, 8 October 2026. Surveys what the
community has built on Cheng Lou's Pretext since its March 2026 launch, what the
genuine innovation and the pitfalls are, and which solved problems are worth
porting into Susegad. Every link was read (page or repo), not a search snippet.*

## TL;DR

Pretext is a 15 KB, zero-dependency TypeScript library that measures and lays out
multiline text without touching the DOM. The genuine innovation is **not** the
canvas `measureText()` call (that predates it) but the **prepare/layout split**:
do the expensive, browser-specific work once (segment, measure word widths,
cache), then reflow is pure arithmetic — about 0.09 ms for 500 blocks versus
15–30 ms of DOM reflow.

Susegad already converged on this split independently. `packages/type/layout.js`
caches a prepared handle (`prepare(text, font)`) and reflows cheaply against shape
functions (`rect`, `arch`) with `layoutNextLineRange()`. The repo comment says it
plain: *"No DOM here; the only thing Pretext touches is a canvas to measure with,
and the tests give it a fake one."* Pretext is vendored at
`packages/type/vendor/pretext.js` (decision 0019).

The question for this sprint is not "how do we learn Pretext" — it is "how do we
promote the text tier from a type-package internal into a first-class, shared
surface contract." That is the architectural decision 0029.

## Who, what, when

- **Cheng Lou** — former React core team, creator of react-motion, co-creator of
  ReasonML, now a frontend engineer at Midjourney. Pretext was built with
  AI-assisted development (Claude Code + Codex), "trained" against browser ground
  truth for weeks.
- **Launched** 27 March 2026, MIT. ~50k stars within weeks, a 397-point Hacker
  News thread, 16M+ views on X.
- **Scope is deliberately narrow.** Rendering, framework adapters, and helpers are
  "out of scope, the community's job." This is why the ecosystem exists.

## The two use cases (the API split that matters)

1. **Plain** — `prepare(text, font)` → opaque handle; `layout(handle, width,
   lineHeight)` → `{ height, lineCount }`. For virtualization, scroll anchoring,
   zero-CLS: you know the height before you paint.
2. **Per-line** — `prepareWithSegments(...)` then `layoutWithLines()` (all lines at
   one width) or `layoutNextLine()` / `layoutNextLineRange()` (each line at its
   own width). This is the path that enables **text around shapes**, flowing
   around floated images, non-rectangular containers, and 3D occlusion.

Also worth noting: a `rich-inline` sub-entry (`@chenglou/pretext/rich-inline`) for
mixed fonts / code spans / mentions / chips / inline images, and a `preimage`
counterpart (image measurement with the same prepare/layout split) from
somnai-dreams.

## The official caveats (the pitfalls, from the README)

These are load-bearing — they are the honest limits, and they decide how Susegad
must use Pretext:

- **Canvas ≠ painted browser.** Subpixel rounding, font-fallback-chain resolution,
  and per-engine quirks mean Pretext's output is a high-fidelity approximation,
  not a guaranteed match. The repo keeps `RESEARCH.md` (design decisions) and
  `ENGINE_FOLLOWUPS.md` (open gaps), and tests against real browsers via
  `corpora/` and `pages/accuracy.ts`.
- **`system-ui` is unsafe on macOS.** Canvas and DOM resolve it differently at
  certain sizes (10–12px, 14px, 26px). Use a named font, and name one per script
  your text actually uses.
- **Narrow CSS coverage.** Handles `white-space: normal | pre-wrap` and
  `word-break: normal | keep-all` only. Out of scope: `font-variant-numeric`,
  `font-optical-sizing`, `font-feature-settings`, `font-variation-settings`,
  auto-hyphenation, `text-wrap: balance/pretty`, `hanging-punctuation`,
  `text-rendering: optimizeLegibility`. Text painted with any of these can wrap
  differently.
- **Font-loading timing.** Prepare *after* the web font has loaded
  (`await document.fonts.load(...)`), because `unicode-range` splits load only
  what the text needs. Re-prepare when `<html lang>` changes — language changes
  both fonts and line breaks.
- **Environment floor.** Needs Canvas 2D, Unicode property escapes (`\p{...}`), and
  `Intl.Segmenter` (for Thai/Lao/Khmer/Myanmar and other space-less scripts). No
  IE, no old Android WebView without a heavy polyfill. Burmese shaping is still an
  open issue.
- **Not out-of-the-box fast.** Early builds measured ASCII at 2200 ms where the
  simpler `uWrap.js` did 80 ms; the speed came from later PRs. Cheng Lou himself
  called the "500x" claim "unfair" (hot cached path vs cold full measurement).
- **Pixel pass-through.** Pass font sizes in whole px (Firefox rounds fractional
  sizes), `maxWidth` as the number you set (not one read back — it is rounded and
  zoom-scaled), and round computed widths to whole/quarter pixels.
- **Emoji + zoom.** On Chrome/Firefox/macOS a small emoji's painted width depends
  on `devicePixelRatio`; call `clearCache()` and re-prepare on zoom (issue #418).
- **No SSR yet**, and explicitly not a font renderer.

The single most repeated architectural lesson from the Hacker News thread: **soft
hyphens, emoji correction, and non-Latin scripts are not edge cases you bolt on
later — they are the foundational rules.** This maps directly onto Susegad's
Devanagari and Kannada type work.

## The ecosystem — two overlapping catalogs

There are **two** "awesome" lists. Do not conflate them.

1. **`bluedusk/awesome-pretext`** — the older, wider list (demos, games, community
   projects, articles, videos, "people to follow"). Auto-updated by a Claude Code
   slash command. Good for discovering *ideas* and *who*.
2. **`ShipItAndPray/awesome-pretext`** — a curated catalog of **42 package-shaped
   projects**, nearly all under the ShipItAndPray org, each with a live demo. This
   is the one that matters for porting, because it names *solved problems*.

The ShipItAndPray catalog is a 12-star showcase with one contributor ("noreply");
these are demo-quality, AI-generated repos, **not** battle-tested libraries. The
right move is to port the *solved problem* (the pattern), not to vendor the code.
That aligns with Susegad's dependency-free charter anyway.

## The flagship ideas that matter to Susegad

### textura — Pretext × Yoga (DOM-free layout engine)

By Razroo. The repo link has moved (404 on `razroo/textura`); it lives at
`razroo.github.io/textura`. The one-line thesis:

> Yoga computes flexbox layout but *cannot measure text*. Textura wires in
> Pretext's canvas measurement so every node gets exact geometry. No DOM, no
> reflow.

API sketch: `await init()` (loads Yoga WASM once), then
`computeLayout(tree, { width })` over a tree of `{ text, font, lineHeight }`
nodes → nested `{ x, y, width, height }`. It also ships an **MCP server**
(`claude mcp add textura npx @razroo/textura-mcp`) with tools `compute_layout`,
`analyze_layout`, `validate_responsive`, `fix_layout` — "give your AI coding agent
layout vision."

The far end of the same idea is **`geometra`** (Agent-Pattern-Labs): Yoga WASM +
Pretext computing pure `{x,y,width,height}` streamed as flat JSON, renderable by
Canvas2D, terminal, or "raw geometry for AI agents" — a whole browser-rendering
pipeline replaced by server-side layout.

What Susegad takes: the *principle* that a pure text-geometry tier can be run
without a browser (which is the CI-gate idea below), and the ambition that Susegad
scenes are the render backend rather than flat canvas.

### Pretext × three.js

- The three.js manual "Creating Text" page lists the naive routes: DOM overlay,
  CSS2D/CSS3DRenderer, canvas-as-texture, `THREE.TextGeometry`, or `troika-three-text`.
  None of them tell you *where lines break at a given width*. Pretext does.
- The ecosystem's "3D Object Text Wrap" showcase (pretextjs.dev, by solarise_webdev,
  X post 2038713450533212445) wraps text around a 3D gaussian splat **in real time**:
  Pretext does the line breaking, three.js does the spatial embodiment.
- The cited "Pretext + Three.js guide" (TachikomaRed, X post 2038649393574809911)
  is the same idea: Pretext for precision layout, three.js for the z-axis.

What Susegad takes: the natural division — **Pretext computes 2D layout, stage3d
owns the z-axis.** Susegad's shape functions (`rect`, `arch`) can compute occlusion
for a 3D object the same way they compute it for an arch. This is the strongest
undeveloped differentiator found in the whole survey: nobody in the ecosystem is
pairing DOM-free text with *progressive, register-aware 3D*.

## The 42 packages, triaged for Susegad

Full inventory from the ShipItAndPray catalog, mapped against
`packages/`. Three tiers.

### Tier 1 — solved problems that map to a component Susegad already owns

Port the technique, zero new surface area.

| Pretext package | Susegad component | The solved problem |
|---|---|---|
| pretext-accordion | accordion | zero-CLS: predict collapsed→expanded height before paint |
| pretext-tooltip / pretext-truncate | tooltip, quote, postcard | know size before render; multiline truncate without flash |
| pretext-overflow-menu | site-nav, action-menu, menu | collapse to "+N more" correctly on frame 1 |
| pretext-masonry | tile-band, gallery | masonry from *predicted* card heights |
| pretext-table | data-table | column sizing + virtualization, no getBoundingClientRect |
| pretext-forms | field, form | auto-sizing inputs on the ruled-line aesthetic |
| pretext-typewriter | loader, narration | streaming text with stable final height |
| pretext-sparkline | now-note | inline sparklines, collision-free value labels |

### Tier 2 — net-new components worth adding (on-thesis, named, solved)

| Pretext package | What to build | Why it is Susegad |
|---|---|---|
| pretext-comic | speech-bubble / shape-fit primitive | torn-paper quotes, thought bubbles; unifies quote + chat-thread + doodle into one "text-in-shape" shape source |
| pretext-tts-highlight + pretext-captions | karaoke word highlight + WCAG captions | the missing link between the sound tier and the type tier |
| pretext-gantt | timeline sibling to stepper | zero-flicker labels on frame 1 |
| pretext-map-labels | collision-free label placement | feeds veranda/toran/kolam annotations and the folio diagram grammar |
| pretext-infinite-canvas | infinite canvas with zoom-correct wrap | most "engine"-adjacent; touches engine/src stage/loop + scenes |

### Tier 3 — a new gate class (the Asymmetrica-flavored one)

| Pretext package | What it gives Susegad |
|---|---|
| pretext-overflow-monitor | detect text overflow in CI, pure arithmetic, no browser |
| pretext-a11y | WCAG text-overflow audit in CI, no browser |
| pretext-i18n | catch i18n text overflow at build time, no browser |

Susegad already gates everything (`tools/axe.mjs`, `tools/perf.mjs`,
`tools/checks.mjs`, budgets). These three are a **gate class Susegad does not yet
have**: a *layout* gate over pure arithmetic. Given the Devanagari + Kannada type
tokens, `pretext-i18n` is the obvious first win: "this label overflowed in Kannada"
caught at `node tools/checks.mjs` time instead of in a screenshot matrix.

### Explicit skips (do not burn a worktree)

`pretext-react` / `-rn` (React wrappers; Susegad is dependency-free ES modules),
`pretext-terminal` / `-logviewer` / `-repl` / `-code-minimap` / `-blocks` /
`-editor` / `-diff*` (off-thesis or dev-tool-adjacent), `pretext-og` (overlaps
Satori), `pretext-ssr` (fights the sealed-client folio model), `pretext-webxr`
(the stage3d tier already covers the sane 80%).

## Source index

Primary and read directly:

- chenglou/pretext README + official caveats — https://github.com/chenglou/pretext
- chenglou/pretext demo index — https://chenglou.me/pretext/
- ShipItAndPray/awesome-pretext (the 42-package catalog; repo is only the static
  site — the README *is* the catalog) — https://github.com/ShipItAndPray/awesome-pretext
- Live catalog site — https://shipitandpray.github.io/awesome-pretext/
- bluedusk/awesome-pretext (wider list; demos, community, tutorials, articles) —
  https://github.com/bluedusk/awesome-pretext
- Hacker News launch thread (397 pts; the perf/accuracy debate) —
  https://news.ycombinator.com/item?id=47556290

Secondary (context, criticism, ecosystem):

- HackerNoon, "Pretext Does What CSS Can't" (the caveats summarized) —
  https://hackernoon.com/pretext-does-what-css-cant-measuring-text-before-the-dom-even-exists
- pasqualepillitteri.it limits writeup (environment floor, system-ui, CSS coverage) —
  https://pasqualepillitteri.it/en/news/2293/pretext-15kb-zero-dom-text-layout-engine
- gigazine (community criticism + the uWrap perf comparison) —
  https://gigazine.net/gsc_news/en/20260412-pretext/
- textura (Pretext × Yoga) — https://razroo.github.io/textura/ (repo moved off
  razroo/textura)
- geometra (the far-end "replace the renderer" idea) —
  https://glama.ai/mcp/servers/Agent-Pattern-Labs/geometra
- pretextjs.dev 3D Object Text Wrap showcase — https://pretextjs.dev/pretext-demo/showcase-3d-text-wrap
- three.js "Creating Text" manual — https://threejs.org/manual/en/creating-text.html
- pretext.cool (community gallery/guides) — https://www.pretext.cool/
- pretext.wiki (community docs) — https://pretext.wiki/

Named ports and projects referenced, for the agent to read before porting:

- always-fit-resume — https://github.com/vladartym/always-fit-resume
- fitbox (darkroomengineering) — https://github.com/darkroomengineering/fitbox
- pinch-type — https://github.com/lucascrespo23/pinch-type
- jalco-ui (Shadcn-compatible registry) — https://github.com/jal-co/ui
- layout-sans — https://github.com/BaselAshraf81/layout-sans
- swift-pretextkit — https://github.com/tornikegomareli/swift-pretextkit
- PretextSharp — https://github.com/wieslawsoltes/PretextSharp
- nim-pretext — https://github.com/jasagiri/nim-pretext
- expo-pretext — https://github.com/JubaKitiashvili/expo-pretext

## Related decisions in this repo

- 0017 — the three.js tier (stage3d loads three lazily; core never imports it)
- 0019 — Pretext vendored into `packages/type/vendor/pretext.js`
- **0029** — Pretext is a measurement oracle behind an injectable boundary; the
  text tier becomes a first-class scene surface (this survey's companion)