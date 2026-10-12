# Site footer

`<sg-site-footer>` is the closing block every site needs. It enhances a native `<footer>`.

## Markup

| Element | What it is |
|---|---|
| `footer` | the native footer itself; the element adds `aria-label="Site footer"` if you gave the footer no label |
| `p.sg-site-footer-sign` | the sign-off line, one sentence in the site's own voice |
| `nav.sg-site-footer-links` with a `<ul>` | the links a reader may still want (contact, privacy, licences). Optional. Give the nav its own `aria-label`, since "Footer" alone says nothing a second footer nav could share |
| `p.sg-site-footer-small` | the small print: copyright, ownership, a line about the place |

Everything inside is your copy. The element writes only one thing: the year of the small print.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `now` | an ISO date to count from, for demos, tests and print; it stops the clock | the real clock |
| `seed` | the drawing's seed (the pencil rule, the stamped angles) | the sign-off line |
| `register` | `quiet`, `warm`, `playful` | inherited |

Event: `sg-site-footer-year` `{ year }`, when the small print's year moved on.

## The year moves forward, once

The small print's copyright year is compared with the clock's year on load:

| The markup says | The clock says | The footer shows |
|---|---|---|
| 2024 | 2026 | 2026, and the page hears `sg-site-footer-year` |
| 2026 | 2026 | 2026, untouched |
| 2027 | 2026 | 2027. A year written ahead keeps; the footer never rolls back |
| no year anywhere | any | nothing. The element never invents a year |

Put the year in a `<time datetime="2026">2026</time>` and the element keeps the attribute and the text in step. Without a `<time>`, it rewrites the first year it finds in the line's own text. Without JavaScript nothing moves: what you wrote is what people read, so write the year you mean.

## Registers

| | Look |
|---|---|
| quiet | a hairline rule, the sign-off in the display face, links in a row, the small print in soft text |
| warm | the top rule becomes a pencil line, the sign-off moves to the hand, and a drawn pencil rule sits under it, fitted to the width of the words (the widest line), not the block they sit in, each visit the same for a seed |
| playful | a bold rule, the sign-off large in the hand, and the links set down like stamped chips, each at its own small seeded angle, with a short hop when pointed at |

Reduced motion keeps every register still: the hop is the only movement, and it is off.

## Accessibility

