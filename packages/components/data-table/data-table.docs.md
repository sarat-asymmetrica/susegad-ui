# Data table

`<sg-data-table>` is a native `<table>` that sorts and scrolls. It enhances a `<table>`.

## Markup

| Element | What it is |
|---|---|
| `<caption>` | required. It names the table, and names the scroll region the element wraps it in. |
| `thead th[data-sort]` | a sortable column. `data-sort="month"` is the column id used in the `sg-table-sort` event. Without `data-sort` a column never sorts. |
| `th[data-money-col]` | right-aligns a money or number column's heading with its cells. |
| `td[data-money="125000"]` | a money cell. The attribute holds the raw number; the element rewrites the text as ₹1,25,000 from the pure core. Cells with element children are left alone. |
| `td[data-value="38"]` | the number a cell sorts by, when the text alone is not it. |
| `tfoot` | never sorted. It stays where you wrote it. |

Everything else in the table is yours: `th scope="col"`, links in cells, text.

## Attributes and events

| | |
|---|---|
| `register` | `quiet`, `warm`, `playful`; inherited like every component's. |
| `sg-table-sort` | event, `{ id, dir }`, on every change. `dir` is `asc`, `desc` or `null` (the written order restored). |
| `table.sort('collected')` | sorts programmatically; returns false for an unknown column. |

## Sorting

One click sorts ascending, a second descending, a third returns the rows to the order they were written in. The sorted th carries `aria-sort="ascending"` or `"descending"`, and no other th carries it. The sort is stable: equal values keep their written order. Numbers sort as numbers (data attribute or money-like text), text as text after numbers. The footer never moves.

## Money, the Indian way

`groupIndian()` in `data-table.core.js` groups 2-2-3: the last three digits, then pairs. 125000 → "1,25,000", 1250000 → "12,50,000", 12500000 → "1,25,00,000". It is a pure function with no `Intl` and no locale library, because a locale library groups Western-style (125,000) on most machines. `rupee(n)` adds the ₹. A value the code cannot read renders as nothing, never "NaN".

## Registers

| | Look |
|---|---|
| quiet | hairline rules, generous space, zero ornament. The money column carries the weight. |
| warm | a hand-drawn rule under the header (a seeded SVG wobble, drawn in code), the caption in the hand face. |
| playful | a tinted zebra, the sorted column in the accent colour; the money stays in ink, because red figures in a ledger read as owed. |

Reduced motion keeps every register still; there is nothing that needs to move.

## Accessibility

