# Select

`<sg-select>` wraps the browser's own `<select>` and leaves it native. People get the keyboard and screen-reader behaviour they already know, the form gets its value with or without JavaScript, and the page gets a select drawn in its register.

## Usage

```html
<link rel="stylesheet" href="susegad/components/select/select.css">
<script type="module" src="susegad/components/select/select.js"></script>

<sg-select>
  <label for="guests">Guests</label>
  <select id="guests" name="guests">
    <option>1</option><option selected>2</option><option>3</option>
  </select>
</sg-select>
```

Everything a select can do still works: `required`, `disabled`, `<optgroup>`, `lang` on an option, `aria-describedby` for a hint. Put a `<p>` hint after the select and point `aria-describedby` at it.

## Attributes and events

| Name | Kind | What it does |
|---|---|---|
| `register` | attribute | `quiet`, `warm` or `playful`. Overrides the page's register for this element. |
| `change`, `input` | events on the `<select>` | The browser's own. The element adds none of its own for a choice. |
| `sg-skin` | event | Fires when a register's look has loaded. |

## Registers

- **Quiet:** a hairline box with a plain chevron. The list is a raised panel with a checkmark on the chosen option. Only the chevron moves, turning as the list opens. Without JavaScript, this is what shows.
- **Warm:** written on the paper like the field: no box, a pencil rule drawn by hand under the select (the field's own, from `field/rule.js`), a caret of two uneven pencil strokes, a list edged in ink, and the chosen option underlined in the accent colour. When the person makes a choice, ink runs over the rule as far as the chosen words go, drawn in over about half a second. A value the page arrived with is not inked. The rule measures about 6:1 against the page in light and 8:1 in dark.
- **Playful:** a stamped box, its edge in accent ink with an off-register ghost, and a thick, round accent caret. The options are stamped chips, slightly tilted, wrapping in the picker, and the chosen one is filled. A choice lands on the control with a small press.

Browsers without customizable select (`appearance: base-select`) show their own select with the hairline border in every register.

## Accessibility

- The `<select>` is the control: a combobox named by its `<label>`, with its own listbox, keyboard (Space or Enter opens it, arrows move, Enter chooses, Escape closes, typing jumps) and form value.
- The drawn parts are CSS or `aria-hidden` SVG. Nothing is added to the accessibility tree.
- The target is at least 44 pixels high, and the focus ring is the token focus colour.
- `:user-invalid` turns the border (the pencil rule in warm) to the danger colour after the person has tried, and so does `aria-invalid="true"`, for an error a server sends back. Pair it with `<sg-field-note>`, or a message linked by `aria-describedby`, for the words. The demo shows a chosen value and a wrong one.
- With reduced motion, every transition is off.
- `select.check.mjs` checks the no-JavaScript form, the keyboard, the screen-reader tree and every register under reduced motion. Zero axe violations in every register, light and dark.
