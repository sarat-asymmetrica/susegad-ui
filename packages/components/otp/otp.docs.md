# One-time code

`<sg-otp>` is the box you type a one-time code into. It enhances one `<input>`, which stays the only control: it submits with the form, takes the phone's code-from-messages suggestion and password managers, and works without JavaScript.

## Use

```html
<link rel="stylesheet" href="susegad/components/otp/otp.css">
<script type="module" src="susegad/components/otp/otp.js"></script>

<form method="post" action="/verify">
  <sg-otp>
    <label for="code">Enter the 6-digit code we sent to 98220 12345</label>
    <input id="code" name="code" autocomplete="one-time-code" inputmode="numeric"
           pattern="[0-9]{6}" maxlength="6" required>
  </sg-otp>
  <button>Confirm</button>
</form>
```

Say in the label how many digits and where the code went. Keep `autocomplete="one-time-code"`, `inputmode="numeric"` and the `pattern`: they are what makes autofill, the number pad and native validation work, with or without JavaScript. (The element adds the first two if they are missing, but only once JavaScript runs.)

## What people see and do

- Without JavaScript, or until a skin loads: one input with the digits spaced out.
- With a skin: a row of boxes, one per digit, grouped for reading (6 as 3 + 3, 8 as 4 + 4). The input lies over them, transparent, so every tap and keystroke still goes to the real input.
- Typing fills the next box. Typing over a filled box replaces it. Tapping a filled box selects its digit.
- Backspace empties the box before the caret and the rest move up. Arrow keys, Home and End move between boxes. Select all and delete clears them.
- Pasting a whole message ("Your code is 482 913") keeps just the digits and fills every box. So does an SMS suggestion or autofill.
- Digits typed in Devanagari, Kannada, Tamil, Bengali or any other Indian script, or full width, are read as ASCII digits.
- Letters and symbols go nowhere.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `length` | 3 to 12 | the input's `maxlength`, else the count in its `pattern`, else 6 |
| `seed` | any string: fixes the playful stamps' tilt | the input's `name` |
| `webotp` | boolean: on Android Chrome, also ask for the code from the SMS with the WebOTP API | absent |
| `register` | `quiet`, `warm`, `playful` | inherited |

`webotp` needs your SMS to end with a line like `@your.domain #482913`. It is cancelled when the form submits or the element goes.

## Properties and events

- `value`: the code (get and set; setting keeps digits only).
- `complete` (read only): all boxes filled.
- `sg-otp` event, bubbling, `detail: { value, complete }`, on every change. The input's own `input` event fires as usual, including for the edits the element makes.
- Nothing submits by itself. Submitting when the last digit arrives would change the page under someone mid-typing (WCAG 3.2.2). Listen for `complete` if your flow really needs it, and say so in the label.

## Errors

Mark a code the server rejected with `aria-invalid="true"` on the input and describe it with `aria-describedby`, or use `<sg-field-note>`. The boxes and digits turn to the danger colour in every register.

## Registers

| | Look | Motion |
|---|---|---|
| quiet | plain boxes with a hairline, digits in the body face | digits appear; the caret blinks |
| warm | stamp boxes: a carved double frame that inks when its digit arrives, digits in the display face with a little ink starvation | each digit inks in over 240 ms |
| playful | a stamp per digit, each box at its own small tilt | each digit comes down, presses past flat and settles while its ink spreads; a paste lands left to right |

Reduced motion shows every digit in place, with a steady caret.

## Accessibility

