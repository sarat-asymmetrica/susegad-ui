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

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The Stamp and Loader that picture a state sit in the form's `aria-hidden` art box (the warm skin gives its stamp `role="none"`, `packages/components/form/skins/warm.js`); the state is said in words in the status line: `packages/components/form/form.check.mjs`, "sent is said politely, in words", "slow work says \"sending\", with a Loader". |
| 1.3.1 Info and relationships | Meets | A native `<form>` with native labels and controls; the element adds a status line and a summary. `form.check.mjs`: "no JavaScript: an empty required field stops the submit", "every field that validates gets a field note". |
| 1.3.5 Identify input purpose | Meets with author's part | `packages/components/form/form.js` never sets or removes `autocomplete`; the author's token stands (the demo sets `autocomplete="name"` and `"email"`). Naming the purpose of a personal-data field is the author's. |
| 1.4.1 Use of color | Meets | Every state is words: "Check 2 fields: Your name, Phone or email.", "Sending your message.", "Sent. ...", "Couldn't send: ... Your words are still in the form." (`form.check.mjs`, "a submit with problems counts and names them", "a failure says what happened and that the words are kept"). The stamp, the loader and the colours repeat the words. |
| 1.4.3 Contrast (minimum) | Meets | The state line is a `--sg-text` role on the page surface: `packages/tokens/tokens.test.js` ("AA: every text role on every surface is 4.5:1 or more") for every palette and theme. Axe: `tools/axe.mjs --url /packages/components/form/demo.html`, 0 violations across 6 runs (3 registers, light and dark), desktop, 2026-10-07, on the demo that shows the ready, problem, sending, sent and failed states. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, all five states, no sideways scroll and nothing clipped (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, all five states, no sideways scroll (document width 320), including the fixed failure toast. |
| 1.4.11 Non-text contrast | Meets | The fields' rules and focus rings are tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js` (`--sg-rule-strong`, `--sg-focus`). The submit button is the page's own. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, all five states, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | Native controls and a native submit: `form.check.mjs`, "no JavaScript: Enter submits a valid form, every field included"; with the element on, the same check presses Enter to submit a form with problems and a slow one (the "a submit with problems counts and names them" and "slow work" steps). The failure toast's close button is a native button. |
| 2.1.2 No keyboard trap | Meets | `packages/components/form/form.js` listens to `submit` and `reset` only; it binds no `keydown` and sets no `tabindex`. After a failed send focus stays where it was (`form.check.mjs`, "focus stays where it was, and the words are still in the form"). |
| 2.4.3 Focus order | Meets | `form.check.mjs`: "focus goes to the first problem, whose note it reads; the summary stays silent"; otherwise the page's own order. |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the submit button and the fields in each register and requires a focus style; the ring colour is tested at 3:1 in `packages/tokens/tokens.test.js`. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | The failure toast is `position: fixed` at the bottom of the viewport. `packages/components/toast/toast.css` publishes the pile's height as `scroll-padding-block-end` on the document and adds a spacer at the end of the page. Manual test, 2026-10-07, 390 by 844 with the toast showing, three registers: 16 Tab presses through every field and button and on to the toast's close button, and none of the fields or buttons is under the toast (0 percent overlap each). The toast's top edge is at y 719, 715 and 692 (quiet, warm, playful) and the lowest field or button ends at y 706, 706 and 684. A page with a taller sticky bar of its own needs its own padding. |
| 2.5.3 Label in name | Meets | Fields keep their native labels as names; the summary names each problem field by its label text (`form.check.mjs`, "Check 2 fields: Your name, Phone or email."). The submit button's visible text is its name. |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07, 390 px touch: every field is 358 px wide and 44.0 px tall, the demo's send buttons 76.1 by 44.0 px, and the failure toast's close button 32.0 by 32.0 px, in all three registers. No check in the repository asserts target size for the form yet. |
| 3.2.2 On input | Meets | The element listens to `submit` and `reset` only (`form.js`); changing a value submits and navigates nothing (`form.check.mjs`, "nothing was submitted" after a problem; the form sends only when Send is pressed). A second submit while sending is ignored ("a second submit while sending is ignored"). |
| 3.3.1 Error identification | Meets | A submit with problems counts and names them, focus goes to the first problem and its field note says what is wrong: `form.check.mjs`, "a submit with problems counts and names them", "every field that validates gets a field note", "the browser bubbles give way to the notes". A failed send says why ("a failure says what happened and that the words are kept"). |
| 3.3.2 Labels or instructions | Meets with author's part | The native labels stay, each paired with its field by `for` (`packages/components/form/demo.html`); the form adds the state words. The label text, required marks and any format hints are the author's. |
| 4.1.2 Name, role, value | Meets | While sending the button keeps focus and carries `aria-disabled="true"`, the form `aria-busy` (`form.check.mjs`, "slow work says \"sending\" ... and the button says it is busy"). Axe with JavaScript off: `tools/axe.mjs --no-js --url /packages/components/form/demo.html`, 0 violations across 6 runs, 2026-10-07. |
| 4.1.3 Status messages | Meets | One polite status line says each state once: sent, sending and the problem count; the summary is silent because focus moves to the first problem, and a failure is spoken by its alert toast, not by the line (`form.check.mjs`: "sent is said politely, in words" `live=polite`; "the failure is also an error toast (an alert), said once"; "the summary stays silent" `live=off`). |

**The page author owns:**

- The label text, required marks and format hints, in the language of the page, and `lang` on text in another language (3.1.2).
- `autocomplete` on fields that hold personal data (1.3.5).
- The words of each answer the server gives (`respondWith`), and what to do when sending fails.
- Sticky headers or banners of the page's own, which could cover the focused control (2.4.11).
- The colours the page sets behind the form, if it overrides the tokens.

## Checks

`node --test packages/components/form/form.test.js` covers the state machine, the words and the summary. `node packages/components/form/form.check.mjs` checks the page without JavaScript (blocked when invalid, submitted when valid), keyboard submits, notes and focus, the silent summary, no loader for quick work, the loader for slow work, the ignored second submit, failure with its toast, reset, native submission with no handler, and `fetch`.

## Growing and pressing

A bare textarea in a form grows with what is typed, to a ceiling (`field-sizing: content`). The submit button shades or settles under a press as the register says, and a successful submit confirms with the sound and haptic words, behind the sound switch.
