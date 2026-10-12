# QR code

`<sg-qr>` draws a QR code as a picture and keeps the words beside it as real text: a UPI link, a ticket number, a Wi-Fi password. The encoder is part of the component, written from the standard, with no dependency, so it works on a page with no network.

## Use

```html
<link rel="stylesheet" href="susegad/components/qr/qr.css">
<script type="module" src="susegad/components/qr/qr.js"></script>

<sg-qr value="upi://pay?pa=casaexemplo@okaxis&pn=Casa%20Exemplo&am=25500.00&cu=INR"
       label="QR code for the UPI payment link">
  <p>Pay Casa Exemplo <strong>₹25,500</strong></p>
  <p>Or pay to <code>casaexemplo@okaxis</code>.</p>
</sg-qr>
```

The element's own markup is the text beside the code. It is the real content: the picture only repeats it for a phone camera, and it is what a screen reader reads and what people select and copy. Without JavaScript the text shows and the picture does not.

When there is no `value`, the element's text is also what the code says:

```html
<sg-qr label="QR code for the ticket number">TICKET-GOA-2026-0001234</sg-qr>
```

### Building the value

`qr.helpers.js` has two helpers for what people usually put in a code. They check what you give them and throw a `TypeError` in plain words, so a bad amount fails on your page instead of in a payer's app:

```js
import { upiPayload, wifiPayload } from './qr.helpers.js';

upiPayload({ pa: 'casaexemplo@okaxis', pn: 'Casa Exemplo', am: '25500.00', tn: 'Booking 12 to 15 Oct' });
// upi://pay?pa=casaexemplo@okaxis&pn=Casa%20Exemplo&am=25500.00&cu=INR&tn=Booking%2012%20to%2015%20Oct

wifiPayload({ ssid: 'Casa Exemplo guests', password: 'susegad-2026' });
// WIFI:T:WPA;S:Casa Exemplo guests;P:susegad-2026;;
```

What the helpers accept:

| Field | Rule |
|---|---|
| `pa` | the payee's UPI address, `handle@bank`, no spaces |
| `am` | a positive amount in rupees. A number is rounded to two places (`0.1 + 0.2` gives `0.30`). A string must already be a plain decimal with at most two places; `'1e3'`, `'-5'` and `'12.345'` are refused, not guessed at. Written as `2500.00` |
| `cu` | `INR` in any case; anything else is refused |
| `tn` | the note, 80 characters at most. That cap is ours: we did not have the NPCI linking spec to check, and some apps show less |
| `tr` | the transaction reference; merchant payments need one |
| `security` (Wi-Fi) | `WPA` (`WPA2` and `WPA3` are written as `WPA`, which is what phones read), `WEP` or `nopass`; anything else is refused |

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `value` | any text, up to 2,953 bytes at level L | the element's own text |
| `ecc` | `L`, `M`, `Q`, `H`: about 7, 15, 25 and 30 percent of the code can be damaged or covered and still read | `M` |
| `label` | the picture's accessible name | `QR code` |
| `size` | the plate's width: a number is px, or a length such as `12rem` | `12rem` |
| `register` | `quiet`, `warm`, `playful` | inherited |

Choose `ecc` by where the code will live: `L` on a screen, `M` on paper, `Q` or `H` on something that will get scuffed. Higher levels make a bigger code.

## Properties and events

- `symbol` (read only): the last matrix drawn, `{ version, size, ecc, mode, mask, rows }`, or `null`. `rows[y][x]` is `'1'` for a dark module.
- `sg-qr` event, bubbling, `detail: { version, ecc, mode, size }`, each time the picture is drawn.
- `sg-qr-error` event, `detail: { message }`, when the value will not fit. The picture is dropped, the words stay, and the element gets `data-error`.
- Changing `value`, `ecc`, `label` or `size`, or editing the text when there is no `value`, redraws.

## Registers

| | Look | Motion |
|---|---|---|
| quiet | a plain white plate with a hairline | none |
| warm | a soft paper plate with a hand-ruled double frame in its padding | none |
| playful | as warm, with block-print studs on the corners and the middle of each side | the frame draws itself on once, when first seen |

The modules are the same in all three registers: same shape, same size, dark on light. Only the plate's margin carries the register. Reduced motion shows the finished frame.

## Scanning

- The plate is light in every theme. A QR code is dark modules on a light ground, so the plate does not follow dark mode, and in forced colours it keeps its own colours (and gets an edge in the system text colour).
- The code keeps the four-module quiet zone the standard asks for, inside the picture. The frame sits outside it.
- **Size floor.** A phone reads a code reliably when each module is at least 2 CSS px. The element holds the plate to that, whatever `size` says: the plate is never narrower than `2 px × (modules + 8) + 3 px` in quiet, and `2 px × (modules + 8) ÷ 0.86 + 3 px` in warm and playful, whose frame margin takes 14% of the width. A UPI link (usually 41 modules, version 6) comes to 101 px in quiet and 117 px in warm and playful; a version 8 code with Indian-script text (49 modules) to 117 and 136 px. On a narrow screen the plate is also held to the width of its row.
- The picture is an SVG with `shape-rendering="crispEdges"`, so it stays sharp at any size and prints cleanly. Print the plate at 2 cm or more on a side for a short link.
- If you change `--sg-qr-light` or `--sg-qr-dark`, keep at least 10:1 between them and keep the modules the dark one. Inverted codes (light on dark) do not scan on many phones.

## Accessibility

