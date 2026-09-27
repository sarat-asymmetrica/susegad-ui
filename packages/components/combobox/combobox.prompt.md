# Combobox

*"Bombay", "मुंबई" and "mum" are all asking for Mumbai.*

An input with suggestions. Without JavaScript it is the browser's own `<input list>` and `<datalist>`. With JavaScript it becomes the ARIA APG editable combobox, and its matching finds places however people type them.

```html
<link rel="stylesheet" href="susegad/components/combobox/combobox.css">
<script type="module" src="susegad/components/combobox/combobox.js"></script>

<sg-combobox>
  <label for="from">Travelling from</label>
  <input id="from" name="from" list="cities" autocomplete="off">
  <datalist id="cities">
    <option value="Mumbai" data-aliases="Bombay, मुंबई">Maharashtra</option>
    <option value="Bengaluru" data-aliases="Bangalore, ಬೆಂಗಳೂರು">Karnataka</option>
  </datalist>
</sg-combobox>
```

## The prompt

Build a combobox as a light-DOM custom element, `<sg-combobox>`, around a native `<input list>` with a visible `<label>` and a `<datalist>`, so that without JavaScript the browser's own suggestions work and the form submits whatever was typed. With JavaScript, follow the ARIA APG editable combobox with list autocomplete: remove the input's `list`, give it `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded` and `aria-controls`, and build a listbox of the datalist's options as a manual popover anchored under the input with CSS anchor positioning. Keep focus in the input and move through the options with `aria-activedescendant`. Down Arrow opens the list and moves to the next option, Up Arrow to the previous, both wrapping; Enter chooses the active option and closes the list, or submits the form when none is active; Escape closes the list, and clears the text if it is already closed; Tab closes without choosing. Never choose for the person, and always keep what they typed. Match the way Indian place names are really typed: fold case and punctuation, strip accents from Latin letters only and leave the vowel signs of Devanagari, Kannada and other scripts alone, match the start of any word, and match aliases from `data-aliases` (older names and other scripts), saying "also Bombay" when an alias matched. Add a looser match for the usual romanisation variants (doubled vowels, aspirates, w for v), ranked below the exact ones. Mark the matched letters, mapping accents back to the original text. Say the number of suggestions in a polite status line once typing settles, only when it changes. Give it three registers. Quiet: a hairline box and list. Warm: write the input on the paper like the field and the select: no box, the field's pencil rule under it, inked from left to right while the input has focus and under the words away from it; a caret of two uneven pencil strokes; the list edged in ink and ruled in pencil between the suggestions, with the active suggestion's name underlined in ink by hand rather than filled. Playful: a stamped box with an off-register ghost, a caret in accent ink with a thick, round nib, and the suggestions as stamped chips. Keep the list's entrance off in quiet and under reduced motion.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| without JavaScript the browser's own suggestions work | progressive enhancement | The `<input list>` and `<datalist>` are real HTML. The element reads the options from the datalist, so the no-JS path and the enhanced path share one list. |
| follow the ARIA APG editable combobox with list autocomplete | accessibility | The input is the combobox and keeps focus. The listbox is controlled by it, labelled by the same label, and the active option is announced through `aria-activedescendant`. |
| a manual popover anchored under the input with CSS anchor positioning | popover API, anchors | The list sits in the top layer, so no container clips it. `anchor-name` on the input and `position-anchor` on the list place it, with `flip-block` when there is no room below. Browsers without anchors get coordinates from JavaScript. |
| Never choose for the person, and always keep what they typed | the person decides | Typing opens the list with nothing selected. Only Enter on an active option or a click chooses. A place not in the list is kept and submitted as typed. |
| strip accents from Latin letters only | Unicode | Text is decomposed (NFD). A combining mark is dropped only when it follows a Latin letter, so "Balcão" folds to "balcao" while "मुंबई" keeps its anusvara and matras. |
| match aliases from `data-aliases` | aliases | Each option can list other names. A match through an alias ranks just below the same kind of match on the name, and the option says which alias matched. |
| a looser match for the usual romanisation variants | folding | aa, ee and oo fold to a, i and u; th, dh, bh, kh, gh, ph and jh lose the h; w folds to v. "Tiruvanantapuram" finds Thiruvananthapuram, one rank below exact matches. |
| mapping accents back to the original text | highlighting | Each character is folded on its own and its position remembered, so the match in the folded text maps back and the `<mark>` wraps "Balcão", not "Balca". |
| Say the number of suggestions in a polite status line | live region | A visually hidden `role="status"` says "2 suggestions" 450 ms after typing stops, and nothing if the number has not changed. |
| the field's pencil rule under it, inked while the input has focus | shared drawing | `ruleUnder()` from `field/rule.js`: the field's graphite `pencilRule()` under the input, with the input's border turned transparent at the same width. On `focus` the ink runs the whole rule, drawn in over 560 ms; on `blur` it shrinks to the typed words, measured with `canvas.measureText`. |
| ruled in pencil between the suggestions … underlined in ink by hand | CSS masks | One hand-drawn stroke as an SVG data URI (`--sg-pencil-line`, `vector-effect: non-scaling-stroke`) is the mask for both: a `::before` on each option but the last, in `--sg-text-soft` at 55%, and a `::after` on the active option's `.sg-combobox__value`, in `--sg-accent-text`, so the underline is exactly as long as the name. The active option has no fill. |
| a caret of two uneven pencil strokes | SVG | `caret()` takes a list of `[d, width]`; warm passes two crossing strokes of 1.9 and 1.5. |
