# Postcard

`<sg-postcard>` is a card for a piece of work: title, where and when with a status, the problem in a line, what was built, the outcome and a link. It enhances an `<article>`.

## Markup

| Element | What it is |
|---|---|
| `<article>` | required |
| `<h2>`–`<h4>` with one `<a href>` | the title and the card's only link; it covers the whole card |
| `p.sg-postcard-where` | the place and year, with the status as `<sg-badge>` beside them: `success` (Live), `accent` (Shipped), `info` (Experiment) |
| `.sg-postcard-face` with `.sg-postcard-problem` | the problem in a line (the picture side in playful) |
| `dl.sg-postcard-back` | the details: Built, Outcome, anything else as `dt`/`dd` pairs |

Keep other links out of the card; put them under it.

## Status: a badge, or a stamp when asked for

By default the status is a level badge on the where-line. A rubber stamp on every card reads as heavy, so it is opt-in: set `status-style="stamp"` and put an `<sg-stamp role="none">` in the article (as its last child) instead of the badge. It sits in the card's top corner; in warm it gets a postmark, lettered from the `postmark` attribute. The element warns if a card has a stamp without asking for one.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `status-style` | `badge`, `stamp` | `badge` |
| `postmark` | a place and year for the warm postmark, e.g. "Aldona 2026" (stamp style only) | no lettering |
| `seed` | the tilt and postmark's hand | the title |
| `register` | `quiet`, `warm`, `playful` | inherited |

## Registers

| | Look | Motion |
|---|---|---|
| quiet | an index card: a red hairline under the title, ruled lines under the details | none |
| warm | a postcard's back on card stock with a deckled edge: divider, address lines, a printed postage square with no word (the stamp and a postmark instead, in stamp style) | none |
| playful | tilted, hard shadow, the problem on a bright tile | turns over on hover or focus, where it may (below) |

The playful card turns over only with a hovering pointer and full motion. On touch screens, under reduced motion and without JavaScript, both sides show one above the other. The warm card's message side takes about two thirds from 44rem up. Below 44rem the address lines move up under the postage square (or stamp), beside the title and where-line, and the message runs the full width under a pencil rule, so real-length copy keeps six or more words a line (checked with fictional copy of a real card's length at 560 px). Below 30rem the address lines go.

## In a grid

Cards stretch to their grid cell's height (`height: 100%`), so a row of cards lines up. Leave about 10 px around playful cards for the tilt and shadow; the element pads itself by that much.

## Accessibility

- One tab stop per card; the whole card is the link's target; the focus ring goes round the card.
- The details are always in the DOM, in reading order.
- Contrast on the playful tile (on-accent on accent) and back (text on the highlighter) is tested in every palette and theme.

### Conformance (WCAG 2.2 AA)

