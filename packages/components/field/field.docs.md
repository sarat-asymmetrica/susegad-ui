# Field

`<sg-field>` is a label over a ruled line, for a line of text (`<input>`), a longer message (`<textarea>`) or a choice from a list (`<select>`). The native control does all the work; the element adds the ink and a character count.

## Use

```html
<link rel="stylesheet" href="susegad/components/field/field.css">
<script type="module" src="susegad/components/field/field.js"></script>

<sg-field>
  <label for="name">Your name</label>
  <input id="name" name="name" required autocomplete="name">
  <sg-field-note for="name" validate></sg-field-note>
</sg-field>

<sg-field>
  <label for="code">Booking code</label>
  <input id="code" name="code" maxlength="12">
</sg-field>

<sg-field>
  <label for="msg">Anything else</label>
  <textarea id="msg" name="message" rows="4"></textarea>
</sg-field>

<sg-field>
  <label for="room">Room</label>
  <select id="room" name="room">
    <option value="">Choose a room</option>
    <option value="garden">Garden room</option>
    <option value="loft">Loft</option>
  </select>
</sg-field>
```

A select stays the native select: it opens, types ahead, validates and submits as the browser does. The rule sits under it as under an input, with a small chevron to show it opens; in warm and playful the ink runs under the chosen option, and nothing until one is chosen. Where customizable select (`appearance: base-select`) is supported, ArrowDown on a closed select opens the picker rather than cycling the value, as sg-select does; elsewhere the browser's own behaviour stays. A field with none of these controls inside stays plain light DOM and draws nothing.

Hints go between the label and the control, linked with `aria-describedby`:

```html
<sg-field>
  <label for="phone">Phone</label>
  <p class="hint" id="phone-hint">We only call about this booking.</p>
  <input id="phone" name="phone" aria-describedby="phone-hint">
</sg-field>
```

## Without JavaScript

`field.css` styles the native label and control directly, so a page without JavaScript shows the same ruled line and the form submits as usual. Link a `<label for>` to its control yourself for that path; the element links a label without `for` only when it runs.

## Attributes

`<sg-field>` itself takes only `register`. Everything else belongs on the control: `required`, `type`, `maxlength`, `pattern`, `autocomplete`, `inputmode`.

| Set by the element | When |
|---|---|
| `data-filled` | the control has text, or a select has a chosen value |
| `data-kind` | `line` (an input or a select) or `area` |
| `data-skin` | the mounted skin's register |

## Registers

| | Look | Motion |
|---|---|---|
| quiet | a hairline rule under a faint writing strip; a textarea ruled like a notebook | none |
| warm | written on the paper itself: no well, a pencil rule drawn by hand and a little past both ends, inked over as far as your words go; a textarea gets a laterite margin like an exercise book | the focused field's rule inks from left to right over 560 ms, the one thing on the page that moves; the words' ink changes only when the words do |
| playful | the same drawing in accent ink with a thicker nib, on the writing well, with a double margin down a textarea; the ink wobbles twelve times a second while you type | the focus ink runs in over 420 ms; the wobble settles 0.6 s after you stop; none under reduced motion |

## Accessibility

