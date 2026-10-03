# WhatsApp order

*The "how do I order?" answer for a home baker, a café, a shack or a stall that takes its orders on WhatsApp.*

It turns what someone chose on the menu into a message the seller can read at a glance, shows them that message word for word, and opens WhatsApp with it already written. Nothing is sent until they press send there.

```html
<link rel="stylesheet" href="susegad/components/wa-order/wa-order.css">
<script type="module" src="susegad/components/wa-order/wa-order.js"></script>

<sg-menu id="menu" orderable continue="#order">…</sg-menu>

<sg-wa-order id="order" for="menu" number="+91 90000 12345" business="Sample Pasta Studio"
             min-notice="24" areas="Porvorim, Panjim, Margao">
  <a class="sg-wa-send" href="https://wa.me/919000012345?text=Hello%20Sample%20Pasta%20Studio!%20I%20would%20like%20to%20order.">Order on WhatsApp</a>
</sg-wa-order>
```

## The prompt

Make an order composer web component for a small food business that takes orders on WhatsApp. It listens for the menu's `sg-change` (the menu named by `for`, or an `<sg-menu>` nested inside it) and asks only what a seller needs: the day (a native date input whose earliest day counts a `min-notice` in hours from now, in the device's own time, and says when the earliest day is if a day inside the notice is picked), a time of day (a native select of `slots`, with "No preference"), delivery or pickup (two big native radios; `fulfilment` can offer just one), the delivery area (a free text field with `areas` as suggestions, hidden for pickup, and a line saying the full address is asked for in WhatsApp), a name, any dietary needs and any notes. Show the exact message under "This is what we'll send", with a line saying they send it themselves and can change it there. The primary action is an `<a>` whose `href` is always the wa.me link for exactly the message on screen, opening in a new tab; with no JavaScript the author's plain wa.me link with a short generic message stays in the markup and is the page's one strong button. The message is plain text for a phone: a greeting, a line for each dish (quantity × name, its unit and tags such as egg-less in brackets, its price), the total marked as an estimate to confirm, then the day and time, delivery area or pickup, the name, dietary needs, notes, and thanks; no markdown a WhatsApp would garble, no dashes. Handle Indian numbers however they are written (10 digits, 0 in front, +91, spaces, hyphens, brackets), numbers from other countries, emoji and Indian scripts in what people type, a lone half of an emoji, and a very long order (shorten it a level at a time, never drop a dish, and say so if it still cannot fit). An empty cart has no link and says why, with a link back to the menu. Until the order is complete the link is `aria-disabled` and stays focusable, and pressing it moves focus to the first thing missing and says what it is in the browser's own bubble, in our words. Be honest: it never says the order is placed. After the tap it says "Your order is written; send it in WhatsApp and we'll confirm." and fires `sg-wa-open`; changing the order afterwards clears that line. Give it three registers. Quiet: ruled fields, a plain bordered message, one ink-filled button, the chosen way ticked as well as filled. Warm: the message is a slip of ruled paper in the hand with a margin line, the title ruled under by hand. Playful: the message is a speech bubble with a tail, choices as pills, a button that presses down, and the "written" line stamps in once. Under reduced motion nothing moves.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| composes the message | pure core | `composeOrder(order, { level })` returns the text; `prepareOrder(order, { number, now, minNoticeHours })` returns `{ ok, text, href, problems, reason, level }`. Both run in Node. |
| Indian numbers however they are written | pure core | `normalizeNumber()` strips spaces, hyphens and brackets, a trunk 0, `+91`, `0091`, and puts 91 in front of a bare 10-digit mobile. A number with a plus is taken as written. `waLink(number, text)` throws on one it cannot use. |
| the link's address always equals the preview | one source | Both are made from the same `prepareOrder()` result on every input; the check decodes the `href` with the URL parser and compares it to the preview text. |
| emoji and a lone half of an emoji | pure core | `wellFormed()` repairs a lone surrogate before `encodeURIComponent`, which would throw; long free text is cut on whole code points. |
| shorten it a level at a time | pure core | Level 1 drops each dish's price and the thank-you; level 2 drops units and cuts the notes. Tags stay. If the link still passes 4000 characters (`MAX_HREF`) there is no link and the reason says so. |
| notice, in hours | pure core | `earliestDate(now, hours)` (the device's local time) sets the date input's `min`; `validateOrder()` also refuses an earlier day and says when the earliest is. |
| no link until it is complete, but still focusable | `aria-disabled` | The `<a>` loses its `href` and gains `role=link tabindex=0 aria-disabled`; Enter, Space or a click runs the same handler, which moves focus to the first missing field and calls `reportValidity()` with our message set by `setCustomValidity()`. |
| a plain link with no JavaScript | progressive enhancement | The author's `<a class="sg-wa-send">` is the one the element upgrades and moves into its panel; remove the element and it goes back where it was. |
| never says the order is placed | words | `STRINGS.written` is the only thing said after the tap. The check searches the whole composer for "placed", "confirmed", "received" and "booked". |
| the written line stamps in once | WAAPI | `stampIn('full')` in the core: 320 ms, one iteration; every other register and reduced motion get `null`. |
| ruled paper | CSS | A repeating gradient on `::before` behind the text (`z-index: -1` inside an isolated `pre`), a margin line on `::after`; the words stay on a solid background. |
