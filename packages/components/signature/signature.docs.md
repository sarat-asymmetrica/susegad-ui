# Signature

`<sg-signature>` lets someone sign by hand or by typing their name. It enhances a typed-name `<input>`, which is the whole control without JavaScript and the keyboard way to sign with it.

## Use

```html
<link rel="stylesheet" href="susegad/components/signature/signature.css">
<script type="module" src="susegad/components/signature/signature.js"></script>

<form method="post" action="/sign">
  <sg-signature>
    <label for="sig">Type your full name to sign</label>
    <input id="sig" name="signature" autocomplete="name" required>
  </sg-signature>
  <button>Sign and send</button>
</form>
```

The form receives two fields:

| Field | Holds |
|---|---|
| `signature` | the typed name, which may be empty if they drew |
| `signature-path` | the drawn ink as SVG path data in a 600 × 200 box, or empty if they typed. Only sent when JavaScript ran. |

To show a drawn signature again, put the path in an SVG:

```html
<svg viewBox="0 0 600 200"><path fill="currentColor" d="…the signature-path value…"/></svg>
```

`element.toSVG('#1d2742')` returns the same as a standalone string.

## What people see and do

- Without JavaScript: the label and a typed-name input on a signing line, set in the hand face. `required` works natively.
- With JavaScript: a line of help ("Sign in the box with your finger, a pen or the mouse. Or type your full name below."), the pad, **Undo last stroke** and **Start again** buttons, then the same label and input.
- Drawing or typing a name both count as signed. If they draw, the pad shows the drawing; if they only type, the pad shows the name in the hand face.
- **Start again** clears the drawing and the name, and puts focus in the name. A form reset clears the drawing too.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `path-name` | the hidden input's `name` | `<input name>-path` |
| `seed` | any string: fixes the playful flourish | `signature` |
| `data-value-missing` | your wording when nothing is signed and the field is required | "Sign in the box, or type your full name." |
| `register` | `quiet`, `warm`, `playful` | inherited |

Put `required`, `disabled` and `autocomplete` on the input as usual. With JavaScript, `required` stays on the input (so screen readers announce it) until there is a drawing, which signs instead; the element then lifts it, and puts it back if the drawing is undone or cleared. While nothing is signed it also sets the input's custom validity to its own words, so native validation, `:invalid` and `<sg-field-note validate>` all still work.

## Properties, methods and events

- `method` (read only): `'drawn'`, `'typed'` or `null`.
- `pathData` (read only): the SVG path data being submitted.
- `strokes`: the raw samples, `[[x, y, timeMs, pressure], …]` per stroke, in pad units. Set it to restore a signature.
- `undo()`, `clear()`, `toSVG(color)`.
- `sg-signature` event, bubbling, `detail: { method, strokes }`, on every change.
- Drawing also fires `input` on the typed-name field, so validation helpers re-check.

## Registers

| | Pad | Ink | Motion |
|---|---|---|---|
| quiet | a plain hairline signing line | a plain pen: width from speed (and a pen's pressure), the same in every direction | none beyond the pen itself |
| warm | a pencilled line with a small cross | a broad nib at 35 degrees: thick downstrokes, hairline joins; fresh ink is glossy and dark and dries into the paper's grain over 1.6 s | the drying |
| playful | as warm, ink in the accent colour | as warm | once the pen rests, a swash underlines the signature and ends in a loop |

Reduced motion lays the ink down dry and shows the flourish without drawing it. What is submitted is always the ink as shown. The flourish is decoration and is never submitted.

## Accessibility

- The typed name is the keyboard and screen-reader way to sign, and a full signature on its own. The help text is linked to it with `aria-describedby`.
- The pad is `aria-hidden`: a drawing can't be read aloud, so its state is said in words in a polite status line ("Signed by drawing. You can undo or start again.", "Signature cleared.").
- Undo and Start again are real `<button type="button">`s and never submit. When Undo removes the last stroke and disables itself, focus moves to the name instead of dropping to the page.
- A disabled input disables the pad and both buttons.
- The pad stops page scrolling only while a finger is on it (`touch-action: none` on the canvas).

## Budget and performance

| File | Bytes |
|---|---|
| `signature.js` + `signature.core.js` (behaviour) | 14.3 KB of 15 KB declared |
| `skins/paint.js` + `skins/marks.js` (shared painter) | 9.6 KB |
| `skins/quiet.js`, `warm.js`, `playful.js` | 0.3 to 0.4 KB each |

Dry strokes are baked once into a cached layer. Only fresh ink is painted again each frame, and only while it dries, and never off screen. Measured at 16.7 ms mean and 16.8 ms worst while drawing three strokes and letting them dry, in every register and at 2× pixel density (headless Chromium, 4 × Intel N100, 86% busy). At rest the pad costs nothing: 0.78× the Paus baseline in the same run.
