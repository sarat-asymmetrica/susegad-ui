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

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The list adds no images of its own. The cards inside it carry their own art as `aria-hidden` drawings (see the event card's table). The empty state is text (`packages/components/event-list/event-list.check.mjs`: "the default words show"). |
| 1.3.1 Info and relationships | Meets | `event-list.check.mjs`: "the cards are a list for a screen reader (role list, role listitem)", the past events sit in a native `<details>` labelled "Before (1)", and with JavaScript off "every card shows in the order written, with its heading". |
| 1.4.1 Use of color | Meets | Past and upcoming are told apart by place and words: what has happened is in the "Before" drawer, and its label says how many. No state is carried by colour alone (`event-list.check.mjs`: "what has happened is in a \"Before\" drawer, labelled with how many"). |
| 1.4.3 Contrast (minimum) | Meets | `event-list.check.mjs`: "axe, light, all three registers: 0 violations" and the same in dark, and "axe with every \"Before\" drawer open (dark, warm): 0 violations", `color-contrast` included. Text roles are tested at 4.5:1 on every surface in `packages/tokens/tokens.test.js`. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: the demo with the root font size at 200 percent in three registers (1280 px wide), no sideways scroll and no clipped text (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | `event-list.check.mjs`: "at 390 px the demo does not scroll sideways". Manual test at 320 CSS px, three registers, 2026-10-07: no sideways scroll, no element past the viewport. |
| 1.4.11 Non-text contrast | Meets | The only parts of the list itself that need contrast are the "Before" drawer's marker (text colour) and the focus ring (`--sg-focus`), tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. Card parts are covered in the event card's table. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected on the demo in three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `event-list.check.mjs`: "Tab reaches \"Before\" (N presses) with a focus ring; Enter opens it and Space closes it", and "the keyboard reaches the call to action in the empty state". The list itself is not a control. |
| 2.1.2 No keyboard trap | Meets | Manual test: `packages/components/event-list/event-list.js` binds no key handler; the drawer is a native `<details>` and the links are native, so Tab and Shift+Tab pass through. |
| 2.4.3 Focus order | Meets | Cards and the drawer follow the order the list writes them (soonest first, then "Before"); `event-list.check.mjs` Tabs to the drawer and to the empty-state call to action. When a card moves into the drawer on its own, focus is not moved by the list (`event-list.js` calls no `focus()`). |
| 2.4.4 Link purpose (in context) | Meets with author's part | The list writes no link of its own. The links are the cards' (see the event card's table) and the call to action in the empty state, which is the author's markup (`packages/components/event-list/event-list.check.mjs`: "the keyboard reaches the call to action in the empty state"). Each link sits in a card named by its heading, which is its context. Whether the link text says where it goes is the author's. |
| 2.4.7 Focus visible | Meets | `event-list.check.mjs`: "Tab reaches \"Before\" ... with a focus ring"; the rule is in `packages/components/event-list/event-list.css`. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/event-list/event-list.css` has no `position: fixed` or `sticky`. A sticky header or banner the page adds can cover a focused card link or the drawer. |
| 2.5.3 Label in name | Meets | The drawer's name is its visible summary text, "Before (N)", because the list sets no `aria-label` on it (`packages/components/event-list/event-list.js`). Link names are the cards' own text. |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07: no focusable control under 24 by 24 CSS px at 1280 px or at 390 px with touch, in all three registers, with the "Before" drawer closed (throwaway Playwright script). |
| 4.1.2 Name, role, value | Meets | Native `<details>` for the drawer, `role="list"` and `role="listitem"` for the cards. `event-list.check.mjs`: axe with 0 violations in light and dark, with the drawer open, and with JavaScript off. |

**The page author owns:**

- The words of every card and of the empty state, in the language of the page, and `lang` on a card in another language (3.1.2).
- The heading level inside each card, so the list fits the page's outline.
- Sticky headers or banners that could cover a focused link or the drawer (2.4.11).
- The colours the page sets behind the list, if it overrides the tokens.
- Link texts that say where they go, in the cards and in the empty state (2.4.4).

## Arriving and pressing

- Cards arrive once, on the tala: each one lands on its own beat of the sixteen-beat teental cycle (130 ms a beat, nothing on the three silent beats). Only the first five wait for a beat; the rest take the fifth's beat, so the list cascades top to bottom and the longest wait is 520 ms however long it is, and the cards are in the accessibility tree from the start (the fade is visual only). The stagger is CSS, with `sibling-index()`; where a browser lacks it, `core/arrive.js` hands each one the same delay. Warm eases in; playful settles on the spring. Quiet gets no stagger, and nothing moves under reduced motion.
- The cards put away in the closed "Before" drawer do not stagger; only what is on top does.
- Only arrivals play. A new one that is added later starts again from the first beat, and a sort or a move the reader asked for never replays anything (`data-seen` marks what has arrived).
- A press answers within a frame: no transition on the way in, and it eases back in under 150 ms. Quiet settles 1 px, warm shades the colour toward the ink, playful gives a little (scale 0.97) and lets go on the spring. Reduced motion keeps the colour and drops the movement; a held key does not move anything.
