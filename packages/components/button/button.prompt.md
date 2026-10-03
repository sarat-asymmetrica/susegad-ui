# Button

*The word or the way, plainly offered: a line to press, or a road to walk.*

A native `<button>` or `<a href>` is the whole control. Warm draws its outline a little off true, the way a hand does; playful stamps it as a chip that presses in.

```html
<link rel="stylesheet" href="susegad/components/button/button.css">
<script type="module" src="susegad/components/button/button.js"></script>

<sg-button><button type="submit" data-tone="accent">Send the request</button></sg-button>
```

## The prompt

Make a button web component that wraps a real `<button>` or `<a href>`, so it takes the keyboard, submits and navigates with or without JavaScript. Style the native element directly for quiet: a hairline border, transparent background, the surface colour on hover, a visible focus ring, `data-tone="accent"` for a filled primary look. Give it three registers. Quiet: exactly that, and nothing more. Warm: draw a hand-inked outline behind the label as an `aria-hidden` SVG path, jittered from a seed so it looks drawn rather than plotted (walk the rounded-rect perimeter, nudge each corner and a few points along every edge by a small random offset, seeded so the same button always draws the same wobble); keep it invisible until the button is hovered or focused, then fade it in and let a small CSS keyframe animation "boil" it (a slow, tiny scale and translate loop) for as long as the pointer or focus stays, so nothing moves until someone's attention is there. Playful: a bold-bordered stamped chip that presses in on `:active` with a plain CSS transform, and on release blooms a soft ink ring from the point of contact using Web Animations, fading to nothing; skip the ring under reduced motion, where the press transform alone is the feedback. Read the button's size with `ResizeObserver` so the warm outline redraws at the button's true box, and place the ink ring at the pointer's position, not the button's centre.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a native `<button>` or `<a href>` is the whole control | native first | The keyboard, `:disabled`, form submission and navigation are the browser's; the component only decorates. |
| jittered from a seed | seeded randomness | `boilOutline(w, h, seed)` uses `rng('button-boil:' + seed)`, so two buttons with different labels (the default seed) never draw the same wobble, and the same button always draws the same one. |
| invisible until hovered or focused … boil it | honest, state-triggered motion | The outline's opacity and its CSS animation are both gated on `:hover, :focus-within` in `button.css`; nothing plays on page load, and the animation stops the moment attention leaves, because CSS unapplies it. |
| presses in on `:active` | native state, plain CSS | `transform: translateY(1px) scale(0.97)` on `:active`, no JavaScript. |
| blooms a soft ink ring … using Web Animations | ported technique | `inkSpread(motion)`, the fade-out ring, is the same shape as `stamp.core.js`'s `landing().spread`: a small scaled-up ring that fades to `opacity: 0`. |
| skip the ring under reduced motion | Ω honesty | `inkSpread('still')` and `inkSpread('state')` return `null`; the skin then plays nothing, and the press transform (a real state, not decoration) still shows. |
| read the button's size with ResizeObserver | resize correctness | An SVG redrawn only at its true box avoids the Wave 4 lesson about a canvas cleared by resize; here the `viewBox` is recomputed, not a canvas context. |

## Accessibility

- `disabled` (native) or `aria-disabled="true"` (a disabled-looking link) dims the button and turns off hover, boil and the ink ring.
- Focus is always visible (`--sg-focus`), in every register.
- The outline, the accent border and the text on the accent fill hold WCAG contrast in every palette and theme (tested).
- Forced colours restore the browser's own button and link appearance; the drawings are hidden.

## Credit

The ink-spread press is ported from the Wave 1 Stamp's landing, itself from an earlier booking calendar's `drawStamp`. Tier: a general technique, not a motif; no cultural credit is owed beyond the Stamp's own.
