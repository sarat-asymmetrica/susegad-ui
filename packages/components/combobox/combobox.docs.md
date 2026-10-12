# Combobox

`<sg-combobox>` is a text input that suggests values as people type, for places, names and anything else with a known list and room for something new. It starts as the browser's own `<input list>` and `<datalist>`, and becomes the ARIA APG editable combobox when JavaScript runs.

## Usage

```html
<link rel="stylesheet" href="susegad/components/combobox/combobox.css">
<script type="module" src="susegad/components/combobox/combobox.js"></script>

<sg-combobox>
  <label for="from">Travelling from</label>
  <input id="from" name="from" list="cities" autocomplete="off" required>
  <datalist id="cities">
    <option value="Mumbai" data-aliases="Bombay, मुंबई">Maharashtra</option>
    <option value="Panaji" data-aliases="Panjim, पणजी">Goa</option>
  </datalist>
</sg-combobox>
```

- The option's `value` is what goes into the input and the form. Its text (here the state) is shown beside it as a hint, and can be matched too.
- `data-aliases` lists other names, comma-separated: an older name, a spelling people use, the name in another script.
- Add `lang` to an option whose value is not English, so a screen reader pronounces it well.
- The value is whatever the person types. The list only suggests. To insist on a listed value, validate it on the server, or with `setCustomValidity()` and `<sg-field-note>`.

## Attributes, properties and events

| Name | Kind | What it does |
|---|---|---|
| `register` | attribute | `quiet`, `warm` or `playful`. Overrides the page's register for this element. |
| `open` | property | Whether the suggestions are showing. |
| `suggestions` | property | The values on show, best first. |
| `toggle()` | method | Open or close the suggestions (the caret does this for a pointer). |
| `sg-choose` | event | A suggestion was chosen. `detail: { value }`. The input also fires `input` and `change`, as typing would. |
| `sg-skin` | event | Fires when a register's look has loaded. |

## Matching

- Case, punctuation and extra spaces are ignored.
- Accents are ignored on Latin letters: "Balcao" finds "Balcão", "Sao Jacinto" finds "São Jacinto". Devanagari, Kannada and other scripts keep their vowel signs, because there they are letters.
- A match at the start of the name ranks first, then at the start of any word ("goa" finds "Old Goa"), then an alias ("Bombay", "मुंबई"), then a looser spelling match ("Tiruvanantapuram" finds Thiruvananthapuram), then three or more letters inside a word.
- Equally good matches keep the order of your datalist.

## Keyboard

| Key | What it does |
|---|---|
| Typing | Filters the suggestions and opens the list. Nothing is chosen for you. |
| Down Arrow | Opens the list, or moves to the next suggestion (from the last, back to the first). Alt+Down opens without moving. |
| Up Arrow | Opens the list at the last suggestion, or moves to the previous one. |
| Enter | Chooses the highlighted suggestion. With none highlighted, submits the form as usual. |
| Escape | Closes the list. With the list closed, clears the text. |
| Tab | Closes the list and moves on, keeping what was typed. |
| Left, Right, Home, End | Back to editing the text. |

## Registers

