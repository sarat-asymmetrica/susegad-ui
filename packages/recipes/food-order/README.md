# Food order

A menu and the way to order from it, for a small food business that takes its orders on WhatsApp: a café, a home baker, a shack, a stall. The page has three parts, in the order a person needs them: how ordering works in three lines, the menu, and the order, written for them as a message.

It composes:

| Piece | Used for |
|---|---|
| `<sg-menu orderable>` | the menu: sections of dishes with prices in rupees, units, tags in words, sold-out and ask-first dishes said as words, a quantity stepper on each dish you can order, and one polite running total |
| `<sg-wa-order>` | the order: day (with notice), time of day, delivery or pickup, area, name, dietary needs and notes; the exact message under "This is what we'll send"; and a Send link whose address is that message |
| `<sg-field>` | the ruled text fields inside the composer |

Nothing on the page needs wiring. The composer finds the menu by `for="menu"` and listens for its `sg-change`.

## Files

| File | What it is |
|---|---|
| `index.html` | The page, and the demo. Reads `?register`, `?theme` and `?palette`. The studio, the dishes and the number are made up. |
| `recipe.js` | Imports both elements and says when the page is ready. Nothing else; it wires nothing. |
| `recipe.css` | The page around the parts: the heading, the three steps, the two columns. |
| `recipe.test.js` | The page's own consistency: the composer's `number` and the fallback link's number are the same number, and the fallback message names the business. |
| `recipe.check.mjs` | Browser checks: the whole journey on a phone (tap, tap, fill, read, send) ending on a link that decodes to the preview, the page with no JavaScript, the steps in reading order, and axe on both ends of the journey. |

## What it asks of the shop

Change four things on `index.html`:

1. The dishes in `<sg-menu>`: edit the list, or write it with `menuHTML()` from `menu.core.js` from your own data.
2. The composer's `number` (however you write it), `business`, `min-notice` (hours) and `areas`.
3. The fallback link inside `<sg-wa-order>`. Build its address with `waLink(number, text)` from `wa-order.core.js`, so it cannot drift from `number`; the test in `recipe.test.js` shows how to check it.
4. The three steps, if your shop works differently (no pickup, a different notice).

## Without JavaScript

The menu is a list, readable with or without the stylesheet: names, prices, units, tags and "Sold out" as words. The composer is the one plain link, styled as the page's strong button, with a short message: "Hello Sample Pasta Studio! I would like to order. What is available?" It opens WhatsApp. Nothing on the page is a button that would do nothing.

## Honesty

The page never says an order is placed. It says "Nothing is final until we reply and confirm", and after the tap, "Your order is written; send it in WhatsApp and we'll confirm." It cannot know whether the person pressed send, and it does not take payment, hold stock or check what is available that day.
