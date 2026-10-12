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

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The error mark and the pencil arrow are `aria-hidden="true"` (`packages/components/field-note/field-note.js`, `mark` and `deco`; the warm and playful skins set it on their drawings). The note's words carry the meaning, with a hidden "Error:" first: `packages/components/field-note/field-note.check.mjs`, "leaving it shows the note, in words, with the tone spoken". |
| 1.3.1 Info and relationships | Meets | The note's id is added to the field's `aria-describedby` (the ids already there are kept) and the field gets `aria-invalid="true"`: `field-note.check.mjs`, "the field points at the note and is marked invalid", "the field keeps the ids it already had in aria-describedby", and "a hint is described but never marks the field invalid". A note written inside the label steps out so it never joins the field's name ("refused: the field's name is just its label"). |
| 1.4.1 Use of color | Meets | The error is words ("Error: Enter an email address like name@example.com.") with a mark beside them; the danger colour is never the only cue (`field-note.check.mjs`, "leaving it shows the note, in words, with the tone spoken"). |
| 1.4.3 Contrast (minimum) | Meets | The note's ink is `--sg-danger` (a hint uses `--sg-text-soft`), both text roles in `packages/tokens/tokens.test.js` ("AA: every text role on every surface is 4.5:1 or more") for every palette and theme. Axe: `tools/axe.mjs --url /packages/components/field-note/demo.html`, 0 violations across 6 runs (3 registers, light and dark), desktop, 2026-10-07. With every note showing (7 on the demo, after a submit and a blur of each field) axe finds 0 violations in all three registers, light and dark (axe-core 4.13.0 run on that state, 2026-10-07). |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and no clipped note (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, no sideways scroll (document width 320). `packages/components/field/field.check.mjs` also covers the note at narrow widths ("<register> at <width>px: the field note wraps inside its field, whole, and no field overflows"). |
| 1.4.11 Non-text contrast | Meets | The error mark is `currentColor` in `--sg-danger`, 4.5:1 or more on every surface in every palette and theme (`packages/tokens/tokens.test.js`, danger is in `textRoles`). It repeats what the words say. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 4.1.2 Name, role, value | Meets | The note has no role of its own to misreport; it names the field's problem through `aria-describedby`, and the field keeps its native name, role and value (`field-note.check.mjs`, "refused: the field's name is just its label"). Axe with JavaScript off: `tools/axe.mjs --no-js --url /packages/components/field-note/demo.html`, 0 violations across 6 runs, 2026-10-07. |
| 4.1.3 Status messages | Meets | The note is a polite live region that starts silent for first-time typing and speaks once when it shows: `field-note.check.mjs`, "a single note is spoken politely", "typing into a field the first time shows nothing", "<register>: the note's words are written once". After a submit it is `aria-live="off"` because focus moves to the first problem and the field reads its own note ("after a submit the notes do not all speak at once"). |

**The page author owns:**

- The words of any message the page writes itself (a server's reason, a hint), in the language of the page, and `lang` on a message in another language (3.1.2).
- Naming the field in the message when it matters ("Enter your departure"); the element takes the name from the label.
- The colours the page sets behind the note, if it overrides the tokens.

## Checks

`node --test packages/components/field-note/field-note.test.js` covers message choice, the showing state machine, `aria-describedby` handling and the seeded arrow. `node packages/components/field-note/field-note.check.mjs` checks the behaviour in Chromium: first-try typing, blur, fixing, submit and focus, silence after a submit, server messages and hints.
