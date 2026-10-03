# Button

`<sg-button>` wraps one native `<button>` or `<a href>`. It takes the keyboard, submits a form, or follows a link with or without JavaScript. The register lays a drawing over it; the native element carries every behaviour.

## Use

```html
<link rel="stylesheet" href="susegad/components/button/button.css">
<script type="module" src="susegad/components/button/button.js"></script>

<sg-button><button type="submit" data-tone="accent">Send the request</button></sg-button>
<sg-button><a href="/rooms">See the rooms</a></sg-button>
```

`data-tone="accent"` on the native element gives the filled, primary look. Leave it off for the plain, secondary look. Both skin the same way.

## Attributes and properties

| | Values | Default |
|---|---|---|
| `seed` | any string, for the warm outline's wobble and the playful ink | the button's own text |
| `register` | `quiet`, `warm`, `playful` | inherited |

## Registers

| | Look | Motion |
|---|---|---|
| quiet (and no JS) | a hairline outline, crisp | none beyond the native hover and focus states |
| warm | an ink outline drawn a little off true, behind the label | the ink "boils" (a slow, small wobble) only while hovered or focused |
| playful | a stamped chip, bold border, bold weight | presses in on `:active`; on release, an ink ring blooms from the point of contact and fades |

Reduced motion: the boil never animates and the ink ring never plays; the press transform (`:active`) still gives feedback, because it marks a real state (held down), not decoration. Forced colours: the browser's own button and link look, drawings hidden.

## Accessibility

- The native element is the whole control. `disabled` and `aria-disabled="true"` both dim it and stop the press feedback.
- Focus uses `--sg-focus`, visible against every register.
- Outline, accent border and accent-filled text hold 3:1 (border) or 4.5:1 (text on the accent fill) in every palette and theme (tested).

## Budget

Behaviour 1.6 KB (`button.js` + `button.core.js`); skins quiet 0.1 KB, warm 1.1 KB, playful 0.8 KB.
