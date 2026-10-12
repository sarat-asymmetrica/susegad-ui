# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning
follows the rules in [`docs/ROADMAP.md`](docs/ROADMAP.md#semver-for-a-visual-library),
adapted for a copy-into-your-project library: a **major** change removes or
renames a public attribute, event, slot, CSS custom property, token or
registry field, or changes a default in a way that alters behaviour; a
**minor** change adds pieces, parameters or registers, or redraws a scene
(noted below with before/after); a **patch** is a fix with no change to the
public surface or a drawing's composition.

## [Unreleased]

## [0.1.0] - 2026-10-06

The first tagged release. It matches `@susegad/cli` and `@susegad/mcp`
0.1.0 on npm, published the same day from commit `1b512ad`. This section
covers the build record from the studio site's first use of the library
(2026-09-27) to the release; it does not reach back to the repo's
2026-09-24 seeding or the waves before that (Carepa, the overlays, actions
and motion waves, the Goan stories loop's first story), which shipped before
this changelog existed. The registry lists 116 items. Every item is
`experimental` unless the registry says otherwise (`tokens` and `core` are
`beta`; see the stability labels on
[the Components page](https://susegad.asymmetrica.ai/components)).

### Added

**Components and recipes**

- **Seven components from the studio site**: `chat-thread` (redaction at
  build time, quoted replies, reactions), `voice-note` (plays only on its
  own press, transcript always shown), `quote`, `postcard` (a level badge by
  default; stamp and postmark are opt-in with `status-style="stamp"`),
  `site-nav` (a guarded `::details-content` fallback), `reach` (wa.me and
  mailto, a copy button that says it copied), `now-note` (says its own age,
  flags itself stale after 45 days), plus the **`studio-home` recipe**.
- **The overlays and actions wave**: `button`, `link`, `tabs`, `popover`,
  `tooltip`, `dialog`, `drawer`, `scroll-section`, and `action-menu` (the
  dropdown menu; it is `sg-action-menu` because `sg-menu` is the food menu
  below). Also the `kantar-interlude` transition and the `kantar-curtain`
  it shares with the Kantar scene.
- **Pieces for food and events**: `event-card`, `event-list` (honest about
  the clock: what is past, what is today), `tile-band` in azulejo and
  majolica tones, the `azulejo` palette, `menu` (a priced food menu),
  `wa-order` (an order that opens in WhatsApp), and the `food-order` recipe.
  Registry items now carry a `motif` field that says where a pattern comes
  from.
- **The open atelier's components**: `accordion`, `gallery` (asks consent
  before it shows people), `person-card` with the `member-directory` recipe
  (filter by field and track, state kept in the address), `site-footer`
  (three registers), and `data-table` (Indian digit grouping for money,
  sortable columns). Also the `community-square` template for a makers guild.

**Scenes**

- **Five scenes from the studio site**: `vahi` (paper to ledger), `ferry`
  (four stops, `step="1".."4"`, never auto-advances), `nod` (a helper that
  asks first before anything is sent), `dar` (door and key), `pahat` (a dawn
  desk, redrawn around its window as the subject).
- **The sketchbook port, all three volumes**: `tinto`, `prahar`, `maun`
  (Volume III); `saanj`, `toran`, `shet`, `ghat`, `chiro`, `abri`, `kairi`,
  `mosaico`, `vel`, `themb` (Volume II); `khazan`, `mankurad`, `vad`,
  `neel`, `chai` (Volume I). `shet`, a full paddy-field year, is the first
  scape: a scene on its own tier with a larger budget (decision 0020).
- **Four Goan scenes**: `posta` (the old post office in Fontainhas: a
  sorting desk, a postbox, a stamp coming down), `kantar` (the tiatr stage,
  with its song lyrics as real text beside the canvas), `mithagar` (the
  Ribandar salt pans, brine drying to crust), and `taverna` (rain on bottle
  glass in a village taverna).
- **`veranda`**, a drawn scape with real depth: laterite pillars, a balcao,
  a Mangalore-tile roof, mango and paddy beyond. Words on glass pass behind
  its pillars and stay readable.
- **The tiatr hero**: the docs home opens on `<sg-scene name="kantar" hero>`.
  Quiet and warm rise once and rest; playful sings one act per click.

**Words in the world**

- **The type tier**, built on the vendored Pretext, with Tinto's chalkboard
  and plaques and Vad's words in the sky round its canopy (decision 0019).
- **Glass words**: `<sg-scene movable>` lets a reader move the words with a
  grip button, the arrow keys or the pointer, and share the spot with
  `?words=x,y`. Frosted glass tokens `--sg-glass-*`. `keepClear(id, rect)`
  and a `calm` getter in core let any object ask the words to keep away
  (decision 0021).
- **The veranda in depth**: `stage3d` and `<sg-depth-photo>` turn a picture
  and its depth map into a scene you can walk through, with a 2D fallback
  that steps between stills. `three` is pinned at 0.186.1 and vendored
  tree-shaken (135.6 KB gzipped), and the registry gains `npmDependencies`.
  Words settle where they can be read, never over other words; notes anchor
  to places; there is a "monsoon" and a "dusk" lens.
- **Orientation**: `core-orient` (quaternions and slerp, a readability
  cone) and an opt-in `pane-turn` on `<sg-veranda-stage>`. The words may
  lean, but only as far as they stay readable (decision 0022, proposed). No
  shipped page opts in.
- **The engine names the physics**: `light.js` (the sun's arc by latitude,
  shadow length and direction), `motion.js` (`follow`, `spring`, `lagged`,
  `pendulum`) and `wave.js` (fronts over real distance). All three are pure,
  tested and opt-in by import. The engine's budget goes from 53,248 to
  81,920 bytes to hold them; a scene pays only for what it imports.

**Tools, the CLI and agents**

- **`@susegad/cli` over HTTP**: `susegad add` and `susegad diff` read the
  live site by default, check every file against its index hash, and refuse
  to overwrite a file you have edited. `susegad skill` installs the
  library's skill for an agent. `susegad check` runs the lighter gate in one
  command.
- **`@susegad/mcp`** (`susegad-mcp`): a stdio server with five tools over the
  CLI's own add and diff.
- **The site for agents and embedders**: `llms.txt`, the registry and
  `custom-elements.json` served from the site, a `/start` page, and link
  previews (Open Graph and Twitter card) on every page, each piece with its
  own poster.
- **The scene skill** and the **community sketchbook**, so a contributor or
  an agent can draw a scene the library will accept, and `CONTRIBUTING.md`.
- **The lighter gate**: risk tiers read from the diff
  (`tools/gate-tier.mjs`), an evidence pack for a reviewer
  (`tools/review-pack.mjs`), and checks that moved into tools: a copy lint, a
  motif lint, a canvas-text lint with a decided allow-list, rest checks
  (reduced-motion still, idle rest), and `tools/until-fail.mjs`, which keeps
  a flaky check's first failure.
- **`tools/strip.mjs` and `tools/onion.mjs`**: a strip of frames or an onion
  skin (`--json`, `--facts`, `--diff`) from a hand-stepped clock, so a motion
  claim can be looked at and not only asserted.
- **A cross-browser harness**: `--engine=` or `SG_ENGINE`, a per-engine CI
  matrix with Chromium the only hard gate, and `docs/BROWSERS.md` for the
  open differences.
- `tools/serve.mjs` answers byte-range requests, so media (the soundbook,
  narration clips) can seek.
- Stability labels (`experimental` | `beta` | `stable`) on every registry
  item, shown on the Components page and by `susegad list` / `susegad info`.

**The docs site**

- **A site map**: an index page for each kind of piece and a page for every
  scene and component, with posters shot at build time in every register and
  theme. The home page is short (2.7 screens at 1440 px) and the old anchors
  still land.
- **Security headers**: a content security policy that allows nothing from
  third parties, `nosniff`, a strict referrer policy, a permissions policy
  that closes camera, microphone, location, payment and USB, and long
  caching for fonts and posters. Scripts and styles keep `'unsafe-inline'`
  for now, because Cloudflare cuts `_headers` values at about 2 KB, too
  short for per-script hashes.
- Every page's header and footer link to the public repository.

### Changed

- Postcard's status display defaults to a plain level badge; the stamp and
  postmark illustration moved behind `status-style="stamp"`, because the
  default read as "a little too stamp heavy" (owner feedback, 2026-09-27).
- The warm register's `reach` component recolours its inland letter from a
  near-grey (chroma 0.016) to a pale blue, checked against the old paper as
  a failing control.
- The docs home groups scene plates by sketchbook volume. The Components
  gallery page is retired; each piece has its own page.
- **Motif ruling**: the owner approved the origin table. Seven origin
  corrections stand (among them the tiatr hero and the two scapes); `kolam`
  is tagged regional to Tamil Nadu, `abri` to the Deccan, `neel` to
  Rajasthan (Sanganer and Bagru), and `kairi` is everyday to India. The
  placeholder "the owner confirms" is gone from 33 scene glosses. The nine
  scenes that draw text on the canvas stay, each marked in the lint.
- Kantar's curtain is drawn once, in `packages/curtain/`, and both the scene
  and the interlude use it. Playful's warmer velvet is gone; its figure and
  spot remain.
- `sunAt` now returns a compass bearing (about 105 at dawn, 180 at noon, 255
  at dusk at 15 N), so its output goes straight into `shadowDir`.
- `mithagar` takes its sun, shadows and drying front from the engine's new
  modules instead of its own arithmetic.
- The MCP server imports `@susegad/cli` by name rather than by a relative
  path, so it also runs from an npm install.
- The home page's door mosaic takes its pictures' own proportions, so
  nothing is cropped.

### Fixed

- `pahat`'s 76-105 ms load-time long task (traced to the engine's `paper()`)
  is gone: it now paints in ~8 ms generator slices, 0 long tasks across
  three loads.
- Chat-thread's reaction announcement now fires once, verified against
  Chromium's own accessibility tree (Playwright's aria snapshot was
  over-reporting image children).
- Calm rects (the reading-layer boxes a scene quietens around) went stale
  when only `--sg-reading-place` changed. They are now measured again
  whenever the panel's box moves.
- `abri`: below half quality the colour veins drew under the words, so the
  paper moved where it should hold still (about 1.4% of pixels). The held
  zone now draws the same at every quality (0.00%), and the drift eases in
  over a 60-unit band.
- `susegad-mcp` on a default install threw on every tool call, because no
  `--registry` reached the loader as null. It now answers, and a test walks
  that path.
- `<sg-depth-photo>` read pixels back from the GPU on every frame
  (`data-drawn` is an empty string, so the check was always true).
- Veranda: words no longer land over other words, first letters stay visible
  while the camera walks, and the lens no longer splits words into chips.
- Posters and demos: veranda-stage's poster was blank, scene posters carried
  the element's own play button, the export demo was shot half drawn, and
  the gallery demo's photographs became drawings so its poster can be taken.
- The warm site-footer's pencil rule fits the words, not the paragraph's
  box. Person-card's long link no longer widens the disc column on a phone.
  `community-square` shares one column and its sections breathe.
- The engine's new modules were tested before release and the tests found
  eight defects, all fixed. For example, `spring` and `pendulum` diverged on
  a quarter-second frame, `front` never completed on an infinite reach, and
  `shadowLength`'s cap clamped every short caster to the same few pixels.

### Known issues

- `sg-scene` writes its frame styles as an inline `<style>`, which a strict
  content security policy (`style-src 'self'`) blocks. Fixed after this
  release.
- `sg-field` throws when it wraps a `<select>`. Fixed after this release.
- `sg-site-nav` is a size container, so inside a flex row its content-based
  width is 0 and a folded menu button can spill past the edge on a phone.
  Workaround today: give it an explicit width.
- `themb`'s auto renderer is unmeasured on a real GPU (headless Chromium
  frame times only).
- `abri`'s drift with words at low quality, and its comb stage near the
  words, have not been measured.
- `susegad add` does not yet write `three` into a consumer's `package.json`.
- Browser differences are listed in [`docs/BROWSERS.md`](docs/BROWSERS.md).

[Unreleased]: https://github.com/sarat-asymmetrica/susegad-ui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sarat-asymmetrica/susegad-ui/releases/tag/v0.1.0
