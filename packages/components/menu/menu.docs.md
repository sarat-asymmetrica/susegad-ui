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

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The warm frame and ruled lines are `aria-hidden="true"` and carry no meaning; the stepper glyphs are `aria-hidden` inside buttons that have a name; tags are words with a glyph beside them. `packages/components/menu/menu.check.mjs`: warm frame "hidden", "every tag is words you can see". |
| 1.3.1 Info and relationships | Meets | A list of lists: dishes are list items, tags are list items, the price is a `<data>` element, and each stepper is a group named for its dish (`packages/components/menu/menu.js`). `menu.check.mjs` with JavaScript off: every dish is a list item with its name, the section heads and tags are there; with it on: the buttons come in reading order, each named for its dish. |
| 1.4.1 Use of color | Meets | A tag is always words, a sold-out or ask-first dish says so in words, and the count says how many are ordered (a picked dish also changes colour, never only that). `menu.check.mjs`: "every tag is words you can see (12 px or more)", "no JS: ... the sold-out word". |
| 1.4.3 Contrast (minimum) | Meets | `menu.check.mjs`: "contrast <register>/<theme>" measures every piece of text from its painted colours and requires 4.5:1 (3:1 when large) in all three registers, light and dark, with an order in progress. `packages/tokens/tokens.test.js` for the tokens, and axe `color-contrast` on the open state. |
| 1.4.4 Resize text | Meets | Manual test: the demo with the root font size at 200 percent in three registers, nothing clipped and nothing in the menu wider than the screen (throwaway Playwright script, 2026-10-06). |
| 1.4.10 Reflow | Meets | `menu.check.mjs`: nothing scrolls sideways at 390 px, with JavaScript off and on in each register. Manual test at 320 CSS px, three registers: no sideways scroll, no clipped text (2026-10-06). |
| 1.4.11 Non-text contrast | Meets | The stepper glyph against its button or the card: 12.7 to 14.2:1 in quiet, 4.7 to 6.3:1 on the warm and playful buttons, and the warm and playful button fill against the card 4.4 to 6.3:1, light and dark (manual test, 2026-10-06, default palette). The focus ring and control borders are tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em) injected on the demo in three registers, no clipping or overlap (throwaway Playwright script, 2026-10-06). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `menu.check.mjs`: Tab walks minus, plus, then the next dish's minus; Enter and Space on plus each add one; Enter on minus counts down; Start again and the way on are real buttons and links. All three registers. |
| 2.1.2 No keyboard trap | Meets | `menu.check.mjs` Tabs through the steppers and onward in each register. The menu binds no key handler of its own; every control is a native button or link in `packages/components/menu/menu.js`. |
| 2.4.3 Focus order | Meets | `menu.check.mjs`: "the buttons are in reading order" and the Tab sequence follows it; a minus at zero is `aria-disabled`, not disabled, so focus is never lost, and Start again keeps focus. |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto each control in every register and requires a focus style; the `:focus-visible` rules are in `packages/components/menu/menu.css`. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | `packages/components/menu/menu.check.mjs`: "phone <register>: Tab-focusing each of N controls, down to the last dish, leaves it at least 90 percent unobscured by the sticky total bar", at 390 by 844 with an order in progress, in all three registers, in Chromium, WebKit and Firefox. It was red before `scroll-margin-block-end` on the stepper buttons and `scroll-padding-block-end` on the document were added in `packages/components/menu/menu.css` (the worst focused button was 14 percent visible in quiet and 0 in warm and playful). A menu inside its own scrolling box, or under a taller sticky bar of the page's own, needs the same padding on that box or `--sg-menu-bar-clear` set. |
| 2.5.3 Label in name | Meets | The visible label of a stepper button is the symbol + or −, hidden from assistive tech, and the name is "Add one Fresh fettuccine" or "Remove one Fresh fettuccine" (`menu.check.mjs`, "each named for its dish"). A symbol is not words, so there is no visible word for the name to contain; this is our reading of the criterion, not a checked fact. The Start again button and the way on are text and named by it. |
| 2.5.8 Target size (minimum) | Meets | `menu.check.mjs`, "phone <register>: every stepper button is at least 44 by 44", in all three registers. Start again measures 78.8 by 44 px and the way on 148 by 46 px at 390 px (manual test, 2026-10-06). |
| 4.1.2 Name, role, value | Meets | Native buttons with a name for the dish, `aria-disabled` for a stepper at its limit, a count in a named group. `menu.check.mjs`: axe with an order in progress in each register, "axe <register> with an order in progress: no violations (WCAG 2.2 AA)". |
| 4.1.3 Status messages | Meets | One polite, atomic `role="status"` region says the dish, the count and the total, and says it again on Start again and at the ceiling. `menu.check.mjs`: "the total is one polite live region that says the dish, the count and the total", "Start again empties the order, says so", "the limit is kept and said". |

**The page author owns:**

- The dish names, descriptions, units and prices, and the words for tags and for sold out or ask first, in the language of the page.
- `lang` on any dish name or description in another language (3.1.2).
- The heading level of each section title, so the menu fits the page's outline.
- The wording and the target of the way on (`continue`).
- Sticky headers or banners on the page that could cover a dish's buttons (2.4.11), and, for a menu inside its own scrolling box, the same `scroll-padding-block-end` on that box that the menu sets on the document; `--sg-menu-bar-clear` sets the distance.
- The colours the page sets behind the menu, if it overrides the tokens.

## Limits

- The order lives in the page: reload and it is gone. A page that wants more keeps `menu.order` itself.
- Prices are per unit, whole or to the paisa. A dish "per kg" or by weight is not handled: write it as a unit and ask first.
- The ceiling is per dish, not per order.

## Arriving and pressing

- Dishes arrive once, on the tala: each one lands on its own beat of the sixteen-beat teental cycle (130 ms a beat, nothing on the three silent beats). Only the first five wait for a beat; the rest take the fifth's beat, so the list cascades top to bottom and the longest wait is 520 ms however long it is, and the cards are in the accessibility tree from the start (the fade is visual only). The stagger is CSS, with `sibling-index()`; where a browser lacks it, `core/arrive.js` hands each one the same delay. Warm eases in; playful settles on the spring. Quiet gets no stagger, and nothing moves under reduced motion.
- Only arrivals play. A new one that is added later starts again from the first beat, and a sort or a move the reader asked for never replays anything (`data-seen` marks what has arrived).
- A press answers within a frame: no transition on the way in, and it eases back in under 150 ms. Quiet settles 1 px, warm shades the colour toward the ink, playful gives a little (scale 0.97) and lets go on the spring. Reduced motion keeps the colour and drops the movement; a held key does not move anything. The first press on a dish that joins the order confirms with the sound and haptic words, behind the sound switch; the counting after it is quiet.
