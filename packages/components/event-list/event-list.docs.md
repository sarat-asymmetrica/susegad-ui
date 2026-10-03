# Event list

`<sg-event-list>` holds `<sg-event-card>` elements and keeps the calendar in order. It needs `event-card` beside it: the clock work is the card's.

## Markup

| Element | What it is |
|---|---|
| a heading | the list's own heading ("What's on") |
| `<sg-event-card>` | the events, in any order |
| `p.sg-event-empty` | optional: what to say when nothing is coming. If you write none, the list adds "Nothing on the calendar right now. Ask about a private session." |
| `p.sg-event-ask` | optional: your call to action for an empty calendar (a WhatsApp link, usually). Without JavaScript it is always shown, so put it after the cards. |

The element adds `div.sg-event-upcoming` (the cards still to come) and `details.sg-event-before` (the drawer, with a `summary` such as "Before (2)" and `div.sg-event-past`).

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `now` | an ISO time to count from, for demos and tests; it stops the clock | the real clock |
| `timezone` | an IANA zone, the default for cards that name none | `Asia/Kolkata` |
| `register` | `quiet`, `warm`, `playful` | inherited |

Event: `sg-event-list-change` `{ upcoming, past }`, when a card moves. `list.sync()` reads the clock again; `list.clock()` is the time the list counts from.

## How it keeps the calendar honest

- Upcoming events are sorted by start, soonest first. Events that start at the same time keep the order you wrote them in. An event whose date cannot be read goes last.
- An event moves to "Before" the moment its end passes (the end is not inclusive). With no `end` it moves when its day is over.
- "Before" is closed until the visitor opens it, shows how many it holds, lists the most recent first, and is not there at all when it would be empty.
- When nothing is coming, `.sg-event-empty` and `.sg-event-ask` show and the list hides. While anything is coming they stay hidden.
- One timer for the whole list, set for the next moment any card changes, only while the list is on screen. Scroll back to it and it catches up at once.
- The cards inside a list do not run timers of their own.

On a static site, call `partitionEvents()` from `event-card/event.core.js` at build time to write the cards in the right order, so a reader without JavaScript sees the same calendar.

## Registers

| | Look |
|---|---|
| quiet | a plain list, a ruled "Before" row, an outlined ask link |
| warm | the empty state is a dashed ticket with nothing printed on it yet |
| playful | the empty line and the heading in the hand |

Nothing moves except a card changing place.

## Accessibility

- `role="list"` and `role="listitem"` on the lists and cards.
- The drawer is a native `<details>`: Tab reaches it, Enter and Space open and close it, and what is inside is neither visible nor focusable while it is closed.
- The empty state is text.
