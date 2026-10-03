# Carepa: the surface

A surface is a scene-like backdrop: a pure model, a renderer and a still, but
no slotted reading zone of its own (compare `docs/CHARTER.md`'s scene
contract). Carepa is the warm and playful register's backdrop for Dialog and
Drawer, and any other place that needs "content present but not legible":
the page behind stays present but is never readable as text through it.

## After, what we took, what we left

*After* the carepa windows of old Goan houses: rooms glazed not with clear
glass but with small, flat panes cut from the windowpane oyster, so what is
outside comes in only as soft colour and moving light, never as detail.

*What we took*: the same job, done for a screen. A backdrop that keeps the
page behind it present, but never lets it be read as text, pane by pane, the
way the shells never let the lane outside be read as a lane.

*What we left*: the shells themselves, and the room they came from. This
surface is drawn, not photographed, and it draws a window, not that one.
Ported by copying from the sketchbook's Carepa plate
(`C:\Projects\asymmetrica-web\explorations\susegad\pieces\carepa.js`, read
only, commit `06ec47e` on `explore/susegad`), per
`docs/requests/2026-09-25-volume-iii-harvest.md`. The plate's second round
fixed a fault it called "too see-through"; this port keeps that fix by
painting the room opaque first (`room()` in `render.js`), so nothing of the
real page ever shows through the surface — only the drawn, blurred world
outside the window does, and only as colour.

## Usage

```js
import { mount } from './surfaces/carepa/index.js';

const host = document.querySelector('.scrim'); // sized by CSS to fill its container
const carepa = mount(host, { seed: 1, register: 'warm', reducedMotion: false });

// later
carepa.setRegister('playful'); // brighter, more of the shells catch light
carepa.reseed(2);
carepa.still();                // the finished reduced-motion frame
carepa.destroy();
```

`host` should have `.sg-carepa-css` (from `carepa.css`) for the no-JavaScript
and no-canvas fallback: a plain, dimmed, tokens-only wash. `mount()` appends
a `canvas[aria-hidden="true"]` inside `host` and the CSS steps its own
background aside once the canvas is there (`:has(canvas)`), so nothing is
painted twice.

## Registers

- **Quiet** never mounts carepa (per Wave 5's brief): Dialog and Drawer use a
  plain dimmed CSS backdrop instead. Carepa is warm and playful only.
- **Warm**: the shells catch pink, green and blue at their own angle from the
  pointer (or from `driftSun(time)` when nothing points at it).
- **Playful**: `register: 'playful'` raises `model()`'s `brighten` to 1.35,
  so every shell catches more light, not only the ones nearest the pointer
  ("the same, brighter and more of them").

## Accessibility and honesty

The surface is `aria-hidden`: it carries no meaning of its own, only
theatre (A2). The dialog or drawer's own content is what a screen reader
and a no-JavaScript visitor see; carepa never stands in for that content.
Reduced motion shows one finished still, drawn once, with the pointer
treated as outside the window so the light sits where `driftSun(4.2)`
(the plate's own still time) leaves it. The surface pauses whenever its
host is not driving it (there is no independent `play()`/`pause()` for a
surface off screen the way a `<sg-scene>` has one; Dialog and Drawer call
`mount()` only while open, and `destroy()` on close, so nothing runs behind
a closed dialog).

## Performance

Cover-fit scaling means the composition is always drawn at its own 1200×820
logical resolution and stretched by the canvas's own transform, exactly like
`stage()`'s device-pixel handling elsewhere in the library, so a very wide or
very tall host never costs more geometry, only a different scale factor.
Painted-once layers (`room()`, `shells()`) are cached per seed on plain
offscreen canvases and blitted with one `drawImage` a frame (A4); only the
pointer-driven sheen gradients and the small "outside" canvas (a tenth
size) redraw live.
