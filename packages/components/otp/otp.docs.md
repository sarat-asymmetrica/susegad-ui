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

## Budget

| File | Bytes |
|---|---|
| `otp.js` + `otp.core.js` (behaviour) | 13.0 KB of 14 KB declared |
| `skins/boxes.js` (shared) | 1.6 KB |
| `skins/quiet.js` | 0.2 KB |
| `skins/warm.js` | 2.4 KB |
| `skins/playful.js` (loads warm.js) | 0.4 KB + 2.4 KB |

Nothing runs per frame. A digit's landing is one or two Web Animations, cancelled when they finish.
