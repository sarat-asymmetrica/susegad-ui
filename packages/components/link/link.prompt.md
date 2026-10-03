# Link

*The road named plainly, and the line that marks it: a hairline, an inked stroke, a kolam's unbroken wave.*

A native `<a href>` is the whole control. Warm inks the underline in on hover; playful draws it as a kolam's continuous line.

```html
<link rel="stylesheet" href="susegad/components/link/link.css">
<script type="module" src="susegad/components/link/link.js"></script>

<sg-link><a href="/rooms">See the rooms</a></sg-link>
```

## The prompt

Make a link web component that wraps a real `<a href>`, so it navigates and takes the keyboard with or without JavaScript. Quiet is the browser's own underline, styled with `text-underline-offset` and the tokens' stroke width; do nothing more. Warm: switch the native underline off and draw an `aria-hidden` SVG line under the text instead, nudged off straight by a small seeded jitter so it reads as ink; keep it fully undrawn (a `stroke-dasharray`/`stroke-dashoffset` trick, the offset equal to the path's own length) until the link is hovered or focused, then transition the offset to zero so the line appears to ink itself in, and transition it back on leave. Playful: draw the underline as one continuous wave with a small knotted loop near its middle, the way a kolam's line crosses itself, always visible, no hover requirement. Read the link's width with `ResizeObserver` so the line always spans the true text box.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a native `<a href>` is the whole control | native first | Keyboard activation, `:visited` and navigation are the browser's; the component only decorates. |
| nudged off straight by a small seeded jitter | seeded randomness | `inkUnderline(w, seed)` uses `rng('link-ink:' + seed)` for a hand line that never repeats between two different labels. |
| fully undrawn … until hovered or focused | the classic SVG "draw a line" trick | `path.getTotalLength()` sets `stroke-dasharray` and `stroke-dashoffset` to the same value (nothing shows); `link.css` transitions `stroke-dashoffset` to `0` under `:hover, :focus-within`, so it looks inked in and, on leave, drawn back out. |
| one continuous wave with a small knotted loop | in the spirit of the Kolam scene | `kolamUnderline(w, seed)` is a cubic-bezier wave, not the scene's grid geometry: an unbroken line, evoking the motif without porting its full model. |
| read the link's width with ResizeObserver | resize correctness | The `viewBox` and the path are recomputed at the link's true box on every resize, so the line never sits at a stale width. |

## Accessibility

- A link must never be told apart from body text by colour alone (WCAG 1.4.1): quiet and warm each carry a real underline, native or drawn; playful's wave does the same job.
- Focus is always visible (`--sg-focus`).
- Link text and the drawn ink hold WCAG contrast in every palette and theme (tested).
- Forced colours restore the browser's own underline and link colour; the drawings are hidden.

## Credit

The kolam line takes its idea, an unbroken loop, from the pan-Indian kolam and rangoli tradition and this library's own Kolam scene, without copying that scene's dotted-grid geometry. Tier: pan-Indian, everyday and welcoming, not sacred.
