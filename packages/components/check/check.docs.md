# Checkbox

`<sg-check>` wraps one native `<input type="checkbox">` and its label. Everything a checkbox does, the input does, with or without JavaScript.

## Use

```html
<link rel="stylesheet" href="susegad/components/check/check.css">
<script type="module" src="susegad/components/check/check.js"></script>

<sg-check>
  <label><input type="checkbox" name="extras" value="breakfast" checked> Breakfast on the balcão</label>
</sg-check>
```

A label beside the input (`<input id="x"><label for="x">`) also works.

### Select all

```html
<sg-check controls="x-breakfast x-pickup x-late">
  <label><input type="checkbox" id="x-all"> All extras</label>
</sg-check>
<sg-check><label><input type="checkbox" id="x-breakfast" name="extras" value="breakfast"> Breakfast</label></sg-check>
...
```

Give the "select all" input no `name`, so it is not sent with the form. Without JavaScript it is an ordinary checkbox that does nothing, so for a page that must work without scripts, leave it out or render it only when scripts run.

## Attributes and properties

| | Values | Default |
|---|---|---|
| `indeterminate` | boolean attribute | absent |
| `controls` | space-separated ids of child checkboxes | none |
| `seed` | any string, for the drawn marks | the label |
| `register` | `quiet`, `warm`, `playful` | inherited |
| `checked` (property) | boolean; setting it fires `change` | the input's |

## Registers

| | Look | Motion |
|---|---|---|
| quiet (and no JS) | hairline box, crisp tick, a bar for "some" | the tick scales in under 200ms |
| warm | a box sketched in four pencil strokes whose corners cross, a heavy pencil tick, a pencil dash | the tick is drawn in over 280 ms when ticked |
| playful | a rubber-stamp block (a heavy inked edge and a fine inner rule); a bold stamped tick, cut bigger than the box and printed through the Wave 1 stamp's ink texture, with ink spots | the stamp presses down past flat and settles |

Reduced motion: marks appear with no movement. Forced colours: the system checkbox.

## Accessibility

- Keyboard: Tab to it, Space to tick. Nothing added, nothing taken away.
- A screen reader hears the label and "checked", "not checked" or "mixed".
- Required: use `required` on the input. The browser stops the form and says why.
- Contrast: box edge, pencil and tick are 3:1 or more on every surface (WCAG 1.4.11), tested for every palette and theme.

## Budget

Behaviour 8.6 KB of 12 KB (`check.js` + `check.core.js`); skins 0.3, 2.2 and 1.9 KB.
