# Radio group

`<sg-radio-group>` wraps a `<fieldset>` of native radios. The fieldset, the legend and the radios do all the work, with or without JavaScript.

## Use

```html
<link rel="stylesheet" href="susegad/components/radio/radio.css">
<script type="module" src="susegad/components/radio/radio.js"></script>

<sg-radio-group>
  <fieldset>
    <legend>Arriving by</legend>
    <label><input type="radio" name="arrive" value="car" required> Car</label>
    <label><input type="radio" name="arrive" value="train" required> Train to Thivim</label>
    <label><input type="radio" name="arrive" value="boat" disabled> Boat (closed in the monsoon)</label>
  </fieldset>
</sg-radio-group>
```

Always give the group a `<legend>`: it is the question the radios answer, and what a screen reader says first.

## Attributes and properties

| | Values | Default |
|---|---|---|
| `orientation` | `column`, `row` | `column` |
| `seed` | any string | the legend |
| `register` | `quiet`, `warm`, `playful` | inherited |
| `value` (property) | the chosen radio's value, or `''`; setting it chooses and fires `change` | |
| `radios` (property) | the native radios, in order | |

A server can swap the options (htmx); the drawings follow.

## Registers

| | Look | Motion |
|---|---|---|
| quiet (and no JS) | hairline circles, a crisp dot | the dot scales in under 200ms |
| warm | pencil circles whose ends cross; the choice gets an ink dot and is circled in ink, a leaning oval a quarter bigger that runs past its start, as a pen circles an answer | the ring is drawn in when the choice moves |
| playful | bold inked circles; the choice becomes a four-petalled kolam flower in place of its circle | the kolam blooms with a small turn |

Reduced motion: no movement. Forced colours: the system radios.

## Accessibility

- Keyboard: native. Tab to the chosen radio, arrows to move and choose, disabled radios skipped.
- Required: put `required` on the radios; the browser stops the form and says why.
- Contrast: circles, rings and dots are 3:1 or more on every surface (WCAG 1.4.11), tested for every palette and theme.

## Budget

Behaviour 5.8 KB of 12 KB (`radio.js` + `radio.core.js`); skins 0.3, 2.5 and 1.4 KB.
