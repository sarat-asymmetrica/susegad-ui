# Veranda stage

*The page's words on a frosted pane inside a drawn veranda, at a depth: things in front hide it, the focus follows it, and a paragraph flows round a clay pot that turns.*

```html
<sg-veranda-stage register="playful">
  <h2>Come and sit</h2>
  <p>The lamp is on at six.</p>
</sg-veranda-stage>
```

## The prompt

Make a custom element that stages a drawing and its depth map through a depth-photo element, and puts the page's own words on a pane inside it. Keep the words as real text in the element's children and move them into a panel over the picture; nothing but their look is drawn. Make the pane movable with the library's movable module, attached to this element, and add a depth: Page Up and Page Down or the wheel over the grip change it. Hide the pane where something in the picture is nearer than the pane with a CSS mask made from the depth map: for each depth-map pixel nearer than the pane's own byte plus two, place it where the camera puts it (the picture's two corners at that pixel's depth) and mark the cells of a small grid it lands in, and make the mask an SVG image of the cells that show, remade only when the camera has been still for a moment. Keep the mask still in stage space while the pane moves by moving the mask's position the other way. Set the picture's focus to the pane's depth. Keep the words readable and clear of other words all the time, not only on release: when the pane is let go, and when the camera, the lens, a note or the pot changes what is in front, look at each line box; if any has more than fifteen percent hidden, or the pane's box meets another set of words, find the least change that fixes it, trying the pane's own place first and forward in depth, then the nearest free places on a sixteen-pixel lattice, and say so. Start the words in a readable place by doing the same before anyone sees them. In quiet, on a narrow stage, or with reduced motion, keep the words flat and the picture a still. In playful, add a button in a strip below the words that turns the pane into a lens: crop another still of the same drawing to the pane's rectangle and draw it into the pane, with one plate under the whole block of words, inset from the rim, so the words are exactly where they were. Let notes stick to anchors that are points on real surfaces, place each through the picture's own projection every frame so it follows the camera, standing on whichever side of its anchor meets no other words, find a dropped note's surface by the depth under it, cycle the anchors with the grip's arrows, and keep every note in a plain list too. Let scrolling walk the camera down the veranda, stopping at each note nearest first. Put a turning clay pot on the seat, drawn by three.js in its own small canvas, and put the paragraph on its own glass pane beside it with the pot straddling the pane's corner; project its vertices into a silhouette each frame, turn that into a width per line and lay the paragraph round it with the type tier, re-laying at sixteen steps a turn so a line never shifts every frame.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| keep the words as real text | fallback | The children move into `.panel`; the picture, the mask and the glass are only their look. Every check reads the accessibility tree. |
| attached to this element | interaction | `attach(this, { root, els: { stage, panel, toggle }, register, measure })` from core's movable: the grip, arrows, status line, `words-at` and `sg-words-moved`. Core is untouched. |
| a CSS mask made from the depth map | fields | `#buildMask()` turns the hidden grid into an SVG path of the shown cells (`shownPath()`) and sets it as `mask-image` on the panel, when the camera has been still. |
| moving the mask's position the other way | model | `#positionMask()` sets `mask-position` to the stage's offset from the panel, so the mask stays fixed in stage space. |
| the least change that fixes it | model | `settleSpot()` in pane.core.js: the pane stays if it can, else the cheapest of coming forward (bisected to a hundredth) and moving on a 16 px lattice, with the notes and the pot's pane as obstacles and the worst line held to 15% (2% when it moves). |
| where the camera puts it | model | `hiddenGrid()`: a forward splat of the depth map through `place()` for each depth byte; the mask and the settle read the same grid. |
| a lens | texture | `#drawLens()` crops the monsoon or dusk look to the pane's rect through the picture's two corners and draws it into a canvas inside the pane; `.panel.lens::after` is the one plate. |
| anchors that are points on real surfaces | model | `ANCHORS` in world.js: metre coordinates on the shutter, the door leaf, the pillar's face, the seat, the lamp and the mango's trunk, each tested to lie on its solid. |
| the picture's own projection every frame | interaction | `#placeNotes()` calls `place(u, v, d)` for each note's anchor whenever the picture's corners move. |
| the depth under it | fields | `nearestAnchor()` scores the anchors by picture distance plus the depth difference. |
| stopping at each note nearest first | easing | `walkAt()`: each stop owns an equal share of the scroll, the first 45% moving the camera, the rest holding. |
| its own small canvas | shader | matka-view.js builds a lathe, a torus and a tube in three.js and renders them with two lights into a transparent canvas. |
| a width per line | model | `flowShape()` returns the wider side of the column beside the silhouette from `extentIn()` over the projected vertices; the type tier's `layIntoShape()` lays the lines. The column ends at the pot's middle, so the pot straddles the pane's edge. |
| sixteen steps a turn | easing | `quantise()`: the layout is redone only when the turn's step changes, and the lines that have not changed are not written. |

## Accessibility

Every word is real text. The pane, the lens, the notes and the pot are decoration around it; each note is also in a list, each grip is a named button, and status lines say what moved in plain words. Quiet, reduced motion, narrow stages, no WebGL and no three.js all keep the words readable on a finished still.
