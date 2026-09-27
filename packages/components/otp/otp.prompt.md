# One-time code

*The six digits from a text message that prove it is you.*

A row of boxes for a one-time code, stamped digit by digit, that still behaves exactly like one plain input: paste, autofill and screen readers all just work.

```html
<link rel="stylesheet" href="susegad/components/otp/otp.css">
<script type="module" src="susegad/components/otp/otp.js"></script>

<sg-otp>
  <label for="code">Enter the 6-digit code we sent to 98220 12345</label>
  <input id="code" name="code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required>
</sg-otp>
```

## The prompt

Make a web component for entering a one-time code. Start from one input with `autocomplete="one-time-code"`, `inputmode="numeric"`, a pattern and a maxlength, so it submits, takes SMS autofill and validates without JavaScript. With JavaScript, keep that input as the only control: lay it transparently over a row of boxes that are hidden from assistive technology, one per digit, grouped in threes or fours for reading. Show each digit in its box, the caret and focus ring in the current box, and every selected box when there is a selection. Handle `beforeinput` so the row behaves like boxes: typing over a filled box replaces it, backspace empties the box before the caret and pulls the rest along, and a paste or autofill keeps just the digits from whatever text arrives and fills every box. Read digits typed in any Indian script, or full width, as ASCII. A tap on a filled box selects its digit. Never submit on the last digit; fire an event instead. Give it three registers. Quiet: plain hairline boxes, digits in the body face. Warm: stamp boxes, a carved double frame that inks when its digit arrives, the digit in the display face with a little ink starvation from an SVG turbulence filter, and each digit inking in as it lands. Playful: a stamp per digit, each box at its own seeded tilt, each digit coming down, pressing past flat and settling while its ink spreads, and a pasted code landing left to right. With reduced motion, show the digits in place.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| keep that input as the only control | native first | The input sits in the same grid cell as the boxes, above them, with transparent text, caret and selection. Every tap, keystroke, paste and autofill goes to it; the boxes only draw its value. Until a skin loads, the input is shown as it is. |
| hidden from assistive technology | accessibility | The boxes are `aria-hidden`. A screen reader meets one labelled textbox, and nothing else. |
| typing over a filled box replaces it | state | `beforeinput` is cancelled and `insert(value, start, end, text, length)` decides: the new digits overwrite from the selection start, and the caret lands after them. The element then sets the value and fires the usual `input` event itself. |
| backspace … pulls the rest along | state | `remove(value, start, end)` takes out the digit before the caret (or the selection) and closes the gap, so the code never has holes. |
| keeps just the digits … any Indian script | text | `digitsOf` walks the text and maps each decimal digit, from ASCII, Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam, Arabic-Indic or full width, to its ASCII value. A code of the full length pasted anywhere replaces the whole code. |
| A tap on a filled box selects its digit | pointer | On `pointerup` the element finds the box under the finger and sets the selection to that one digit, so the next digit typed replaces it. |
| Never submit on the last digit | accessibility | Submitting on input would change the page under someone mid-typing (WCAG 3.2.2). `sg-otp` reports `{ value, complete }` and the builder decides. |
| a little ink starvation from an SVG turbulence filter | texture | One `<filter>` per element: fractal noise, turned into an alpha mask by a colour matrix and cut out of the digit with `feComposite in`. It sits on the digit only, so the focus ring stays whole. |
| each box at its own seeded tilt | seed | `boxPose(seed, i)` gives up to 3.5 degrees and a pixel's nudge, fixed per box. |
| pressing past flat and settling while its ink spreads | easing | Web Animations keyframes from `landing(motion)`: scale 1.4, 0.92, 1.03, 1 over 320 ms, and a halo that scales out and fades. A paste staggers the boxes 55 ms apart. Every animation is cancelled when it finishes. |

## Accessibility

- One labelled input, with its native autocomplete, keyboard and validation. The label says how many digits and where the code went.
- The focus ring is on the current box. Errors come from `aria-invalid` and `aria-describedby` on the input, and turn the boxes to the danger colour.
- No automatic submit. No time limit of its own.
- Reduced motion shows the digits in place and a steady caret.

## Credit

The stamp boxes come from the Wave 1 Stamp, itself harvested from the "held" stamp on the Casa Exemplo booking card and the rubber stamps of Indian offices. Tier: pan-Indian.
