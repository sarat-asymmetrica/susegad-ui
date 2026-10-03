# Tooltip

`<sg-tooltip>` wraps a trigger and its accessible description. The trigger's `aria-describedby` always points to the tooltip text, whether or not it is ever shown on screen, so a screen reader has it regardless of hover.

**The tooltip's words must never be the only place a meaning lives.** Put anything a person must know to act (a price, a deadline, a policy) in real text nearby too; use the tooltip for a helpful extra, not the only copy of something that matters.

## Use

```html
<link rel="stylesheet" href="susegad/components/tooltip/tooltip.css">
<script type="module" src="susegad/components/tooltip/tooltip.js"></script>

<sg-tooltip>
  <button aria-describedby="cancel-note">Free cancellation</button>
  <span id="cancel-note" role="tooltip">No charge up to 48 hours before arrival.</span>
</sg-tooltip>
```

Leave `aria-describedby` and the `id` off and the element wires them itself, as long as the trigger and the `role="tooltip"` element are both direct children, trigger first.

## Attributes and properties

| | Values | Default |
|---|---|---|
| `register` | `quiet`, `warm`, `playful` | inherited |
| `open` (property, read only) | boolean | `false` |

## Registers

| | Look |
|---|---|
| quiet (and no JS) | a plain small label |
| warm | hand-lettered, in the hand face, a little larger |
| playful | the same, with a pencil leader line pointing from the panel to the trigger |

## How it shows

Without JavaScript, CSS alone reveals the panel on `:hover` and `:focus-visible`, by opacity only (never `display` or `visibility`), so the accessible description is never hidden by the visual state either way. With JavaScript, the panel becomes a `popover` (`hint` where the platform understands it, else `manual`), drawn in the top layer so it is never clipped by an ancestor, shown after a short delay on hover (to avoid flicker while the pointer passes over the page) and instantly on focus, and dismissed by Escape or by leaving. It opens above the trigger by default and below it when there is little room above.

## Accessibility

- `aria-describedby` links the trigger to the tooltip's text at all times.
- Touch: focusing the trigger (most mobile browsers focus a button on tap) shows the tooltip the same way keyboard focus does.
- Escape dismisses it without moving focus.
- The panel's background and text hold 4.5:1 contrast in every palette and theme (tested).

## Budget

Behaviour 4.4 KB (`tooltip.js` + `tooltip.core.js`); skins quiet, warm and playful are each a no-op mount, under 0.2 KB: the look is entirely in `tooltip.css`, keyed off `[data-skin]`, `[data-open]` and `[data-above]`.
