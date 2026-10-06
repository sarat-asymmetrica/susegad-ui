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

## Sizing it

At 390 px the wrapper scrolls and `document.documentElement.scrollWidth` stays 390. Give the table enough columns that it has something to scroll, and mark the number columns with `data-money-col` so they keep their alignment while it does.
