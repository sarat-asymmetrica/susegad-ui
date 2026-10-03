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

Nothing has been tagged yet; `package.json` carries `0.1.0` as the version
this Unreleased section will become at the first tag (see
`docs/RELEASING.md`). This section covers the build record kept privately
since the studio site started dogfooding the library (2026-09-27) through
the sketchbook port (2026-09-28); it does not reach back to the repo's
2026-09-24 seeding or the waves before that (Carepa, the overlays/actions/
motion waves, the Goan stories loop's first story), which shipped before
this changelog existed. Every item below is still `experimental` unless the
registry says otherwise (`tokens` and `core` are `beta`; see the stability
labels on [the Components page](https://susegad.asymmetrica.ai/components)).

### Added

- **Seven components from the studio site**: `chat-thread` (redaction at
  build time, quoted replies, reactions), `voice-note` (plays only on its
  own press, transcript always shown), `quote`, `postcard` (a level badge by
  default; stamp and postmark are opt-in with `status-style="stamp"`),
  `site-nav` (a guarded `::details-content` fallback), `reach` (wa.me and
  mailto, a copy button that says it copied), `now-note` (says its own age,
  flags itself stale after 45 days), plus the **`studio-home` recipe**.
- **Five scenes from the studio site**: `vahi` (paper to ledger), `ferry`
  (four stops, `step="1".."4"`, never auto-advances), `nod` (a helper that
  asks first before anything is sent), `dar` (door and key), `pahat` (a dawn
  desk, redrawn around its window as the subject).
- **The sketchbook port, all three volumes**: `tinto`, `prahar`, `maun`
  (Volume III); `saanj`, `toran`, `ghat`, `chiro`, `abri`, `kairi`,
  `mosaico`, `vel`, `themb` (Volume II); `khazan`, `mankurad`, `vad`,
  `neel`, `chai` (Volume I). `shet` is drawn but not yet in the registry
  (see Known issues).
- `tools/serve.mjs` now answers byte-range requests, so media (the
  soundbook, narration clips) can seek.
- Stability labels (`experimental` | `beta` | `stable`) on every registry
  item, shown on the Components page and by `susegad list` / `susegad info`.

### Changed

- Postcard's status display defaults to a plain level badge; the stamp and
  postmark illustration moved behind `status-style="stamp"`, because the
  default read as "a little too stamp heavy" (owner feedback, 2026-09-27).
- The warm register's `reach` component recolours its inland letter from a
  near-grey (chroma 0.016) to a pale blue, checked against the old paper as
  a failing control.
- The docs home groups scene plates by sketchbook volume.

### Fixed

- `pahat`'s 76-105 ms load-time long task (traced to the engine's `paper()`)
  is gone: it now paints in ~8 ms generator slices, 0 long tasks across
  three loads.
- Chat-thread's reaction announcement now fires once, verified against
  Chromium's own accessibility tree (Playwright's aria snapshot was
  over-reporting image children).

### Known issues

- `shet` (a full paddy-field year, 88 KB drawn) is not in the registry: it
  is over decision 0003's 64 KB scene ceiling. Decision 0020 (scapes) gives
  it a path in; it has not been rebuilt onto that tier yet.
- `sg-site-nav` is a size container, so inside a flex row its content-based
  width is 0 and a folded menu button can spill past the edge on a phone.
  Workaround today: give it an explicit width.
- Calm rects (the reading-layer boxes a scene quietens around) go stale
  when only `--sg-reading-place` changes; the demos work around it, the
  underlying core bug is still open.
- `themb`'s auto renderer is unmeasured on a real GPU (headless Chromium
  frame times only).

[Unreleased]: https://github.com/sarat-asymmetrica/susegad-ui/commits/main
