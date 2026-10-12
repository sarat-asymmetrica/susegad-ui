# Bubble

*A speech, thought or shout bubble: the crow's remark in a village scene, a caption in a comic strip, a shopkeeper's aside on a menu.*

The page writes the words. The bubble is only the drawing around them, and in warm and playful the words are laid into the drawing's real shape.

```html
<link rel="stylesheet" href="susegad/components/bubble/bubble.css">
<script type="module" src="susegad/components/bubble/bubble.js"></script>

<sg-bubble kind="thought" tail="bottom-left" speaker="Crow">
  <figure>
    <p>Perhaps the fish will still be there tomorrow.</p>
  </figure>
</sg-bubble>
```

## The prompt

Make a bubble web component around a native `<figure>` that holds one paragraph, the page's own words, and optionally a `<figcaption>` naming who is speaking. It has a `kind` (speech, thought, shout), a `tail` (bottom-left by default; bottom, bottom-right, top-left, top, top-right, left, right, or none), a `speaker` and a `size`. Everything a reader needs is in that HTML; the component never adds words except a caption only a screen reader sees, when the page names a speaker and does not write a figcaption ("Crow thinks"). Give it three registers. Quiet: a hairline rounded callout with a small tail, the words as plain CSS text, no drawing and no script (a thought is dotted, a shout firm). Warm: draw the bubble as an SVG inside the paragraph, hand-inked, with a pen that wanders a little: a rounded speech balloon with a curved tail, a thought as a cloud of bumps with a trail of three small circles, a shout as a burst of spikes whose tail is one long spike; then lay the words into the shape the bubble really has, a line at a time, so the lines follow the curve. Playful: a bolder pen, a warm fill, an offset shadow, a small tilt from the seed, a torn edge on a shout, and a pop out of the tail's tip the first time it is on screen. The words must stay real text: one span per line inside the paragraph, selectable and read in order. Under reduced motion, or when the paragraph holds markup, let CSS lay them: two floats whose `shape-outside` is the same shape. If the words do not fit at 14 px or more, grow the bubble taller, then fall back to a plain rounded box that grows with the text. Never clip a word and never set it under 14 px.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a native figure that holds one paragraph | native first | The quiet look is `bubble.css` alone. Without JavaScript it is complete. |
| a caption only a screen reader sees | made figcaption | `speaker="Crow"` with no figcaption adds a hidden one: "Crow says", "Crow thinks", "Crow shouts". A figcaption the page wrote is never touched. `label` is the whole caption in the page's own language, and needs no `speaker`. |
| a pen that wanders a little | seeded noise, Catmull-Rom | `bubbleModel` walks a superellipse with `makeNoise`, through the engine's `catmull`. Same seed and size, same drawing. |
| a cloud of bumps | circle arcs | The thought is an ellipse with nine to sixteen arcs hung on it, each a little over a chord; the words sit in the ellipse. |
| a burst of spikes | polygon | Outer points and valleys alternate; the tail grows out of the nearest spike. The words sit in the ring of valleys, a polygon zone. |
| lay the words into the shape | text zones | `textZones(state)` returns a zone descriptor; `layZones` (the type tier) sets the largest legible size and centres the block. One span per line inside the paragraph. |
| only when it is seen | lazy door | `skins/body.js` loads `skins/bubble.live.js` by `import()` (it holds the one static import of `type/operators.js`, and so Pretext) only at warm or playful with motion on, and only for a plain-text paragraph. Quiet, reduced motion and no JavaScript never ask for it. |
| the lines follow the curve in the still | CSS shape-outside | Two floats, half the width and the full height each, whose `shape-outside` is the zone's left and right edge; the browser sets the text between them. |
| grow, then flow | sizeBubble, plain model | The bubble grows taller to 0.9 of its width; past that, a rounded box with the same tail grows with plain CSS text. |
| a pop out of the tail | Web Animations | `arrive(motion, register, tip)`: opacity and transform only, from the tail's tip, once, never under reduced motion. |

## Accessibility

- The reader gets the figure: the words as the page wrote them, then the caption.
- The drawing and the float shapers are `aria-hidden` and hold no text.
- Words are never smaller than 14 px, never clipped, and stay selectable.
- Forced colours: the outline is CanvasText on Canvas and the shadow is dropped.
