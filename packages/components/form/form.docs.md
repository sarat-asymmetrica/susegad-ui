# Form

`<sg-form>` wraps a native `<form>`. Without JavaScript, the browser validates and submits it. With JavaScript, every field says what is wrong in its own note, a submit with problems says how many and focuses the first, and a good submit says "Sending", then "Sent" or why it could not send.

## Use

```html
<link rel="stylesheet" href="susegad/components/form/form.css">
<link rel="stylesheet" href="susegad/components/field/field.css">
<link rel="stylesheet" href="susegad/components/field-note/field-note.css">
<link rel="stylesheet" href="susegad/components/loader/loader.css">
<link rel="stylesheet" href="susegad/components/stamp/stamp.css">
<link rel="stylesheet" href="susegad/components/toast/toast.css">
<script type="module" src="susegad/components/field/field.js"></script>
<script type="module" src="susegad/components/form/form.js"></script>

<sg-form>
  <form action="/enquire" method="post">
    <sg-field><label for="name">Your name</label><input id="name" name="name" required></sg-field>
    <sg-field><label for="contact">Phone or email</label><input id="contact" name="contact" required></sg-field>
    <button>Send</button>
  </form>
</sg-form>
```

Keep `novalidate` out of the markup: the element sets it when it runs, so the page without JavaScript keeps the browser's validation.

## Sending

The form fires `sg-submit` on a valid submit. You choose who sends it:

```js
form.addEventListener('sg-submit', e => {
  e.detail.respondWith(
    fetch('/enquire', { method: 'POST', body: e.detail.formData }).then(r => {
      if (!r.ok) throw new Error(`the server answered ${r.status}`);
      return { message: 'Sent. We will write back within a day.', stamp: 'Sent' };
    }),
  );
});
```

- `respondWith(promise)`: the form follows the promise. Resolve with `{ message, stamp, detail, tone, reset }` (all optional); reject with an `Error` whose message says what happened in plain words ("the server answered 503").
- The `fetch` attribute: the form posts itself to its `action` with its `method` and stays on the page. A JSON answer can carry the same `{ message, stamp, detail, tone, reset }`, and a `text/plain` answer becomes the message.
- Neither: the browser submits as usual, and the form says "Sending" until the page moves on.

## Attributes, events, properties

| | |
|---|---|
| `fetch` | post to `action` and stay on the page |
| `notes="off"` | do not add field notes to fields without one |
| `register` | `quiet`, `warm`, `playful` (inherited) |
| `sg-submit` | `{ formData, submitter, respondWith(promise) }` on a valid submit |
| `sg-form-state` | `{ state, words }` on each change |
| `form.status` | `idle`, `invalid`, `sending`, `sent`, `failed` |
| `data-state` | the same, on the element, for your CSS |
| `data-summary-name` (on a field) | a short name for the summary of problems, when the label is a whole sentence: `<input type="checkbox" name="rules" required data-summary-name="House rules">` gives "Check 1 field: House rules." |

## States

| State | Words (warm) | Drawn (warm and playful) |
|---|---|---|
| invalid | "Check 2 fields: Your name, Phone or email." Focus goes to the first; not read aloud | nothing |
| sending | "Sending your message." Only if the work takes more than 150 ms | a Loader |
| sent | the answer's message, or "Sent. Thank you." (always shown) | a Stamp: its word ("Sent") and the answer's short `detail` |
| failed | "Couldn't send: what happened. Your words are still here; try again when you're ready." | nothing; an error toast says it |

Quiet uses the same states with plainer words ("Sending.", "Sent.") and draws nothing. Resetting the form returns it to idle.

A successful submit plays `confirm` through the sound switch (`packages/sound`); a failed one already gets its sound from the error toast it raises, so the form does not also play one.

## Accessibility

- Without JavaScript, the browser's own validation and submission work unchanged.
- Each state is said once, in one polite status line. The summary of problems is not read aloud, because focus moves to the first problem and the field reads its own note. A failure is not read by the line, because its toast is an alert.
- While sending, the button keeps its focus and has `aria-disabled="true"`, and the form has `aria-busy`. A second submit is ignored.
- Words typed are never cleared unless the answer asks for it.

## Checks

`node --test packages/components/form/form.test.js` covers the state machine, the words and the summary. `node packages/components/form/form.check.mjs` checks the page without JavaScript (blocked when invalid, submitted when valid), keyboard submits, notes and focus, the silent summary, no loader for quick work, the loader for slow work, the ignored second submit, failure with its toast, reset, native submission with no handler, and `fetch`.