- The table is a native `<table>` with a `<caption>`; the scroll region is `role="region"` named by that caption, focusable so a keyboard user can scroll it.
- Sorting is a native `<button>` in the th: Tab, Enter, Space; `aria-sort` tells the direction; the arrow is a shape, not only a colour.
- The table sets `font-variant-numeric: tabular-nums`, so digits align.
- Without JavaScript the table reads fully, in the written order, no wrapper, no buttons.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The sort arrow is a CSS shape on the button (`packages/components/data-table/data-table.css`, `.sg-table-sort::after`), and the direction is said by `aria-sort`, so nothing is lost without the picture. The table holds the author's own cells and images. |
| 1.3.1 Info and relationships | Meets | A native `<table>` with a `<caption>`, `<th>` headers and `aria-sort` on the sorted one. `packages/components/data-table/data-table.check.mjs`: "Enter sorts ascending and writes aria-sort", "the scroll region is named by the caption and focusable", and "without JavaScript: no wrapper, no buttons, the written order". Whether `<th scope>` is right for a complex table is the author's markup. |
| 1.4.1 Use of color | Meets | The sorted column shows an arrow that turns for the direction and `aria-sort` says it; the sorted header's darker colour only repeats that (`packages/components/data-table/data-table.css`, `th[aria-sort]` rules). |
| 1.4.3 Contrast (minimum) | Meets | `packages/components/data-table/data-table.check.mjs`: "axe, light, all three registers: 0 violations", the same in dark, and for each register on its own in dark, `color-contrast` included. Text roles are tested at 4.5:1 or more on every surface in `packages/tokens/tokens.test.js`. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-06: the demo with the root font size at 200 percent in three registers (1280 px wide), the page does not scroll sideways and no text is clipped (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | A data table is two-dimensional content, which the criterion allows to scroll in both directions, and here only the table's own region scrolls. `data-table.check.mjs`: "at 390 the page does not scroll sideways" and "the wrapper does scroll sideways, so nothing is cut off". Manual test at 320 CSS px, three registers, 2026-10-06: the page does not scroll sideways. The region is focusable so a keyboard user can scroll it. |
| 1.4.11 Non-text contrast | Meets | The sort arrow is drawn in `currentColor` or `--sg-accent-text` (text roles, 4.5:1 or more) and the focus ring is `--sg-focus`; the row rules are decoration. `packages/tokens/tokens.test.js` tests the focus ring and `--sg-rule-strong` at 3:1 or more on every surface for every palette and theme. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-06: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected on the demo in three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `data-table.check.mjs`: in each register Tab reaches the first sort button with a focus ring, Enter sorts ascending then descending, Space clears the sort, and a second column starts again at ascending. The scroll region has `tabindex="0"`, checked in "the scroll region is named by the caption and focusable". |
| 2.1.2 No keyboard trap | Meets | Manual test: `packages/components/data-table/data-table.js` binds no key handler of its own; the sort controls are native buttons and the region takes Tab and Shift+Tab as any focusable element does. |
| 2.4.3 Focus order | Meets | Sort buttons come in header order and the scroll region comes before them in the page; `data-table.check.mjs` Tabs to the first sort button in each register. |
| 2.4.7 Focus visible | Meets | `data-table.check.mjs`: "Tab reaches the first sort button (N presses) with a focus ring" in each register; the rules are `.sg-table-sort:focus-visible` and `.sg-table-wrap:focus-visible` in `packages/components/data-table/data-table.css`, and `tools/touch.check.mjs` requires a focus style as well. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/data-table/data-table.css` has no `position: fixed` or `sticky`, so the component covers nothing. A sticky header or banner the page adds can cover a focused sort button or the region. |
| 2.5.3 Label in name | Meets | The sort button's accessible name is its visible text first, then ", now smallest first" or ", now largest first" once sorted (`packages/components/data-table/data-table.js`, `aria-label` built from `btn.textContent`). |
| 2.5.8 Target size (minimum) | Meets | A sort button is at least 2rem (32 px at 16 px type) tall (`min-height` in `packages/components/data-table/data-table.css`) and as wide as its header text. Manual test, 2026-10-06: no focusable control under 24 by 24 CSS px at 1280 px or at 390 px with touch, in all three registers (throwaway Playwright script). |
| 4.1.2 Name, role, value | Meets | Native `<button>` in the `<th>`, `aria-sort` for the state, and the region named by the caption. `data-table.check.mjs`: axe with 0 violations in light and dark, in each register, and with JavaScript off. |

**The page author owns:**

- The caption, the column headings and the cell text, in the language of the page, and `lang` on cells in another language (3.1.2).
- `scope` and `headers` on a table with more than one header row or column.
- Which columns can be sorted and the `data-value` of cells whose text is not what should sort.
- Sticky headers or banners on the page that could cover a focused sort button or the scroll region (2.4.11).
- The colours the page sets behind the table, if it overrides the tokens.

## Sizing it

At 390 px the wrapper scrolls and `document.documentElement.scrollWidth` stays 390. Give the table enough columns that it has something to scroll, and mark the number columns with `data-money-col` so they keep their alignment while it does.

## Arriving and pressing

- Rows arrive once, on the tala: each one lands on its own beat of the sixteen-beat teental cycle (130 ms a beat, nothing on the three silent beats). Only the first five wait for a beat; the rest take the fifth's beat, so the list cascades top to bottom and the longest wait is 520 ms however long it is, and the cards are in the accessibility tree from the start (the fade is visual only). The stagger is CSS, with `sibling-index()`; where a browser lacks it, `core/arrive.js` hands each one the same delay. Warm eases in; playful settles on the spring. Quiet gets no stagger, and nothing moves under reduced motion.
- Only arrivals play. A new one that is added later starts again from the first beat, and a sort or a move the reader asked for never replays anything (`data-seen` marks what has arrived).
- A press answers within a frame: no transition on the way in, and it eases back in under 150 ms. Quiet settles 1 px, warm shades the colour toward the ink, playful gives a little (scale 0.97) and lets go on the spring. Reduced motion keeps the colour and drops the movement; a held key does not move anything.
