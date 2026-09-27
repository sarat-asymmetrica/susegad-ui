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
| `prices` | attribute | Show each free night's price (28k, 70k, 1.2L; the full figure in Indian grouping is in the day's name), the season ribbon (warm, playful) and a season table. Without it: dates only. |
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

## Credit

The calendar, the ribbon and the rules come from the Casa Exemplo booking page and its portal kernels.
