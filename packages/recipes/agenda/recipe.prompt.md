# Agenda (recipe)

Make an agenda recipe for a conference in Panjim: sessions across one or two days, each with a start and end time, a title, a speaker, a room and a track, as plain HTML that reads in full with JavaScript off. Every time is written out as text in India Standard Time and labelled IST. With JavaScript it works out "now on stage" from the Indian clock: a session that is on says "Now on stage, until 11:15 am" in words (and carries `aria-current="time"`), the soonest one still to come says "Next, at 2 pm" (or "Next, tomorrow at 10 am", only when it is today or tomorrow), and a finished session goes quieter but stays readable and is read aloud as "Finished". Parallel sessions can all be on at once. One status line at the top says the state in a sentence ("Between sessions. Next, at 2 pm."). It checks the clock once a minute with a single timeout that wakes just after the minute turns and only while the tab shows; it never moves focus, never replaces a node, and is not a live region, so it announces nothing. It counts in Panjim's days whatever the visitor's machine zone is. A session that crosses midnight stays on stage after the date turns. The marker is words first, then a filled dot and a bar for now and a ring for next, never colour alone. Three registers: quiet (ruled lines), warm (small raised cards, the state in the hand), playful (outlined cards, a tilted pill).

Do not build it on `sg-event-list`: its closed "Before" drawer hides the morning and its cards say "Booking is closed". Use `core/intl.core.js` for the clock.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| times written once for the machine | the two `<time datetime="…+05:30">` in each session | `sessionsOf(root)` reads start and end from them (a `data-start`/`data-end` still wins); the check asserts the words agree with the `datetime`. |
| the Indian clock | `parseWhen(text, 'Asia/Kolkata')`, `wall`, `clock`, `daysFrom`, `formatDate` from `core/intl.core.js` | times are Panjim wall-clock time, so a machine in New York agrees with Goa. |
| on, next, finished | `phaseOf(now, { start, end })` | `now >= start` is on, `now >= end` is over; no end means never on stage. |
| what to say at this moment | `agendaState(sessions, now)` | pure: returns the overall state, the status sentence and a label per session; runs in Node. |
| "Next, at 2 pm" | `whenWords(now, start)` | "at 2 pm", "tomorrow at 10 am", "Sun 15 Nov at 10 am". |
| once a minute, calmly | `setTimeout` to the next minute edge, plus `visibilitychange` | no rAF, no interval; nothing is touched when nothing changed. |
| never move focus | state lines made once, text updated in place | no node is replaced, so a reader keeps their place. |
| say nothing aloud | a plain `<p>`, not `role=status` | the one sentence is read when someone reaches it. |
| try another moment | `?now=2026-11-14T10:40` on the demo page, or `mountAgenda(root, { now, tick: false })` | a fixed clock for demos and tests. |

## Accessibility

- Every state is text: "Now on stage, until 11:15 am", "Next, at 2 pm", "Finished" (visually hidden).
- The session that is on has `aria-current="time"`.
- Times are real `<time datetime>` with the +05:30 offset, followed by an IST label.
- Finished sessions use the softer text colour, not opacity, so contrast holds.
- No live region, no focus moves, no motion.