The table adds rows for the card's link (2.4.7, 2.5.8), which the component's traits in `tools/conformance.core.js` do not ask for.

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The postage square, the postmark and the drawn frames are `aria-hidden` (`packages/components/postcard/skins/warm.js`, `packages/components/postcard/postcard.js`) and the details are real text in reading order: `packages/components/postcard/postcard.test.js`, "the postage square and the postmark are both decoration, and the square gives way to a stamp"; `postcard.check.mjs`, "without JavaScript every card shows its details". |
| 1.3.1 Info and relationships | Meets | An `<article>` with a heading whose `<a>` is the card's one link, and the details as text. `postcard.check.mjs`: "nine cards, each exactly one tab stop, and the whole card is its link", and axe without JavaScript: 0 violations. |
| 1.4.1 Use of color | Meets | The status is a badge with words ("Live") or, when asked for, a stamp with words, never colour alone (`postcard.check.mjs`: "default: every card shows a level badge on its where-line", "status-style=\"stamp\": the stamp shows in every register"). The heading link is a card title, not a link inside a block of text, and gains an underline on hover. |
| 1.4.3 Contrast (minimum) | Meets | `packages/components/postcard/postcard.test.js`, "AA: <palette> <theme>: the playful face and back read at 4.5:1" (on-accent on accent, text on the highlighter); `packages/tokens/tokens.test.js` for the other registers; `postcard.check.mjs`: "axe, <theme>, all three registers: 0 violations". |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and nothing clipped (throwaway Playwright script). |
| 1.4.10 Reflow | Meets with author's part | `postcard.check.mjs`: "at 390 px the page does not scroll sideways", "at 320 px the page does not scroll sideways", and "<register>, <style>, a 560 px card with real-length copy: at least 6 words a line". The 320 px check failed before the demo was fixed (the demo page scrolled 16 px sideways, 336 px wide, from its own grid's `minmax(20rem, 1fr)` columns); the demo's grid is now `minmax(min(100%, 20rem), 1fr)` and the page is 320 px wide. A page that lays cards in a grid keeps its columns able to shrink to the screen. |
| 1.4.11 Non-text contrast | Meets | The postage square, postmark and frames are decoration beside the card's words. The card's focus ring is tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `packages/components/postcard/postcard.check.mjs`: "nine cards, each exactly one tab stop, and the whole card is its link" and "Tab walks the cards one stop each, in order". The card's one control is its heading link. |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07: `packages/components/postcard/postcard.js` and its skins bind no key handler, set no `tabindex` and call no `focus()`, so Tab and Shift+Tab pass through the native links. |
| 2.4.3 Focus order | Meets | `packages/components/postcard/postcard.check.mjs`: "Tab walks the cards one stop each, in order". Manual test, 2026-10-07 (throwaway Playwright script): the postcard demo at 390 px in quiet, warm and playful, Tab pressed through every stop (9 stops in each register, one per card); each focused control was on screen and not covered (the element at its centre is the control itself) and every stop came after the previous one in document order. The same script on a page with a full-screen fixed layer added reported every stop covered, so it can fail. |
| 2.4.4 Link purpose (in context) | Meets with author's part | The link is the card's heading (`packages/components/postcard/postcard.check.mjs`, "nine cards, each exactly one tab stop, and the whole card is its link"), so the card's title is the link text and the details beside it are its context. The title and details are the author's. |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the card in each register and requires a focus style; the ring goes round the whole card (`packages/components/postcard/postcard.css`). `postcard.check.mjs`: "Tab walks the cards one stop each, in order". |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | `packages/components/postcard/postcard.css` has no `position: fixed` or `sticky`, so the component never covers a focused control itself. Manual test, 2026-10-07 (throwaway Playwright script): the postcard demo at 390 px in three registers, every Tab stop was on screen and not covered (the element at its centre is the control itself); the same script with a full-screen fixed layer added reported every stop covered, so it can fail. |
| 2.5.3 Label in name | Meets | The card's link is its heading, named by the title's own visible text; the component adds no `aria-label` to it (`packages/components/postcard/postcard.js`). The status badge and stamp are words, not controls. |
| 2.5.8 Target size (minimum) | Meets | The heading link is 23.0 px tall in quiet (36.0 in warm, 24.6 to 51.7 in playful), but its hit area is the whole card: `postcard.check.mjs`, "the whole card is its link" samples three points across each card and finds the one link at each. Manual test, 2026-10-07, 390 px touch: the cards are 351 to 363 px wide and 241 to 515 px tall. |
| 4.1.2 Name, role, value | Meets | A native `<a>` in a heading, named by the title. `postcard.check.mjs`: axe with and without JavaScript, 0 violations. |

**The page author owns:**

- The title, the details and the status words, in the language of the page, and `lang` on text in another language (3.1.2).
- Link text that says where the card goes (2.4.4).
- The grid a page puts several cards in, so its columns can shrink to a 320 px screen (1.4.10).
- The colours the page sets behind the card, if it overrides the tokens.

- A sticky header or banner that could cover a card when it takes focus (2.4.11).