- A native `<footer>` (contentinfo) with a nav that carries its own label.
- Links are plain links: they take Tab and show a 2 px focus ring; a chip is at least 44 px tall, so the playful stamp keeps its target size.
- The pencil rule and the stamped angles are `aria-hidden` drawing; nothing is said only by the drawing.
- Without JavaScript the written markup reads in full, in the quiet look.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The footer holds no images of its own. The warm pencil rule is an SVG set `aria-hidden="true"` (`packages/components/site-footer/skins/warm.js`) and the playful stamp angles are borders and shadows in CSS, so nothing is said only by the drawing. axe, 0 violations in every register (`packages/components/site-footer/site-footer.check.mjs`, "axe, light, all three registers: 0 violations"). |
| 1.3.1 Info and relationships | Meets | A native `<footer>` (contentinfo) holding a `<nav>` that carries its own label and a `<ul>` of links. `site-footer.check.mjs`: "a labelled footer keeps its own label (the element adds one only when there is none)", and "without JavaScript: sign-off, every link and the small print show on all 3 footers". |
| 1.4.1 Use of color | Meets with author's part | The footer's own links are a list inside a labelled `<nav>`, not links in running text, so they are found by position and by their list, and colour is not what sets them apart (`packages/components/site-footer/site-footer.css`: no underline at rest in quiet and warm, a bordered chip in playful). A link the page puts inside the small print is the author's, and must be underlined or otherwise marked. |
| 1.4.3 Contrast (minimum) | Meets | Text is `--sg-text` and the small print the token text roles: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: every text role on every surface is 4.5:1 or more"). axe, 0 violations: `site-footer.check.mjs`, "axe, light, all three registers", "axe, dark, <register> on its own" and "axe without JavaScript". |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent in a 320 px wide window (stricter than 200 percent alone), three registers, page width 320, nothing clipped (throwaway Playwright script). Sizes are in `rem`, `em` and tokens, with `min-height` on the links: `packages/components/site-footer/site-footer.css`. |
| 1.4.10 Reflow | Meets | `site-footer.check.mjs`: "at 390 px the <register> demo does not scroll sideways". Manual test, 2026-10-07: the demo at 320 CSS px, three registers, page width 320 (throwaway Playwright script). |
| 1.4.11 Non-text contrast | Meets | The focus ring is `--sg-focus`, and the playful chip border and the warm rule are `--sg-text`: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: focus ring and control borders are 3:1 or more on every surface"). The quiet top rule is decoration. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, page width 320 with no sideways scroll (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | The footer holds only native links, reached by Tab (manual test, 2026-10-07: 7 Tab stops on the demo in each register, see 2.4.3); `tools/touch.check.mjs --only site-footer` requires a focus style in each register. |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07: `packages/components/site-footer/site-footer.js` and its skins bind no key handler, set no `tabindex` and call no `focus()`; the links are native, so Tab and Shift+Tab pass through. |
| 2.4.3 Focus order | Meets | Manual test, 2026-10-07 (throwaway Playwright script): the site-footer demo at 390 px in quiet, warm and playful, Tab pressed through every stop (7 stops in each register); each focused control was on screen and not covered (the element at its centre is the control itself) and every stop came after the previous one in document order. The same script on a page with a full-screen fixed layer added reported every stop covered, so it can fail. The order is the order the author wrote the links. |
| 2.4.4 Link purpose (in context) | Meets with author's part | The links are the author's own `<a>` with their own text, in a `<nav aria-label="Footer">` (`packages/components/site-footer/site-footer.js`). The component adds no link text. The words must say where each goes (the demo uses Work, Journal, Workshops, Visit, Privacy). |
| 2.4.7 Focus visible | Meets | Added although the kind has no `interactive` trait, because it carries links. `packages/components/site-footer/site-footer.check.mjs`: "<register>: Tab reaches the first link ... a <n> px target with a focus ring", in all three registers. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | `packages/components/site-footer/site-footer.css` has no `position: fixed` or `sticky`, so the footer never covers a focused control itself. Manual test, 2026-10-07: the site-footer demo at 390 px in quiet, warm and playful, Tab pressed through every stop (7 stops in each register); each focused control was on screen and not covered (the element at its centre is the control itself) and every stop came after the previous one in document order. The same script on a page with a full-screen fixed layer added reported every stop covered, so it can fail. A sticky bar the page adds can still cover a footer link. |
| 2.5.3 Label in name | Meets | Links are named by their own visible text: the only `aria-label` the component adds is on the footer landmark, when the author gave none (`packages/components/site-footer/site-footer.js`). |
| 2.5.8 Target size (minimum) | Meets | Added for the same reason. Manual test, 2026-10-07: the footer links measure 33 by 44 px at the smallest in quiet and warm and 81 by 50 px in playful (throwaway Playwright script on the demo, 1280 px). `site-footer.check.mjs` requires 40 px or more of height in each register. |
| 4.1.2 Name, role, value | Meets | contentinfo with a name: the element sets `aria-label` only when the page gave none (`site-footer.js`; `site-footer.check.mjs`, "a labelled footer keeps its own label"). The links are native. axe: 0 violations in every register, in light, in dark and with JavaScript off (the same check file). |

**The page author owns:**

- The words of the sign-off, every link and the small print, in the language of the page, and `lang` on any passage in another language (3.1.2).
- The footer's label: the element adds the English default "Site footer" when the `<footer>` has no `aria-label`, so on a page in another language, give it one.
- Link text that says where each link goes (2.4.4), and any link placed inside the small print: marked by more than colour (1.4.1).
- Consistent footer links across pages (3.2.3, 3.2.4).

- A sticky header or banner that could cover a footer link when it takes focus (2.4.11).