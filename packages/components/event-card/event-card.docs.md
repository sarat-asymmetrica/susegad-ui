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

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The tear line and its holes are an `aria-hidden` drawing (`packages/components/event-card/event-card.js`, `.sg-event-perf`; `packages/components/event-card/event-card.css`), and the card holds no images of its own. Kind, date, venue and price are text. |
| 1.3.1 Info and relationships | Meets | An `<article aria-labelledby>` with an `<h3>`, a real `<time datetime>` with the offset, `<section>`s with `<h4>`s and lists, and the booking link in the footer (`packages/components/event-card/event-card.js`, the markup in its header comment). `packages/components/event-card/event-card.check.mjs`: "without JavaScript: kind, title, date, venue, price and booking link all show on every card" and "the date the element writes is the date the plain markup already says". |
| 1.4.1 Use of color | Meets | The clock state is words ("Today at 11 a.m.", "On now", "Over") and a sold-out card says so in words and swaps the booking link for the alternative (`event-card.check.mjs`: "clock <time>: <phase>, \"<status>\", booking link shown or gone", "<name>: seats line ..., sold out, booking replaced by the alternative"). |
| 1.4.3 Contrast (minimum) | Meets | `event-card.check.mjs`: "axe, light, all three registers: 0 violations", the same in dark, in each register on its own in dark (playful with reduced motion), and with JavaScript off, `color-contrast` included. Text roles are tested at 4.5:1 or more on every surface in `packages/tokens/tokens.test.js`. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: the demo with the root font size at 200 percent in three registers (1280 px wide), no sideways scroll and no clipped text (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | `event-card.check.mjs`: "at 390 px the demo does not scroll sideways", and warm "at 390: the stub is a strip along the foot with a horizontal tear line, and the page does not scroll sideways". Manual test at 320 CSS px, three registers, 2026-10-07: no sideways scroll and no element past the viewport. |
| 1.4.11 Non-text contrast | Meets | The tear line is decoration. The focus ring is `--sg-focus` and the card's rules are `--sg-rule-strong`, tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected on the demo in three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `event-card.check.mjs`: "<register>: Tab reaches \"Save my seat\" (N presses) and it shows a focus ring" in each register, "a sold-out event: Tab reaches the alternative link, not the booking one", and "a finished event: Tab never lands on a booking link". |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07: `packages/components/event-card/event-card.js` and its skins bind no key handler, set no `tabindex` and call no `focus()`, so Tab and Shift+Tab pass through the native links and the booking and map links. `packages/components/event-card/event-card.check.mjs` Tabs through the demo in each register ("Tab reaches \"Save my seat\" ... and it shows a focus ring"). |
| 2.4.4 Link purpose (in context) | Meets with author's part | The booking link sits in the card's footer inside an `<article>` named by its title, and the clock hides it once the event is over (`event-card.check.mjs`: "a finished event: Tab never lands on a booking link"). The link text is the author's: Manual test, 2026-10-07: in the demo's markup the booking links on the upcoming and the sold-out card both read "Save my seat" and the map links "Map", which a list of links shows without the event's name. Writing the event into the link text or an `aria-label` makes each one stand alone. |
| 2.4.7 Focus visible | Meets | `event-card.check.mjs`: "Tab reaches \"Save my seat\" ... and it shows a focus ring" in each register; the rule is `sg-event-card a:focus-visible` in `packages/components/event-card/event-card.css`, and `tools/touch.check.mjs` requires a focus style as well. |
| 2.5.3 Label in name | Meets | Links are named by their visible text because the component adds no `aria-label` (`packages/components/event-card/event-card.js`). |
| 2.5.8 Target size (minimum) | Meets | The booking link is at least 2.75rem (44 px) tall (`min-height` in `packages/components/event-card/event-card.css`). Manual test, 2026-10-07: no focusable control under 24 by 24 CSS px at 1280 px or at 390 px with touch, in all three registers; the small "Map" link sits inline in a sentence, which the criterion excepts, and measured at least 24 px tall besides (throwaway Playwright script). |
| 2.2.2 Pause, stop, hide | Not applicable | Nothing on a card moves by itself: the playful stub lifts only on hover or focus and settles back, and nothing loops (`event-card.check.mjs`: "playful: nothing loops (no infinite animation)"). |
| 2.4.3 Focus order | Meets | Manual test, 2026-10-07 (throwaway Playwright script): the event card demo at 390 px in quiet, warm and playful, Tab pressed through every stop (7 stops in each register); each focused control was on screen and not covered (the element at its centre is the control itself) and every stop came after the previous one in document order. The same script on a page with a full-screen fixed layer added reported every stop covered, so it can fail. The clock changes which link exists (a finished event has no booking link, a sold-out one has the alternative), and `event-card.check.mjs` asserts it: "a finished event: Tab never lands on a booking link". |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | `packages/components/event-card/event-card.css` has no `position: fixed` or `sticky`, so the component never covers a focused control itself. Manual test, 2026-10-07 (throwaway Playwright script): the event-card demo at 390 px in three registers, every Tab stop was on screen and not covered (the element at its centre is the control itself); the same script with a full-screen fixed layer added reported every stop covered, so it can fail. |
| 4.1.2 Name, role, value | Meets | A named article, native links, a `<time>`. `event-card.check.mjs`: axe with 0 violations in light and dark, in each register, and with JavaScript off. |

**The page author owns:**

- The event's words, the price, the venue and the link texts, in the language of the page, and `lang` on a passage in another language (3.1.2).
- Link texts that name the event, or an `aria-label` that begins with the visible text, so a list of links makes sense (2.4.4).
- The heading level of the card's title, so the card fits the page's outline.
- The `start`, `end` and `timezone` of the event, since the clock reads them.
- Sticky headers and banners that could cover the booking link when it takes focus (2.4.11).
- The colours the page sets behind the card, if it overrides the tokens.
