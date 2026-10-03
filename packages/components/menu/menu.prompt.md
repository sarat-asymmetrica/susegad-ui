# Menu

*The price list of a café, a home baker, a shack or a stall: what is on offer, what it costs, and what is not available today.*

Sections of dishes, each with a name, a price in rupees, a unit, a line about it, tags in words, and whether it can be had. On a phone it can take an order: a quantity stepper on each dish and a running total.

```html
<link rel="stylesheet" href="susegad/components/menu/menu.css">
<script type="module" src="susegad/components/menu/menu.js"></script>

<sg-menu orderable glyphs continue="#order">
  <section class="sg-menu-section">
    <h3 class="sg-menu-section-title">Fresh pasta</h3>
    <ul class="sg-menu-items">
      <li class="sg-menu-item" data-id="fettuccine" data-availability="available">
        <span class="sg-menu-name">Fresh fettuccine</span>
        <span class="sg-menu-price"><data value="450">₹450</data> <span class="sg-menu-unit">10 pieces</span></span>
        <span class="sg-menu-line">Plain wheat, rolled thin</span>
        <div class="sg-menu-meta"><ul class="sg-menu-tags"><li class="sg-menu-tag" data-tag="egg-less">Egg-less</li></ul></div>
      </li>
    </ul>
  </section>
</sg-menu>
```

## The prompt

Make a menu web component for a small food business, a list a person can read and order from on a phone. The page's own HTML is the menu: sections, each a heading and a list of dishes, each dish its name, its price in rupees (the machine value in a `<data value>`), its unit ("10 pieces", "serves 2"), a line about it, tags as words (egg-less, veg, vegan, contains nuts, spicy; an optional small shape before each, never a shape or a colour alone), and a status: available, sold out or ask first. With no JavaScript and no CSS it must read as a plain list. Give pure functions that clean up whatever is handed over (prices written as "₹ 1,23,450" or "Rs. 450", tags written "eggless" or "Egg-free", availability written "soldout"), group rupees the Indian way (₹1,23,450), add an order up in paise so it never drifts, and write the same semantic list as a string, so a server can render it and a test can read it. Add an `orderable` attribute: each dish that can be had gets a quantity stepper of two native buttons and a count, named for the dish ("Add one Fresh fettuccine"), 44 px square, with a minus that has run out marked `aria-disabled` and never removed so focus stays; one polite, atomic live region says the dish and the count then the total ("Fresh fettuccine: 2 in your order. 2 items, ₹900"); a Start again button, a ceiling on how many (and say so at it), and an optional link on to the order that shows once something is added. A sticky bar keeps the total at the foot of the screen. Dishes that are sold out or ask first never get a stepper and say why in words. Emit `sg-change` with `{ lines: [{ id, name, unit, qty, unitPrice, tags }], total, count }` in menu order. Let `menu.items = [...]` write the list from data. Give it three registers. Quiet: a typeset price list, a name, dots, a price in tabular figures, the unit beneath the price and the sauce beneath the name, section heads in small capitals. Warm: a menu card on a raised sheet with a double frame ruled by hand in pencil round it (the field component's pencil rule, run along each side so the strokes cross a little at the corners), section heads in the hand with a ruled line under each, dish names in the display face, the sauce in italics. Playful: each dish a bordered card, the price in a pill, tags as chips, sold out stamped at a slight tilt, and when a dish is added its count lifts and settles once, with a slight overshoot; nothing loops. Under reduced motion nothing moves in any register.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| reads as a plain list with no JavaScript | progressive enhancement | The server markup is the whole menu: `ul`/`li`, the price in a `<data value>`, the status as a word. The element reads it and adds only what needs script (steppers, total, links). Tabular figures, leader dots and the card are CSS. |
| clean up whatever is handed over | pure core | `normalizeMenu()`, `parsePrice()`, `parseTags()` (known tags have one label each), `normalizeAvailability()`. Ids are the name's slug and never repeat. |
| the Indian way (₹1,23,450) | pure core | `formatMoney(n, currency)`: last three digits, then pairs, for ₹, Rs and INR; thousands for any other currency; decimals only when there are some. |
| added up in paise | pure core | `summarize(menu, qtys)`: lines in menu order, a dish that cannot be ordered never in them, the total summed as integer paise. |
| write the same list as a string | pure core | `menuHTML(menu)` escapes every word; the element's `items` property uses it, so script and server give the same markup. |
| tabular figures | CSS | `font-variant-numeric: tabular-nums` and `font-feature-settings: "tnum"` on the price, the count and the total. The check measures `1111111` against `0000000`. |
| leader dots | CSS | The name is a flex row whose `::after` grows to fill the line, a dotted bottom border; it is not drawn when there is no price after it. |
| tags in words, an optional glyph | CSS | `sg-menu[glyphs]` draws a shape in `::before` from the tag's `data-tag`; the tag's text is always the markup. |
| native buttons, named for the dish | native first | Two `<button type=button>` and a count in a `role=group` named "Fresh fettuccine, quantity". |
| a minus that has run out … focus stays | `aria-disabled` | `aria-disabled="true"`, never the `disabled` property, so a keyboard user pressing minus to zero keeps their place. |
| one polite live region | live region | `role=status aria-live=polite aria-atomic=true`: a screen-reader-only sentence about the dish, then the visible total. |
| a ceiling on how many (and say so) | clamp | `max-qty` (default 99); the plus button goes `aria-disabled` at it and the line says "3 is the most we can take in one order." |
| hand-ruled double frame | reuse | `pencilRule()` and `inkPath()` from the field component, run along each side of the card at two insets; drawn once per size into an `aria-hidden` SVG. |
| the count settles once | WAAPI | `settleMotion('full')` in the core gives the keyframes (lift, land, slight overshoot, 420 ms, one iteration); the playful skin plays them on the count that changed. Other registers and reduced motion get `null`. |
