# Reach

*The "get in touch" block of a homestay, a clinic, a shop or a one-person studio.*

Email and WhatsApp as real links, a button that copies the number and says so, and a line on when replies usually come.

```html
<link rel="stylesheet" href="susegad/components/reach/reach.css">
<script type="module" src="susegad/components/reach/reach.js"></script>

<sg-reach>
  <address>
    <p class="sg-reach-line"><span class="sg-reach-label">Email</span>
      <a href="mailto:hello@example.com?subject=A%20project">hello@example.com</a></p>
    <p class="sg-reach-line"><span class="sg-reach-label">WhatsApp</span>
      <a href="https://wa.me/919000012345?text=Hello!">+91 90000 12345</a>
      <button type="button" class="sg-reach-copy" data-copy="+91 90000 12345" hidden>Copy number</button></p>
    <p class="sg-reach-when">Replies usually come the same day.</p>
  </address>
</sg-reach>
```

## The prompt

Make a contact block web component around an `<address>`. Each way to reach someone is a line with a small label and a real link: `mailto:` for email (spaces in the subject as %20, never +), and `https://wa.me/<digits>?text=<message>` for WhatsApp, the full international number in digits and a first message already written. Give pure functions that build and read back those links, for a build step. Ship the copy-the-number button with `hidden` in the HTML and show it only when the clipboard can be used, since without JavaScript it could do nothing. When it's pressed, copy the number, change its label to Copied for a moment, and say "Copied +91 … Paste it into WhatsApp or your phone." in a polite status line inside the block; if copying fails, say so and give the number to select. Give it three registers. Quiet: plain lines, labels in small capitals. Warm: an inland letter, a pale blue card that stays pale blue at night, with fold lines at a third and two thirds, a perforated left edge and a printed postage square, the words in the hand. Playful: a rubber-stamped card, a double-ruled frame inked round it at a slight tilt with ink starvation and an off-register ghost on the frame only, so the words and links stay crisp.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| real links … built and read back | pure core | `waLink(number, text)`, `mailtoLink(email, { subject, body })`, `readWaLink(href)`, `digitsOf()`. `waLink` refuses a number that isn't 8 to 15 digits with its country code. |
| shown only when the clipboard can be used | progressive enhancement | The button is `hidden` in the HTML; the element unhides it when `navigator.clipboard.writeText` (or the older copy command) exists. |
| say … in a polite status line | live region | A `<p role="status">` added inside the block; the line clears after six seconds so the next press is news again. The toast was considered and not used: it needs a region on the page, and this answers a press right beside it. |
| stays pale blue at night | color-scheme | `color-scheme: light` on the card, so every `light-dark()` token inside reads its daytime value; the tests check the words on that paper in both palettes. |
| pale blue, not grey | relative colour | `oklch(from var(--sg-info) 0.91 0.032 h)`: the palette's info hue, pale and a little saturated (#CCE6F1 in Susegad). The first try, 13% info mixed into the raised paper, measured chroma 0.016 at a yellow hue, which reads grey; the check reads the paper's pixels and fails on it. Browsers without relative colour get that mix. |
| perforated left edge | CSS mask | A repeating radial gradient cuts half-circles down the left edge; a drop-shadow filter on the host replaces the box-shadow the mask would cut off. |
| ink starvation … on the frame only | reuse | The stamp component's `stampPose()` and `inkMask()` (stamp.core.js), painted once to a canvas and used as the frame's CSS mask. |

## Accessibility

- An `<address>` of labelled links; each link's text is the address or number itself.
- The copy button is a real button, 32 px tall; its result is spoken once through the status line.
- The status line reads as normal text, not only colour.
- Forced colours: the cards get a system border and lose their masks.
