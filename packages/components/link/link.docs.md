# Link

`<sg-link>` wraps one native `<a href>`. It takes the keyboard and navigates with or without JavaScript. The register draws the underline; the native anchor carries every behaviour.

## Use

```html
<link rel="stylesheet" href="susegad/components/link/link.css">
<script type="module" src="susegad/components/link/link.js"></script>

<sg-link><a href="/rooms">See the rooms</a></sg-link>
```

## Attributes and properties

| | Values | Default |
|---|---|---|
| `seed` | any string, for the drawn line's wobble | the link's own text |
| `register` | `quiet`, `warm`, `playful` | inherited |

## Registers

| | Look | Motion |
|---|---|---|
| quiet (and no JS) | a plain hairline underline, the browser's own | none beyond the native hover colour change |
| warm | an ink underline drawn a little off true, there at rest | it inks heavier on hover or focus (the stroke goes from 1.4 to 2.4 px) and eases back on leave |
| playful | the underline as a kolam line: one continuous wave with a small knotted loop | always drawn; no extra motion of its own |

Reduced motion: warm's thickening collapses to instant; nothing else moves. Forced colours: the browser's own underline and link colour, drawings hidden.

## Accessibility

- The native `<a>` is the whole control: `href`, `:visited`, keyboard activation.
- A link is never told apart by colour alone: every register carries an underline at rest, native in quiet, drawn in warm (a pencil line under the text from the first paint) and playful (the wave).
- Link text and the drawn ink hold 4.5:1 and 3:1 in every palette and theme (tested).

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The link is text. The drawn underline is `aria-hidden="true"` and carries no meaning: `packages/components/link/link.check.mjs`, "the drawing is hidden from assistive tech" in warm and playful. |
| 1.3.1 Info and relationships | Meets | A native `<a href>` inside the element. `link.check.mjs` reads the accessibility tree with JavaScript off and on in each register and finds `link "See the rooms"`. |
| 1.4.1 Use of color | Meets | A link in a sentence has an underline at rest in all three registers: native in quiet, the drawn pencil line in warm and the wave in playful, none of them waiting for hover or focus. `packages/components/link/link.check.mjs`: "a link in a sentence has an underline at rest (rest versus underline removed)" screenshots the strip under the link with no hover and no focus, removes the underline and counts the columns that changed. It read 0 of 107 in warm before the fix (the line was undrawn until hover), and 107 of 107 in all three after. The text against the body text is 1.4:1 to 2.8:1 across the palettes (computed from `packages/tokens/tokens.js`, 2026-10-07), so the underline, not the colour, is what tells a link from its words. |
| 1.4.3 Contrast (minimum) | Meets | `packages/components/link/link.test.js`, "contrast: <palette> <theme>" asserts the link colour is 4.5:1 or more on `--sg-surface` and `--sg-surface-raised` in every palette, light and dark. Axe: `tools/axe.mjs --url /packages/components/link/demo.html`, 0 violations across 6 runs (3 registers, light and dark), desktop, 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and nothing clipped (throwaway Playwright script). The link is inline text, in `em` and `rem` units. |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, no sideways scroll (document width 320). No check in the repository asserts it for the link itself. |
| 1.4.11 Non-text contrast | Meets | `packages/components/link/link.test.js` asserts the playful drawn ink (`--sg-accent`) is 3:1 or more on both surfaces in every palette, light and dark. The focus ring is tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipping or overlap, no sideways scroll (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | A native anchor: Tab focuses it and Enter follows it, with JavaScript off or on. `tools/touch.check.mjs` Tabs onto the link in each register. |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07: `packages/components/link/link.js` and its skins bind no `keydown` and set no `tabindex`; focus leaves with Tab as for any link. |
| 2.4.3 Focus order | Meets | The native anchor keeps its place in the page's order; the drawn line is `aria-hidden` and takes no focus (`packages/components/link/link.js` sets no `tabindex`). |
| 2.4.4 Link purpose (in context) | Meets with author's part | The component keeps the author's own link text as the name (`link.check.mjs`, `link "See the rooms"`). Whether that text, or the sentence around it, says where the link goes is the author's. |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the link in each register and requires a focus style; `packages/components/link/link.css` draws a 2 px outline on `:focus-visible`, and the ring colour is tested at 3:1 in `packages/tokens/tokens.test.js`. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test, 2026-10-07: `packages/components/link/link.css` uses no `position: fixed` or `sticky` on the link (document scan of the demo in all three registers found none). A sticky header or banner the page adds can cover a link that is scrolled to. |
| 2.5.3 Label in name | Meets | The accessible name is the visible text: `link.check.mjs` reads `link "See the rooms"` for that link. |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07, 390 px touch: every link in the demo is 27.0 px tall and 60.4 px or more wide in all three registers. A link inside a sentence is also exempt as an inline target. No check in the repository asserts target size for the link yet. |
| 4.1.2 Name, role, value | Meets | A native `<a href>`: role and name are the browser's. `link.check.mjs`: still announced as a link by its text in each register, with JavaScript off. |

**The page author owns:**

- The link text: it says where the link goes, and makes sense in its sentence (2.4.4).
- `lang` on a link in another language (3.1.2); the demo does it for Marathi, Kannada and Konkani.
- Sticky headers and banners that could cover a link when it takes focus (2.4.11).
- The colours the page sets behind the link, if it overrides the tokens.

## Budget

Behaviour 1.6 KB (`link.js` + `link.core.js`); skins quiet 0.1 KB, warm 1.1 KB, playful 0.9 KB.