- **Quiet:** a hairline input with a plain chevron, and a raised list with a bar beside the highlighted suggestion. The list appears without motion. Without JavaScript, the input keeps this look and the suggestions are the browser's own.
- **Warm:** written on the paper like the field: no box, a pencil rule under the input (the field's own, from `field/rule.js`) that inks from left to right while you type in it, and stays inked under the words when you leave. A caret of two uneven pencil strokes. The list is edged in ink and ruled in pencil between suggestions; the highlighted suggestion's name is underlined in ink by hand, not filled. The list unfurls in about a quarter of a second.
- **Playful:** a stamped box with an off-register ghost and a thick, round accent caret; suggestions are stamped chips, slightly tilted, and the highlighted one is filled. A choice lands on the input with a small press.

An input that is `:user-invalid`, or carries `aria-invalid="true"` for an error a server sends back, shows its edge (or its pencil rule, in warm) in the danger colour. Link the words with `aria-describedby`. The demo shows a filled-in value and a wrong one.

## Accessibility

- Follows the ARIA APG editable combobox with list autocomplete. Focus stays in the input; the highlighted suggestion is announced through `aria-activedescendant`, and the listbox is labelled by the input's label.
- A polite status line says how many suggestions there are ("2 suggestions", "No suggestions") once typing settles, and only when the number changes.
- The chevron is `aria-hidden`: the arrow keys do what it does.
- The input is at least 44 pixels high, the suggestions at least 40.
- With reduced motion, the list's entrance and the chevron's turn are off.
- `combobox.check.mjs` checks the no-JavaScript form, every key above, the screen-reader tree, matching across scripts, and every register under reduced motion. Zero axe violations in every register, light and dark.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The chevron is `aria-hidden` (the arrow keys do what it does), and the warm pencil rule and caret are drawn behind the input (`packages/components/combobox/combobox.check.mjs`: "warm rests on a pencil rule with no box, and the caret is two pencil strokes"). The suggestions are text. |
| 1.3.1 Info and relationships | Meets | A native `<label for>` and `<input>`, which becomes `role="combobox"` with `aria-autocomplete="list"`, `aria-expanded` and `aria-controls` a `role="listbox"` named by the label. `combobox.check.mjs`: "the input becomes a combobox with a list popup", "it controls a listbox named by the label", and the accessibility tree reads `combobox "Travelling from" [expanded]` and `listbox "Travelling from"`. |
| 1.3.5 Identify input purpose | Meets with author's part | The component leaves the input's `autocomplete` alone (`packages/components/combobox/combobox.js` never sets it). The demo writes `autocomplete="off"` because its fields are not the reader's own address. A combobox that collects the reader's own city, state or country owns the matching `autocomplete` token. |
| 1.4.1 Use of color | Meets | The active suggestion is shown by a fill in quiet and an underline in warm (`combobox.check.mjs`: "warm: focus inks the rule; the active suggestion is underlined in ink, not filled") and is also the one named by `aria-activedescendant`; matched letters are marked with `<mark>`, not colour alone ("the matched letters are marked, accents and all"). |
| 1.4.3 Contrast (minimum) | Meets | Text is `--sg-text` and `--sg-text-soft`, tested at 4.5:1 or more on every surface in `packages/tokens/tokens.test.js`. `tools/axe.mjs --url /packages/components/combobox/demo.html`: 0 violation(s) across 6 run(s) (three registers, light and dark, desktop), 2026-10-07, and with the list open (axe-core, WCAG 2.2 AA tags, three registers, light): 0 violations, with `color-contrast` listed to review by hand. |
| 1.4.4 Resize text | Meets | `packages/components/combobox/combobox.check.mjs`: "<register>, 200% root font size, 1280x800: the list fits the viewport and the active option is on screen at every step" types "m" and walks ArrowDown through all five suggestions in quiet, warm and playful, in Chromium, WebKit and Firefox. It failed before the fix in quiet and warm (the fifth option at 751 to 831 px in an 800 px viewport); now the list ends at 792 px. `combobox.js` caps the list's height at the room on the roomier side of the input (`--sg-combobox-room` in `combobox.css`), so a long list scrolls inside itself. No text is clipped or scrolled sideways at 200 percent (manual test, 2026-10-07, throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test at 320 CSS px, three registers, 2026-10-07: no sideways scroll with the list open; the list is 288 px wide inside the 16 px margins and every option is in view (throwaway Playwright script). |
| 1.4.11 Non-text contrast | Meets | The input border and the list border are `--sg-rule-strong` and the focus ring is `--sg-focus`, tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected with the list open, three registers, no clipped or overlapping text and every option still readable (throwaway Playwright script). No check in the repository asserts it yet. |
| 1.4.13 Content on hover or focus | Not applicable | The list opens when the reader types, presses an arrow key or clicks the input or the caret (`combobox.check.mjs`: "typing opens the list", "a pointer can open the list and choose"), not when the pointer hovers or focus lands. |
| 2.1.1 Keyboard | Meets | `combobox.check.mjs`: Tab reaches the input, typing opens the list, Down and Up Arrow move (wrapping), Enter chooses and closes, Escape closes and keeps the text, Escape again clears it, and a place that is not in the list is kept. |
| 2.1.2 No keyboard trap | Meets | `combobox.check.mjs`: "Tab closes the list and moves on without choosing"; Escape closes it. |
| 2.4.3 Focus order | Meets | Focus stays in the input while the suggestions are browsed (`aria-activedescendant`), and Tab goes on to the next control (`combobox.check.mjs`: "Down Arrow moves to the first option, focus stays in the input", "Tab closes the list and moves on"). |
| 2.4.7 Focus visible | Meets | The input shows its focus ring in every register (`tools/touch.check.mjs`). The active option, named by `aria-activedescendant`, stays on screen at a 200 percent root font size: the same check as 1.4.4 asserts its box is inside the viewport and inside the list at each ArrowDown step, in all three registers (`packages/components/combobox/combobox.check.mjs`). |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test, 2026-10-07: nothing the component draws covers the input, and the list sits below it in the top layer (`position: fixed` in `packages/components/combobox/combobox.css`), so it covers other page content but never the focused input. A sticky bar the page adds can cover the input when it is scrolled to. |
| 2.5.3 Label in name | Meets | The input is named by its visible label (`combobox.check.mjs`: `combobox "Travelling from"`), and each option's name is its text. |
| 2.5.8 Target size (minimum) | Meets | The input is at least 2.75rem (44 px) high and an option at least 2.5rem (40 px) (`packages/components/combobox/combobox.css`). Manual test, 2026-10-07: options measure 278 by 40 px in quiet and warm and 141 to 197 by 41 px in playful at 320 px, and no focusable control is under 24 by 24 px at 1280 px or at 390 px (throwaway Playwright script). |
| 3.2.2 On input | Meets | Typing and arrowing change the list and the status line and nothing else. Choosing an option fills the input and closes the list, and the form submits only when the reader presses Enter again or the page's own button (`combobox.check.mjs`: "Enter chooses the option and closes the list", "a place not in the list is kept, and Enter submits the form"). |
| 3.3.1 Error identification | Meets with author's part | `required` is the native attribute: `combobox.check.mjs`: "no JS: an empty required city stops the form". The demo shows an invalid field with `aria-invalid="true"` and `aria-describedby` pointing at a sentence that names the field and offers the valid choices ("There is no airport called Gova. Choose one from the list: Mopa (GOX) or Dabolim (GOI)"); that markup and wording are the page's, since the component does not validate. |
| 3.3.2 Labels or instructions | Meets with author's part | The native `<label for>` is the name and `aria-describedby` can point at a hint (`combobox.check.mjs`: "it controls a listbox named by the label"). The label and hint words are the author's. |
| 4.1.2 Name, role, value | Meets | `combobox.check.mjs`: role, `aria-expanded`, `aria-activedescendant` and `aria-selected` follow the state, and the tree reads `combobox "Travelling from" [expanded]` with `option`s. axe: 0 violations, closed and open, 2026-10-07. |
| 4.1.3 Status messages | Meets | A polite `role="status"` line says how many suggestions there are once typing settles, and only when the number changes (`combobox.check.mjs`: "the number of suggestions is said politely, once", "2 suggestions"). |

**The page author owns:**

- The label, hint and error words, in the language of the page, and `lang` on an option list in another language (3.1.2).
- The error markup: `aria-invalid` and an `aria-describedby` sentence that says what is wrong and what is valid (3.3.1).
- The `autocomplete` token on a field that collects the reader's own details (1.3.5).
- Sticky headers and banners that could cover the input when it takes focus (2.4.11).
- The colours the page sets behind the input, if it overrides the tokens.
