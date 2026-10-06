# Person card

`<sg-person-card>` is one person, and what they are building. It enhances an `<article>`.

## Markup

| Element | What it is |
|---|---|
| a heading (`h2` to `h4`) | the person's name; the article is named by it, and the initials are cut from the same words |
| `p.sg-person-role` | their role in a few words ("Teacher, Aldona") |
| `p.sg-person-building` | one line on what they are building |
| `p.sg-person-link` | one link: their site, a profile or an email. The card never writes a link. |
| `img.sg-person-photo` | optional, and only with that person's consent (see below). Written by you; it takes the disc's slot exactly. |

## The initials, not a photo

By default the card shows no photo. The element adds an `aria-hidden` disc with the
person's initials, cut from the heading by `initialsOf(name)` in `person.core.js`:
first and last word ("Sarita Fernandes" gives "SF"), one initial for a single name,
middle names skipped, edge spaces trimmed, "" when the name has no letters at all
(the disc is then plain, and the heading is read as usual).

A photo goes on the card only when the person gave it and their consent is recorded
wherever you keep such things. Put the `<img class="sg-person-photo" alt="…">` inside
the article yourself; the element notices it and takes the disc away. The card never
fetches a photo of its own, and nothing here implies consent.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `data-track` | one of the project's tracks ("AI for Kids", "Tech for Good", ...) | none; the member-directory recipe reads it |
| `seed` | the playful disc's colour and the card's tilt | the name |
| `register` | `quiet`, `warm`, `playful` | inherited |

Event: `sg-person-ready` when the disc is first drawn.

## Registers

| | Look |
|---|---|
| quiet | a hairline card, the initials in a plain disc |
| warm | a soft card with a wash at the top, the initials in the hand |
| playful | a colour disc, its hue seeded, the name in the hand, and a small seeded tilt that arrives on hover or focus and settles back |

Reduced motion keeps every register still.

## Accessibility

- The `<article>` is named by the person's own heading.
- The initials disc is `aria-hidden`; the name is read as words, not letters.
- The link is an ordinary link: it takes Tab and shows a focus ring.
- A photo needs a real `alt` you write; the element fills only a missing `alt`.
- Without JavaScript the markup you wrote shows in full, in the quiet look.
