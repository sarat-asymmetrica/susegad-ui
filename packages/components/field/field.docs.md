# Field

`<sg-field>` is a label over a ruled line, for a line of text (`<input>`) or a longer message (`<textarea>`). The native control does all the work; the element adds the ink and a character count.

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
```

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
| `data-filled` | the control has text |
| `data-kind` | `line` or `area` |
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

## Checks

`node --test packages/components/field/field.test.js` covers the ink geometry, the pencil rule, the focus timing, the boil, line reading and the count. `node packages/components/field/field.check.mjs` checks keyboard use, the pencil rule at rest, the margin, the focus ink, the ink's length, the count, the textarea, reset, the playful wobble (and its absence under reduced motion) and the page without JavaScript in Chromium.
