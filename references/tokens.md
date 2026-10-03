# Tokens, fonts, colour and type

*Reference file for [`SKILL.md`](../SKILL.md), split out in rung 7 of docs/requests/2026-09-28-open-the-door.md so the top file stays short. Content moved verbatim; nothing here is new.*

## 3. Load tokens, fonts and core

```html
<link rel="stylesheet" href="src/lib/susegad/tokens/fonts.css">
<link rel="stylesheet" href="src/lib/susegad/tokens/tokens.css">
<script type="module">
  import './src/lib/susegad/core/index.js';        // defines <sg-scene>
  import './src/lib/susegad/scenes/paus/index.js'; // registers the paus scene
</script>
```

- Link `fonts.css` before `tokens.css`. It declares the self-hosted faces, split by script with `unicode-range`, so a page downloads only the scripts it shows. No request leaves the site.
- Import `core/index.js`, then each scene you use. Every scene module imports core itself, so one scene import also works, but naming core first keeps the order plain.
- `<sg-scene>` loads nothing by itself. It waits until its scene module has registered, then draws.

## 4. Use tokens, never raw colours

Components and pages read roles, never pigments and never hex values.

| Role | Use it for |
|---|---|
| `--sg-surface`, `--sg-surface-raised`, `--sg-surface-sunk` | the page, cards, wells and inputs |
| `--sg-text`, `--sg-text-soft`, `--sg-text-faint` | text; all three are 4.5:1 or better on every surface |
| `--sg-accent`, `--sg-on-accent` | the primary action as a fill, and the text on it |
| `--sg-accent-text` | the accent as text: links, the active tab |
| `--sg-success`, `--sg-warning`, `--sg-danger`, `--sg-info` | status text and icons |
| `--sg-focus`, `--sg-focus-width`, `--sg-focus-offset` | focus rings |
| `--sg-rule`, `--sg-rule-strong` | hairlines; use `rule-strong` for anything a person must see to operate, such as an input border |
| `--sg-scrim` | the paper wash behind text on a scene |
| `--sg-selection` | `::selection` |
| `--sg-lift` | the shadow under anything raised: a card, a popup list, the signature pad. Use it rather than a shadow of your own. |
| `--sg-shadow` | the lift's colour: ink by day and near black at night, so nothing raised glows in the dark theme. If you truly need another shadow, make it from this, never from the text colour. |
| `--sg-pencil` | drawing only: pencil strokes and construction lines that need no text contrast; never text |

Pigments (`--sg-laterite`, `--sg-kokum`, `--sg-pool`, `--sg-paddy`, `--sg-indigo` and the rest) are for drawing and decoration only.

Canvas code reads hex, never the CSS strings: a 2D context cannot parse `light-dark()` or `var()`, and older ones cannot parse OKLCH. Take colours from the JS mirror, `roleHex(palette, theme)` in `tokens/tokens.js` (`roleHex('casa', 'light').pencil` is `'#93897A'`), or resolve them on a live element with `readColor(el, 'pencil').hex`, which follows the page's palette and theme. Redraw when the theme changes.

Space, shape and motion: `--sg-space-1` to `--sg-space-8`, `--sg-radius-0` to `--sg-radius-4` and `--sg-radius-pill`, `--sg-step--1` to `--sg-step-5` (fluid type sizes), `--sg-measure` (62ch) and `--sg-measure-narrow`. Durations are `--sg-dur-instant | quick | calm | slow | ambient | fade` and easings `--sg-ease-out | in-out | spring | ink`. The register sets the durations, and reduced motion collapses them, so animate with these and you get both for free.

### Type, including Devanagari and Kannada

The stacks are `--sg-font-display` (Castoro, Tiro Devanagari Marathi, Tiro Kannada), `--sg-font-body` (Mukta, Noto Sans Kannada), `--sg-font-hand` (Kalam) and `--sg-font-mono`. Each covers Latin, Devanagari and Kannada, with metric-matched and system fallbacks, so the page still reads if the fonts fail.

```css
body { font-family: var(--sg-font-body); color: var(--sg-text); background: var(--sg-surface); }
p, li, h1, h2, h3 { line-height: var(--sg-leading-body); }
h1, h2 { font-family: var(--sg-font-display); line-height: var(--sg-leading-tight); }
```

```html
<p lang="mr">पाऊस आला.</p>
<p lang="kn">ಮಳೆ ಬಂತು.</p>
<p lang="kok-Latn">Paus ailo.</p>
```

- Mark every run of Indian-language text with `lang`. `:lang(hi|mr|kok|kn|sa|ne)` raises the `--sg-leading-*` values for the matras above and below the line. Konkani in Romi (`kok-Latn`) keeps Latin leading.
- Declare `line-height: var(--sg-leading-body)` on the text elements themselves, not only on `body`. A custom property only changes the line height where the `var()` is used.
- Kannada has no hand face yet; `--sg-font-hand` falls back to Noto Sans Kannada for it.
- Indian-language copy is reviewed by a native speaker before it ships. Machine translation is a first draft.
