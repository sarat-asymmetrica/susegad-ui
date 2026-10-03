# Tokens

Colour, type, space, motion, sound and the register for Susegad UI, as CSS custom properties with a JS mirror.

```html
<link rel="stylesheet" href="susegad/tokens/fonts.css">
<link rel="stylesheet" href="susegad/tokens/tokens.css">
<html data-palette="casa" data-theme="dark" data-register="quiet">
```

- `data-palette="susegad|casa|azulejo"`: the colour palette. Default `susegad`.
- `data-theme="light|dark"`: leave it off to follow the reader's system setting.
- `data-register="quiet|warm|playful"` (or `register="..."`): default `warm`.

All three work on `:root` or on any element. Themes use `light-dark()`, so a theme is just `color-scheme`. Browsers without `light-dark()` get a hex fallback on `:root`.

## What to read

Components read the roles, never the pigments.

| Role | Use |
|---|---|
| `--sg-surface`, `-surface-raised`, `-surface-sunk` | grounds: the page, cards, wells and inputs |
| `--sg-text`, `-text-soft`, `-text-faint` | text; all three are 4.5:1 or more on every surface |
| `--sg-accent`, `--sg-on-accent` | the primary act as a fill, and the text on it |
| `--sg-accent-text` | the accent as text: links, the active tab |
| `--sg-success`, `-warning`, `-danger`, `-info` | status text and icons, 4.5:1 or more |
| `--sg-focus` | focus rings, 3:1 or more on every surface; draw them at `--sg-focus-offset` |
| `--sg-rule`, `--sg-rule-strong` | hairlines, and control borders (3:1 or more) |
| `--sg-scrim` | a translucent paper wash behind text on a scene |
| `--sg-selection` | `::selection` background |
| `--sg-lift` | the soft shadow under a raised card. Its colour, `--sg-shadow`, is the ink by day and near-black at night, so a lifted card never glows in the dark theme. Use it rather than a shadow of your own. |
| `--sg-pencil` | drawing only: pencil strokes and construction lines that need no text contrast. Fainter than every text role, never text. In Casa light it is the redesign's own `#93897A`. |

Pigments (`--sg-laterite`, `--sg-kokum`, `--sg-pool` and so on) are for drawing and decoration.

Canvas code cannot read these as written: a 2D context does not parse `light-dark()` or `var()`, and older ones do not parse OKLCH. Take hex from the JS mirror, `roleHex(palette, theme)` in `tokens.js` (`roleHex('casa', 'light').pencil` is `'#93897A'`), or resolve a live element's colour with `readColor(el, 'pencil').hex`, which follows the page's palette and theme.

A nested `data-theme` changes `color-scheme`. An element inside it must read the tokens itself (`color: var(--sg-text)`). A colour inherited from outside was already resolved for the outer theme.

Type: `--sg-font-display`, `-body`, `-hand` and `-mono` cover Latin, Devanagari and Kannada. Each stack names the self-hosted faces first (Castoro, Tiro Devanagari Marathi, Tiro Kannada, Mukta, Noto Sans Kannada, Kalam). Next comes a metric-matched fallback (`'Castoro Fallback'` is Georgia stretched to Castoro's metrics), then system faces, Latin before Indic. `fonts.css` declares the faces, split by script with `unicode-range`, so a page downloads only what it shows; `fonts/README.md` has the licences and sources. No request leaves the site. Without the fonts the page still reads: Georgia and Arial for Latin, Nirmala UI or Kohinoor for the Indic scripts. `:lang(mr|kok|kn|hi|...)` gives Indic text more line height. Also: `--sg-step--1` to `--sg-step-5` (fluid), `--sg-leading-*`, `--sg-measure`, `--sg-space-1` to `--sg-space-8`, `--sg-radius-*`, `--sg-hairline` (0.5px on dense screens).

Motion: `--sg-dur-instant | quick | calm | slow | ambient | fade` and `--sg-ease-out | in-out | spring | ink`. The register sets the durations:

| | calm | slow | ambient | spring overshoot | ornament | wobble | sound |
|---|---|---|---|---|---|---|---|
| quiet | 160ms | 190ms | none | none (ease-out) | 0 | 0 | confirmations |
| warm | 280ms | 560ms | 9s | 3.8% | 1 | 0.6 | soft |
| playful | 340ms | 700ms | 7s | 17.9% | 2 | 1.4 | full |

Under `prefers-reduced-motion: reduce`, every movement duration becomes 0.01ms, ambient stops and `--sg-motion-scale` is 0. Only `--sg-dur-fade` (150ms) remains, for opacity. Sound tokens (`--sg-sound-tick | confirm | complete | error`) name synth patches; the sound layer plays them, and it is off by default.

## Teental: the sixteen-beat stagger

A generic ease staggers a list by a flat multiple of the index: item by
item, always the same wait. Teental staggers it by a cycle instead, so a
list has phrasing rather than a metronome.

*After* Khaprumama Parvatkar, and teental, the sixteen-beat rhythmic cycle
of Hindustani music he played it in on the tabla and the ghumot.

*What we took*: timing as a cycle, not a straight line. A heavy first beat
(sam), a three-beat hush two-thirds through (khali, where the bass drum
falls silent), and everything else landing on the beats between. Nothing
here enters on a khali beat, the way nothing in the cycle is struck there.

*What we left*: his playing. `talaDelay()` counts out a rhythm; it does not
attempt his hands, and no sound ships with it.

`tala`, `talaBeats()` and `talaDelay()` live in `tokens.js` (see the comment
above them there for how a list should use it), with `--sg-tala-beat` as
the CSS duration of one beat for a pure-CSS stagger. Used in Drawer, Menu
and the scroll sections. Ported from the sketchbook's Teental plate, per
`docs/requests/2026-09-25-volume-iii-harvest.md`.

**Owner to confirm:** whether Khaprumama Parvatkar has died. His name is
used here as the library's other named patrons are (HOMAGE.md's rule 2),
but nobody on this wave has verified it, and rule 4 only allows a living
artist's name after they've agreed to it.

