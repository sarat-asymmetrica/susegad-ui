# Ask the house

The Casa Exemplo enquiry form, "A question, or dates we can't show yet?", rebuilt entirely from library parts. It is a prototype: it sends nothing, and it says so before and after you press Send.

It composes:

| Piece | Used for |
|---|---|
| `<sg-form>` | the native form: validation, the summary of problems and focus, and the states ("Sent" and, while real work is pending, "Sending") |
| `<sg-field>` | each ruled line, and the notebook-ruled message |
| `<sg-field-note>` | what is wrong, in the house's own words, and the hint for more than six people |
| `<sg-select>` | how many people: 1 to 6, or "More than 6", which brings the house's answer as a hint ("The house sleeps 6. Tell us more below and we'll see what's possible.") |
| `<sg-combobox>` | where they are travelling from: cities suggested as they type, found by older names and other scripts too ("Bombay", "मुंबई", "Bangalore", "ಬೆಂಗಳೂರು") |
| `<sg-stamp>` | "Not sent · Prototype", when you send (warm and playful) |
| `<sg-loader>`, `<sg-toast-region>` | used by the form when a real send is slow or fails |

## Files

| File | What it is |
|---|---|
| `index.html` | The page. Casa palette by default; `?register`, `?theme` and `?palette` change it. |
| `recipe.js` | The pieces, with no side effects beyond defining the components: `mountEnquiry(sgForm, send)`, `mountGroupHint(select, note)`, the prototype's `answer()`, which sends nothing, and `STRINGS`, the words. Importing it wires nothing. |
| `demo.js` | The demo page's wiring: mounts the prototype answer and the group hint on `index.html`. Your page does this itself, with its own send. |
| `recipe.css` | The page around the form: the heading beside the form on wide screens, the two-column row, the prototype note. |
| `facade.svg` | The house's front elevation as a still line drawing (16 KB), shown under the heading in warm and playful. |
| `facade.scene.mjs`, `facade.bake.mjs` | Where the drawing comes from: the elevation's strokes, and the script that bakes them into `facade.svg` (`node packages/recipes/enquiry/facade.bake.mjs`). Not needed at run time. |
| `sent.html` | Where the form lands without JavaScript. It keeps nothing and says so. |
| `enquiry.check.mjs` | The browser check: keyboard only, the house's messages, nothing leaving the page, and the page in quiet with reduced motion and JavaScript off. |

## The drawing of the house

In warm and playful, the heading column carries the house itself: the front elevation of Casa Exemplo as a still line drawing, gable, oculus, the teak door, the arched windows and the potted plants. It is harvested from the villa redesign's hero drawing (`elevation.js`, where it draws itself in ink over the photograph); here it is the finished linework only, with no photograph, tone or notes, and never moves.

`facade.svg` is a CSS mask, so it needs no JavaScript and takes the register's ink: `--sg-ink` in warm, `--sg-accent-text` in playful, in either theme. It is `aria-hidden`: the page's words already say what the house is. Quiet hides it, and so does forced colours. For another house, draw its strokes in `facade.scene.mjs`'s shape and bake again.

## Without JavaScript

The form is a plain `<form action="./sent.html" method="post">` with native constraints:

- `required` on name and contact;
- a `pattern` on contact that accepts a phone number or an email address, with spaces or hyphens, in ASCII or any Indian numerals (`\p{Nd}`); with JavaScript the digits are written as ASCII as they are typed (`toAsciiDigits` from the OTP's core), so the house always receives 98220 12345;
- people is a `<select>` of 1 to 6 or "More than 6", so it cannot be wrong; more than six is a question for the house, not an error;
- "Where are you travelling from?" is the browser's own `<input list>` with a `<datalist>`.

The browser checks these itself and shows its own messages (with the `title` as the hint for the pattern). A valid enquiry is posted to `sent.html`, a static page that keeps nothing. POST keeps the answers out of the address bar and the server's logs.

## Make it send

Import `recipe.js` and mount your own send. Importing it wires nothing, so the prototype's "Not sent" answer never reaches your form; `demo.js` is only for the demo page.

```js
import { mountEnquiry, mountGroupHint } from './susegad/recipes/enquiry/recipe.js';

mountGroupHint(document.getElementById('f-group'), document.getElementById('f-group-note'));

mountEnquiry(document.querySelector('sg-form.enquiry__form'), async data => {
  const r = await fetch('/enquire', { method: 'POST', body: data });
  if (!r.ok) throw new Error(`the house's inbox answered ${r.status}`);
  return { message: 'Sent. The house will write back within a day.', stamp: 'Sent' };
});
```

Point the form's `action` at the same endpoint, so the page without JavaScript sends too. Then remove the prototype note and `sent.html`. The form shows "Sending" only while your request is pending, then "Sent", or why it could not send, keeping every word the person typed.
