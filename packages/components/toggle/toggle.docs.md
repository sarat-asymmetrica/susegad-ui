# Toggle

`<sg-toggle>` wraps one native `<input type="checkbox" role="switch">` and its label. It submits and takes Space with or without JavaScript, and a screen reader calls it a switch.

## Use

```html
<link rel="stylesheet" href="susegad/components/toggle/toggle.css">
<script type="module" src="susegad/components/toggle/toggle.js"></script>

<sg-toggle>
  <label><input type="checkbox" role="switch" name="reminder" value="whatsapp" checked> A WhatsApp reminder the day before</label>
</sg-toggle>
```

When off, a switch sends nothing (like any checkbox). Read it on the server as "present means on".

## Attributes and properties

| | Values | Default |
|---|---|---|
| `seed` | any string, for the lamp's flicker | the label |
| `register` | `quiet`, `warm`, `playful` | inherited |
| `checked` (property) | boolean; setting it fires `input` and `change` | the input's |

## Registers

| | Look | Motion |
|---|---|---|
| quiet (and no JS) | a plain track and thumb; on fills the track with the accent | the thumb slides under 200ms |
| warm | a brass tower bolt; on, the bolt is in the keeper and the handle is down | the bolt slides on the register's spring |
| playful | a clay diya; on, a flame and a glow | the flame flickers while lit and on screen |

Reduced motion: no movement anywhere, the bolt already home, the flame still. Forced colours: the system control.

## Accessibility

- Keyboard: Tab to it, Space to switch.
- The state is always a shape (thumb side, bolt position, flame) outlined in the text colour, never colour alone.
- Contrast: track edge, filled track, thumb and outlines are 3:1 or more (WCAG 1.4.11), tested for every palette and theme.

## Budget

Behaviour 5.3 KB of 12 KB (`toggle.js` + `toggle.core.js`); skins 0.3, 2.2 and 1.6 KB.
