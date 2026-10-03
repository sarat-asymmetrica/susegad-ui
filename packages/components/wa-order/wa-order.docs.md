# WhatsApp order

`<sg-wa-order>` turns a menu selection into a pre-written WhatsApp message. It pairs with `<sg-menu>`: the menu says what was chosen, this asks when and where, shows the exact message, and gives a Send link whose address is that message.

## Use

```html
<sg-menu id="menu" orderable continue="#order">…</sg-menu>

<sg-wa-order id="order" for="menu" number="+91 90000 12345" business="Sample Pasta Studio"
             min-notice="24" areas="Porvorim, Panjim, Margao">
  <a class="sg-wa-send" href="https://wa.me/919000012345?text=Hello%20Sample%20Pasta%20Studio!%20I%20would%20like%20to%20order.">Order on WhatsApp</a>
</sg-wa-order>
```

The `<a>` is the fallback. With no JavaScript it is the page's one strong button and opens WhatsApp with a short message. With JavaScript the element upgrades the same link: it asks the questions, and keeps the link's `href` equal to the message it shows.

Build the fallback link with `waLink()` so the number is right:

```js
import { waLink } from './susegad/components/wa-order/wa-order.core.js';
waLink('098765 43210', 'Hello! I would like to order.');
// https://wa.me/919876543210?text=Hello!%20I%20would%20like%20to%20order.
```

## Attributes and events

| | |
|---|---|
| `for` | the id of the menu to read; or put an `<sg-menu>` inside the element and leave this off |
| `number` | the shop's WhatsApp number, however you write it (see below). Without one the plain link is all that shows |
| `business` | named in the greeting ("Hello Sample Pasta Studio!") |
| `min-notice` | hours of notice; the date field's earliest day counts them from now |
| `areas` | comma-separated delivery areas, offered as suggestions (a free text field: anywhere can still be typed) |
| `slots` | comma-separated times of day; default Morning, Afternoon, Evening. "No preference" is always first |
| `fulfilment` | the ways you offer: `delivery pickup` (default both), or just one |
| `currency` | default `₹` |
| `register` | quiet, warm, playful |
| `sg-wa-open` | when the Send link is pressed with a complete order. `detail: { text, href, lines, total }`. It means the message was handed to WhatsApp, never that an order was placed |
| `order` (property) | `{ ok, text, href, problems, reason, level }` for what would be sent now |

## Numbers

`normalizeNumber()` understands `98765 43210`, `098765 43210`, `+91 98765-43210`, `0091 (98765) 43210` and `919876543210`, all as 919876543210. A 10-digit number that does not start 6 to 9 is refused as not a mobile. A number with a plus keeps its own country code. `waLink()` throws on a number it cannot use, so a typo is found when the page is built, not by messaging a stranger.

## The message

```
Hello Sample Pasta Studio! I would like to order:

2 × Fresh fettuccine (10 pieces, egg-less, veg): ₹900
1 × Spinach ravioli (serves 2, veg): ₹520

Estimated total: ₹1,420. Please confirm the total and any delivery charge.

When: Sun 4 Oct 2026, Morning (9 to 12)
Delivery to: Porvorim
Name: Anjali
Dietary: No nuts
Notes: Ring twice please 🍝

Thank you!
```

Plain text. Nothing a WhatsApp would turn bold, struck through or into a list; the business's own names have `*`, `_`, `~` and backticks removed. What the customer types is tidied (control characters out, spaces collapsed, cut on whole characters). Pickup reads `Pickup: I will collect it` with no area. With nothing chosen there is no message and no link.

A very long order is shortened a level at a time until its link fits in 4000 characters (an assumption: it keeps well inside what servers and browsers accept). Level 1 drops each dish's price and the thank-you; level 2 drops units and cuts the notes. A dish is never dropped, and its tags (egg-less, contains nuts) stay at every level. If even the shortest does not fit, there is no link and the reason says so.

## Registers

| | Look |
|---|---|
| quiet | ruled fields, a plain bordered message, one ink-filled button; the chosen way is filled and ticked |
| warm | the message on ruled paper in the hand with a margin line, its title ruled under by hand; the button in the accent |
| playful | the message in a speech bubble with a tail, pill choices, a button that presses down, and the "written" line stamps in once |

Motion: the playful button press (CSS, only without reduced motion) and the stamp (320 ms, one iteration). Reduced motion: none.

## Accessibility

- Every field is a native control with its visible label; the optional ones say so. The required ones use the browser's own validation, worded by us through `setCustomValidity`.
- The Send action is a real link. Until the order is complete it is `aria-disabled` with no `href`, still focusable, and its reason is read with it (`aria-describedby`). Pressing it moves focus to the first field that is missing and shows the browser's own message.
- A date input is several tab stops in the browser (day, month, year, the picker); the rest follow in reading order, and the link comes last.
- The delivery and pickup choice is two native radios in a fieldset, so the arrow keys move between them. The chosen one is ticked and filled, never colour alone.
- The only live region is the line after the tap. The reason and the preview are not read out as you type.
- Text contrast is measured from the painted colours in all three registers and both themes.

## Honesty

It never says the order is placed. After the tap it says "Your order is written; send it in WhatsApp and we'll confirm." and nothing more. It cannot know whether the person pressed send in WhatsApp.

## Limits

- It does not take payment, hold stock or check what is available on the day. The shop confirms in WhatsApp.
- Notice is counted from the device's clock and local time.
- Details are not remembered between visits.
- On a desktop with no WhatsApp the link opens WhatsApp Web; there is no copy-the-message button.