- The picture is one `role="img"` with `label` as its name. Say what the code does ("QR code for the UPI payment link"), not what it looks like.
- The text beside the code is the real content, so a person who cannot scan or see the picture has the same information. Put the link or the number in it.
- The frame and studs are `aria-hidden`. Nothing here takes focus: it is an image with text, not a control.
- The text beside the code wraps, including long links with no spaces, down to a 320 px screen. On a narrow screen it moves below the plate.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The picture is one `role="img"` named by `label`, and the words beside it are real text with the same content; the frame and studs are `aria-hidden`. `packages/components/qr/qr.check.mjs`: "one role=\"img\" per code, named by its label (and \"QR code\" when none is given)", "the accessibility tree offers the labelled picture once", and "playful: the frame is aria-hidden, so the tree still holds only the four codes". |
| 1.3.1 Info and relationships | Meets | The words are the element's own markup, in the document, and the picture repeats them for a camera. `qr.check.mjs`: "the words beside the code select as real text, with the UPI address in them" and "without JavaScript the words show, in the demo layout, and there is no picture". |
| 1.4.1 Use of color | Meets | Nothing is told by colour: the code is dark modules on a light plate, and what it says is in the words beside it (`packages/components/qr/qr.docs.md`, "Accessibility"). The registers differ only in the plate's margin. |
| 1.4.3 Contrast (minimum) | Meets with author's part | The component sets no colour on the words beside the code: they take the page's text colour on the page's ground, which is the author's. `packages/components/qr/qr.check.mjs`: "axe, <register>, <theme>: 0 violations" in every register, light and dark, with the frame drawing on, at phone width and with JavaScript off. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07 (throwaway Playwright script): the demo page in quiet, warm and playful, with the root font size at 200 percent at 1280 px wide, and at 320 px wide (plain, and with the WCAG text-spacing values injected: line height 1.5, letter 0.12em, word 0.16em, paragraph 2em); the page was never wider than the screen (document scroll width minus window width was 0 in every case) and no box that hides its overflow had text running out of it. The clipping probe is coarse (it only sees boxes with `overflow: hidden`). |
| 1.4.10 Reflow | Meets | `qr.check.mjs`: "<width> px: the words wrap below the plate, nothing scrolls sideways, the text stays inside the card" and "a 70-character link with no spaces wraps inside a 320 px screen". The plate is never narrower than the size floor that keeps each module at 2 CSS px (see "Scanning"), and on a narrow screen it is held to the width of its row. |
| 1.4.11 Non-text contrast | Meets | `qr.check.mjs`: "<register> / <theme> / <code>: the modules sit on a light ground, contrast at least 10:1" for every register, theme and code, with a control that a grey-on-grey plate fails it; the plate stays light in dark mode and in forced colours (the check "forced colours ...: the plate keeps dark modules on a light ground and still decodes"). The frame and studs are decoration. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07 (throwaway Playwright script): the demo page in quiet, warm and playful, with the root font size at 200 percent at 1280 px wide, and at 320 px wide (plain, and with the WCAG text-spacing values injected: line height 1.5, letter 0.12em, word 0.16em, paragraph 2em); the page was never wider than the screen (document scroll width minus window width was 0 in every case) and no box that hides its overflow had text running out of it. The clipping probe is coarse (it only sees boxes with `overflow: hidden`). |
| 2.2.2 Pause, stop, hide | Not applicable | Nothing runs for more than five seconds. In playful the frame draws itself on once, when first seen, in the calm duration (`packages/components/qr/skins/warm.js`, shared by playful), and `qr.check.mjs` asserts "playful, motion allowed: the frame's rules and studs animate once, then none are left running". Quiet and warm: "nothing animates". |
| 2.3.1 Three flashes or below threshold | Meets | The only movement is the frame's rules drawing on and its studs fading in once, over the calm duration, with nothing repeating (`packages/components/qr/skins/warm.js`; `qr.check.mjs`: "playful, motion allowed: ... animate once, then none are left running", "playful, reduced motion: nothing animates at all, and the frame is already whole"). The code itself is static. |
| 4.1.2 Name, role, value | Meets | A `role="img"` with a name, and nothing to operate. `qr.check.mjs`: "axe, <register>, <theme>: 0 violations", "axe, playful, dark, phone width: 0 violations", "axe while the frame is drawing on: 0 violations", and "axe without JavaScript: 0 violations". |

**The page author owns:**

- The `label`, in the page's language, saying what the code does (the default, "QR code", is English only), and `lang` on it if it differs from the page (3.1.2).
- The words beside the code: the link, number or password, so a person who cannot scan has the same information (1.1.1).
- The colours the page sets behind the words, and any change to `--sg-qr-light` or `--sg-qr-dark` (keep at least 10:1 between them, modules dark).
- Printing the plate large enough for a camera: 2 cm or more on a side for a short link.

## To do

The default label, "QR code", is English only. Give each code a `label` in the page's language for now. When the shared strings module (`core-strings`) lands with the language work, the default will follow the page's `lang`.

## Limits

Byte mode carries UTF-8, so the rupee sign and Devanagari or Kannada text work, but each takes 3 bytes. The code holds at most 2,953 bytes (level L), 2,331 (M), 1,663 (Q) or 1,273 (H), and 7,089 digits. A UPI link fits easily; more than a few hundred bytes makes a dense code that is hard to scan from a phone screen.

## Credit

The encoder follows ISO/IEC 18004, and its tests compare it with Project Nayuki's QR Code generator library (MIT) and an independent decoder, jsQR. The frame's studs are the diamond cuts of Indian block printing, shared with the stamp. Tier: pan-Indian.