- It is a native label and control, so keyboard, screen readers, autofill and validation behave exactly as they do without the element.
- An error (`aria-invalid="true"`, set by the field note) thickens the rule and turns it, and the ink, to the danger colour. The note says what is wrong in words.
- The rule meets 3:1 against the page (`--sg-rule-strong`); focus shows the library's focus ring. The drawn rules are stronger: measured at 1x in the demo, the warm pencil (text ink under paper grain) is about 6:1 in light and 8:1 in dark along most of its length, and 4.5:1 at its weakest tenth; the playful ink about 5:1 in both.
- Under reduced motion the focus ink is simply there, with no draw-in. In forced colours the drawing goes and the system's own rule comes back.
- With a `maxlength`, the count appears in the last fifth (or the last 10 characters). It is read aloud only at 20, 10 and 0 left.
- The ink is `aria-hidden`, ignores the pointer, and never covers the words.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The drawn rule and ink are `aria-hidden="true"` and carry no meaning: `packages/components/field/field.check.mjs`, "the ink is hidden from assistive technology". |
| 1.3.1 Info and relationships | Meets | A native `<label>` over a native `<input>`, `<textarea>` or `<select>`. `field.check.mjs`: "a label without `for` is linked to its field", and without JavaScript "a label with `for` still focuses its field". |
| 1.3.5 Identify input purpose | Meets with author's part | `packages/components/field/field.js` never sets or removes `autocomplete`, so the author's token stands (the demo sets `autocomplete="name"`). Naming the purpose of a personal-data field is the author's. |
| 1.4.1 Use of color | Meets | An invalid field thickens its rule and ink as well as turning them to the danger colour (`packages/components/field/field.css`, `[aria-invalid="true"]`), and the note beside it says what is wrong in words (`packages/components/field-note/field-note.check.mjs`, "leaving it shows the note, in words, with the tone spoken"). |
| 1.4.3 Contrast (minimum) | Meets | Label, value and count are `--sg-text` and `--sg-text-soft`; placeholder is `--sg-text-faint`. `packages/tokens/tokens.test.js` ("AA: every text role on every surface is 4.5:1 or more") for every palette and theme. Axe: `tools/axe.mjs --url /packages/components/field/demo.html`, 0 violations across 6 runs (3 registers, light and dark), desktop, 2026-10-07. Axe leaves `color-contrast` for hand review there (the ink sits behind the control), so it was read by hand: the label and value are 12.65:1 in light and 14.16:1 in dark (11.36:1 and 15.27:1 on the sunk fill in quiet and playful), painted colours read from the demo in all three registers. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and no clipped label, value or note (throwaway Playwright script). Sizes are in `rem`, and the control's height is `min-block-size: 2.75rem` in `packages/components/field/field.css`. |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, no sideways scroll (document width 320). `field.check.mjs`: "<register> at <width>px: the field note wraps inside its field, whole, and no field overflows". |
| 1.4.11 Non-text contrast | Meets | The rule that bounds the control is `--sg-rule-strong`, and the focus ring is `--sg-focus`: `packages/tokens/tokens.test.js` asserts both 3:1 or more on every surface for every palette and theme. The drawn warm and playful rules are stronger than that (measured in the Accessibility notes above). |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `field.check.mjs`: "Tab reaches the field and typing goes in". The control is native, so Tab, arrows and the select's own keys are the browser's. |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07: `packages/components/field/field.js` listens to `input`, `change`, `focus` and `blur` only, binds no `keydown` and sets no `tabindex`; Tab and Shift+Tab leave the control as they do a native one. |
| 2.4.3 Focus order | Meets | The native control keeps its place in the page's order; the drawing is `aria-hidden` and takes no focus (`field.js` sets no `tabindex`). |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the control in each register and requires a focus style; `packages/components/field/field.css` draws a `:focus-visible` ring in `--sg-focus`, and the warm and playful skins ink the whole rule (`field.check.mjs`, "warm: focus inks the whole rule, drawn in from the left"). |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test, 2026-10-07: `packages/components/field/field.css` uses no `position: fixed` or `sticky`, and a document scan of the demo found none. A sticky header or banner the page adds can cover a field that is scrolled to. |
| 2.5.3 Label in name | Meets | The accessible name is the visible label: `field.check.mjs` finds the control by its label text ("Your name") in each register. |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07, 390 px touch: every input, select and textarea in the demo is 358 px wide and 44.0 px or more tall in all three registers (`min-block-size: 2.75rem`), and the buttons beside them 44.0 px. No check in the repository asserts target size for the field yet. |
| 3.2.2 On input | Meets | `field.js` only redraws the ink and count on `input`, `change`, `focus` and `blur`; it moves no focus and submits nothing (code read, 2026-10-07). `field.check.mjs` types into fields with the page staying put. |
| 3.3.1 Error identification | Meets with author's part | The field shows an invalid state (`aria-invalid="true"`) and keeps its note beside it; the words of the error come from `sg-field-note` or the page. `packages/components/field-note/field-note.check.mjs`: "a valid value clears the note and both attributes at once", "the field points at the note and is marked invalid". A field with no note and no page message shows the state and says nothing in words. |
| 3.3.2 Labels or instructions | Meets with author's part | The component keeps the native `<label>` as the name and shows a count near a `maxlength` (`field.check.mjs`, "the count shows in the last stretch of a maxlength"). The label text and any format hint are the author's. |
| 4.1.2 Name, role, value | Meets | The control is native, named by its label, with its own value and state. Axe with JavaScript off: `tools/axe.mjs --no-js --url /packages/components/field/demo.html`, 0 violations across 6 runs, 2026-10-07. |

**The page author owns:**

- The label text, in the language of the page, and any hint about the format (3.3.2).
- `autocomplete` on a field that holds personal data (1.3.5).
- The words of every error, through `sg-field-note` or the page (3.3.1).
- `lang` on a label or value in another language (3.1.2).
- Sticky headers and banners that could cover a field when it takes focus (2.4.11).
- The colours the page sets behind the field, if it overrides the tokens.

## Checks

`node --test packages/components/field/field.test.js` covers the ink geometry, the pencil rule, the focus timing, the boil, line reading and the count. `node packages/components/field/field.check.mjs` checks keyboard use, the pencil rule at rest, the margin, the focus ink, the ink's length, the count, the textarea, reset, the playful wobble (and its absence under reduced motion) and the page without JavaScript in Chromium.

## Growing

A textarea grows with what is typed (`field-sizing: content`), from four ruled lines up to fourteen, and then scrolls inside itself. The drawn rules follow its height. A browser without `field-sizing` keeps the rows it was given. A select shades under a press.
