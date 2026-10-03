# Postcard

`<sg-postcard>` is a card for a piece of work: title, where and when with a status, the problem in a line, what was built, the outcome and a link. It enhances an `<article>`.

## Markup

| Element | What it is |
|---|---|
| `<article>` | required |
| `<h2>`–`<h4>` with one `<a href>` | the title and the card's only link; it covers the whole card |
| `p.sg-postcard-where` | the place and year, with the status as `<sg-badge>` beside them: `success` (Live), `accent` (Shipped), `info` (Experiment) |
| `.sg-postcard-face` with `.sg-postcard-problem` | the problem in a line (the picture side in playful) |
| `dl.sg-postcard-back` | the details: Built, Outcome, anything else as `dt`/`dd` pairs |

Keep other links out of the card; put them under it.

## Status: a badge, or a stamp when asked for

By default the status is a level badge on the where-line. A rubber stamp on every card reads as heavy, so it is opt-in: set `status-style="stamp"` and put an `<sg-stamp role="none">` in the article (as its last child) instead of the badge. It sits in the card's top corner; in warm it gets a postmark, lettered from the `postmark` attribute. The element warns if a card has a stamp without asking for one.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `status-style` | `badge`, `stamp` | `badge` |
| `postmark` | a place and year for the warm postmark, e.g. "Aldona 2026" (stamp style only) | no lettering |
| `seed` | the tilt and postmark's hand | the title |
| `register` | `quiet`, `warm`, `playful` | inherited |

## Registers

| | Look | Motion |
|---|---|---|
| quiet | an index card: a red hairline under the title, ruled lines under the details | none |
| warm | a postcard's back on card stock with a deckled edge: divider, address lines, a printed postage square with no word (the stamp and a postmark instead, in stamp style) | none |
| playful | tilted, hard shadow, the problem on a bright tile | turns over on hover or focus, where it may (below) |

The playful card turns over only with a hovering pointer and full motion. On touch screens, under reduced motion and without JavaScript, both sides show one above the other. The warm card's message side takes about two thirds from 44rem up. Below 44rem the address lines move up under the postage square (or stamp), beside the title and where-line, and the message runs the full width under a pencil rule, so real-length copy keeps six or more words a line (checked with fictional copy of a real card's length at 560 px). Below 30rem the address lines go.

## In a grid

Cards stretch to their grid cell's height (`height: 100%`), so a row of cards lines up. Leave about 10 px around playful cards for the tilt and shadow; the element pads itself by that much.

## Accessibility

- One tab stop per card; the whole card is the link's target; the focus ring goes round the card.
- The details are always in the DOM, in reading order.
- Contrast on the playful tile (on-accent on accent) and back (text on the highlighter) is tested in every palette and theme.
