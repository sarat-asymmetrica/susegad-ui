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

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The only drawing is the warm pencil rule under the heading, an SVG set `aria-hidden="true"`: `packages/components/wa-order/wa-order.check.mjs`, "warm: the message is on ruled paper in the hand, its title ruled under by hand" (asserts `hidden === 'true'`). Everything else is text and native controls. |
| 1.3.1 Info and relationships | Meets | Every field is a native control with its visible `<label>`, the details sit in a `<fieldset>` with a `<legend>`, delivery or pickup is two native radios in a `<fieldset>`, and the preview is labelled by its heading: `packages/components/wa-order/wa-order.js`. `wa-order.check.mjs`: "<register>: Tab walks the fields in reading order and ends on the send link". |
| 1.3.5 Identify input purpose | Meets | The element sets `autocomplete="name"` on the name field and `autocomplete="address-level2"` on the delivery area (`packages/components/wa-order/wa-order.js`). No check in the repository asserts it yet. |
| 1.4.1 Use of color | Meets | The chosen way of getting the order is ticked and filled, never colour alone ("The delivery and pickup choice ... is ticked and filled"), a field the person has not completed gets a 2 px underline and a written reason, and the "written" line is words: `wa-order.check.mjs`, "<register>: still missing the day and a name: no link yet, and it says what is first". |
| 1.4.3 Contrast (minimum) | Meets | `wa-order.check.mjs`: "contrast <register>/<theme>: empty and finished states meet 4.5:1 (3:1 when large), from painted colours", for every text element in the empty and finished states, in all three registers and both themes. axe, 0 violations on those states (`wa-order.check.mjs`, "axe <register>: nothing chosen, flagged, and written states have no violations (WCAG 2.2 AA)"). |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent at 1280 px, three registers, nothing wider than the screen (throwaway Playwright script). Sizes are in `rem`, `em` and tokens: `packages/components/wa-order/wa-order.css`. |
| 1.4.10 Reflow | Meets | `wa-order.check.mjs`: "phone <register>: nothing scrolls sideways, every field fits and is 44 px tall, the send link is wide and 48 px tall" (390 px) and "no JS: ... nothing scrolls sideways". Manual test, 2026-10-07: the demo at 320 CSS px, three registers, page width 320 (throwaway Playwright script). |
| 1.4.11 Non-text contrast | Meets | Field underlines, the choice chips and the dashed disabled link are `--sg-rule-strong`, the focus ring `--sg-focus`, and the unfinished-field underline `--sg-danger`: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: focus ring and control borders are 3:1 or more on every surface" and, for `--sg-danger`, the text-role test). The filled chip is `--sg-accent` or `--sg-text` with its own text on it. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, page width 320 with no sideways scroll (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `wa-order.check.mjs`: Tab walks the date, time, way, area, name, dietary and notes fields and ends on the send link; the arrow keys move between delivery and pickup ("pickup (arrow key on the radio)"); a date can be typed by hand ("a date typed by hand (04102026) is kept as it is typed"); Enter or Space on the link before the order is complete moves focus to the first missing field ("pressing the link too early moves focus to the first missing field and says what is missing"). |
| 2.1.2 No keyboard trap | Meets | The only key handler is on the send link, for Enter and Space while it is `aria-disabled` (`packages/components/wa-order/wa-order.js`); Tab and Shift+Tab leave every control, and `wa-order.check.mjs` walks the whole tab order to the link and on. |
| 2.4.3 Focus order | Meets | Reading order, with the send link last and focus moved to the first missing field when it is pressed too early (`wa-order.check.mjs`, "Tab walks the fields in reading order and ends on the send link"). A hidden delivery area takes no focus ("pickup ... hides the area"). |
| 2.4.4 Link purpose (in context) | Meets | The send link reads "Send on WhatsApp" and the menu link "Back to the menu"; both are text in the element (`wa-order.check.mjs`, "it is a real link that opens WhatsApp in a new tab" asserts the label). The link opens a new tab with `rel="noopener"`, and the label does not say so. |
| 2.4.7 Focus visible | Meets | `packages/components/wa-order/wa-order.css` sets `:focus-visible` outlines in the token focus colour on the fields, the choices, the send link and the menu link; `tools/touch.check.mjs` Tabs onto the first focusable control in the component, in the quiet register, and requires an outline, ring or style change. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/wa-order/wa-order.css` uses no `position: fixed` or `sticky` and no overlay. A sticky bar the page adds, such as the menu's total bar that the demo composes it with, can cover a field when focus moves to it. |
| 2.5.3 Label in name | Meets | Every name comes from the visible `<label>` or legend: `packages/components/wa-order/wa-order.js` sets no `aria-label`, and the send link's name is its text, "Send on WhatsApp". |
| 2.5.8 Target size (minimum) | Meets | `wa-order.check.mjs`: "phone <register>: ... every field fits and is 44 px tall, the send link is wide and 48 px tall". Manual test, 2026-10-07: at 1280 px the fields are 44 to 46 px tall, the delivery and pickup chips 42 px (40 px in playful), the send link 48 px, and the "Back to the menu" link 29 px (throwaway Playwright script on the demo). |
| 3.2.2 On input | Meets | Choosing a way to get the order shows or hides the delivery area and changes the message, with focus left where it was, and nothing opens or submits until the person presses the link: `wa-order.check.mjs`, "pickup (arrow key on the radio) hides the area, drops the address from the message, and the link stays good". |
| 3.3.1 Error identification | Meets | A missing or refused field is named in words, in the line under the preview and in the browser's own message: "Pick the day you want it.", "We need a day of notice. The earliest day is Sat 3 Oct 2026." (`wa-order.check.mjs`, "notice: today is refused, and the reason says when the earliest day is"; "pressing the link too early moves focus to the first missing field and says what is missing"). Fields stay `required` natively. |
| 3.3.2 Labels or instructions | Meets with author's part | Each field has its visible label, optional ones say so ("(optional)"), and the area has a hint (`packages/components/wa-order/wa-order.js`). The `areas`, `slots` and `business` words the page gives are the author's. |
| 4.1.2 Name, role, value | Meets | Native controls with their labels; the send link is a real link that, until the order is complete, is `aria-disabled` with `role="link"`, still focusable, and its reason is read with it (`aria-describedby`): `wa-order.check.mjs`, "an empty cart has no link, says why, and points back to the menu". axe: 0 violations in the nothing-chosen, flagged and written states, in every register (the same file). |
| 4.1.3 Status messages | Meets | The only live region is the "written" line after the tap, a `role="status"` paragraph; the reason and the preview are not read out as you type: `wa-order.check.mjs`, "honest line: it says the order is written and must be sent, never that it is placed", "sg-wa-open tells the page what was handed over" and "change the order after sending and the "written" line goes". |

**The page author owns:**

- The words the page gives: `business`, `areas`, `slots`, the menu it reads, and the number, in the language of the page; the element's own labels, hints and messages ("Day you want it", "Pick the day you want it.", "Send on WhatsApp") are fixed English in `wa-order.core.js`, so on a page in another language they are a passage in English: mark it with `lang` (3.1.2) or ask for them to be made replaceable.
- Sticky bars and banners that could cover a field when it takes focus, such as a total bar from the menu (2.4.11).
- Saying, near the link, that it opens WhatsApp in a new tab, if the audit wants it (3.2.5 is level AAA).
- What happens after the person sends the message: the library writes the order and hands it over, and never says it is placed.

## Honesty

It never says the order is placed. After the tap it says "Your order is written; send it in WhatsApp and we'll confirm." and nothing more. It cannot know whether the person pressed send in WhatsApp.

## Limits

- It does not take payment, hold stock or check what is available on the day. The shop confirms in WhatsApp.
- Notice is counted from the device's clock, on the kitchen's IST calendar: a phone set to another zone still gets the kitchen's day.
- Details are not remembered between visits.
- On a desktop with no WhatsApp the link opens WhatsApp Web; there is no copy-the-message button.
