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

### Conformance (WCAG 2.2 AA)

The table adds rows for 2.2.2 and 2.3.1, because the indeterminate and playful drawings loop on their own, which the component's traits in `tools/conformance.core.js` do not ask for.

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The native `<progress>` carries the value and the name; the drawings and the value line are `aria-hidden` (`packages/components/progress/progress.js`, `packages/components/progress/skins/warm.js`, `packages/components/progress/skins/playful.js`), so nothing is read twice. |
| 1.3.1 Info and relationships | Meets | A native `<progress>`, named by the visible label through `aria-labelledby` (`progress.js`); without a label the page's own `aria-label` is left alone. In warm and playful the native bar is visually hidden but stays in the accessibility tree. |
| 1.4.1 Use of color | Meets | The amount is a number ("40%") and the state words ("In progress", "Complete", "Working on it"), as well as the drawn bar, glass or kolam: `packages/components/progress/progress.test.js`, "state: fraction, percent and words". |
| 1.4.3 Contrast (minimum) | Meets | The label and value are `--sg-text` roles on the page surface: `packages/tokens/tokens.test.js` ("AA: every text role on every surface is 4.5:1 or more") for every palette and theme. Axe: `tools/axe.mjs --url /packages/components/progress/demo.html`, 0 violations across 6 runs (3 registers, light and dark), desktop, 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and nothing clipped (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, no sideways scroll (document width 320). |
| 1.4.11 Non-text contrast | Meets | The drawn bar, glass or kolam repeats the number and the words beside it ("40%", "In progress"), so it is not needed to read the amount (`packages/components/progress/progress.js` writes both). Its own contrast against its ground is not asserted by any check in the repository, and was not measured for this table. The focus ring does not apply: the bar takes no focus. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.2.2 Pause, stop, hide | Meets with author's part | A determinate bar moves only when its value changes. The indeterminate state and the playful and warm drawings loop while on screen: manual test, 2026-10-07, `document.getAnimations()` on the demo: none running in quiet, 13 in warm (dots fading over 2.8 s) and 16 in playful, and 0 in every register with `prefers-reduced-motion`. Each skin pauses its loops when the bar is off screen (`packages/components/progress/skins/warm.js` and `packages/components/progress/skins/playful.js`: `ctx.visible ? a.play() : a.pause()`). There is no on-page pause control, so a page that uses the warm or playful register beside content people read for longer than five seconds owns offering the quiet register. |
| 2.3.1 Three flashes or below threshold | Meets | Manual test, 2026-10-07, every looping animation on the playful and warm demos listed by element, property and period: dots of 2 by 2 px fading over 2.8 s (warm), steam strokes 7 by 24 px fading over 3.2 s, and one marching-dash line 71 px tall and no wider than its stroke, every 260 ms (playful). None is a flash of a large area. |
| 4.1.2 Name, role, value | Meets | A native `<progress>` with its value, max and an accessible name; indeterminate when no `value`. Axe with JavaScript off: `tools/axe.mjs --no-js --url /packages/components/progress/demo.html`, 0 violations across 6 runs, 2026-10-07. |
| 4.1.3 Status messages | Meets with author's part | `packages/components/progress/progress.js` has no live region of its own: the native `<progress>` exposes its value to assistive technology, and `sg-progress` fires `sg-complete` when the value reaches the max. Whether a screen reader speaks each change depends on the reader. A page that needs a milestone or the finish announced writes its own status message (for instance when `sg-complete` fires). We have not tested this with a screen reader. |

**The page author owns:**

- The label, in the language of the page, and `lang` on a label in another language (3.1.2).
- Feeding the bar real values: a determinate bar moves only when its value moves.
- Announcing a milestone or the finish, with a status message of the page's own, when that matters (4.1.3).
- A way to turn the loops off, such as offering the quiet register, when a bar sits beside content people read for longer than five seconds (2.2.2).
- The colours the page sets behind the bar, if it overrides the tokens.

## What moves, and why

A determinate indicator moves only when its value changes. Do not feed it a timer or an estimate. If you do not know how far along the work is, leave the value off and use a clear label, or use `<sg-loader>`.

## Credit

The warm kolam is the Kolam scene's own mirror-curve geometry; see that scene for the practice it comes from and who draws it. The cutting-chai glass is harvested from the Susegad sketchbook's chai plate.
