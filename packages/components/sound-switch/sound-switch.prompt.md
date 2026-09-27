# Sound switch

*The one control that turns a page's sound on or off, and the user's own gesture for doing it.*

```html
<link rel="stylesheet" href="susegad/components/sound-switch/sound-switch.css">
<script type="module" src="susegad/components/sound-switch/sound-switch.js"></script>

<sg-sound-switch>
  <label><input type="checkbox" role="switch"> Sound</label>
  <small class="sg-sound-switch-note">Turning sound on needs JavaScript.</small>
</sg-sound-switch>
```

## The prompt

Make a sound switch web component over a native `<input type="checkbox" role="switch">`: the checkbox is the whole control, it reads and writes one shared on/off setting stored in `localStorage`, and checking it is the only thing on the page allowed to make the first sound, because that click is the user's own gesture. Without JavaScript the checkbox still exists and is still announced as a switch, but nothing it does has an effect, since there is no sound without JavaScript; say so in a small note next to it, and hide that note once the element is running. Give it three registers. Quiet: the plain switch, no drawing. Warm: draw a small speaker beside the track, with a line struck through it when the switch is off and two arcs of sound in its place when it is on, faded between the two on a CSS transition under 200ms. Playful: the same speaker, but while the switch is on and the element is on screen, breathe the two arcs gently from seeded noise, so two switches on the same page never pulse in step, and hold them still under reduced motion, in quiet motion, or off screen. Keep every switch on the page in sync with the shared setting, so checking one checks them all.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| the checkbox is the whole control | native first | `static native = 'input[type="checkbox"]'`; `role="switch"` is added if missing. The component adds `role` and a drawing only; the checkbox carries the keyboard, focus and screen-reader behaviour on its own. |
| reads and writes one shared on/off setting stored in localStorage | shared state | `soundOn()`/`setSoundOn()` (`packages/sound/switch.js`) own `localStorage['sg-sound']`, wrapped in try/catch. The element only calls them; it holds no state of its own. |
| checking it is the only thing … allowed to make the first sound | consent | `setSoundOn()` runs inside the checkbox's own `change` handler, itself a user gesture, which is exactly when `switch.js` is allowed to resume the shared `AudioContext`. Turning it on also calls `play('confirm')` right there, so the tap and the first sound are the same gesture. |
| nothing it does has an effect … say so in a small note | fallback | `sound-switch.css` shows a `<small class="sg-sound-switch-note">` by default and hides it only once the element sets `data-ready`, which only happens with JavaScript running. |
| a line struck through … two arcs of sound | redundancy | `SPEAKER` in `sound-switch.core.js` holds the body, two arc paths and a slash as plain SVG path data. `[data-on]` on the drawing shows the arcs and hides the slash, or the reverse; the state is a shape, never colour alone. |
| breathe the two arcs gently from seeded noise … never pulse in step | noise | `pulse(t, seed)` reads Perlin noise seeded by the element (its `seed` attribute or id), so no two switches share a phase. `waveAnimation(motion, on, seed)` samples it into Web Animations keyframes, or returns null to hold still. |
| keep every switch on the page in sync | shared state | Every instance calls `onSoundChange(on => …)` and writes the checkbox back only when it disagrees, so one page can hold as many switches as it likes without an event loop. |

## Accessibility

- `role="switch"` on the native checkbox; the label you write is what is read.
- The drawing is `aria-hidden="true"`; nothing about the switch's state is said only by a shape or a colour.
- Forced-colours mode brings back the system's own control and hides the drawing.
- The no-JS note keeps the page honest: it never implies sound works where it cannot.
