# Menu

`<sg-menu>` is a menu and price list for a small food business. The page's own list is the menu; script adds a quantity stepper to each dish you can order, and a total.

## Markup

```html
<sg-menu orderable glyphs continue="#order">
  <section class="sg-menu-section">
    <h3 class="sg-menu-section-title">Fresh pasta</h3>
    <p class="sg-menu-section-note">Made to order.</p>
    <ul class="sg-menu-items">
      <li class="sg-menu-item" data-id="fettuccine" data-availability="available">
        <span class="sg-menu-name">Fresh fettuccine</span>
        <span class="sg-menu-price"><data value="450">₹450</data> <span class="sg-menu-unit">10 pieces</span></span>
        <span class="sg-menu-line">Plain wheat, rolled thin</span>
        <div class="sg-menu-meta">
          <ul class="sg-menu-tags"><li class="sg-menu-tag" data-tag="egg-less">Egg-less</li></ul>
          <span class="sg-menu-status">Sold out</span>   <!-- only when not available -->
        </div>
      </li>
    </ul>
  </section>
</sg-menu>
```

With no JavaScript this is a plain list, readable with or without the stylesheet. Write the markup by hand, or have a server or build step write it with `menuHTML()`.

| Part | What it is |
|---|---|
| `.sg-menu-section` | a section: `.sg-menu-section-title` (any heading level), optional `.sg-menu-section-note`, then `ul.sg-menu-items` |
| `li.sg-menu-item` | a dish. `data-id` (optional; the name's slug otherwise), `data-availability`: `available`, `sold-out` or `ask` |
| `.sg-menu-name` | required |
| `.sg-menu-price` | the price in `<data value="450">` (any text works: "₹450"), and `.sg-menu-unit` |
| `.sg-menu-line` | the sauce or description |
| `.sg-menu-tag` | one per tag, `data-tag` for the key (`egg-less`, `veg`, `vegan`, `nuts`, `spicy`, or your own) |
| `.sg-menu-status` | the word for a dish that cannot be ordered ("Sold out", "Ask first"); the element adds it if you forget |

A dish with no price, or marked sold out or ask first, never gets a stepper and is never in an order.

## From data

```js
menu.items = [
  { title: 'Fresh pasta', note: 'Made to order.', items: [
    { name: 'Fresh fettuccine', line: 'Plain wheat, rolled thin', price: 450, unit: '10 pieces', tags: ['egg-less', 'veg'] },
    { name: 'Squid ink tagliolini', price: 640, availability: 'sold out' },
  ] },
];
```

Prices may be numbers or text ("₹ 1,23,450", "Rs. 450"). A flat list of dishes is one untitled section. `menu.items` reads back as the cleaned sections.

## Attributes, properties, events

| | |
|---|---|
| `orderable` | add steppers, the total and Start again |
| `glyphs` | a small shape before each known tag; the words stay |
| `currency` | the symbol, default `₹`; ₹, Rs and INR group the Indian way, anything else in thousands |
| `max-qty` | the most of one dish in an order, default 99 |
| `continue` | a `#hash`: a link to it shows in the total bar once something is added; `continue-label` words it |
| `seed`, `register` | the warm frame's hand; the register |
| `menu.order` | `{ lines, total, count }` now |
| `menu.setQty(id, n)`, `menu.clear()` | change the order from script; they say so and fire `sg-change` like a press |
| `sg-change` | `detail: { lines: [{ id, name, unit, qty, unitPrice, tags }], total, count }`, lines in menu order. `tags` are the words ("Egg-less") |

## Registers

| | Look |
|---|---|
| quiet | a typeset price list: name, dotted leader, price in tabular figures; the unit under the price, the sauce under the name; section heads in small capitals |
| warm | a menu card: a raised sheet, a double frame ruled by hand in pencil, script section heads with a ruled line, dish names in the display face, the sauce in italics |
| playful | each dish a card, prices in pills, tags as chips, "Sold out" stamped at a tilt; the count lifts and settles once when a dish is added |

Motion: only the playful count's settle (420 ms, one iteration). Reduced motion: none anywhere.

## Reused

The warm frame and the ruled lines under the heads use `pencilRule()` and `inkPath()` from `packages/components/field/field.core.js`.

## Accessibility

- A list of lists: each dish a list item, each tag a list item, with the price in a `<data>` element.
- The stepper is two real buttons and a count in a group named for the dish; the buttons are named "Add one Fresh fettuccine" and "Remove one Fresh fettuccine", 44 px square.
- A minus at zero is `aria-disabled`, not disabled, so focus is never lost.
- One polite, atomic live region says the dish and its count, then the total. A screen reader hears "Fresh fettuccine: 2 in your order. 2 items, ₹900".
- A tag is always words. The glyph comes with them, never in their place, and a colour is never the only difference.
- Sold out and ask first are said as words next to the dish.
- Prices use tabular figures so a column of them lines up.
- Forced colours: the frame and the ruled lines are dropped, and the stepper gets a system border.

## Limits

- The order lives in the page: reload and it is gone. A page that wants more keeps `menu.order` itself.
- Prices are per unit, whole or to the paisa. A dish "per kg" or by weight is not handled: write it as a unit and ask first.
- The ceiling is per dish, not per order.
