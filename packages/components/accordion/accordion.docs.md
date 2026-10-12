# Accordion

`<sg-accordion>` is a list of questions and answers for an FAQ. It enhances the
browser's own `<details>` and `<summary>`: the browser does the opening and
closing, with or without JavaScript.

## Markup

| Element | What it is |
|---|---|
| `details` (children of the element) | one question. Several sharing the same `name` form an exclusive group: only one open at a time. |
| `summary` | the question, one per details. It is the reader's toggle: Tab to it, Enter or Space to turn it. |
| everything after the summary | the answer, plain markup (paragraphs, lists, links). Write it as you would any prose. |

The element adds no words and no structure of its own. Two things it does add:

- A `name` attribute on the element becomes the group for every child that has none. A child that already carries its own `name` keeps it, so one accordion can hold an exclusive group and free-standing sections side by side.
- Attributes for the skins: `data-skin` (set by the element), `data-motion`, `data-open-count`, `data-any-open`.

Two or more items of one group starting `open` are settled by the browser while parsing: it keeps the first and drops the rest. Check the source with `resolveOpen()` from the pure core at build time if you want the clash named where an author can see it.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `name` | a group name for the children that have none | none: every item stands alone unless it carries a name |
| `register` | `quiet`, `warm`, `playful` | inherited |

Event: `sg-accordion-change` `{ open, total, exclusive }`, when an item moves (`open` is the indices now open). The element also exposes `details` (its items), `items` (`{ name, open, label }[]`) and `account` (`{ total, open, exclusive, groups }`) for a page that wants the state in JS.

## The platform owns the behaviour

- A summary is a real toggle: it takes Tab, opens on Enter and Space, and shows a 2 px focus ring.
- Screen readers get the open and closed state from the `<details>` itself; the element adds no ARIA, because none is needed.
- The exclusive group is `<details name="…">`, native in Chromium and Safari, Firefox from 130.
- Without JavaScript everything still opens and closes. The quiet look applies.

## Registers

| | Look |
|---|---|
| quiet | hairline rules between items and across the top of the first, generous space, a thin chevron that turns when the item opens. No ornament. |
| warm | the marker drawn in the hand face: a small hand-set `+` that becomes a `–` when the item opens, and a soft open transition (the answer slides down and fades in). |
| playful | the questions set in the hand face; the marker a drawn glyph in the accent colour, each with its own small seeded tilt, that flips 180 degrees with a spring when the item opens. |

Nothing moves under reduced motion: every register keeps its finished still, and an item still opens and closes.

## Sample

```html
<link rel="stylesheet" href="susegad/components/accordion/accordion.css">
<script type="module" src="susegad/components/accordion/accordion.js"></script>

<sg-accordion name="faq">
  <details name="faq" open>
    <summary>Where is the homestay, and how do I get there?</summary>
    <p>In Aldona, a village in the fields north of Panjim. Half an hour by car or bus; we send directions when you book.</p>
  </details>
  <details name="faq">
    <summary>Is breakfast included?</summary>
    <p>Yes, on the veranda from 7:30 to 10.</p>
  </details>
</sg-accordion>
```

## Accessibility

