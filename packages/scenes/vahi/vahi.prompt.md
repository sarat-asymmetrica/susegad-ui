# Vahi

*Marathi: a notebook, and the account book a shop keeps its days in.*

Receipts, invoices, a carbon bill book and a scrawled chit lie in a heap on a teak table. One at a time, each paper lifts, drifts over the open account book while its line is written, and settles on a neat stack. When the last line is in, the book closes and its string is wound round.

```html
<script type="module" src="susegad/scenes/vahi/index.js"></script>

<!-- an illustration beside the words -->
<sg-scene name="vahi" register="warm">
  <h2>Run your back office</h2>
  <p>Bills, invoices and the books, kept in one place.</p>
</sg-scene>

<!-- a real records import: set progress from the work, never from a timer -->
<sg-scene name="vahi" progress="0" label="Records sorted"></sg-scene>
```

## The prompt

Draw a teak table seen from directly above, on a canvas with no image files. Paint the planks once into an offscreen layer: a warm wash, long flowing grain lines from smooth noise, a knot or two, and window light falling off across the table. On it lies a loose pile of paper: long thermal receipts torn at both ends, invoices folded in three with a ruled table, a pink or yellow carbon bill book slip with its perforated stub, and a small chit torn from a ruled notebook with pencil scrawl. Paint each paper once as a sprite with its own soft shadow, and draw the sprites turned and lifted each frame. Beside the pile, a red cloth account book lies open, ruled in pale blue with red columns, last month in faded ink on the left page. One paper at a time, lift it, carry it in a gentle arc over the book, hold it while a pen writes its line on the right-hand page in cursive-looking scribble, then settle it squared-up on a neat stack. When the last line is written, swing the left board over the spine to close the book, clamp the stack with a steel clip, and wind a cotton string round the cover. Make it a pure function of time so it can be tested in Node, and stop drawing once the book is shut. Add a progress attribute from 0 to 1: when set, sort exactly that much and let time stand still. In the quiet register, draw only hairlines: the closed book beside the stack. In playful, let the pointer nudge loose papers, and a click throws the pile again. When text sits over the drawing, move the table's action into the largest clear space beside it.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| Paint the planks once into an offscreen layer | texture | The table is painted once per size and theme into a cached canvas (grain lines from Perlin noise, knots, a light gradient) and blitted every frame, so a frame never redraws wood. |
| Paint each paper once as a sprite with its own soft shadow | texture | Each paper is drawn once into its own small canvas at device resolution, with its shadow blurred once beside it. A frame only turns, lifts and places the eight sprites. |
| carry it in a gentle arc | easing | A paper's journey is four beats of its own time: lift (ease-out), drift over the book (ease-in-out along a bowed path), hold while the line is written, then settle on the stack (ease-in-out), with the shadow growing as it lifts. |
| cursive-looking scribble | wobble | A line of entry is a row of words made of looping humps, drawn with the engine's ink so its width breathes like pen pressure. The pen tip follows the end of the line being written. |
| Make it a pure function of time | model | model({ time, seed, register, params }) returns every paper's pose, the entries written, the pen and how far the book has closed. It runs in Node, and returns settled once the string is wound, so the element stops drawing. |
| when set, sort exactly that much and let time stand still | state | With progress set, the model ignores time: that many papers are on the stack and that many lines are on the page, the book closes only at 1, and the same number is read out as text. |
| move the table's action into the largest clear space | calm | fitAround measures the slotted text's boxes and scales the pile, book and stack into the largest clear band beside them. The table itself stays put. |
| a click throws the pile again | interaction | In playful, a click, Enter or Space reseeds the pile: every paper flies out from where it lay, pushed away from your hand, and the sorting starts again. Moving the pointer over loose papers shoves them along. |

## Accessibility

The drawing is decorative unless it shows progress. With `progress` set, the element says the same number in a polite status region, named by `label` ("Records sorted: 40% done"), at most once a second and only when it changes. Nothing is said only by the drawing: the page text carries the message. In playful, the drawing takes focus; the arrow keys move a hand that nudges loose papers, and Enter or Space throws the pile again. Quiet and reduced motion show the finished still: the closed book beside the neat stack.

## Credit

The red cloth account book tied with string is kept by shopkeepers and traders across India. Some communities also honour the new year's book at Diwali; this drawing shows only a plain cover, with no mark of worship.
