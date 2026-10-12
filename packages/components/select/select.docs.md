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

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The caret and the warm pencil rule are CSS or an SVG with `aria-hidden="true"` (`packages/components/field/rule.js`); the native `<select>` named by its `<label>` is all that is exposed. `packages/components/select/select.check.mjs`: "screen readers get a combobox named by its label, with its value". |
| 1.3.1 Info and relationships | Meets | `select.check.mjs` reads the accessibility tree and finds `combobox "Guests"` and `combobox "Room"`, each named by its `<label for>`; the hint is the select's description ("the hint is its description"); the select is still the native element, "not a rebuilt listbox". |
| 1.3.5 Identify input purpose | Meets with author's part | The element leaves the native `autocomplete` attribute alone (`packages/components/select/select.js` reads and sets only `change`, `blur`, `invalid` and `toggle` listeners), so a field about the person, such as a country or a birth month, can say so. The attribute is the author's to add. No check in the repository asserts it. |
| 1.4.1 Use of color | Meets with author's part | The invalid state turns the border to the danger colour and is also set by `aria-invalid`, which the select exposes to assistive technology (`packages/components/select/select.css`, `:user-invalid`). The words that say what is wrong are the author's, in a `<sg-field-note>` or a message linked by `aria-describedby`. The chosen option in the picker is also set by weight and a check or fill, not colour alone. |
| 1.4.3 Contrast (minimum) | Meets | The label and selected value are `--sg-text`, and the danger border is `--sg-danger`, a text role: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: every text role on every surface is 4.5:1 or more"). axe: `tools/axe.mjs --url /packages/components/select/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent in a 320 px wide window (stricter than 200 percent alone), three registers, page width 320, nothing clipped (throwaway Playwright script). The select is sized in `rem` and `em` with `min-block-size`, so it grows with the text: `packages/components/select/select.css`. |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, page width 320, no sideways scroll (throwaway Playwright script). `select.css` sets `inline-size: 100%` and `max-inline-size: 100%`. |
| 1.4.11 Non-text contrast | Meets | The control border is `--sg-rule-strong`, and the focus ring `--sg-focus`: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: focus ring and control borders are 3:1 or more on every surface") for every palette in light and dark. Warm draws its pencil rule in `--sg-text` and playful its stamped edge in `--sg-accent-text`, both text roles at 4.5:1. The caret is `currentColor`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, page width 320 with no sideways scroll (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `packages/components/select/select.check.mjs`: Tab reaches the select, Space opens the picker, the arrows and Enter choose and the picker closes, Escape closes without changing the choice, in each register under reduced motion. In Firefox the arrow keys inside an open picker are not supported by the browser (`unsupportedIn` in the check, a gap in the engine's customizable select, not in the component). |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07: `packages/components/select/select.js` binds no `keydown` and sets no `tabindex`; Tab and Escape behave as for any native select (`select.check.mjs`: "Escape closes the picker without changing the choice", "focus comes back to the select"). |
| 2.4.3 Focus order | Meets | The native `<select>` is the one tab stop, in the page's order, and the drawing takes no focus. `select.check.mjs`: "Tab reaches the first select". |
| 2.4.7 Focus visible | Meets | `packages/components/select/select.css` sets a `:focus-visible` outline in the token focus colour; `tools/touch.check.mjs` Tabs onto the select in each register and requires a focus style. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/select/select.css` uses no `position: fixed` or `sticky` and the open picker is the browser's own top-layer popup. A sticky header or banner the page adds can cover a select that is scrolled to. |
| 2.5.3 Label in name | Meets | The accessible name is the visible `<label>` text: `select.check.mjs` reads `combobox "Guests"` and `combobox "Room"` for those labels. |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07: every select is 44 px tall by 280 px wide in all three registers (throwaway Playwright script on the demo), from `min-block-size: 2.75rem` in `packages/components/select/select.css`. Picker options are 40 px (quiet and warm) and about 38 px (playful chips) tall. No check in the repository asserts target size for the select yet. |
| 3.2.2 On input | Meets | `packages/components/select/select.js` only counts the `change` for the skin; it navigates and submits nothing. `select.check.mjs` chooses values and the form is sent only when the Submit button is pressed ("the form still gets the value"). |
| 3.3.1 Error identification | Meets with author's part | An unchosen `required` select stops the form with the browser's own message (`select.check.mjs`: "no JS: an unchosen required room stops the form"), and `:user-invalid` and `aria-invalid="true"` mark the control. A message sent back by a server, and its words, are the author's. |
| 3.3.2 Labels or instructions | Meets with author's part | The component keeps the native `<label for>` as the name and a hint linked by `aria-describedby` as the description (`select.check.mjs`, "the hint is its description"). The label and hint text are the author's. |
| 4.1.2 Name, role, value | Meets | It is a native `<select>`: `select.check.mjs` finds a combobox with its name and value, and `combobox "Season" [disabled]` for the disabled one. axe: `tools/axe.mjs --url /packages/components/select/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07. |

**The page author owns:**

- The label text, in the language of the page, in a `<label for>` that points at the select, and `lang` on a label or option in another language (3.1.2).
- `autocomplete` on a select that asks about the person (1.3.5).
- The words of an error, in a `<sg-field-note>` or a message linked by `aria-describedby`, whether the browser or the server found it (3.3.1).
- Sticky headers and banners that could cover a select when it takes focus (2.4.11).
- The colours the page sets behind the select, if it overrides the tokens.
