# Event card

`<sg-event-card>` is one workshop, class, supper club or pop-up. It enhances an `<article>`.

## Markup

| Element | What it is |
|---|---|
| `p.sg-event-kind` | the kind, in words ("Workshop", "Supper club", "Pop-up", "Class"). Optional: with a `kind` attribute and no such element, one is added. |
| a heading (`h2` to `h4`) | the title; the first heading directly in the article |
| `p.sg-event-when` with `<time>` | the date and time. With `start` set, the element writes the text and `datetime` itself, so they cannot disagree with the clock; what you write is what people see without JavaScript, so write it the same way. |
| `p.sg-event-where` | `.sg-event-venue`, `.sg-event-area` and, if you like, a map `<a>` |
| `section.sg-event-do`, `section.sg-event-eat` | "What you'll do or learn" and "What you'll eat", each a small heading and a `<ul>` |
| `footer.sg-event-stub` | the foot of the card: the price, the seats line and the booking link. It is the stub of the ticket in warm and playful. |
| `p.sg-event-price` | `.sg-event-amount` and the words after it ("per person", "a plate") |
| `p.sg-event-cta` | the booking link: your own `<a>`, usually WhatsApp (build it with `waLink()` from `reach.core.js`). The card never writes a link. |
| `[data-when="sold-out"]` | an optional `hidden` element, usually a link ("Ask about the next date"), shown only when the event is sold out |

The element adds `p.sg-event-status` ("In 2 days", "Today at 11 am", "On now, until 1 pm", "This one has happened. Booking is closed.") after the date and, when `seats-left` is given, `p.sg-event-seats` in the foot.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `start` | `YYYY-MM-DDTHH:MM`, wall-clock time in the zone; an offset or `Z` wins | required |
| `end` | the same | none: the event is "today" all day and never "on now" |
| `timezone` | an IANA zone, or the list's | `Asia/Kolkata` |
| `seats-left` | a whole number | none: no seats line. `0` means sold out. |
| `kind` | `workshop`, `supper-club`, `pop-up`, `class` | none |
| `now` | an ISO time to count from, for demos, tests and print; it stops the clock | the real clock |
| `seed` | the ticket's lean and the holes of its tear line | the title |
| `register` | `quiet`, `warm`, `playful` | inherited |

Event: `sg-event-state` `{ phase, soldOut }`, when the clock moves the card on. `card.refresh(nowMs)` reads the clock again; `card.info` is the latest description.

## Honest by the clock

| It is | The card says | Booking link | Seats line |
|---|---|---|---|
| coming up | "In 2 days", "Tomorrow", "In 3 weeks", then the date | shown | only if `seats-left` is a number |
| today, before the start | "Today at 11 am" | shown | as above |
| on now (needs an `end`) | "On now, until 1 pm" | shown | as above |
| over | "This one has happened. Booking is closed." | gone | gone |
| `seats-left="0"` | "Sold out" | replaced by `[data-when="sold-out"]` if you wrote one | "Sold out" |

The start is inclusive and the end is not: at 11:00:00 it is on now, at 13:00:00 it is over. Days are the venue's days: at 00:30 in Goa, 19:00 UTC the evening before, an event that day is already "today".

A seats line never appears unless you gave a number. A card with no `seats-left` says nothing about seats; it never guesses scarcity.

On a static site you can compute all of this at build time with `describeEvent()` from `event.core.js`, so a reader without JavaScript sees the same words. Use one or the other: the element writes its own status line whatever the HTML already says.

## Registers

| | Look |
|---|---|
| quiet | a ruled card, the foot ruled off, the booking link an outline |
| warm | a ticket: notches and a perforated tear line (holes drawn in code, each a little different), a tinted stub as a column at the right when the card is wide enough and a strip along the foot when it is not, a small seeded lean |
| playful | the same ticket in the hand; the stub tears a little on hover or focus, lifts at its free corner, settles with a spring and stays there while the pointer stays, and goes back when it leaves. Nothing loops. |

Reduced motion keeps every register still.

## Accessibility

- A named article; a real `<time datetime>` with the offset.
- The clock state is words with a shape beside it, not colour alone.
- The booking link takes Tab, shows a focus ring, and leaves the tab order when the event is over.
- The tear line is an `aria-hidden` drawing.
- Without JavaScript the written markup reads fine and the quiet look applies.
