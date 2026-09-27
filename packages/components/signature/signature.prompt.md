# Signature

*The signature on a form, a lease or a delivery slip: a name in your own hand, or typed when a hand isn't possible.*

A place to sign a form. Draw with a finger, a pen or the mouse, or type your name. The ink behaves like ink, and what the form sends is exactly what you see.

```html
<link rel="stylesheet" href="susegad/components/signature/signature.css">
<script type="module" src="susegad/components/signature/signature.js"></script>

<sg-signature>
  <label for="sig">Type your full name to sign</label>
  <input id="sig" name="signature" autocomplete="name" required>
</sg-signature>
```

## The prompt

Make a web component for signing a form. Start from a label and a typed-name input that submits with the form and works without JavaScript; set the name in a handwriting face on a signing line. With JavaScript, add a pad above it to sign on with a finger, pen or mouse, plus "Undo last stroke" and "Start again" buttons and a line of help linked to the input. Record each stroke as pointer samples with time and pressure, using coalesced events so fast strokes stay smooth. Turn each stroke into a filled ribbon of ink: widen it with a pen's pressure (ignore the mouse's fixed 0.5), thin it when the stroke is quick, swell it in at the start, flick it thin when the pen lifts quickly and leave it blunt when it lifts slowly, and round both ends. Export the ribbons as SVG path data into a hidden input, so the server receives exactly the ink on screen. Either a drawing or a typed name satisfies `required`, through the input's custom validity, so native validation still works. Give it three registers. Quiet: a plain hairline line and a plain pen that is the same width in every direction. Warm: a pencilled line with a small cross, and a broad nib held at 35 degrees so downstrokes come out thick and joins hairline; fresh ink is glossy and dark, then dries into the paper's grain over a second and a half. Playful: the warm ink in the accent colour, and once the pen rests, a swash that underlines the signature and ends in a small loop, never submitted. Bake dry strokes into a cached layer and repaint only the fresh ink while it dries. The pad is hidden from assistive technology, so say "Signed by drawing" and "Signature cleared" in a polite status line, and keep the typed name as the keyboard way to sign. With reduced motion, lay the ink down dry.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a typed-name input that submits … without JavaScript | native first | The builder's `<input>` is the control. The element only adds things around it, and `required` stays native: with JavaScript the element clears `required` and sets the input's custom validity instead, so a drawing can count too. |
| record each stroke as pointer samples | pointer | Pointer capture on the canvas, and `getCoalescedEvents()` for every sample the screen saw between frames. Each sample is `[x, y, time, pressure]` in the pad's 600 × 200 units, via the engine's `stage().toLogical`. |
| widen it with a pen's pressure (ignore the mouse's fixed 0.5) | physics | `strokeWidths` uses `pressure` only when `pointerType` is `pen`. Speed is smoothed and always counts: `width = base × (0.45 + 1.1p) × (0.5 + 0.75 / (1 + 1.6v))`, then eased so the width never jumps. |
| swell it in … flick it thin … blunt | easing | Along the stroke's length the width rises over the first 7 units. If the lift speed is over 0.9 units per ms, it falls to a quarter over the last 16. |
| a filled ribbon of ink … round both ends | geometry | `ribbon` runs a Catmull-Rom spline through the samples, carrying width as a third coordinate, offsets each point along its normal by half the width, and joins the two sides with half-circle caps. It is the engine's `ink()` idea, driven by the hand instead of by noise. A tap is a dot. |
| a broad nib held at 35 degrees | physics | The width is multiplied by `1 − nib + nib × |sin(angle − 35°)|`. Strokes along the nib's edge come out hairline, strokes across it full. |
| exactly the ink on screen | what you see is what is sent | The same polygons are painted and written into `signature-path` with one decimal. A register change re-inks the strokes and rewrites the path. |
| dries into the paper's grain | texture | Fresh ink is filled solid with a pale sheen along its edge. As it dries, the engine's grain pattern is cut out of it with `destination-out` more and more, and when it is dry it is baked into a cached layer and never painted again. |
| a swash that underlines the signature and ends in a small loop | seed | `flourish(bounds, seed)` makes samples along a dipping, rising curve that turns back into a loop, inked with the same ribbon and drawn in over 650 ms. |
| hidden from assistive technology … a polite status line | accessibility | The pad is `aria-hidden`. `role="status"` says when a drawing starts and when it is cleared, not on every stroke. |

## Accessibility

- The typed name is a complete way to sign, by keyboard, switch or screen reader. It has its label and the help text.
- The drawing's state is said in words. Undo and Start again are buttons, disabled when there is nothing to take away. Focus never drops to the page.
- Contrast: the ink is `--sg-ink` (or `--sg-accent-text` in playful) on `--sg-surface-raised`. The buttons and help use token text colours.
- Reduced motion lays the ink down dry.

## Credit

Grown from the Susegad engine's `ink()`, the hand-inked ribbon every plate draws with, and from broad-nib dip pens and fountain pens, whose thick downstrokes and hairline joins are what a written signature looks like. Tier: pan-Indian.