## Utilities

`tokens.css` also carries two classes that every component and recipe may rely on:

```html
<span class="sg-vh">3 of 8 files uploaded</span>
<a class="sg-vh sg-vh-focusable" href="#main">Skip to the booking form</a>
```

- `.sg-vh` hides text from sight but not from screen readers. It clips the text to nothing with `clip-path: inset(50%)`, at 1px, absolutely positioned, with no wrapping so it is read as one phrase. Never use `display: none` or `visibility: hidden` for this; both remove the text from assistive tech too.
- `.sg-vh-focusable` brings it back while it has keyboard focus, on the raised surface with the focus ring. It is for skip links and similar.

They are defined in `tokens.js` (`utilities`) and generated like everything else; the tests check both are present.

## The palettes

**Susegad** is the sketchbook: monsoon-indigo ink on handmade cream, with the pigments the plates were drawn in. Laterite (Chiro) is the accent, kokum (Vel) is danger, haldi is warning, paddy (Shet) is success and the monsoon sea (Ghat) is info. At night the paper becomes the monsoon sky.

**Casa** is a Goan house palette, ported exactly: every light value is the original hex (the tests check this). Four changes were needed to pass AA on every surface:

- `ink-faint` was `#93897A`, 3.03:1, labels only. It is deepened to `#6D6456` (4.59:1 on paper-deep), and the original is kept as the pigment `--sg-casa-faint`.
- `info` is pool deepened a touch to `#166E82`. The original `#1F7488` is 4.23:1 on paper-deep, which is fine for focus rings but not for text.
- `danger` is laterite. The house kept laterite for decoration, but at 4.78:1 on the deepest ground it reads as text.
- The selection wash and the scrim are new.

Dark is the house's own night chapter: `#14161C` with `#E8E2D6` ink.

**Azulejo** is the painted tile of Goa's Portuguese-era houses and churches, with its majolica cousin: a cream glaze, cobalt ink, and lemon and leaf green. It was made for the `tile-band` component and is a palette like the others: every text role passes AA on all three surfaces in both themes. Cobalt is the primary act and the focus ring by day; at night the ground is deep cobalt, the ink is cream, the accent is cobalt lifted to `#8FB2F2` and the focus ring is lemon. The tile pigments (`--sg-cobalt`, `--sg-cobalt-bright`, `--sg-lemon`, `--sg-leaf`, `--sg-glaze`, `--sg-wash`) are for drawing: lemon and leaf are never text on cream. Tiles keep their own colours in both themes, as a real tile would, so `tile-band` reads the pigments and not the page's grounds. Two choices to know: `warning` is lemon at night but a darkened mustard (`#7A5500`) by day, because lemon cannot be read on cream; and `danger` is a plain terracotta red, a colour azulejo itself does not have.

### Lowest contrast of each text role, on its worst surface

| | text | soft | faint | accent | success | warning | danger | info |
|---|---|---|---|---|---|---|---|---|
| Susegad light | 11.36 | 5.96 | 4.60 | 4.58 | 4.59 | 4.60 | 7.81 | 4.59 |
| Susegad dark | 12.71 | 7.99 | 4.74 | 4.60 | 4.62 | 8.19 | 4.61 | 5.12 |
| Casa light | 11.98 | 4.93 | 4.59 | 4.64 | 5.82 | 5.14 | 4.78 | 4.62 |
| Casa dark | 12.61 | 7.55 | 4.72 | 5.61 | 4.62 | 4.59 | 4.62 | 7.31 |
| Azulejo light | 11.37 | 6.59 | 4.77 | 6.74 | 5.17 | 5.39 | 6.04 | 5.14 |
| Azulejo dark | 12.33 | 8.87 | 5.98 | 6.70 | 7.08 | 9.03 | 6.68 | 6.70 |

These numbers use the 8-bit colour the browser paints. The tests also check on-accent against the accent fill, text and soft text on the selection and on the scrim over pure black and pure white, and focus and control borders at 3:1.

