# Quote

`<sg-quote>` is a pull-quote or testimonial around a native `<figure>`.

## Markup

| Element | What it is |
|---|---|
| `<figure>` | required; the element enhances it |
| `<blockquote>` | the words, one or more `<p>`; add `cite="…"` if the source has a URL |
| `<figcaption>` | who said it |
| `.sg-quote-who` | the person's name |
| `.sg-quote-role` | their role and business |
| `a.sg-quote-source` | optional: where they said it (a voice note, a review, an article) |

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `seed` | any string, for the bracket's and mark's hand | the first 60 characters of the words |
| `register` | `quiet`, `warm`, `playful` | inherited |

## Registers

| | Look | Motion |
|---|---|---|
| quiet | display face beside a hairline; name in small capitals | none |
| warm | the hand face, a margin note with a pencil bracket | none |
| playful | large words under a hand-drawn quotation mark in the accent colour | the mark inks in once, the first time it is on screen |

Reduced motion: the mark is drawn, not inked in. Without JavaScript: the quiet look.

## Using a real quote

Quote exactly what was said, with the person's permission, and link the source when there is one. The library's demos use made-up people and words.

## Accessibility

- Nothing the component draws is read aloud; the check proves the read text is the same with and without the skins.
- Put a quote in a `<figure>` rather than a bare `<blockquote>` so the caption is tied to it.

### Conformance (WCAG 2.2 AA)

The table adds rows for the optional source link (2.4.4, 2.4.7, 2.5.8), which the component's traits in `tools/conformance.core.js` do not ask for.

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The pencil brackets and quotation marks are `aria-hidden` SVG and add no words: `packages/components/quote/quote.check.mjs`, "the ornament adds no words: what is read is the same with and without the skins" (with a control: "a quotation mark drawn as text shows up in the same probe"). |
| 1.3.1 Info and relationships | Meets | A native `<figure>` with a `<blockquote>` and a `<figcaption>`; the check reads the same six pieces of text with and without the skins, and axe finds no violations without JavaScript (`quote.check.mjs`, "axe without JavaScript: 0 violations"). |
| 1.4.1 Use of color | Meets | The words, the name and the role carry the meaning; the quotation mark and bracket are decoration. The source link keeps its underline (`packages/components/quote/quote.css` never sets `text-decoration: none` on it). |
| 1.4.3 Contrast (minimum) | Meets | Quote text and name are `--sg-text` and `--sg-text-soft`, the source link `--sg-accent-text`: `packages/tokens/tokens.test.js` ("AA: every text role on every surface is 4.5:1 or more") for every palette and theme; `quote.check.mjs` runs axe in light and dark, all three registers: 0 violations. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and nothing clipped (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | `quote.check.mjs`: "at 390 px: no sideways scroll". Manual test, 2026-10-07: demo at 320 CSS px, three registers, no sideways scroll (document width 320). |
| 1.4.11 Non-text contrast | Meets | The mark and brackets are decoration and add no meaning. The source link's focus ring is tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | The quote's only control is the author's native source link, reached by Tab: `tools/touch.check.mjs` Tabs onto it in each register and requires a focus style. A quote with no link puts nothing on Tab (it is a `<figure>` and a `<blockquote>`). |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07: `packages/components/quote/quote.js` and its skins bind no key handler, set no `tabindex` and call no `focus()`, so Tab and Shift+Tab pass through the native links. |
| 2.4.3 Focus order | Meets | Manual test, 2026-10-07 (throwaway Playwright script): the quote demo at 390 px in quiet, warm and playful, Tab pressed through every stop (3 stops in each register); each focused control was on screen and not covered (the element at its centre is the control itself) and every stop came after the previous one in document order. The same script on a page with a full-screen fixed layer added reported every stop covered, so it can fail. |
| 2.4.4 Link purpose (in context) | Meets with author's part | The source link is the author's own link text (`packages/components/quote/quote.check.mjs` finds it at 24 px or more), and sits in the figure's caption. Whether the text says where it goes is the author's. |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the source link in each register and requires a focus style; `packages/components/quote/quote.css` draws a 2 px `:focus-visible` outline in `--sg-focus`. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | `packages/components/quote/quote.css` has no `position: fixed` or `sticky`, so the component never covers a focused control itself. Manual test, 2026-10-07 (throwaway Playwright script): the quote demo at 390 px in three registers, every Tab stop was on screen and not covered (the element at its centre is the control itself); the same script with a full-screen fixed layer added reported every stop covered, so it can fail. |
| 2.5.3 Label in name | Meets | The source link is named by its own visible text because the component adds no `aria-label` to it (`packages/components/quote/quote.js` sets none). |
| 2.5.8 Target size (minimum) | Meets | `quote.check.mjs`: "source links at least 24 px tall" at 390 px. Manual test, 2026-10-07: 111.1 to 113.1 px wide and 25.8 px tall in all three registers. |
| 4.1.2 Name, role, value | Meets | Native elements only; the source link is a native `<a href>`. `quote.check.mjs`: axe with and without JavaScript, 0 violations. |

**The page author owns:**

- The quote and who said it, with their permission, in the language of the page, and `lang` on a quote in another language (3.1.2).
- The source link's text, so it says where it goes (2.4.4).
- Putting the quote in a `<figure>` so the caption is tied to it.
- The colours the page sets behind the quote, if it overrides the tokens.

- A sticky header or banner that could cover the source link when it takes focus (2.4.11).