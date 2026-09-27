# Diagram

*The sketch on the back of an envelope that explains how the thing works, made from a few lines of text.*

Write `Guest -> Portal: books a stay` and get a diagram: hand-inked boxes and arrows that draw, flows with things moving along them, steps you can walk through, and the whole thing in words for anyone who cannot see it.

```
:::diagram{title="How a booking travels" steps}
Guest -> Portal: books a stay
Portal => Owner: asks to hold
Owner -> Guest: confirms
:::
```

## The prompt

Make a diagram grammar for documents. Read a small line grammar: `A -> B: label` for an arrow, `A => B` for a flow, `A <-> B` both ways, `A -- B` a plain line, `Name = Label`, `group Name: A, B`, `title:`, `direction: right|down`, `#` comments, and `>` lines that give the arrow above them a step description in prose. Report bad lines with their line numbers and draw the rest. Lay it out in layers: rank each box by its longest path from where the story starts, breaking cycles where they close; order boxes within a rank by their neighbours' positions, keeping groups together; join facing sides with cubic curves; loop arrows that go back beyond the boxes, and send arrows that skip a rank over the top. Keep boxes that are not in a group out of its frame. Work in rank and cross coordinates so the same code lays out rightward and downward. Render it as a string of SVG with no DOM, so a document build can seal it: classes and presentation attributes only, never inline styles. Make every diagram carry its text alternative from the same model: the parts and connections behind "Read the diagram as text", or the steps as an ordered list. Give it three registers. Quiet: hairline boxes and plain arrows. Warm: boxes drawn in four inked strokes that cross at the corners, and lines inked with the engine's wobble and pressure, returned as SVG outlines rather than painted. Playful: the same, with boxes tinted from the palette and flows in the accent colour. In the page, draw the arrows in once when the diagram comes into view with Web Animations on a stroke dash (through a mask for the inked ones), move dots along flows and pause them off screen, and add step-through with buttons, arrow keys and a polite live region that says each step. Leave flows as still dots in quiet and under reduced motion. Draw again if the register changes, and turn a rightward diagram downward on a narrow screen unless its author chose the direction.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a small line grammar | parsing | `parse(src)` reads line by line with a handful of patterns. Arrows are tried before `Name = Label`, because `=>` contains `=`. A `>` line joins the arrow above it while only descriptions come between. |
| rank each box by its longest path … breaking cycles where they close | layout | A depth-first walk from the sources, then from the order boxes first send an arrow, marks the edges that close a cycle. The others push each box's rank to one more than its predecessor's. |
| order boxes … keeping groups together | layout | Six sweeps sort each rank by the mean position of its neighbours in other ranks. Grouped boxes sort by their group's mean, so they stay side by side. |
| loop arrows that go back … over the top | layout | Back edges become a cubic curve out beyond the boxes, and beyond the labels on that side. Forward edges that would pass through a box in a middle rank arc over all the boxes instead. |
| rank and cross coordinates | layout | Everything is placed in (u, v): u along the ranks, v across them. Only at the end is (u, v) mapped to (x, y) or (y, x). |
| a string of SVG with no DOM | sealing | `renderDiagram` builds markup by hand and escapes every value. It uses no `style` attributes, so the Folio seal's Content-Security-Policy needs no extra hashes. |
| its text alternative from the same model | accessibility | `describe(model)` writes the summary, the parts (with their groups) and every connection ("Booking portal sends to Owner: asks to hold."). The SVG is `role="img"`, named by its `<title>` and described by that list. |
| four inked strokes that cross at the corners | ink | `inkBox` jitters the corners, bows each side a little and runs every stroke 2 to 5 units past its corner. `inkPath` is the engine's `ink()` recipe (resample, sideways noise wobble, breathing width, tapered ends), returned as the ribbon's outline. |
| draw the arrows in … through a mask | motion | The plain centreline carries a stroke dash animated from its length to 0. For inked lines, a white stroke along the centreline in a `<mask>` reveals the ribbon. Each animation is cancelled when it finishes. |
| move dots along flows and pause them off screen | motion | Each dot is a `<circle>` animated through 25 `translate()` keyframes sampled with `getPointAtLength`, looping, spread out by negative delays. An IntersectionObserver pauses and plays them. |
| a polite live region that says each step | accessibility | A `role="status"` line reads "Step 2 of 4." and the step's words. The list item gets `aria-current="step"`. The lines that are not current fade back, but their words stay in the soft text colour. |
| turn a rightward diagram downward on a narrow screen | layout | A ResizeObserver compares the element's width with the drawn width. Below about 72% it renders again with `direction: down`, unless the source or the options chose a direction. |

## Credit

Grown from the Susegad engine's hand-inked line and from the old habit of explaining how something works by drawing boxes and arrows on whatever paper is to hand. Tier: pan-Indian.
