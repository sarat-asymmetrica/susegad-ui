# Date range

`<sg-date-range>` asks for a stay: an arrival and a departure. Two native date inputs do the work, and submit with the form, with or without JavaScript. With it, a two-month calendar under the inputs writes into them, knows which nights are taken and which mornings you can leave as others arrive, and moves by keyboard like the WAI-ARIA date picker grid.

It reads availability and prices from the booking kernels (`packages/kernels/booking/`), so the calendar and the quote always agree.

## Usage

```html
<link rel="stylesheet" href="susegad/components/date-range/date-range.css">
<script type="module" src="susegad/components/date-range/date-range.js"></script>

<sg-date-range prices>
  <fieldset>
    <legend>Your stay</legend>
    <label>Arrival <input type="date" name="arrival" required min="2026-10-22" max="2027-06-30"></label>
    <label>Departure <input type="date" name="departure" required min="2026-10-23" max="2027-07-01"></label>
  </fieldset>
</sg-date-range>
```

Tell it what is already booked:

```js
document.querySelector('sg-date-range').blocks = [
  { arrival: '2026-11-13', departure: '2026-11-16', kind: 'booking' }, // booking | hold | owner
];
```

Inside an `<sg-form>`, each input's note goes just after its label, never inside it. If the two labels sit side by side, wrap each in a block of its own (`<div><label>Arrival <input type="date" …></label></div>`) so a note wraps under its own date and never widens the input.

Set `min` and `max` on the inputs yourself so the no-JavaScript path has the window too; if you leave them out, the element fills them in from the rate card's booking window. Limits the element fills in follow `open-from` and a new `rates`; limits you wrote are never moved.

Take enquiries for any night from today, while bookings open later:

```html
<sg-date-range prices open-from="2026-09-24"> … </sg-date-range>
```

Every night after the notice period can be picked. The ribbon still flags the rate card's opening date, and the nights before it read as enquiries. `open-from` is a date rather than a mode, so the page says exactly when picking starts, a server can render it, and a test can pin it.

## Attributes, properties and events

| Name | Kind | What it does |
|---|---|---|
| `prices` | attribute | Show each free night's price (28k, 70k, 1.2L; the day's name holds the full figure in Indian grouping and, in brackets, the short form the day shows), the season ribbon (warm, playful) and a season table. Without it: dates only. |
| `today` | attribute | An ISO date to treat as today, for demos and tests. Default: today in India. |
| `blocks` | attribute or property | Taken nights as JSON, or an array: `{ arrival, departure, kind }`. A booking's departure day is free for the next arrival. |
| `rates` | property | The rate card. Default: `RATES` from the booking kernels. Setting it redraws the prices, the ribbon and the season table, and moves any input limits the element set itself. |
| `open-from` | attribute | An ISO date: the first night guests can pick, when that is earlier (or later) than the rate card's `window.openFrom`. For a site that takes enquiries for any future night. The notice period still applies, and the ribbon keeps the rate card's opening flag, because that is when bookings open. |
| `window` | property | The window guests pick from, read only: the rate card's, opening from `open-from` when set. |
| `selection` | property | `{ arr, dep }`, read only; the inputs are the source of truth. |
| `register` | attribute | `quiet`, `warm` or `playful`. |
| `sg-pick` | event | A day was picked: `detail` is `{ arr, dep }`. |
| `sg-range` | event | After every change: `{ arrival, departure, ok, reasons }`. |

The inputs fire `input` and `change` when the calendar writes them, so a form or a recipe listens to them as it would to any input.

A day pick plays `tick` through the sound switch (`packages/sound`). Silent unless the switch is on and a gesture has already happened.

## Registers

- **Quiet:** hairline cells; arrival and departure outlined, the nights between tinted. Nothing moves.
- **Warm:** the Casa calendar: arrival and departure looped in pool-blue ink, the nights between underlined, and a season ribbon above (monsoon rain, Christmas crosshatch, the opening flag, today). At phone width the band names move out of the bands into a two-column key under the months, each with its own swatch.
- **Playful:** the same in laterite ink, bolder and looser.

With reduced motion the ink is drawn in full at once.

## Rules it keeps

