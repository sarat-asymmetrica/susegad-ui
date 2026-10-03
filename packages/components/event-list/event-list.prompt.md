# Event list

*A calendar for anyone who runs workshops, classes, pop-ups or suppers: a link-in-bio that should say what is on, and say plainly when nothing is.*

A list of event cards that keeps itself in order. What is still to come is on top, soonest first. What has happened is put away in a closed "Before" drawer. When nothing is coming it says so and offers a way to ask.

```html
<link rel="stylesheet" href="susegad/components/event-card/event-card.css">
<link rel="stylesheet" href="susegad/components/event-list/event-list.css">
<script type="module" src="susegad/components/event-card/event-card.js"></script>
<script type="module" src="susegad/components/event-list/event-list.js"></script>

<sg-event-list>
  <h2>What's on</h2>
  <sg-event-card start="2026-10-09T19:30" end="2026-10-09T22:00" kind="supper-club">…</sg-event-card>
  <sg-event-card start="2026-10-04T11:00" end="2026-10-04T13:00" kind="workshop">…</sg-event-card>
  <p class="sg-event-ask"><a href="https://wa.me/919800000000?text=…">Ask about a private session</a></p>
</sg-event-list>
```

## The prompt

Make an event list web component that holds `<sg-event-card>` elements and keeps the calendar honest. Read each card's `start`, `end` and `timezone`, and the clock, and put the cards that are still to come in one list, soonest first (cards with the same start keep the order they were written in, and a card with no readable date goes last), and the cards that have happened in a native `<details>` called "Before", closed, labelled with how many ("Before (2)"), most recent first. Do not show the drawer when there is nothing in it. When nothing is to come, show a plain line ("Nothing on the calendar right now. Ask about a private session.", or the author's own `.sg-event-empty`) and the author's call to action (`.sg-event-ask`), and show neither otherwise. While the page is open, move a card the moment the clock passes its end, from one timer for the whole list, set for the next moment any card changes, that runs only while the list is on screen and catches up when it is seen again. A drawer the visitor opened stays open. Mark the lists as lists for a screen reader. Without JavaScript the cards simply stack in the order written. Give it three registers: quiet is a plain ruled list with a ruled "Before" row; warm draws the empty state as a dashed ticket with nothing printed on it yet; playful sets the empty line in the hand. Nothing moves except a card changing place.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| soonest first, the past put away | pure core | `planList(items, now)` calls `partitionEvents`: upcoming by start with ties kept in written order, past most recent first. |
| a closed "Before" archive | native first | A `<details>` with a `<summary>`: closed by default, Tab and Enter and Space work, and its contents are not visible or focusable while closed. |
| a real empty state | honesty | `plan.empty` shows `.sg-event-empty` (your words, or the default) and `.sg-event-ask`, and hides the list. Both stay hidden until the element has looked at the clock, so a page with no JavaScript never says "nothing on" while events are listed. |
| moves a card the moment the clock passes it | one timer | `nextChangeOf(items, now)` is the soonest boundary of any card; `setTimeout` is set for it only while the list is visible; coming back on screen runs `sync()` at once. |
| the visitor opened the drawer | state kept | Re-sorting moves the cards only if their order changed, and never rebuilds the `<details>`, so `open` survives. |
| the list keeps the clock | one clock | Cards inside a list ask the list for the time (`list.clock()`), so one `now` attribute fixes the whole calendar and the cards do not run timers of their own. |

## Accessibility

- A real list: `role="list"` on the container, `role="listitem"` on each card.
- The drawer is a native `<details>`: keyboard and screen reader support come with it.
- The empty line is text in the page, not a picture.
- Cards moving between the list and the drawer keep their own state and focus order.
