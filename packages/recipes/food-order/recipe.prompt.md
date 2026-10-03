# Food order

*A menu and a way to order from it, for a small food business that takes orders on WhatsApp.*

## The prompt

Build the ordering page for a small food business (a café, a home baker, a shack) whose customers today send their orders as direct messages and keep asking "how do I order?". Make it from Susegad UI parts only. Open with the shop's name, a heading ("Order fresh pasta, in a few taps") and two sentences that say everything is made to order so a day's notice is needed, that the order is written for them as a WhatsApp message, and that they read it, send it, and the shop replies to confirm. Under it, "How ordering works" as a plain ordered list of three steps: choose (tap + beside each dish; prices are for one of each unit), say when and where, send it in WhatsApp (we write the message; you press send; nothing is final until we reply). Then, in two columns on a wide screen and one on a phone, the menu and the order. The menu is an `<sg-menu orderable>` of sections of dishes with a name, a price in rupees grouped the Indian way, a unit, a line about it and tags in words (egg-less, veg, vegan, contains nuts, spicy) with a small glyph beside each, one dish sold out and one ask-first, each dish you can order with a quantity stepper, and a total bar that stays at the foot of the screen with a link on to the order. The order is an `<sg-wa-order for="menu">` with the shop's number, its name, a notice in hours, delivery areas and times of day, whose Send link is the page's one strong button. Keep the plain wa.me link inside it as the fallback, with a short generic message, so with no JavaScript the page is a readable list and one link that opens WhatsApp. Never say an order is placed. Say that the studio, the dishes and the number are made up. Let the page's register choose the look: in quiet, ruled fields and an ink-filled button; in warm, a menu card ruled by hand and the message on ruled paper in the hand; in playful, price pills and a speech bubble. Check it on a phone, with reduced motion, with JavaScript off, and by keyboard.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| from Susegad UI parts only | composition | The page links the parts' CSS and imports `menu.js` and `wa-order.js` through `recipe.js`. The recipe's own code is the page (`index.html`), its layout (`recipe.css`) and a ready signal (`recipe.js`). |
| find each other | events and ids | `<sg-wa-order for="menu">` listens for the menu's `sg-change` on the document and reads `menu.order` once at start. A menu nested inside the composer needs no `for`. |
| the page's one strong button | one link | The fallback `<a class="sg-wa-send">` is the link the element upgrades; the same node is styled as the primary button with or without script. |
| readable with no JavaScript | progressive enhancement | The menu is the server's `ul`/`li` list; the composer is the one link; the steps are an `ol`. Steppers, fields and the preview exist only with script. |
| a day's notice | `min-notice` | The date field's earliest day is now plus 24 hours, in the device's time; a day inside it is refused with the earliest day named. |
| never say an order is placed | words | The steps say "Nothing is final until we reply and confirm"; the composer says only that the order is written. The check searches the whole page for "placed", "booked" and "received". |
| made up | sample content | "Sample Pasta Studio", invented dishes and a made-up number; the page says so. |
