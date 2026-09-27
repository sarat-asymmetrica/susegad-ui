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
