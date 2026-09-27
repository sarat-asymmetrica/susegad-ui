# Field note

*The note under a form field that says what is wrong and how to fix it: "Enter an email address like name@example.com."*

It waits until you leave a field you changed, follows your typing once it is showing, and goes the moment the value is right.

```html
<link rel="stylesheet" href="susegad/components/field-note/field-note.css">
<script type="module" src="susegad/components/field-note/field-note.js"></script>

<label for="email">Email</label>
<input id="email" type="email" required>
<sg-field-note for="email" validate></sg-field-note>

<!-- a server's message, shown as written -->
<sg-field-note for="dates">Those dates are booked. The next free nights start on 16 October.</sg-field-note>
```

| Attribute | Values | What it does |
|---|---|---|
| `for` | a field's id | The field it belongs to. Absent: the nearest field before it. |
| `validate` | present or absent | Follow the browser's constraint validation and word the message. Absent: show the text the note holds. |
| `tone` | `error`, `hint` | `hint` is a margin note that never marks the field invalid. |
| `data-value-missing`, `data-type-mismatch`, `data-pattern-mismatch`, … | text | Your wording for one check, beating ours. |

## The prompt

Make an inline error web component, `<sg-field-note for="email" validate>`, that sits under a form field and uses the browser's own constraint validation: required, type, pattern, minlength, maxlength, min, max and step. Choose the message from the first failing check in the order a person should fix things, and word it to say what happened and how to fix it, in the person's terms ("Enter your email.", "Use at least 8 characters. You have 5."), never blaming them. Let the page override any check's wording with a data attribute, and show `setCustomValidity()` messages as they are. Do not show anything while someone types into a field for the first time. Show the note when they leave a field they changed or try to submit, then update it as they type and remove it the moment the value is valid. On a submit, show every note, move focus to the first field with a problem, and keep the other notes silent so they do not all speak at once. While a note shows an error, add its id to the field's `aria-describedby` without removing ids already there, set `aria-invalid="true"` on the field, start the note with a visually hidden "Error:", and make the note a polite live region that exists before any message. Without `validate`, show whatever text the note holds, so a server can render an error. Give it three registers. Quiet: small text in the danger colour with a circled mark, fading in within 120 ms. Warm: a margin note in the hand face, with examples, numbers and addresses set in the body face so a 1 never reads as an l, and a pencil arrow that hooks up into the field, seeded so each arrow is a little different and always the same, drawn in one stroke when the note appears. Playful: the same, inked on as it appears: the arrow is drawn, the words are written left to right, then a wavy line underlines them. Under reduced motion, show it all at once.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| the browser's own constraint validation | native first | The note reads `field.validity` and `validationMessage`. The `invalid` event is cancelled, so the browser's bubble never covers the page, and a form with `novalidate` still gets its notes. |
| the first failing check in the order a person should fix things | ordering | `CHECKS` puts `valueMissing` first, then `badInput`, `typeMismatch` and the rest. `pickMessage()` takes the first that fails. Unit-tested. |
| say what happened and how to fix it | copy | `STRINGS` holds one function per check that uses the field's own limits and label ("Enter a number from 1 to 6.", "Enter your email."). Every string is in one place for the writer. |
| do not show anything while someone types … the first time | state machine | `nextShown()` tracks `dirty` and `shown`: input marks the field dirty; blur shows only a dirty, invalid field; once shown, input follows validity; submit and server messages show at once; reset clears. Unit-tested step by step. |
| move focus to the first field with a problem | focus | On `invalid`, each note checks in a microtask whether its field is the first invalid one in `form.elements` and whether focus is already on a problem. Only then does it focus its field, and only on a submit. |
| keep the other notes silent | live regions | A submit sets `aria-live="off"` on the notes for that update. The focused field reads its own note through `aria-describedby`, and later changes speak politely again. |
| without removing ids already there | ARIA | `tokenList()` adds or removes one id in a space-separated list. The note removes `aria-invalid` only if it set it. |
| examples, numbers, addresses | typography | In the hand face a 1 reads as an l. The warm skin's `valueRuns()` finds email and web addresses and numbers (digits joined by spaces, commas, colons, slashes or dashes) and wraps them in `.sg-field-note__value`, set in the body face with tabular figures. The text itself is unchanged; a test checks nothing is lost. |
| a pencil arrow … seeded | seed | `arrowPath(seed)` in the warm skin makes a cubic curve from the note up to the field, and a two-stroke head that follows the curve's last direction. A Park–Miller generator seeded from the note's id wobbles each point. |
| drawn in one stroke | WAAPI | The dash is set to the path's length and slid to 0: first the shaft, then the head. The animation is cancelled when it finishes. |
| the words are written left to right | clip-path | `clip-path: inset(0 100% 0 0)` to `inset(0)`, with the time scaled to the message's length (up to 0.9 s). |
| a wavy line underlines them | seed | `squiggle(width, seed)` makes quadratic waves to the text's measured width, redrawn when the words change. |
| under reduced motion, show it all at once | still | Every skin checks `ctx.motion === 'still'` and skips its animations. |
