# Diagram

A few lines of text become a diagram: boxes, arrows that draw, flows with things moving along them, and step-through. It is drawn when the document is built, so a sealed Folio document carries it as plain SVG that reads and prints without JavaScript. Every diagram has a text alternative made from the same source.

## Write one

```
title: How a booking travels
Portal = Booking portal
group Casa Exemplo: Owner, Caretaker
Guest -> Portal: books a stay
> The guest picks the dates and pays a deposit on the booking portal.
Portal => Owner: asks to hold
Owner -> Caretaker: readies the house
Owner -> Guest: confirms
```

| Line | Means |
|---|---|
| `A -> B: label` | an arrow from A to B, with an optional label |
| `A => B: label` | a flow: an arrow with things moving along it |
| `A <-> B: label` | both ways |
| `A -- B` | a plain line |
| `> words` | prose for the arrow just above: its step, read out and listed. Several `>` lines join up. |
| `Name = Label` | show a node under a longer label |
| `group Name: A, B, C` | a frame round A, B and C, named. A node is in one group at most. |
| `title: …` | the caption, and the name of the picture for screen readers |
| `direction: right` or `down` | which way the diagram runs. Default: right, turning down on a narrow screen. |
| `# …` | a comment |

Names are what you type (quotes are optional: `"Night watch" -> Owner`). A line it cannot read is reported with its line number, and the rest is still drawn.

## In a Folio document

```
:::diagram{title="How a booking travels" steps}
Guest -> Portal: books a stay
…
:::
```

The attributes are the options below; bare `steps` means true. (The directive syntax belongs to `packages/folio/md`.)

## From code

```js
import { renderDiagram } from './render.js';   // pure, synchronous, Node or browser
const { html, text, errors } = renderDiagram(src, { title, direction, register, steps, id, seed, lang });
```

| Option | Values | Default |
|---|---|---|
| `id` | a stable id for the figure | a hash of the source |
| `title` | overrides `title:` in the source | |
| `direction` | `right`, `down`. Chosen here or in the source, it is kept on every screen. | from the source, else right |
| `register` | `quiet`, `warm`, `playful`: the look drawn into the static SVG | `warm` |
| `steps` | add step-through, and list the steps | false |
| `seed` | fixes the hand-drawn wobble | the id |
| `lang` | the figure's `lang` | |

- `html`: `<sg-diagram>` holding a `<figure>`: caption, SVG, and the text alternative. It uses classes and presentation attributes only, never `style=""`.
- `text`: the text alternative as plain text.
- `errors`: `[{ line, message }]`, line numbers counted from the first line of `src`. A line the grammar cannot read is reported and left out; the rest still draws. A line with an arrow mark that is not a whole connection (`A ->`, `-> B`, `A -->`) or with two arrows (`A -> B -> C`) is an error, never a box. `renderDiagram` does not throw on a bad source.

The page needs `diagram.css`, and `diagram.js` for the live parts. Both are only needed once per page.

## In the page (`diagram.js`)

- **Arrows draw** one after another the first time the diagram comes into view. In warm and playful the inked line is revealed through a mask on a stroke dash, and in quiet the line itself draws. These are Web Animations, cancelled once they finish.
- **Flows move**: dots travel along each `=>` arrow, three in warm and five in playful. They pause off screen. In quiet and under reduced motion they stay as three still dots, which is also what the static SVG and print show.
- **Step-through** (with `steps`): Previous step and Next step buttons, with the arrow keys, Home and End while focus is on them. The current step's arrow and its two ends stay sharp. The other lines fade back, but their words stay readable. A polite status line says "Step 2 of 4." and the step's words, and the list marks the step with `aria-current="step"`. At either end the button says it is unavailable (`aria-disabled`) but keeps focus. `element.step` gets or sets the step (0 shows all of them). The `sg-diagram-step` event carries `{ step, of }`.
- **Register**: if the page's register differs from the one drawn at build time, or changes later, it draws again from the same source and keeps the step.
- **Narrow screens**: a diagram that runs right, where the author did not choose a direction, draws again running down when it would otherwise shrink below about three quarters of its size.

## Registers

| | Boxes and lines | Motion |
|---|---|---|
| quiet | hairline boxes, plain lines and arrowheads, a dashed frame for groups | none beyond what a step needs (180 ms) |
| warm | boxes drawn in four inked strokes that cross at the corners, inked lines with the engine's wobble and pressure, labels and group names in the hand face | arrows draw once; flows move |
| playful | as warm, with boxes and groups tinted from the palette and flows in the accent colour | as warm, faster and fuller |

## Accessibility

- The SVG is `role="img"`, named by its title and described by the text alternative: the steps as an ordered list when there are steps, otherwise the parts and every connection behind "Read the diagram as text". Both come from the same model as the picture.
- Every step is readable without JavaScript. Step-through only adds a second way in.
- Words in the diagram use token text colours. Axe cannot measure SVG text, so contrast is checked by hand: box words are `--sg-text` on `--sg-surface-raised`; labels are `--sg-text-soft` with a halo in the surface colour; while stepping, the words of parts that are not current turn `--sg-text-soft` instead of fading.
- Buttons are real `<button>`s. Focus never drops.

## In a sealed document

No inline styles, no network, no `eval`. Built into a sealed Folio file, the demo made no requests and no policy violations and needed no runtime style hashes. Stepping and a register change also worked inside the sealed file, with the network blocked.

## Known limits

- The layout is layered and simple. Large or tangled graphs will cross lines. Aim for up to a dozen boxes.
- Text widths are estimated in Node, not measured, so an unusual font can make a box a little wide or tight.
- A group's frame is a rectangle round its members. Outsiders in the ranks it spans are pushed clear, but groups that interleave across ranks can still overlap each other.
- Without JavaScript on a phone, a wide diagram scales down. Its text alternative is always readable.
