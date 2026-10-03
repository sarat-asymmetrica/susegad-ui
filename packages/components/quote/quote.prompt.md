# Quote

*A pull-quote or testimonial: what a guest wrote in the visitors' book, what a client said about the work, a line lifted from an essay.*

The words, who said them, their role and business, and a link to where they said it.

```html
<link rel="stylesheet" href="susegad/components/quote/quote.css">
<script type="module" src="susegad/components/quote/quote.js"></script>

<sg-quote>
  <figure>
    <blockquote><p>The order page does in one evening what took us a week of messages.</p></blockquote>
    <figcaption>
      <span class="sg-quote-who">Maya Fernandes</span>
      <span class="sg-quote-role">Founder, Aldona Organics</span>
      <a class="sg-quote-source" href="#voice-note">Hear the voice note</a>
    </figcaption>
  </figure>
</sg-quote>
```

## The prompt

Make a quote web component around a native `<figure>` with a `<blockquote>` and a `<figcaption>` holding the person's name, their role and business, and an optional link to the source. Everything a reader needs is in that HTML; the component only adds decoration, hidden from assistive technology, and never adds words of its own. Give it three registers. Quiet: the words in the display face beside a single hairline, the name below in small capitals, the role in a softer colour. Warm: write it in the hand face as a margin note, with a pencil bracket beside the words, drawn twice with a slight wander and fitted to their height. Playful: set the words large under a big hand-drawn opening quotation mark in the accent colour, made of two blots that ink in one after the other the first time the quote is on screen, with opacity and scale only, and not at all under reduced motion.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a native figure with a blockquote and a figcaption | native first | The quiet look is `quote.css` alone. Without JavaScript it is complete. |
| never adds words of its own | aria-hidden ornament | The bracket and the mark are SVG with `aria-hidden="true"`. The check compares what would be read with and without the skins. |
| a pencil bracket … fitted to their height | noise, ResizeObserver | `bracket(h, seed, wobble)` walks down the left edge with seeded Perlin noise, with short serifs at each end; two passes; redrawn only when the height changes. |
| two blots | Catmull-Rom, noise | `quoteMark(seed)` runs a spline through thirteen anchors of a "6" (a round head and a tail sweeping up), each nudged by noise, for each of the two marks. |
| ink in one after the other … opacity and scale only | Web Animations | `inkIn(motion, i)` gives a blot a fade and a settle from 1.35 times its size, the second 160 ms after the first, at full motion only. |

## Accessibility

- The quote is read as the figure: the words, then the caption.
- The source link has a 24 px target and a visible focus ring.
- Forced colours: the bracket and the mark use CanvasText.