- A night is the night starting on that date. A stay occupies `[arrival, departure)`.
- You can arrive on any free night after the notice period; you can leave on a morning when others arrive (turnover), but not across a taken night.
- A stay the kernels refuse (a taken night typed into the inputs, a season's minimum nights, a stay that is too long) sets the departure input's validity with the reason, so the form's own validation stops it and says why. The reasons are also listed under the calendar, read out politely.
- The kernels keep the portal's wording, with ISO dates and rate-card terms. `inWords` (in `date-range.core.js`) turns each one into a guest's words, from `STRINGS.reasons`: "The night of 13 November is already taken.", "Stays over Christmas week are at least 4 nights.", "Stays at this time of year are at least 3 nights." A reason it does not recognise passes through unchanged.

## Accessibility

- Without JavaScript: two labelled date inputs in a fieldset with a legend, with `required`, `min` and `max`.
- The calendar is a `grid` per month, named by its month. One tab stop; arrows move by a day or a week, Home and End to the ends of the week, Page Up and Page Down by a month (Shift: a year), Enter or Space picks.
- Each day's name says the date, your choice, whether it is free and its price, or why not, and whether you can leave on it. Days you cannot pick are `aria-disabled` but still reachable, so their reason can be heard.
- The chosen days carry `aria-selected`. A hint above the grid says what to do next and is read out as it changes.
- Every night state has its own shape (a stroke for taken, a corner for departure-only, an outline for your ends), not only a colour. Forced colours are supported.
- The season information is a plain table (`Seasons and rates`); the ribbon is its picture.
- axe: zero violations in every register and theme. It lists colour contrast "to review by hand" in warm and playful because the ink canvas lies over the grid; the canvas is transparent apart from the ink round the cells.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The legend keys are `aria-hidden` and the season ribbon and ink are drawings behind the grid, so the seasons are said by a plain table (`packages/components/date-range/date-range.js`; `packages/components/date-range/date-range.check.mjs`: "the season table is text, and says the card is per night"). Each day's name says the date and its state in words. |
| 1.3.1 Info and relationships | Meets | Without JavaScript: two labelled date inputs in a fieldset with a legend (`date-range.check.mjs`: "no JS: the calendar is not there, the two inputs are"). With it: a `role="grid"` table per month named by its month, `aria-selected` on the chosen days, and a day that names its date, its state and its price (`date-range.check.mjs`: "a free day is named in full, with its price in Indian grouping", "both ends are selected in the grid"). |
| 1.3.5 Identify input purpose | Not applicable | The arrival and departure dates are the stay's, not the reader's own details, so none of the WCAG input purposes (such as a birth date) applies. |
| 1.4.1 Use of color | Meets | Every night state has words in its name ("taken", "you can leave on this day", "too soon") and its own shape: a stroke through a taken number, a corner for departure only, an outline for your ends (`packages/components/date-range/date-range.css`, `.is-taken::before`, `.is-depart-only::after`, `.is-arr`). `date-range.check.mjs`: "a taken day that others arrive on says you can leave that morning". |
| 1.4.3 Contrast (minimum) | Meets | Manual test, 2026-10-07: for every day cell in the demo, in all three registers, light and dark, the computed text colour against the cell's painted background, composited over its ancestors (throwaway Playwright script; the ink canvas is transparent apart from its strokes and is not counted): the lowest ratio was 5.39:1 in light (the price on a chosen arrival) and 4.61:1 in dark (the price in a peak week), against the 4.5:1 required; day numbers were 4.74:1 or more. axe finds no violations (`tools/axe.mjs --url /packages/components/date-range/demo.html`: 0 violation(s) across 6 run(s), 2026-10-07) but lists `color-contrast` as to review by hand in all six, because the ink canvas lies over the grid, which the measurement above covers. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: the demo with the root font size at 200 percent in three registers (1280 px wide): no sideways scroll, no clipped element, days 75 by 80 px (throwaway Playwright script). Prices are in `rem` in `packages/components/date-range/date-range.css`. |
| 1.4.10 Reflow | Meets | Manual test at 320 CSS px, three registers, 2026-10-07: no sideways scroll, no clipped element, the months stack to one column (`repeat(auto-fit, minmax(16rem, 1fr))` in `packages/components/date-range/date-range.css`), days 34.3 by 40 px (throwaway Playwright script). No check in the repository asserts it yet. |
| 1.4.11 Non-text contrast | Meets | The chosen days' outline is `--sg-text`, the focus ring `--sg-focus`, and the stroke and corner marks `--sg-text-soft`; `packages/tokens/tokens.test.js` tests the focus ring and `--sg-rule-strong` at 3:1 or more on every surface, and the text roles at 4.5:1 or more, for every palette and theme. The cell borders and the ribbon are not needed to tell a state, since the name says it. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected on the demo in three registers, no clipped element and no sideways scroll (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `date-range.check.mjs`: one tab stop in the grid, ArrowRight moves a day, ArrowDown a week, Home and End to the ends of the week, PageDown and PageUp a month, Enter and Space pick; the typed inputs still work. |
| 2.1.2 No keyboard trap | Meets | The grid is one tab stop and Tab leaves it (`date-range.check.mjs`: "one tab stop in the grid, on the first day you can arrive"); the nav buttons, the grid and the seasons summary are native controls. |
| 2.4.3 Focus order | Meets | The inputs, then the month buttons, the grid (one stop) and the seasons summary, in reading order (`date-range.check.mjs`); a keyboard move brings the focused day into view ("PageDown moves a month and brings it into view"). |
| 2.4.7 Focus visible | Meets | The rule is `.sg-dr-day:focus-visible` in `packages/components/date-range/date-range.css`, and `tools/touch.check.mjs` finds the component interactive and requires a focus style in every register. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/date-range/date-range.css` has no `position: fixed` or `sticky`, so the component covers nothing. A sticky header or banner the page adds can cover a day that scrolls into view. |
| 2.5.3 Label in name | Meets | A day shows its number and a short price ("10", "20k"); its name holds both, as in "Tue 10 Nov 2026, free night, ₹20,000 (20k)", so a speech-input user can say "click 20k" (`labelFor` in `packages/components/date-range/date-range.core.js`, unit-tested in `packages/components/date-range/date-range.test.js`). `packages/components/date-range/date-range.check.mjs`: "every day's visible text is in its accessible name" compares each day's visible spans with its `aria-label` across all 183 days (91 priced) in quiet, warm and playful; it failed on all 91 priced days before the fix ("20k" not in the name). Days with no price show only the number, which the name contains. |
| 2.5.8 Target size (minimum) | Meets | Days are 2.5rem or more (`min-block-size` in `packages/components/date-range/date-range.css`): manual test, 2026-10-07, smallest 43 by 43 px at 1280 px, 43.4 by 43.4 px at 390 px with touch and 34.3 by 40 px at 320 px; the month buttons are 40 by 40 px. The one control under 24 px is the "Seasons and rates" summary, 698 by 21.6 to 23 px at 1280 px and 256 by 21.7 px at 320 px. It passes through the spacing exception: a 24 px circle centred on it touches no other target in any register at 1280, 390 or 320 px (throwaway Playwright script, `circle-hits` empty), and it grows past 24 px at 200 percent text. |
| 3.2.2 On input | Meets | Picking a day writes the inputs and changes the hint and nothing else; the form submits only on the page's own button (`date-range.check.mjs`: "Enter picks the arrival and writes the input", "the hint says what to do next"). |
| 3.3.1 Error identification | Meets | A stay that cannot be booked is refused in text that names the reason: `date-range.check.mjs`: "a typed stay across a taken night is refused, with the reason" ("The night of 13 November is already taken.", also listed in a polite list), "the rate card rules too, in guests' words: the Christmas minimum", "a day past a taken night cannot be the departure". Days that cannot be picked are `aria-disabled` but still reachable, so the reason can be heard. |
| 3.3.2 Labels or instructions | Meets with author's part | Each input has a native `<label>` (Arrival, Departure) inside a fieldset with a legend, and a hint above the grid says what to do next and is read as it changes (`date-range.check.mjs`: "the hint says what to do next"). The label words and the legend are the page's. |
| 4.1.2 Name, role, value | Meets | `role="grid"` named by the month, `aria-selected` and `aria-disabled` on days, native `<input type="date">` and `<button>` elements (`packages/components/date-range/date-range.js`); `date-range.check.mjs` reads the states back. axe: 0 violations, 2026-10-07. |

**The page author owns:**

- The labels of the two inputs and the legend of the fieldset, in the language of the page, and `lang` on any text in another language (3.1.2).
- The rate card and the blocked nights the calendar draws from, and the wording of any reason a night cannot be picked.
- Sticky headers and banners that could cover a day when it takes focus (2.4.11).
- The colours the page sets behind the calendar, if it overrides the tokens.

## Credit

The calendar, the ribbon and the rules come from the Casa Exemplo booking page and its portal kernels.
