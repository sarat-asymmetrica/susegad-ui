# Tooltip

*A word said quietly, at the elbow: a small label, a hand-lettered note, a note on a pencil line.*

A trigger and its accessible description, linked by `aria-describedby` whether or not the tooltip is ever shown. Warm hand-letters it; playful draws a leader line to the trigger.

```html
<link rel="stylesheet" href="susegad/components/tooltip/tooltip.css">
<script type="module" src="susegad/components/tooltip/tooltip.js"></script>

<sg-tooltip>
  <button aria-describedby="cancel-note">Free cancellation</button>
  <span id="cancel-note" role="tooltip">No charge up to 48 hours before arrival.</span>
</sg-tooltip>
```

## The prompt

Make a tooltip web component around a trigger and a `role="tooltip"` element that follows it. Always link them with `aria-describedby`, filled in on connect if the builder left it off, so a screen reader has the text at all times, never only on hover. Style the panel with CSS alone for the no-JS path: position it absolutely above the trigger, and reveal it only by animating `opacity` (never `display` or `visibility`, which would remove it from the accessibility tree) on the trigger's real `:hover` and `:focus-visible`. Give it three registers by CSS alone, keyed off `[data-skin]`: quiet is a plain small label; warm switches to the hand face at a slightly larger size; playful adds a thin leader line, a `::after` pseudo-element, between the panel and the trigger, on whichever side the panel actually landed. Then enhance with JavaScript: turn the panel into a `popover`, `"hint"` where `el.popover = 'hint'` reads back as `'hint'` (feature detection, since the browser silently normalises an unknown value away otherwise), `"manual"` elsewhere, so it draws in the top layer, free of any clipping ancestor; show it after a short delay on `pointerenter` (ignore `pointerType === 'touch'`, so a stuck hover never happens on a phone) and instantly on `focus`; hide it on `pointerleave`/`blur` and on `Escape`; place it above the trigger by default and below when there is little room above, using a pure function of the trigger's box, the panel's size and the viewport so the flip decision is unit tested without a browser.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| always link them with `aria-describedby` | Ω honesty, never hover-only | `tooltip.js` merges the panel's `id` into the trigger's existing `aria-describedby`, so a screen reader always has the text, matching the rule that a tooltip's words are never the only place a meaning lives. |
| reveal it only by animating `opacity` | native first, no-JS path | `tooltip.css`'s base rule needs no script; the panel stays in the accessibility tree the whole time, since opacity, unlike `display`, does not remove content from it. |
| feature detection, since the browser silently normalises an unknown value away | A7, doubt the instrument | `hintSupported(doc)` sets `el.popover = 'hint'` and reads it back; a browser that does not know `"hint"` resets it to `""`, so the read-back, not a guess, decides which value ships. |
| ignore `pointerType === 'touch'` | honest interaction | A touch tap fires `pointerenter` without a matching `pointerleave` until the next tap elsewhere, which would otherwise strand the tooltip open; touch instead uses the focus path, which every button already gets on tap. |
| a pure function of the trigger's box, the panel's size and the viewport | testability | `placement()` in `tooltip.core.js` takes plain numbers and returns `{ left, above }`, unit tested for "room above", "flips below" and "clamped inside the viewport" in Node. |

## Accessibility

- The trigger's `aria-describedby` names the tooltip's text at all times; hover and focus only decide whether it is also shown.
- Escape hides the panel without moving focus away from the trigger.
- Touch users get the tooltip through focus, the same path as keyboard users.
- Panel text holds WCAG contrast in every palette and theme (tested). Forced colours give the panel a real border instead of relying on its filled background.

## Credit

The leader line is a common annotation convention, not tied to a specific tradition. No credit is owed beyond the drawing itself.