## Palette from photographs

```sh
node packages/tokens/tools/palette-from-photo.mjs a.webp b.jpg --name client --out client.css [--compare casa]
```

This writes a `[data-palette="client"]` block in the same shape as the built-in palettes, plus a JSON report of the swatches, pigments and every contrast ratio. Chromium (from Playwright) decodes the images. The colour work in `palette.js` is pure and runs in Node:

1. Sample every photo on an even grid and convert to OKLab.
2. Cut the samples into 16 colours with median cut, then refine with Lloyd passes so each colour's share is real.
3. Cut the chromatic pixels on their own, and sweep 15° hue bins, so something small and distinct (a red stair) is not lost among the walls.
4. Take the paper's hue from the most common light surface and the ink's hue from the shadows. Lightness comes from the reading contract.
5. Fit every text colour to 4.5:1 on all three grounds, starting light so it keeps as much colour as AA allows. Do the same for dark.

### Run on ten A-grade photographs of a Goan house

`palettes/casa-photo.css` and `.json` come from the same ten frames the hand palette was sampled from (facade, gate, nameplate, doors, balcao, wing, carport, stair, pool, detail). The run took 165,280 samples.

- The largest colours were bone `#BCAE8B` (9.1%), weathered teak `#4A3F32` (8.5%), `#73654C` (7.6%) and eave shadow `#1D160E` (7.3%).
- The pool came out at 4.8% of pixels; the hand notes measured 4.9%.
- The pigments found were ochre `#C78330`, pool blue `#56CBE3`, garden olive `#8A943A` and the stair's terracotta `#97433E` (0.3% of pixels, found by the hue sweep).
- The lowest text contrast is 4.60:1.

| Role | By hand | From photos | ΔE (OKLab × 100) |
|---|---|---|---|
| paper | `#F4F0E6` | `#F3EEE3` | 0.6 |
| paper-raised | `#FBF9F4` | `#FAF7F1` | 0.6 |
| paper-deep | `#EAE4D6` | `#E8E2D3` | 0.6 |
| rule | `#DED8C8` | `#DDD6C4` | 0.7 |
| ink | `#2E2419` | `#2A2416` | 1.0 |
| ink-soft | `#6A5F4E` | `#5A5241` | 5.0 |
| ink-faint (AA) | `#6D6456` | `#6A6354` | 0.6 |
| teak (accent) | `#7E5F32` | `#905700` | 4.1 |
| tile (warning) | `#8F4C20` | `#905700` | 3.7 |
| pool (info, AA) | `#166E82` | `#006E7F` | 0.9 |
| moss (success) | `#4C5A42` | `#616900` | 8.8 |
| laterite (danger) | `#A4452C` | `#9F4A45` | 2.9 |

Around 1 is a just-noticeable difference. The grounds, ink, faint ink and pool are the same palette in practice. The differences are choices a designer made:

- **ink-soft:** the tool asks for 6:1 so it stays clearly apart from ink-faint. The hand value is 5.49:1.
- **teak and tile:** the photos have one warm brown family, so the tool gives accent and warning the same hue. The designer split it into teak and tile by meaning.
- **moss:** the tool takes the garden's green as it is. The designer greyed it down to a quiet "verified".

The tool gets you a sound, accessible start in one command. Meaning is still the designer's call. `--ground-hue` and hand edits to the output are how you make it.

## Files

| File | What |
|---|---|
| `tokens.css` | every token; generated, do not edit by hand |
| `fonts.css`, `fonts/` | self-hosted WOFF2 (OFL), 15 files, 632 KB in all; generated by `tools/build-fonts.py` |
| `tokens.js` | the source: palettes, type, space, motion, sound, registers, plus `readToken` and `readColor` for the browser |
| `color.js` | OKLab and OKLCH, gamut mapping, WCAG contrast, `fitContrast` |
| `palette.js` | palette from pixels (pure) |
| `tools/build-css.mjs` | writes `tokens.css` from `tokens.js` (`--check` to verify) |
| `tools/build-fonts.py` | downloads the fonts from google/fonts at a pinned commit, splits them by script, writes `fonts/` and `fonts.css` (needs `pip install fonttools brotli`) |
| `tools/palette-from-photo.mjs` | the CLI above |
| `tools/preview-shots.mjs` | screenshots of `preview.html` into `.shots/tokens/`, with console errors |
| `preview.html` | every palette × theme × register with measured ratios, in Latin, Devanagari and Kannada |

After changing `tokens.js`, run `node packages/tokens/tools/build-css.mjs`. Then run the tests with `node --test packages/tokens/tokens.test.js` (or `npm test`).

## Known limits

- The hex fallback covers `:root` only. A nested palette or theme needs `light-dark()` (Chrome 123, Firefox 120, Safari 17.5).
- Kannada has no hand face yet, so `--sg-font-hand` falls back to Noto Sans Kannada for it.
- `rule` in the light themes is a hairline at about 1.3:1. Anything a user must see to operate, such as input borders, uses `rule-strong`.
