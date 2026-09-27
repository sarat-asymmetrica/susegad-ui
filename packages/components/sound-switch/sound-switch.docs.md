# Sound switch

`<sg-sound-switch>` is the one control that turns Susegad's sound switch on or off, site-wide. It wraps a native `<input type="checkbox" role="switch">`; the checkbox is the whole control.

## Use

```html
<link rel="stylesheet" href="susegad/components/sound-switch/sound-switch.css">
<script type="module" src="susegad/components/sound-switch/sound-switch.js"></script>

<sg-sound-switch>
  <label><input type="checkbox" role="switch"> Sound</label>
  <small class="sg-sound-switch-note">Turning sound on needs JavaScript.</small>
</sg-sound-switch>
```

Put one anywhere a page offers the setting: a header, a settings panel, the first scene that would use sound. More than one on a page stay in sync with each other, because they all read and write the same switch (`packages/sound/switch.js`).

## What it does

- On connect, the checkbox is set to `soundOn()`. Checking or unchecking it calls `setSoundOn()` from inside the browser's own `change` event, so that click or key press is the user gesture `switch.js` needs to resume the shared `AudioContext`: turning sound on and hearing the first sound can be the same tap. Turning it on also plays `confirm`, the switch's own first sound.
- Every `<sg-sound-switch>` on the page listens for `sg-sound-change` and follows: check one, and the rest (and anything else reading `soundOn()`) update without a page reload.
- **Without JavaScript** the checkbox is still there, still announced as a switch, and still takes Space — but nothing it does has an effect, because there is no sound without JavaScript. A `<small class="sg-sound-switch-note">` beside it says so in words; this element hides that note once it is running.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `register` | `quiet`, `warm`, `playful` | inherited |
| `seed` | any string (playful only: which arc breath this switch plays) | the element's `id`, or a fixed default |

## Registers

| | Look | Motion |
|---|---|---|
| quiet | the native switch, hairline, no drawing | none |
| warm | a small speaker beside the track; a struck-through line when off, two arcs when on | the switch fades between the two on a CSS transition, under 200ms |
| playful | the same speaker; the two arcs also breathe gently while it is on | a slow Web Animation, seeded so two switches never pulse in step; paused off screen and under reduced motion |

## Accessibility

- The checkbox carries `role="switch"`; a screen reader says "switch, Sound, on" or "off", from the `<label>` text you write.
- The speaker drawing is `aria-hidden`; the state is never carried by the drawing alone, only by the checkbox itself.
- Forced-colours mode returns the system's own checkbox in the system's own colours; the drawing is hidden.
- The "needs JavaScript" note means the no-JS page never implies sound is available when it is not.

## Budget

| File | Bytes |
|---|---|
| `sound-switch.js` + `sound-switch.core.js` (behaviour) | within 12 KB |
| `skins/quiet.js` | well under 8 KB |
| `skins/warm.js` | well under 8 KB |
| `skins/playful.js` | well under 8 KB |

Nothing runs per frame except a playful switch's single Web Animation, while it is on and on screen.
