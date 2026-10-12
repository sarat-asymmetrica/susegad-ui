# Agenda (recipe)

A conference agenda across one or two days, with rooms and tracks, that knows
what is on stage now. It is plain HTML first: every session, its time in IST,
its room and its track are on the page with JavaScript off. With JavaScript it
adds the words "Now on stage" and "Next, at 2 pm", and one quiet status line.

The event, speakers, talks and times in `index.html` are **sample content**:
invented for the demo, with made-up people. Replace them with your own.

## Mount it

```html
<link rel="stylesheet" href="susegad/recipes/agenda/recipe.css">

<section class="sg-agenda" id="agenda" aria-labelledby="agenda-h">
  <h2 id="agenda-h">Agenda</h2>
  <p class="sg-agenda-zone">Every time here is India Standard Time (IST), the clock in Panjim.</p>

  <section class="sg-agenda-day" aria-labelledby="d1">
    <h3 id="d1"><time datetime="2026-11-14">Saturday 14 November</time></h3>
    <ol class="sg-agenda-sessions">
      <!-- the two <time datetime> are what the clock reads (start, then end); the id is what a speaker's link points at -->
      <li class="sg-session" id="storybook-reader">
        <p class="sg-session-time"><time datetime="2026-11-14T10:30:00+05:30">10:30 am</time> to <time datetime="2026-11-14T11:15:00+05:30">11:15 am</time> <abbr title="India Standard Time">IST</abbr></p>
        <h4 class="sg-session-title">A storybook that reads aloud, in Konkani</h4>
        <p class="sg-session-who">Priyanka Naik</p>
        <p class="sg-session-where"><span class="sg-session-room">Main hall</span> <span class="sg-session-track">AI for Kids</span></p>
      </li>
    </ol>
  </section>
</section>

<script type="module">
  import { mountAgenda } from 'susegad/recipes/agenda/recipe.js';
  mountAgenda(document.getElementById('agenda'));
</script>
```

A session's time is written twice: the words people read (`10:30 am`) and the
`datetime` beside them (`2026-11-14T10:30:00+05:30`), which is what the clock
reads, so there is no third copy. Keep the two the same; the recipe's check
fails when they drift. A session that crosses midnight takes its end on the next
date (`datetime="2026-11-15T00:30:00+05:30"`) and says "after midnight" in its
time line; it stays under the day it started. (A `data-start` and `data-end`
on the `<li>` still work, and win, if you would rather write them.)

## What it says, and when

| It is | The session says | The status line says |
|---|---|---|
| well before the first day | nothing | "The agenda starts Sat 14 Nov, at 9:30 am IST." |
| today or tomorrow, nothing on yet | the soonest: "Next, at 9:30 am" or "Next, tomorrow at 9:30 am" | the same "starts" line |
| a session is on | "Now on stage, until 11:15 am" (every parallel one) | "2 sessions are on stage now. Next, at 12:30 pm." |
| between sessions | the soonest: "Next, at 2 pm" | "Between sessions. Next, at 2 pm." |
| after the last session | "Finished", read aloud only | "That was the last session." |

A session's start is inclusive and its end is not: at 11:15:00 the 10:30 to
11:15 talk is finished. A session with no end is never "on stage". "Next" is
said only when it is today or tomorrow, so a week out nobody reads "Next, at
9 am" as this morning.

The marker is words first, then a shape: a filled dot and a bar down the side
of the session that is on, a ring beside "Next". A finished session takes the
softer text colour and the normal weight, never an opacity, so the morning
stays readable for someone arriving after lunch.

## How it behaves

- **The clock is Panjim's.** Days and times are counted in IST with
  `core/intl.core.js`, whatever zone the visitor's machine is set to. A visitor
  in New York at 8:10 pm on the 13th sees "Next, at 9:30 am", because it is
  6:40 am in Panjim.
- **Once a minute.** One `setTimeout`, set to wake just after each minute
  turns, only while the tab is showing; coming back to the tab catches up at
  once. No animation frame, no interval. Where nothing changed in a minute,
  nothing is touched.
- **Focus is never moved.** The recipe writes into the state lines and the
  status line it made once, and never replaces a node, so a reader tabbing
  through the page keeps their place.
- **Nothing is announced.** The status line is ordinary text, not a live
  region. (`announce()` from `core/announce.js` is for a change someone has just
  caused, such as a total. Nobody pressed anything here.) The session that is
  on carries `aria-current="time"`.
- **Without JavaScript** every session reads in full with its IST time. The
  now and next marks need the clock, so they are not there.

## Try a moment

Add `?now=2026-11-14T10:40` to the demo page to pretend it is that moment in
Panjim. In your own code, pass a clock: `mountAgenda(root, { now: () => ms, tick: false })`.

## Why it is not built on `sg-event-list`

`<sg-event-list>` puts what has finished into a closed "Before" drawer, and its
cards say "Booking is closed" once they are over, which is right for a ticketed
workshop and wrong for a talk. An agenda keeps the morning visible. The clock
work is the same code (`core/intl.core.js`).

## Registers

| | Look |
|---|---|
| quiet | ruled lines between sessions, the state in plain text at the body size |
| warm | each session a small raised card, the one on stage warmed with the accent, the state in the hand |
| playful | rounded outlined cards, the state a small tilted pill (filled for "Now on stage"), finished ones dashed |

Nothing moves, in any register. There is nothing to press: no touch contract
applies to this recipe, because it has no controls.

## Landing on a session

A speaker's talk link ends in the session's id (`#storybook-reader`). The session
you land on has room above it (`scroll-margin-top`) and a 2 px outline, a line
and not only a colour, which stays visible in forced colours.

## Own the words, and the language

The words are in `recipe.strings.js`, by language (decision 0025), and follow the nearest `lang`. A language whose table lacks a key shows the English and marks that text `lang="en"`, so a screen reader reads it in English's voice. The Konkani tables (`gom-Deva`, `gom-Latn`) are empty, for a Kathakar to write and a native reader to check; the file lists every key with an example. Times ("9:30 am") and day words ("Sat 14 Nov") still come from `core/intl.core.js` in English. (`?lang=gom-Deva` on the demo page pretends the page is in Konkani.)

Keep them calm: no countdown, no "hurry".
