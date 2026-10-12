# Button

`<sg-button>` wraps one native `<button>` or `<a href>`. It takes the keyboard, submits a form, or follows a link with or without JavaScript. The register lays a drawing over it; the native element carries every behaviour.

## Use

```html
<link rel="stylesheet" href="susegad/components/button/button.css">
<script type="module" src="susegad/components/button/button.js"></script>

<sg-button><button type="submit" data-tone="accent">Send the request</button></sg-button>
<sg-button><a href="/rooms">See the rooms</a></sg-button>
```

`data-tone="accent"` on the native element gives the filled, primary look. Leave it off for the plain, secondary look. Both skin the same way.

## Attributes and properties

| | Values | Default |
|---|---|---|
| `seed` | any string, for the warm outline's wobble and the playful ink | the button's own text |
| `register` | `quiet`, `warm`, `playful` | inherited |

## Registers

| | Look | Motion |
|---|---|---|
| quiet (and no JS) | a hairline outline, crisp | none beyond the native hover and focus states |
| warm | an ink outline drawn a little off true, behind the label | the ink "boils" (a slow, small wobble) only while hovered or focused |
| playful | a stamped chip, bold border, bold weight | presses in on `:active`; on release, an ink ring blooms from the point of contact and fades |

Reduced motion: the boil never animates and the ink ring never plays; the press transform (`:active`) still gives feedback, because it marks a real state (held down), not decoration. Forced colours: the browser's own button and link look, drawings hidden.

## Accessibility

- The native element is the whole control. `disabled` and `aria-disabled="true"` both dim it and stop the press feedback.
- Focus uses `--sg-focus`, visible against every register.
- Outline, accent border and accent-filled text hold 3:1 (border) or 4.5:1 (text on the accent fill) in every palette and theme (tested).

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The warm outline and playful ink are `aria-hidden` drawings behind the label, hidden entirely in forced colours: `packages/components/button/button.check.mjs`: "<register>, forced colours: the browser's own look, ornament hidden". The label is the name. |
| 1.3.1 Info and relationships | Meets | The native `<button>` or `<a href>` is the whole control. `button.check.mjs`: "no JS: the submit is announced as a button, by its own text" and "no JS: the link is announced as a link". |
| 1.4.1 Use of color | Meets | The label says what the button does. A disabled button is dimmed and its border turns dashed (`packages/components/button/button.css`, `button:disabled`), and the accent button is told from the others by its fill and its words, never by colour alone. |
| 1.4.3 Contrast (minimum) | Meets | `packages/components/button/button.test.js`: "contrast: <palette> <theme>: the hairline outline and the accent chip read" asserts 4.5:1 for text on the accent fill; plain labels are `--sg-text`, tested in `packages/tokens/tokens.test.js`. axe `color-contrast` is clean: `tools/axe.mjs --url /packages/components/button/demo.html`: 0 violation(s) across 6 run(s) (three registers, light and dark, desktop), 2026-10-07. A disabled button is exempt (it is inactive) and is dimmed to 55 percent opacity on purpose. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-06: the demo with the root font size at 200 percent in three registers (1280 px wide), no sideways scroll and no clipped label (throwaway Playwright script). Size is in `em` in `packages/components/button/button.css`. |
| 1.4.10 Reflow | Meets | Manual test at 320 CSS px, three registers, 2026-10-06: no sideways scroll and no clipped label (throwaway Playwright script). No check in the repository asserts it yet. |
| 1.4.11 Non-text contrast | Meets | `packages/components/button/button.test.js`: the hairline outline (`--sg-rule-strong`) and the accent border are 3:1 or more on `--sg-surface` and `--sg-surface-raised` in every palette, light and dark. The focus ring is tested 3:1 or more in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-06: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected on the demo in three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | The native element takes Enter and Space, a link takes Enter. `packages/components/button/button.check.mjs`: "no JS: the form really submitted", and `tools/touch.check.mjs` Tabs onto each button in every register. |
| 2.1.2 No keyboard trap | Meets | Manual test: `packages/components/button/button.js` binds no key handler and sets no `tabindex`; the native control takes Tab and Shift+Tab as any button does. |
| 2.4.3 Focus order | Meets | Manual test: the native element is the only tab stop and keeps its place in the page's order; the drawing is `aria-hidden` and takes no focus (`packages/components/button/button.js` sets no `tabindex`). |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the control in each register and requires a focus style; the rule is `button:focus-visible` in `packages/components/button/button.css`, and the test "the CSS keeps the native control whole" in `packages/components/button/button.test.js` asserts it. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/button/button.css` has no `position: fixed` or `sticky`. A sticky header or banner the page adds can cover a button that is scrolled to. |
| 2.5.3 Label in name | Meets | The accessible name is the visible label, because the component adds no `aria-label` (`button.check.mjs`: "still announced as a button" reads `button "Book now"` in each register). |
| 2.5.8 Target size (minimum) | Meets | `min-height: 2.75em` (44 px at 16 px type) in `packages/components/button/button.css`. Manual test, 2026-10-06: no focusable control under 24 by 24 CSS px at 1280 px or at 390 px with touch, in all three registers on the demo, which holds short and long labels, a link and a disabled button (throwaway Playwright script). |
| 4.1.2 Name, role, value | Meets | `button.check.mjs`: "still announced as a button" in each register and "no JS: the link is announced as a link"; `disabled` is the native attribute. axe: 0 violation(s), `tools/axe.mjs --url /packages/components/button/demo.html`, 2026-10-07. |

**The page author owns:**

- The label text, in the language of the page, saying what the button does, and `lang` on a label in another language (3.1.2).
- A link used as a button (`<a>`) is a link: put `role` and key handling on it only if the page needs a button.
- Sticky headers and banners that could cover a button when it takes focus (2.4.11).
- The colours the page sets behind the button, if it overrides the tokens.

## Budget

Behaviour 1.6 KB (`button.js` + `button.core.js`); skins quiet 0.1 KB, warm 1.1 KB, playful 0.8 KB.
