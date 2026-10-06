# Data table

*A ledger for a business: what came in, what is owed, month by month. The register for auditors and finance first; warm and playful after.*

A native `<table>` that sorts and scrolls. Money is written the Indian way, lakh and crore (₹1,25,000, never 125,000), on tabular figures so columns of digits line up. At phone width the table scrolls inside itself and the page never scrolls sideways.

```html
<link rel="stylesheet" href="susegad/components/data-table/data-table.css">
<script type="module" src="susegad/components/data-table/data-table.js"></script>

<sg-data-table>
  <table>
    <caption>Collections, April to September 2026</caption>
    <thead><tr>
      <th scope="col" data-sort="month">Month</th>
      <th scope="col" data-sort="collected" data-money-col>Collected</th>
      <th scope="col">Note</th>
    </tr></thead>
    <tbody>
      <tr><td>April</td><td data-money="245000">₹2,45,000</td><td>Season opens</td></tr>
      <tr><td>June</td><td data-money="125000">₹1,25,000</td><td>Monsoon, slow</td></tr>
    </tbody>
    <tfoot><tr><td>Total</td><td data-money="370000">₹3,70,000</td><td colspan="2"></td></tr></tfoot>
  </table>
</sg-data-table>
```

## The prompt

Make a data-table web component around a native `<table>`: a `<caption>`, sortable columns marked with `data-sort` on the th, and money cells marked `td[data-money]` whose value is the raw number. With JavaScript, wrap the table in a scrollable region so at phone width the table scrolls sideways inside itself and the page never does; turn each sortable header into a real `<button>` so the sort is the platform's focus and Enter and Space work; write `aria-sort` on the sorted th (ascending, then descending, then gone on a third click) and reorder only the tbody rows with a stable sort, numbers as numbers and text as text, equal rows keeping the order they were written in. Rewrite every money cell from a pure grouping function that writes 125000 as "1,25,000" and 12500000 as "1,25,00,000" (lakh and crore, the 2-2-3 rhythm), never Western grouping and never a locale library, which would group Western-style on most machines. Set tabular figures on the table and align money columns to the right. Give it three registers. Quiet: hairline rules, generous space, zero ornament; the money column carries the weight. Warm: a hand-drawn rule under the header row, drawn in code with a small seeded wobble, and a hand face on the caption. Playful: a tinted zebra and a coloured sort arrow, still drawn. Under reduced motion nothing moves. Without JavaScript the table reads fully in the order it was written.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| lakh and crore, ₹1,25,000 | pure core | `groupIndian(n)` groups the integer part 2-2-3 (the last three, then pairs): 125000 → "1,25,000", 12500000 → "1,25,00,000". No `Intl`, no locale library: those group Western-style on most machines. `rupee(n)` puts the ₹ in front; a number it cannot read says nothing. |
| what a cell sorts as | `cellValue(td)` | `data-value`, then `data-money`, then the text. Money-like text ("₹1,25,000") becomes a number; anything else stays text. |
| the platform's focus, Enter and Space | native `<button>` | The th's content is moved into a real button, so the browser does the keyboard. |
| aria-sort | `ariaSort(dir)` | `ascending` on the first click, `descending` on the second, the attribute removed on the third. Only one th carries it. |
| ascending, descending, gone | `nextSort(current, id)` | The cycle, pure: a column clicked once sorts ascending, twice descending, three times back to the written order; another column starts again at ascending. |
| stable sort | `sortRows(rows, dir, value)` | Numbers as numbers, text after numbers, text by `localeCompare` in Kannada collation; equal values keep their order. Only `tbody.rows` move; the footer never does. |
| scrolls inside itself | `.sg-table-wrap` | The element wraps the table in a `role="region"` div with `overflow-x: auto` and `overscroll-behavior-x: contain`, named by the caption. The page never scrolls sideways at 390 px; the wrapper does. |
| the money on the page is the money in the code | rewrite | Every `td[data-money]` is rewritten from `groupIndian` on connect, so the rendered text and the sort value can never disagree. |
| a hand-drawn rule with a seeded wobble | warm skin | An SVG path under the header row, points every 90 px nudged by `rng('table-rule:seed')`, redrawn only on resize. |
| tabular figures | CSS | `font-variant-numeric: tabular-nums` on the table, so digits align down a column; money columns sit on the right. |

## Accessibility

- A real `<caption>` names the table and names the scroll region.
- Sorting is a native button per column: Tab reaches it, Enter and Space sort it, and `aria-sort` on the th tells the screen reader the direction. The arrow is a shape as well as a colour change.
- The scroll region is focusable, so a keyboard user can scroll a wide table on a phone.
- Without JavaScript the table reads fully, in the order it was written, with the quiet look.