- No ARIA: `<details>` and `<summary>` already say everything. Adding `role` or `aria-expanded` here would only be noise.
- The drawn markers and the open rule are decoration on a pseudo-element; they carry no meaning and sit outside the accessibility tree.
- The focus ring is visible on every register, and the summary is reachable in the tab order in the order the questions are written.
- At phone width nothing scrolls sideways; the answer wraps inside the measure.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The open and closed marker (a chevron, a drawn plus or minus) is a CSS pseudo-element in `packages/components/accordion/accordion.css`, so it is not in the accessibility tree and carries no meaning that the native open state does not. The demo holds no images. |
| 1.3.1 Info and relationships | Meets | Native `<details>` and `<summary>`: the summary is the button, the open state is the browser's own. `packages/components/accordion/accordion.check.mjs`: "no JavaScript: a click on the summary opens it" and "no JavaScript: opening the third closes the first, on the platform alone". Headings or lists inside an answer are the author's markup. |
| 1.4.1 Use of color | Meets | The open state is a turned chevron in quiet and a plus that becomes a minus in warm, and the answer itself appears; none of it is a colour change alone (`packages/components/accordion/accordion.css`, `summary::before` rules). Links inside an answer are underlined (`text-underline-offset` in the same file). |
| 1.4.3 Contrast (minimum) | Meets | Summary text is `--sg-text` and answers are `--sg-text-soft`, both tested at 4.5:1 or more on every surface, palette and theme in `packages/tokens/tokens.test.js` ("AA: ... every text role on every surface is 4.5:1 or more"). `accordion.check.mjs`: "axe, light, all three registers: 0 violations" and the same in dark, `color-contrast` included. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-06: the demo with the root font size at 200 percent in three registers (1280 px wide), no sideways scroll and no clipped text, including the open answer (throwaway Playwright script). Type is in `rem` and `em` in `packages/components/accordion/accordion.css`. |
| 1.4.10 Reflow | Meets | `accordion.check.mjs`: "at 390 px the open accordion does not scroll sideways" and the same for the playful demo. Manual test at 320 CSS px, three registers, 2026-10-06: no sideways scroll, no element past the viewport. |
| 1.4.11 Non-text contrast | Meets | The marker is drawn in `currentColor` (quiet) or `--sg-accent-text` (warm and playful), text roles tested at 4.5:1 on every surface in `packages/tokens/tokens.test.js`; the hairline between questions is `--sg-rule-strong`, and the focus ring is `--sg-focus`, both tested 3:1 or more on every surface for every palette and theme in the same file. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-06: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected on the demo in three registers, no clipped or overlapping text, including the open answer (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `accordion.check.mjs`: in each register Tab reaches the summary and shows a ring, Enter opens the answer, Space closes it, and opening another with the keyboard closes the first in an exclusive group. |
| 2.1.2 No keyboard trap | Meets | Manual test: `packages/components/accordion/accordion.js` binds no key handler and sets no `tabindex`; the summaries are native and Tab and Shift+Tab pass through them. |
| 2.4.3 Focus order | Meets | `accordion.check.mjs`: "Tab reaches the second summary" in each register. Summaries follow the markup order, and nothing in `accordion.js` moves focus. |
| 2.4.7 Focus visible | Meets | `accordion.check.mjs`: "Tab reaches the second summary (N presses) and shows a focus ring" in each register; the rule is `summary:focus-visible` in `packages/components/accordion/accordion.css`, and `tools/touch.check.mjs` requires a focus style on it too. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/accordion/accordion.css` has no `position: fixed` or `sticky`, so the component covers nothing. A sticky header or banner the page adds can cover a summary that scrolls into view. |
| 2.5.3 Label in name | Meets | The summary's accessible name is its visible text, because the component adds no `aria-label`; the marker is generated content and does not change it (`packages/components/accordion/accordion.js` sets no ARIA). |
| 2.5.8 Target size (minimum) | Meets | Each summary is the full width of the accordion and at least 3.25rem (52 px at 16 px type) tall (`min-height` in `packages/components/accordion/accordion.css`). Manual test, 2026-10-06: no focusable control under 24 by 24 CSS px at 1280 px or at 390 px with touch, in all three registers (throwaway Playwright script). |
| 4.1.2 Name, role, value | Meets | Native `<details>` and `<summary>` give the name, the button role and the expanded state with no ARIA. `accordion.check.mjs`: axe with 0 violations in light and dark, in each register, and on the page without JavaScript. |

**The page author owns:**

- The question and answer text, in the language of the page.
- `lang` on a question or answer in another language (3.1.2).
- Alt text for images and the semantics of lists, links or headings put inside an answer.
- Sticky headers or banners that could cover a summary when it takes focus (2.4.11).
- The colours the page sets behind the accordion, if it overrides the tokens.

## Pure core

`accordion.core.js` runs in Node with no DOM: `groupsOf(items)` and `namedGroups(items)` for the exclusive groups, `resolveOpen(items)` for which items should start open (the first of each named group, the rest closed, each with a warning), `describeItems(items)` for the open account (`{ total, open, exclusive, groups }`), and `othersToClose(items, index)` for what one turn of a named item closes. An item is `{ name, open, label }`. Build steps and tests use these; the element uses `describeItems`.
