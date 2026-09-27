# Booking

The Casa Exemplo booking flow, rebuilt from library parts: four short steps (dates, guests and room, your details, confirm and hold), a price you can check by hand, a phone confirmed by a code, and a signature that holds the dates. It is a prototype and says so: nothing leaves the page, nothing is held and nothing is charged.

| Step | Parts | Asks for |
|---|---|---|
| The walk | `<sg-stepper>` inside `<sg-form>` | one step at a time with Back and Next; each step checked before the next; without JavaScript every step shows and the form submits |
| Dates | `<sg-date-range prices>` | arrival and departure, on a calendar that knows taken nights, turnover mornings and the seasons |
| Guests and room | `<sg-select>`, `<sg-combobox>`, `<sg-radio-group>` | guests (1 to 6), the city you are coming from (optional), the room: the whole house, the Sotão, the Balcão or the Quintal (the room names are still to be confirmed by the house) |
| Your details | `<sg-field>`, `<sg-otp>` | your name, a mobile number, and the 6-digit code "sent" to it |
| Confirm and hold | `<sg-check>`, `<sg-toggle>`, `<sg-signature>` | the house rules (required), breakfast (optional, arranged with the house and not in the price), your signature |
| Beside it all | the quote card | every band's nights, rooms, GST on its own line, the total, the deposit |

The answer to the hold is `<sg-form>`'s: "Held" stamped in warm and playful with "Prototype" under it, as the enquiry's "Not sent" is, and the same words in quiet. A real hold drops the second line (`STRINGS.heldDetail`).

## Files

| File | What it is |
|---|---|
| `booking.core.js` | Pure: the quote as words and figures (nights grouped by band and weeknight or weekend, rooms, GST, total, deposit, provisional flags), the Held words, and the phone code (a seeded six-digit code, read in any script). |
| `recipe.js` | The wiring: `mountBooking(root, { rates, blocks, seed })`, `renderQuote(card, view, reasons)` and the phone check. |
| `recipe.css` | The layout, the quote card and the flow's own pieces. |
| `held.html` | Where the form lands without JavaScript. It keeps nothing and says so. |
| `index.html` | The page, which also works as the demo. Links the tokens relatively and reads `?register`, `?theme` and `?palette`. |
| `recipe.test.js` | Tests for the quote and the code, with figures worked by hand from the rate card. |
| `recipe.check.mjs` | Browser checks: the page with JavaScript off (quiet, reduced motion), then the walk with it. |
| `form-check.json` | Valid sample values for `tools/form-check.mjs`: a stay the rate card accepts, and the code the page shows. Not copied by the CLI. |

## Put it on a page

Copy the form and the quote card from `index.html`, then:

```js
import { mountBooking } from './susegad/recipes/booking/recipe.js';
const tags = ['sg-form', 'sg-stepper', 'sg-date-range', 'sg-select', 'sg-combobox', 'sg-radio-group', 'sg-check', 'sg-field', 'sg-otp', 'sg-toggle', 'sg-signature'];
await Promise.all(tags.map(t => customElements.whenDefined(t)));
mountBooking(document.getElementById('booking'), {
  blocks: [{ arrival: '2026-11-13', departure: '2026-11-16', kind: 'booking' }], // nights already taken
});
```

For a real booking, replace the two prototype parts:

- **The code:** `mountBooking` shows the code on the page because nothing is sent. Send it by SMS from your server instead, and check it there too.
- **The hold:** `mountBooking` answers the form's `sg-submit` at once. Create the hold on your server, then resolve with `{ message, stamp: 'Held' }`, or reject with what went wrong.

## Where the figures come from

- Every figure is the booking kernels' own: each band's nights on their own line, rooms, GST at 18% on its own line (or "none below ₹7,500 a night"), the total and the deposit, in lakh grouping.
- The rate card's `provisional` flags reach the page: while any rate or the deposit is provisional, the card says so. The GST mode is printed, not implied.
- A refused stay leads the card with "Not bookable as chosen" and the reasons, then its nights, with no total and no deposit, so no figure for an impossible stay can be screenshotted.
- Without JavaScript the card says the house will send the price when they write back, and the minimum stays (3 nights, 4 over Christmas week) are stated under the dates.
- A stay the kernels refuse is refused by the form's own validation, in a guest's words ("Stays over Christmas week are at least 4 nights."), and the walk does not go on.
- The rate card prices the whole house only. Choose a single room and the card shows no figure for it: it says the house will confirm that room's price when they write back.
- The phone step does not pass until the code typed matches the code "sent", and the page says plainly that nothing left it.
- The prototype statement is always on the page, and the Held message repeats it.

## Without JavaScript

Every step shows, in order: two date inputs with the window's `min` and `max`, a select, a text input with suggestions from a datalist, the room radios, the name and number, the house rules checkbox, the breakfast switch and a typed-name signature. The browser validates them and posts them to `held.html`, a static page that keeps nothing and says so. POST, never GET: a name, a mobile number and a signature must never end up in the address bar, the browser's history or a server's logs. In your project, point `action` at your own endpoint. There is no "Send a code" button and no code field, because nothing could send one; a `noscript` line says the number is confirmed when the house writes back, and another says the price and the hold need JavaScript.

## Accessibility

- The stepper moves focus to each step's legend and says "Step 2 of 4"; Next focuses the first problem with the browser's own message.
- One polite line reads out the total for the stay, rather than the whole card, and only when the total changes: typing a name or a number never repeats it. A refused stay is read out once, by the calendar's own list of reasons; the card's line stays quiet about it. The code note is a polite status line.
- The quote card is a labelled `aside`; its lines are a description list.
- Every part brings its own keyboard and screen reader behaviour: the calendar grid, the combobox listbox, the radio group, the OTP boxes, the signature's typed path.

## Verify

```sh
node --test packages/recipes/booking/recipe.test.js
node packages/recipes/booking/recipe.check.mjs
MSYS_NO_PATHCONV=1 node tools/form-check.mjs --url /packages/recipes/booking/index.html
MSYS_NO_PATHCONV=1 node tools/form-check.mjs --url /packages/recipes/booking/index.html --no-js
MSYS_NO_PATHCONV=1 node tools/matrix.mjs --url /packages/recipes/booking/index.html --jobs 1
MSYS_NO_PATHCONV=1 node tools/matrix.mjs --url /packages/recipes/booking/index.html --jobs 1 --no-js
MSYS_NO_PATHCONV=1 node tools/axe.mjs --url /packages/recipes/booking/index.html
MSYS_NO_PATHCONV=1 node tools/axe.mjs --url /packages/recipes/booking/index.html --no-js
```
