# Popover

`<sg-popover>` wraps a trigger and a native `[popover]` element. The `popovertarget` attribute opens it, closes it on an outside click or Escape, and moves focus, with or without JavaScript. This element places the panel near its trigger and lets the register skin the card.

## Use

```html
<link rel="stylesheet" href="susegad/components/popover/popover.css">
<script type="module" src="susegad/components/popover/popover.js"></script>

<sg-popover>
  <button popovertarget="rates">Today's rate</button>
  <div id="rates" popover>
    <h3>The garden room</h3>
    <p>₹8,200 a night, this week.</p>
  </div>
</sg-popover>
```

Leave the `id` and `popovertarget` off and the element wires them itself, as long as the trigger and the `[popover]` element are both direct descendants.

## Attributes and properties

| | Values | Default |
|---|---|---|
| `register` | `quiet`, `warm`, `playful` | inherited |
| `open` (property, read only) | boolean | `false` |

`showPopover()`, `hidePopover()` and `togglePopover()` on the element call the native panel's own methods.

## Registers

| | Look |
|---|---|
| quiet (and no JS) | a hairline card |
| warm | an inland-letter card: an accent margin and a folded top corner |
| playful | the same, with a dashed postmark in the corner |

The panel's entry is the browser's own `:popover-open` transition, a small fade and rise under 140ms; reduced motion turns it off.

## Positioning

Where CSS anchor positioning is supported, the panel is anchored to its trigger natively, with no layout thrashing. Elsewhere, the element measures the trigger and the panel on open, on resize and on scroll, and places the panel below the trigger, or above it when there is little room below and more room above (`popover.core.js`'s `placement()`, pure and tested).

## Accessibility

- The native popover API does the opening, closing, focus management and light-dismiss; a screen reader hears the trigger's own name and, once open, the panel's content.
- Escape closes it and returns focus to the trigger, as the platform does for every `popover="auto"` element.
- Forced colours: a plain 1px border, the postmark and letter-fold hidden.

## Budget

Behaviour 3.4 KB (`popover.js` + `popover.core.js`); skins quiet, warm and playful are each a no-op mount, under 0.2 KB: the look is entirely in `popover.css`, keyed off `[data-skin]`.
