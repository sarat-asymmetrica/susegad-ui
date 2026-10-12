# QR code

*The code on a payment slip, a ticket or a guest-room card: a picture a phone can read, with the same words printed beside it for people.*

A QR code drawn as an SVG from an encoder written for it, with the words it carries kept beside it as ordinary text. Quiet is a white plate; warm is a paper plate with a hand-ruled frame; playful adds block-print studs and draws the frame on once.

```html
<link rel="stylesheet" href="susegad/components/qr/qr.css">
<script type="module" src="susegad/components/qr/qr.js"></script>

<sg-qr value="upi://pay?pa=casaexemplo@okaxis&pn=Casa%20Exemplo&am=25500.00&cu=INR" ecc="M"
       label="QR code for the UPI payment link">
  <p>Pay Casa Exemplo <strong>₹25,500</strong></p>
</sg-qr>
```

## The prompt

Make a web component that shows a QR code as an image, with its text beside it, such as a UPI payment link, a ticket number or a Wi-Fi password. Write the encoder yourself as a pure module with no dependency, and test it in Node against known vectors. Choose the cheapest mode: digits only is numeric, capitals and a few symbols is alphanumeric, anything else is byte mode with the text as UTF-8, so the rupee sign and Devanagari work. Choose the smallest version, 1 to 40, that holds the text at the error-correction level the builder asks for (L, M, Q or H). Split the data into the standard's blocks, add Reed-Solomon error correction over the finite field with 256 elements, interleave the blocks, lay the bits out in the zigzag, then try all eight masks, score each with the four penalty rules and keep the lowest. Write the format and version information. Return the matrix as plain rows of 0 and 1, and a function that turns it into one SVG path of horizontal runs with a four-module quiet zone. Draw it as an SVG with `shape-rendering="crispEdges"` and `role="img"`, named by a `label` attribute. Keep the builder's own words as real text beside it: selectable, wrapping on a phone (below the code when there is no room beside it), breaking even a long link with no spaces. If there is no `value` attribute, the words are the value. Always draw the code dark on a light plate, even in dark mode and in forced colours, because a code that is light on dark does not scan. Three registers: quiet is a plain plate with a hairline; warm is a paper-coloured plate with a hand-ruled frame in a margin around the code, a thick rule and a thin one, wobbling a little from a seed; playful adds a diamond stud on each corner and in the middle of each side and draws the frame on once when first seen. The frame never touches the code's quiet zone and the modules never change in any register. With reduced motion, show the finished frame. If the text will not fit in any code, keep the words, drop the picture, set `data-error` and fire an event with a plain message. Without JavaScript the words still show.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a pure module … tested against known vectors | pure core | `qr.core.js` has no DOM and no import beyond the seeded rng. Its tests check the ISO/IEC 18004 Annex example's codewords, 14 matrices and a hash of every version at every level from a reference encoder (Project Nayuki's), and a decode round trip through jsQR. |
| the cheapest mode | mode choice | `modeOf(text)`: digits only is numeric, the 45-character set is alphanumeric, anything else is byte. |
| UTF-8 | byte mode | `TextEncoder` turns the text into bytes; the rupee sign is 3 bytes, a Devanagari letter 3. |
| the smallest version that holds it | capacity | `encode` raises the version from 1 until the header and the data bits fit the data codewords for that level; past 40 it throws a `RangeError` that says how much fits. |
| Reed-Solomon over the field with 256 elements | GF(256) | Log and antilog tables for polynomial 0x11D; `generator(n)` builds the divisor and `remainder` divides the data by it. |
| interleave the blocks | blocks | Short blocks first, then longer ones with one more data byte; data taken column by column, then error correction column by column. |
| try all eight masks and keep the lowest penalty | penalty | `penalty()` scores runs of five or more, 2 by 2 blocks, the 1:1:3:1:1 finder shape with light on a side, and dark proportion. The first lowest mask wins, as in the reference. |
| one SVG path of horizontal runs | pathData | `pathData(rows)` writes `M x y h n v1 h-n z` for each run of dark modules, offset by the quiet zone, so the whole code is one `<path>`. |
| always dark on a light plate | scanning | `--sg-qr-light` and `--sg-qr-dark` are constants, not theme tokens; the plate and the SVG set `forced-color-adjust: none`. |
| the words are the value | text | With no `value`, `.value` is the element's collapsed text, and a MutationObserver redraws when it changes. |
| a hand-ruled frame | seed | `framePaths(seed)` jitters the corners and bows each side of two rectangles, from the value, so the same code always gets the same frame. |
| draws the frame on once | reveal | `reveal(motion)` is non-null only in full motion; the rules animate `stroke-dashoffset` (with `pathLength="1"`) and the studs fade in. The animations are cancelled when they end. |
| a plain message | error | `sg-qr-error` carries the core's `RangeError` text. |
| never so small it will not scan | size floor | The element sets `--sg-qr-units` (modules plus quiet zone) and the CSS holds the plate to `min-width: units × 2px ÷ fill + 2px`, where fill is 1 in quiet and 0.86 in warm and playful, whose frame margin is a percentage margin on the picture. `minPlate()` in `qr.helpers.js` is the same sum, tested. |
| a link a payment app will accept | checked payload | `upiPayload` requires `handle@bank`, an amount of at most two decimals (numbers rounded, no float noise), `INR`, and a note of 80 characters or fewer, and throws a plain `TypeError` otherwise. `wifiPayload` takes WPA (WPA2 and WPA3 too), WEP or nopass. |

## Accessibility

- The picture is one `role="img"` named by `label`. The words beside it are text.
- The frame and studs are `aria-hidden`; nothing takes focus.
- The plate is light in every theme and in forced colours, with at least 10:1 between modules and ground.

## Credit

The encoder follows ISO/IEC 18004; its tests compare it with Project Nayuki's QR Code generator library (MIT) and jsQR. The studs are the diamond cuts of Indian block printing. Tier: pan-Indian.
