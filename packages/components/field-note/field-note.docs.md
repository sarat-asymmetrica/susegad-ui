# Field note

`<sg-field-note>` is the note under a form field that says what is wrong and how to fix it. It follows the browser's own validation, or shows a message from your server. It never nags while someone is still typing their first try.

## Use

```html
<link rel="stylesheet" href="susegad/components/field-note/field-note.css">
<script type="module" src="susegad/components/field-note/field-note.js"></script>

<label for="email">Email</label>
<input id="email" type="email" required>
<sg-field-note for="email" validate></sg-field-note>

<label for="phone">Phone</label>
<input id="phone" pattern="[0-9 ]{10,12}">
<sg-field-note for="phone" validate data-pattern-mismatch="Use 10 digits, like 98220 12345."></sg-field-note>
<sg-field-note for="phone" tone="hint">We only call about this booking.</sg-field-note>
```

A server can render an error directly, or swap one in with htmx:

```html
<sg-field-note for="dates">Those dates are booked. The next free nights start on 16 October.</sg-field-note>
```

Style the field yourself from `aria-invalid`, which the note sets:

```css
input[aria-invalid="true"] { border-color: var(--sg-danger); }
```

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `for` | the field's id | the nearest field before the note |
| `validate` | follow constraint validation | absent: show the note's own text |
| `tone` | `error`, `hint` | `error` |
| `data-value-missing`, `data-type-mismatch`, `data-pattern-mismatch`, `data-too-short`, `data-too-long`, `data-range-underflow`, `data-range-overflow`, `data-step-mismatch`, `data-bad-input` | your wording for that check | ours |
| `register` | `quiet`, `warm`, `playful` | inherited |

## Methods and events

| | |
|---|---|
| `note.setMessage(text)` | Show a message from the page or a server; empty text clears it. |
| `note.check()` | Check the field now, as a submit would. Returns whether it is valid. |
| `note.shown`, `note.message` | What it shows now. |
| `sg-field-note` | Bubbles on every change: `{ shown, message, field }`. |

## When it shows

1. Typing into a field the first time: nothing.
2. Leaving a field you changed, while it is invalid: the note appears.
3. While it shows: it follows your typing and goes as soon as the value is valid.
4. Trying to submit: every note shows, focus goes to the first problem, and only that one is read aloud.
5. Resetting the form clears every note.

## Registers

| | Look | Motion |
|---|---|---|
| quiet | small text in the danger colour, a circled mark | fades in within 120 ms |
| warm | a margin note in the hand face, a pencil arrow hooked up into the field; examples, numbers and addresses in the body face | the arrow is drawn in one stroke |
| playful | the margin note, underlined with a wavy line | the arrow is drawn, the words written left to right, then the underline |

A `hint` is a margin note in the soft ink, with no arrow. Under reduced motion every register shows the finished note.

## Starting over

A component that empties a field as part of a new choice (a date range starting a new stay empties the departure) dispatches `sg-reset` on the field. The note starts over, as on a form reset: nothing is wrong until the person leaves the field empty or submits.

## Accessibility

- While the note shows an error, its id is in the field's `aria-describedby` (ids already there are kept) and the field has `aria-invalid="true"`. The note removes `aria-invalid` only if it set it.
- A note never sits inside its field's label, where it would become part of the field's name. One written there steps out to just after the label when it connects. The field's name in a message ("Enter your departure.") comes from a copy of the label with notes, hidden text and pictures removed, or from `aria-labelledby` when set.
- The note starts with a visually hidden "Error:", so the tone is heard. The mark and the arrow are decoration (`aria-hidden`).
- The note is a polite live region from the start. After a submit it stays silent for that update, because focus moves to the first problem and the field reads its own note.
- Focus moves only on a submit attempt (to the first problem, as the browser does), never on blur or while typing.
- A note never appears in the middle of a click. Pressing Send blurs the field you were in; if its note appeared then, it would push Send down and the click would miss. While a pointer is down, the note waits until the click has finished.
- A note that is asked to show what it already shows writes nothing, so a screen reader never reads it twice.
- Contrast: the danger colour is 5.1:1 or more on every surface, in every palette and theme.
- In warm and playful the sentence is in the hand, but anything a person must copy (an example, a number, an email or web address) is set in the body face with tabular figures, because in the hand a 1 reads as an l. `valueRuns()` in the warm skin finds them.

## Checks

`node --test packages/components/field-note/field-note.test.js` covers message choice, the showing state machine, `aria-describedby` handling and the seeded arrow. `node packages/components/field-note/field-note.check.mjs` checks the behaviour in Chromium: first-try typing, blur, fixing, submit and focus, silence after a submit, server messages and hints.
