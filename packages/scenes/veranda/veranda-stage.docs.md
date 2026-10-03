# Veranda stage

`<sg-veranda-stage>` shows the drawn veranda (`scene-veranda`) in 3D and puts the page's words on a frosted pane **inside** it. The words stay real text in the page: in the accessibility tree, selectable, translatable, at every depth and in every tier. The drawing, its exact depth map and three.js only decide how it looks and where it shows.

```html
<link rel="stylesheet" href="susegad/stage3d/depth-photo/depth-photo.css">
<script type="module" src="susegad/scenes/veranda/stage-element.js"></script>

<sg-veranda-stage register="playful" pane-depth="0.3">
  <h2>Come and sit</h2>
  <p>The lamp is on at six.</p>
  <p data-flow>The clay pot on the seat is where the water is kept cool. It turns, slowly, when nobody is looking.</p>
</sg-veranda-stage>
```

The picture and its depth map are made at load from the veranda's own solids (no photograph, no depth model). three.js is requested only when the picture will move, and then from the smaller vendored build (`stage3d/vendor/three.named.js`, 135,588 bytes gzipped against 192,931 for the whole module).

## What you can do

| | Pointer | Keyboard |
|---|---|---|
| Move the pane across the picture | drag the grip at its corner | arrow keys on the grip, Shift for bigger steps, Home puts it back |
| Bring it forward or send it back | the wheel over the grip | Page Up and Page Down on the grip |
| Look through the glass (playful) | the button in the pane | the same button |
| Move a note to another place | drag the note's grip and let go | arrow keys on the note's grip |

- **Things in front hide the pane.** A CSS mask made from the depth map at the pane's depth hides the pane where something is nearer, for the camera as it stands: each near pixel of the map is placed where the camera puts it, so a walk moves the near things more than the far ones. Push the words back and they pass behind a pillar.
- **Focus follows the words.** The pane's depth is the picture's focus: its plane is sharp and the rest softens (a short rack in warm, none in quiet or under reduced motion).
- **Readable, and never over other words.** The rule is held line by line, and held all the time, not only when you let go: if any line has more than 15% of its area behind something nearer, or the pane's box meets a note or the pot's pane, the pane settles (throttled to about eight times a second while the camera or the lens moves, once more when it stops). It stays if it can, comes forward if that is enough, and moves only when it must, and it says so. The words start where they can be read. A hand on the grip is never argued with.
- **The lens.** In playful, a button in a strip below the words turns the pane into a window on the same veranda in the monsoon, then at dusk, drawn from the same solids and seen only inside the pane's rect. The words stay one block on one plate, exactly where they were with the lens off; the strip and the pane's rim show the other weather at full strength. It is a 2D overlay on both tiers, so on the live tier it does not lean with the camera the way the picture does.
- **Notes stay with the place.** `addNote({ anchor, text })` sticks a small note to the window, the door, the near pillar, the balcão seat, the brass lamp or the mango tree. It follows the camera through `place()`, and each note is also in a plain list. A note dropped by its grip finds its surface from the depth map under the drop. A note stands where its pointer touches its anchor and it meets no other words: above and to the right if it can, else another side, else higher up with a longer pointer.
- **The walk.** With `walk`, scrolling dollies the camera down the veranda and stops at each note, nearest first, with the note in focus. In quiet, with reduced motion and on the 2D tier, one still per stop.
- **The pot.** A paragraph marked `data-flow` sits on its own glass pane beside a clay pot that three.js turns on the seat, drawn where the seat is in the picture. The pot stands at the pane's corner, about a third of it outside the glass, and its silhouette is projected into a width per line: the first lines are shorter, Pretext lays the paragraph round it, re-laid sixteen steps a turn. The pot's pane is one of the things the words pane keeps clear of. On the 2D tier, in quiet and with reduced motion, the pot is a still and the lines are laid once.

## Attributes, properties, events

| | |
|---|---|
| `pane-depth` | 0.10 (far) to 0.85 (near); the pane starts at 0.30 |
| `words-at` | `"x y"`, the pane's place as fractions of the room it has to move in (core's movable); nothing is stored inside |
| `lens` | `monsoon` or `dusk`; only in playful, with motion |
| `mood` | `day`, `dusk` (the default in a dark theme, with the lamp lit) or `monsoon` |
| `walk` | scroll dollies the camera and stops at each note |
| `alt` | the picture's text alternative (there is a default) |
| `paneDepth`, `wordsAt`, `notes`, `noteTexts`, `anchors`, `calm` | properties; `notes` is `[{ anchor, text }]` with `text` an index into `noteTexts`, so a postcard carries ids and never words |
| `sg-words-moved`, `sg-pane-depth`, `sg-notes-changed`, `sg-calm`, `sg-flow`, `sg-ready` | events |

Remembering is the page's job: `words.html` writes `#notes=door.1,lamp.0` (anchors and text ids) with `history.replaceState`, and reads it back; anything the page does not know is dropped.

## Registers

| | Pane | Moves |
|---|---|---|
| quiet | a flat opaque plate at rest; no grip, no mask | nothing; the picture is its still, three.js is never asked for |
| warm | frosted glass, movable; the depth mask; focus racks | the lamp, the pot, the camera on scroll |
| playful | glass that also becomes a lens | the same, and the hand leans the camera |

Reduced motion, Save-Data and stages narrower than 35 rem (or words covering more than 45% of the picture) put the words flat below the picture, with no grip and no mask. Without WebGL, with three.js blocked, or before it has loaded, the finished drawing shows in 2D with the words readable on it.

## Accessibility

- Every word on the pane, in a note and in the paragraph is in the page as text. The grips are real buttons with names; the status lines say where the words or a note are in plain words, never numbers.
- A note in the picture is never the only copy: there is a list of them under the picture.
- The lens is decoration: the words' plate holds 4.5:1 against every pixel behind it (checked with the plate off as the control).

## Known limits

- The mask is remade only once the camera has been still for about 170 ms (a vector image, from a 3-pixel grid), so during a scroll it is the last still's and an edge is exact only to three pixels. What keeps the words readable meanwhile is the settle, which works from the grid for the camera as it stands and runs about eight times a second. Remaking the mask while the picture moved made this machine's integrated GPU stall for a second (see below). It follows the camera, not playful's lean (the element does not set one).
- Two panes of frosted glass (`backdrop-filter`) over a picture that moves made the same GPU stall for a second, at a random moment, in about half the page loads. So the pot's pane drops its blur (`[data-moving]`) while the camera is being set and for 260 ms after; the words pane keeps its blur. The check for it (`arrange.check`) fails on a build that keeps both blurs, on this machine; on a machine that does not stall it passes either way.
- On the 2D tier (no WebGL) the walk steps between one still per stop even with motion on: that tier repaints the whole picture on the CPU for every change of camera.
- A pane that must be clear of the notes, the pot and the roof often ends far forward (near the top of the range): the settle prefers the place the person chose to a depth they did not.
- Notes are stickers: they are drawn over the picture and do not hide behind things.
- The lens is not a WebGL render target (see above).
- The pot's pixels and its silhouette agree to about 4 px (the camera is slightly perspective); the layout leaves 18% of the pot's height clear.
- The element is 39 KB of source, over what a component usually declares. The lens, notes and walk could load lazily.
