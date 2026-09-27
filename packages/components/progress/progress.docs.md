# Progress

`<sg-progress>` shows how far a piece of work has got: an upload, an import, a long save. It enhances a native `<progress>`, so the value and its meaning stay native. The number is always in words, and the drawing moves only when the value does.

## Usage

```html
<link rel="stylesheet" href="susegad/components/progress/progress.css">
<script type="module" src="susegad/components/progress/progress.js"></script>

<sg-progress label="Uploading photos">
  <progress value="0.4" max="1">40%</progress>
</sg-progress>
```

Set the value from the work itself, never from a timer:

```js
const bar = document.querySelector('sg-progress');
xhr.upload.addEventListener('progress', e => { bar.value = e.loaded / e.total; });
xhr.upload.addEventListener('load', () => { bar.value = 1; });
```

Setting the native element (`progress.value = 0.4`, or the `value` attribute from a server) works the same way. Remove the value (`bar.value = null`) when the amount is not known.

## Attributes, properties and events

| Name | Kind | What it does |
|---|---|---|
| `label` | attribute | The words shown above the bar, which also name it for screen readers. Without a label, give the native `<progress>` its own `aria-label`. |
| `register` | attribute | `quiet`, `warm` or `playful`. Overrides the page's register for this element. |
| `value` | property | The value on the native element, or `null` when indeterminate. Setting `null` removes the value. |
| `value`, `max` | attributes on `<progress>` | As on the native element. `max` defaults to 1; `value="60" max="100"` is 60%. |
| `sg-complete` | event | Fires once when the value reaches the maximum. Bubbles. `detail: { label }`. |
| `sg-skin` | event | Fires when a register's drawing has loaded. |

## Registers

- **Quiet:** the native bar, drawn as a pencil hairline in the ink colour on a rule-coloured track, with the label and "40%" above it. Without a value, a still dotted line and the words "In progress". This is also what shows without JavaScript.
- **Warm:** a small kolam beside the words, drawn exactly as far as the value over a faint dotted guide of what is left. When the value changes, the line eases on to the new value in about 0.4 s and stops. At 100% the loop closes and the dots turn the accent colour (laterite in the Susegad palette); the words say "Done". Without a value, no line is drawn and the dots breathe slowly beside "Working on it".
- **Playful:** a cutting-chai glass that fills with tea to the value, with a small slosh when it rises and steam curling off the top. Without a value, a thin stream pours into the empty glass beside "On its way". The label is set in the hand face.

## Accessibility

- The native `<progress>` is the progressbar. It is named by the visible label through `aria-labelledby`, and screen readers read its value themselves. The number beside the label is `aria-hidden` so it is not read twice.
- In warm and playful the native bar is visually hidden but stays in the accessibility tree. The drawings are `aria-hidden`.
- Without a value, the native element is indeterminate (screen readers say busy) and the visible words say what is happening.
- Nothing moves unless the value changes, except the indeterminate breathing dots and the steam. With reduced motion, every register shows the current value with no animation, and all animation pauses off screen.
- Zero axe violations in quiet, warm and playful, light and dark, desktop and phone.

## What moves, and why

A determinate indicator moves only when its value changes. Do not feed it a timer or an estimate. If you do not know how far along the work is, leave the value off and use a clear label, or use `<sg-loader>`.

## Credit

The warm kolam is the Kolam scene's own mirror-curve geometry; see that scene for the practice it comes from and who draws it. The cutting-chai glass is harvested from the Susegad sketchbook's chai plate.
