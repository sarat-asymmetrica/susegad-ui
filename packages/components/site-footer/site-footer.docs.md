# Site footer

`<sg-site-footer>` is the closing block every site needs. It enhances a native `<footer>`.

## Markup

| Element | What it is |
|---|---|
| `footer` | the native footer itself; the element adds `aria-label="Site footer"` if you gave the footer no label |
| `p.sg-site-footer-sign` | the sign-off line, one sentence in the site's own voice |
| `nav.sg-site-footer-links` with a `<ul>` | the links a reader may still want (contact, privacy, licences). Optional. Give the nav its own `aria-label`, since "Footer" alone says nothing a second footer nav could share |
| `p.sg-site-footer-small` | the small print: copyright, ownership, a line about the place |

Everything inside is your copy. The element writes only one thing: the year of the small print.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `now` | an ISO date to count from, for demos, tests and print; it stops the clock | the real clock |
| `seed` | the drawing's seed (the pencil rule, the stamped angles) | the sign-off line |
| `register` | `quiet`, `warm`, `playful` | inherited |

Event: `sg-site-footer-year` `{ year }`, when the small print's year moved on.

## The year moves forward, once

The small print's copyright year is compared with the clock's year on load:

| The markup says | The clock says | The footer shows |
|---|---|---|
| 2024 | 2026 | 2026, and the page hears `sg-site-footer-year` |
| 2026 | 2026 | 2026, untouched |
| 2027 | 2026 | 2027. A year written ahead keeps; the footer never rolls back |
| no year anywhere | any | nothing. The element never invents a year |

Put the year in a `<time datetime="2026">2026</time>` and the element keeps the attribute and the text in step. Without a `<time>`, it rewrites the first year it finds in the line's own text. Without JavaScript nothing moves: what you wrote is what people read, so write the year you mean.

## Registers

| | Look |
|---|---|
| quiet | a hairline rule, the sign-off in the display face, links in a row, the small print in soft text |
| warm | the top rule becomes a pencil line, the sign-off moves to the hand, and a drawn pencil rule sits under it, fitted to the width of the words (the widest line), not the block they sit in, each visit the same for a seed |
| playful | a bold rule, the sign-off large in the hand, and the links set down like stamped chips, each at its own small seeded angle, with a short hop when pointed at |

Reduced motion keeps every register still: the hop is the only movement, and it is off.

## Accessibility

- A native `<footer>` (contentinfo) with a nav that carries its own label.
- Links are plain links: they take Tab and show a 2 px focus ring; a chip is at least 44 px tall, so the playful stamp keeps its target size.
- The pencil rule and the stamped angles are `aria-hidden` drawing; nothing is said only by the drawing.
- Without JavaScript the written markup reads in full, in the quiet look.
