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

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The drawing pad is `aria-hidden="true"` and a drawing cannot be read aloud, so the typed name carries the signature in words and a status line says what was drawn. `packages/components/signature/signature.check.mjs`: "with JS: a pad (hidden from assistive tech) and help linked to the input", "drawing is announced once, in words". |
| 1.3.1 Info and relationships | Meets | A native `<label>` and `<input>`, with the help text linked by `aria-describedby`; Undo and Start again are real `<button type="button">`s: `signature.check.mjs`, "no JS: the input has its label" and "with JS: one text input, a hidden signature-path, two real buttons that never submit". |
| 1.3.5 Identify input purpose | Meets with author's part | The documented markup puts `autocomplete="name"` on the typed-name input (`packages/components/signature/signature.js`, the usage comment; all three inputs in `demo.html` carry it) and the element leaves it alone. The attribute is the author's to add. No check in the repository asserts it. |
| 1.4.1 Use of color | Meets | State is said in words, not colour: the status line reads "Signed by drawing. You can undo or start again." or "Signature cleared." (`signature.check.mjs`: "drawing is announced once, in words", "undoing the last stroke clears it and says so"); Undo and Start again are disabled, not recoloured, when there is nothing to take away. |
| 1.4.3 Contrast (minimum) | Meets | The typed name is `--sg-ink`, which is the text role in every palette, the help text `--sg-text-soft`, the placeholder `--sg-text-faint` and the buttons `--sg-accent-text`: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: every text role on every surface is 4.5:1 or more"). axe: `tools/axe.mjs --url /packages/components/signature/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent in a 320 px wide window (stricter than 200 percent alone), three registers, page width 320, nothing clipped (throwaway Playwright script). The input and buttons size in `rem` and `em`: `packages/components/signature/signature.css`. |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, page width 320 with no sideways scroll (throwaway Playwright script). The tools row is `flex-wrap: wrap` in `signature.css`. |
| 1.4.11 Non-text contrast | Meets | The signing line and pad border are `--sg-rule-strong`, the button edge is the same, and the focus ring is `--sg-focus`: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: focus ring and control borders are 3:1 or more on every surface"). The drawn ink is `--sg-ink` (the text role) in quiet and warm and `--sg-accent-text` in playful, both 4.5:1 or more. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, page width 320 with no sideways scroll (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | Drawing needs a pointer, so the typed name is the keyboard way to sign, and it signs in full: `packages/components/signature/signature.check.mjs`, "keyboard: typing a name signs" and "keyboard: the typed name submits". Undo and Start again take Tab and Space or Enter. |
| 2.1.2 No keyboard trap | Meets | Manual test: `packages/components/signature/signature.js` binds only pointer events on the canvas and a click on each button; the canvas is not focusable and takes no `tabindex`, so Tab and Shift+Tab pass through the input and the two buttons. |
| 2.4.3 Focus order | Meets | The order is the typed name, then Undo, then Start again. When Undo takes away the last stroke and disables itself, focus moves to the name instead of dropping to the page: `signature.check.mjs`, "focus is not lost when undo disables itself: it moves to the name". |
| 2.4.7 Focus visible | Meets | `packages/components/signature/signature.css` sets a `:focus-visible` outline in the token focus colour on the input and both buttons; `tools/touch.check.mjs` Tabs onto the control in each register and requires a focus style. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/signature/signature.css` uses no `position: fixed` or `sticky` and no overlay. A sticky header or banner the page adds can cover the field or a button when it takes focus. |
| 2.5.3 Label in name | Meets | The input's name is its visible label ("Type your full name to sign", `signature.check.mjs`, "no JS: the input has its label") and each button's name is its visible text: Undo, Start again. |
| 2.5.7 Dragging movements | Meets | Added because drawing is a drag, though this kind of component has no `drag` trait. The typed name is a single-pointer, no-drag way to give the same signature, and it satisfies `required` on its own: `signature.check.mjs`, "keyboard: typing a name signs" and "a drawing satisfies required without a typed name". |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07: in all three registers the Undo and Start again buttons are 128.5 by 44 px and the typed-name input is 44 px tall (throwaway Playwright script on the demo, 1280 px), from `min-block-size: 2.75rem` in `packages/components/signature/signature.css`. The pad itself is a large drawing area. No check in the repository asserts target size for the signature yet. |
| 3.2.2 On input | Meets | Typing and drawing change nothing but the field; Undo and Start again never submit: `signature.check.mjs`, "with JS: one text input, a hidden signature-path, two real buttons that never submit" and "a form reset clears the drawing too". |
| 3.3.1 Error identification | Meets | A form with nothing signed is invalid, and the message says so in words ("Sign in the box, or type your full name."), set on the input with `setCustomValidity`: `signature.check.mjs`, "required: nothing signed is invalid, in our words" and "required: the submit is blocked". With JavaScript off the native `required` stops an empty submit ("no JS: an empty submit is blocked by native validation"). |
| 3.3.2 Labels or instructions | Meets with author's part | The label and the help text linked by `aria-describedby` are the instruction (`signature.check.mjs`, "help linked to the input"). Their wording, and the language of the built-in messages, are the author's. |
| 4.1.2 Name, role, value | Meets | `signature.check.mjs`: a labelled text input, a hidden `signature-path` input, two named buttons, the pad hidden, and a polite status line for the drawing. A disabled field disables the pad and both buttons ("a disabled field cannot be drawn on, and its buttons are disabled"). axe: `tools/axe.mjs --url /packages/components/signature/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07. |

**The page author owns:**

- The label text, in the language of the page, and the error wording through `data-value-missing`. The built-in words (the help line, "Undo", "Start again" and the status lines) are fixed English in `signature.core.js` with no attribute to replace them, so on a page in another language they are a passage in English: mark it with `lang` (3.1.2) or ask for them to be made replaceable.
- `autocomplete="name"` (or the right token) on the typed-name input (1.3.5).
- Sticky headers and banners that could cover the field or a button when it takes focus (2.4.11).
- What the signature means legally, and checking a drawn signature server-side: a drawn path and a typed name are both only what the person gave.

## Budget and performance

| File | Bytes |
|---|---|
| `signature.js` + `signature.core.js` (behaviour) | 14.3 KB of 15 KB declared |
| `skins/paint.js` + `skins/marks.js` (shared painter) | 9.6 KB |
| `skins/quiet.js`, `warm.js`, `playful.js` | 0.3 to 0.4 KB each |

Dry strokes are baked once into a cached layer. Only fresh ink is painted again each frame, and only while it dries, and never off screen. Measured at 16.7 ms mean and 16.8 ms worst while drawing three strokes and letting them dry, in every register and at 2× pixel density (headless Chromium, 4 × Intel N100, 86% busy). At rest the pad costs nothing: 0.78× the Paus baseline in the same run.
