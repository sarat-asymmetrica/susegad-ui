# Quote

`<sg-quote>` is a pull-quote or testimonial around a native `<figure>`.

## Markup

| Element | What it is |
|---|---|
| `<figure>` | required; the element enhances it |
| `<blockquote>` | the words, one or more `<p>`; add `cite="…"` if the source has a URL |
| `<figcaption>` | who said it |
| `.sg-quote-who` | the person's name |
| `.sg-quote-role` | their role and business |
| `a.sg-quote-source` | optional: where they said it (a voice note, a review, an article) |

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `seed` | any string, for the bracket's and mark's hand | the first 60 characters of the words |
| `register` | `quiet`, `warm`, `playful` | inherited |

## Registers

| | Look | Motion |
|---|---|---|
| quiet | display face beside a hairline; name in small capitals | none |
| warm | the hand face, a margin note with a pencil bracket | none |
| playful | large words under a hand-drawn quotation mark in the accent colour | the mark inks in once, the first time it is on screen |

Reduced motion: the mark is drawn, not inked in. Without JavaScript: the quiet look.

## Using a real quote

Quote exactly what was said, with the person's permission, and link the source when there is one. The library's demos use made-up people and words.

## Accessibility

- Nothing the component draws is read aloud; the check proves the read text is the same with and without the skins.
- Put a quote in a `<figure>` rather than a bare `<blockquote>` so the caption is tied to it.