- One input, with its label. The boxes are `aria-hidden`, so a screen reader hears exactly what it would hear for a plain input: the label, the digits typed, and any error.
- The current box carries the focus ring (the input's own ring would surround the whole row). With a selection, every selected box shows it.
- The input's text is transparent, so axe asks for colour contrast to be checked by hand. The digits people see are token text colours on `--sg-surface-raised` at 1.75rem, which counts as large text.
- The input stays at 16px or more, so iOS does not zoom on focus.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The boxes and their drawings are `aria-hidden`; the one input has its label: `packages/components/otp/otp.check.mjs`, "one control: the native input is the only textbox; the six boxes are hidden from assistive tech". |
| 1.3.1 Info and relationships | Meets | One native `<input>` with its `<label>`; `otp.check.mjs`: "the input keeps its label and its autofill attributes", and with JavaScript off "one input, with the one-time-code autocomplete and the number pad". |
| 1.3.5 Identify input purpose | Meets | The input keeps `autocomplete="one-time-code"` (`otp.check.mjs`: "no JS: one input, with the one-time-code autocomplete and the number pad"; "the input keeps its label and its autofill attributes"). |
| 1.4.1 Use of color | Meets with author's part | The current box is told by its ring and caret and a filled box by its digit, not by colour. An invalid code turns the frame to the danger colour (`packages/components/otp/otp.css`, `[aria-invalid="true"]`), which is a colour cue only: the words that say what is wrong are the page's, or an `sg-field-note`. |
| 1.4.3 Contrast (minimum) | Meets | Manual test, 2026-10-07: the digits are painted in `--sg-text` (quiet) or `--sg-accent-text` (warm, playful) on `--sg-surface-raised`: 13.6:1 and 12.7:1 in quiet, 5.5:1 and 4.6:1 in warm and playful, light and dark, default palette (painted colours read from the demo; the digits are 1.75rem, large text). The input's own text is transparent, so axe leaves colour contrast to this reading. Axe: `tools/axe.mjs --url /packages/components/otp/demo.html`, 0 violations across 6 runs (3 registers, light and dark), desktop, 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and nothing clipped (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, no sideways scroll (document width 320). |
| 1.4.11 Non-text contrast | Meets | The empty box's border is `--sg-rule-strong` in every register (`--sg-otp-frame` in `packages/components/otp/otp.css`); warm and playful keep their accent ink for the inner stamp ring and for the frame once a digit is in it. `packages/components/otp/otp.check.mjs`: "an empty box's border is 3:1 against the page in 4 palettes x light and dark x 3 registers" reads the painted border and page colours in 24 cells; it failed before the fix in the warm and playful cells (the accent frame at 45 percent was 1.9:1 to 2.0:1), and the lowest cell is now 3.45:1. The focus ring is tested 3:1 or more in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | A native input: typing, Backspace, the arrows, select all and paste are the browser's, and `otp.check.mjs` drives them ("typing fills the boxes; letters go nowhere", "backspace works back across the boxes", "arrow keys move between boxes", "Enter submits the form with the code"). |
| 2.1.2 No keyboard trap | Meets | `packages/components/otp/otp.check.mjs`: "2.1.2: with the code empty, part filled and full, Tab leaves it and Shift+Tab returns to it" (Chromium and Firefox), with a control: the same probe on a code that swallows Tab reports a trap. `packages/components/otp/otp.js` also listens only to `beforeinput`, `input`, `focus` and `blur`, binds no `keydown` and sets no `tabindex`. Not run in WebKit, whose Tab order Playwright does not reproduce.|
| 2.4.3 Focus order | Meets | The input is the only tab stop and keeps its place in the page's order (`otp.check.mjs`: "one control"; the boxes are `aria-hidden` and not focusable). |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the input in each register and requires a focus style; the current box carries the ring (`otp.check.mjs`, "the current box follows the caret"), with the ring colour tested at 3:1 in `packages/tokens/tokens.test.js`. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test, 2026-10-07: `packages/components/otp/otp.css` uses no `position: fixed` or `sticky`, and a document scan of the demo found none. A sticky header or banner the page adds can cover the code that is scrolled to. |
| 2.5.3 Label in name | Meets | The accessible name is the visible label text: `otp.check.mjs` finds the input by "Enter the 6-digit code we sent to 98220 12345". |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07, 390 px touch: the input is 245.9 to 358.0 px wide and 58.0 px tall in quiet and 60.0 px in warm and playful. No check in the repository asserts target size for the code yet. |
| 3.2.2 On input | Meets | Typing the last digit fires `sg-otp` with `complete: true` and submits nothing; Enter submits the form (`otp.check.mjs`: "sg-otp says when the code is complete", "Enter submits the form with the code"). |
| 3.3.1 Error identification | Meets with author's part | A short or non-digit code is stopped by the native `pattern` (`packages/components/otp/otp.check.mjs`, "no JS: a short or non-digit code is blocked by native validation"), and the frame turns to the danger colour with `aria-invalid`. The words of what is wrong come from the page or an `sg-field-note`. |
| 3.3.2 Labels or instructions | Meets with author's part | The native `<label>` names the input (`otp.check.mjs`, "the input keeps its label and its autofill attributes") and says how many digits (the demo's "Enter the 6-digit code we sent to ..."). The label text is the author's. |
| 4.1.2 Name, role, value | Meets | One native textbox, named by its label, with its value; the boxes are `aria-hidden` (`otp.check.mjs`: "one control"). Axe with JavaScript off: `tools/axe.mjs --no-js --url /packages/components/otp/demo.html`, 0 violations across 6 runs, 2026-10-07. |

**The page author owns:**

- The label text, saying how many digits and where the code came from, in the language of the page.
- The words of an error when the code is wrong (3.3.1), for instance with an `sg-field-note`.
- Where the code arrives from: `autocomplete="one-time-code"`, `inputmode="numeric"` and the `pattern` stay on the input.
- Sticky headers and banners that could cover the code when it takes focus (2.4.11).
- The colours the page sets behind the boxes, if it overrides the tokens.

## Budget

| File | Bytes |
|---|---|
| `otp.js` + `otp.core.js` (behaviour) | 13.0 KB of 14 KB declared |
| `skins/boxes.js` (shared) | 1.6 KB |
| `skins/quiet.js` | 0.2 KB |
| `skins/warm.js` | 2.4 KB |
| `skins/playful.js` (loads warm.js) | 0.4 KB + 2.4 KB |

Nothing runs per frame. A digit's landing is one or two Web Animations, cancelled when they finish.
