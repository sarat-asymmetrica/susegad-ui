# Site footer

*The last block of a site: a sign-off in the site's own voice, the links a reader may still want, and the small print.*

A native `<footer>` with three paragraphs in it, so it works with no JavaScript at all. With JavaScript, the copyright year in the small print moves forward to the clock's year, once, and never back, and the page hears when it did.

```html
<link rel="stylesheet" href="susegad/components/site-footer/site-footer.css">
<script type="module" src="susegad/components/site-footer/site-footer.js"></script>

<sg-site-footer seed="The Paper Boat Studio">
  <footer aria-label="Site footer">
    <p class="sg-site-footer-sign">Drawn, printed and posted from Aldona.</p>
    <nav class="sg-site-footer-links" aria-label="Footer">
      <ul>
        <li><a href="/work/">Work</a></li>
        <li><a href="/visit/">Visit</a></li>
        <li><a href="/privacy/">Privacy</a></li>
      </ul>
    </nav>
    <p class="sg-site-footer-small">&copy; <time datetime="2026">2026</time> The Paper Boat Studio, Aldona. All drawings belong to the studio.</p>
  </footer>
</sg-site-footer>
```

## The prompt

Make a site footer web component around a native `<footer>`: a sign-off line in a paragraph, a nav of plain links in a list (optional), and a small print line for the copyright and a word about ownership. Give it three registers. Quiet: a hairline rule along the top, the sign-off in the display face, the links in a wrapping row with 44 px targets, the small print small and soft. Warm: the top rule becomes a pencil line, the sign-off is written in the hand, and a pencil rule is drawn under it, two strokes, fitted to the width of the words themselves (measure the text, not the paragraph's box, or the rule runs on past the writing), wandering a little with seeded noise so it is the same drawing on every visit for a seed. Playful: a bold rule, the sign-off large in the hand, and each link set down like a stamped chip at its own small seeded angle between 0.6 and 2.2 degrees, with a short 2 px hop when the pointer is over it, gated on reduced motion, nothing loops. With JavaScript, read the small print's copyright year and move it forward to the clock's year, once: a written year ahead of the clock keeps, a footer with no year in it is left alone, and the year never rolls back. When the year moves, tell the page with an event. Take a `now` attribute so demos, tests and print can stop the clock. The sign-off, the links and the small print are the author's words; the component writes nothing in them.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| moves forward to the clock's year, once | `yearTo(written, now)` | The clock's year wins only when it is ahead of the written one. A year written ahead keeps, the year never rolls back, and anything that is not a whole year between 1900 and 2999 is not a year at all. |
| a footer with no year is left alone | `yearIn(text)` | The first four-digit year in the small print, or null. With null, `yearTo` changes nothing: the element never invents a year. |
| keeps the attribute and the text in step | the element's `#roll()` | With a `<time datetime="2026">` both the attribute and the text are rewritten; without one, the first year in the line's own text nodes is, so links and spans around it survive. |
| tell the page | event | `sg-site-footer-year` `{ year }`, a bubbling, composed event, fired only when the year actually moved. |
| demos, tests and print can stop the clock | the `now` attribute | `Date.parse` of `now` when it reads, `Date.now()` when it does not. |
| two strokes, fitted to the width of the words | `wordsWidth()` and `rulePath(w, seed)` in the warm skin | A Range over the sign-off's text gives the widest line's width (the paragraph's own box would be the column's width). A path is plotted every 5 px across it, twice: the second pass sits 0.8 px lower and lighter. Wander comes from seeded noise (wobble 0.8), so a seed is the same drawing every visit. A line narrower than 8 px is not drawn. |
| its own small seeded angle between 0.6 and 2.2 degrees | `stampTilt(seed, i)` in the playful skin | One seeded angle per link, signed, set as `--sg-footer-tilt`. |
| a short 2 px hop ... nothing loops | CSS only | The playful chip translates 2 px up on hover, with the spring ease, under `prefers-reduced-motion: no-preference` and `data-motion="full"`. No timers, no loops. |
| the sign-off ... are the author's words | native first | The element writes one thing, the year. Everything else is the markup you gave it, which is what a reader without JavaScript sees. |

## Accessibility

- A native `<footer>` (contentinfo); the nav inside carries its own `aria-label`.
- Links are plain links: Tab reaches them, the focus ring is 2 px, and the stamped chips stay at least 44 px tall.
- The pencil rule and the stamped angles are `aria-hidden` decoration.
- The year's movement is also an event, so a page can say it in its own words.
- Without JavaScript the written footer reads in full, in the quiet look.
