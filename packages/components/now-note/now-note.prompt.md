# Now note

*What someone is up to right now: a studio's current work, a homestay's "open for the season", a restaurant's specials, an office's hours this week.*

A line or two, an availability state in words, and the date it was last said, so a reader can tell whether to believe it.

```html
<link rel="stylesheet" href="susegad/components/now-note/now-note.css">
<link rel="stylesheet" href="susegad/components/badge/badge.css">
<script type="module" src="susegad/components/now-note/now-note.js"></script>
<script type="module" src="susegad/components/badge/badge.js"></script>

<sg-now-note stale-after="45">
  <section aria-labelledby="now">
    <h2 id="now">Now</h2>
    <p>Building an order page for a clothing brand in Aldona.</p>
    <p class="sg-now-state"><sg-badge tone="success">Taking on one new project</sg-badge></p>
    <p class="sg-now-updated">Updated <time datetime="2026-09-24">24 September 2026</time></p>
  </section>
</sg-now-note>
```

## The prompt

Make a "now" note web component around a `<section>`: a small heading, a line or two of what's happening, the availability as a status badge whose words say it ("Taking on one new project", "Heads-down till October"), and "Updated" with a `<time datetime>`. With JavaScript, add after the date how long ago that was in words (today, yesterday, 3 days ago, 2 weeks ago, 3 months ago), counted by calendar days in the reader's own calendar, and once the note is older than a `stale-after` number of days (45 by default), add a plain line saying it may be out of date. Give it three registers. Quiet: a dated line under a hairline, the heading in small capitals. Warm: a sticky note in the hand, the highlighter's yellow by day and by night, set on at a small seeded lean with a strip of tape. Playful: a chalkboard outside a café, a slate board in a dark wooden frame whatever the page's theme, the words in chalky handwriting and the heading underlined with a wavy line. Nothing moves.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| how long ago … in words | pure core | `ageInWords(then, now)` from whole calendar days (`daysBetween`, UTC day numbers, so no time zone shifts a day); a date in the future says nothing. |
| older than stale-after | honesty | `isStale(then, now, days)`; an unreadable date counts as stale. The element adds `.sg-now-stale` and `data-stale`, and follows a changed `stale-after`. |
| the reader's own calendar | `todayIso()` | Local year, month and day. A `today` attribute pins it, for demos and tests. |
| by day and by night … whatever the page's theme | color-scheme | The sticky note sets `color-scheme: light` and the board `color-scheme: dark`, so every token inside resolves to that theme; the tests check their words at 4.5:1 in both palettes. |
| a small seeded lean | `lean(seed)` | 0.8 to 2 degrees, set once as `--sg-now-lean`. |
| a status badge | reuse | The state is `<sg-badge>`: its words are the meaning and its shape backs up the tone. |

## Accessibility

- A section named by its heading; the state is words, not a colour.
- The age and the stale line are plain text in the section, read in order.
- Without JavaScript the note shows its date, and a reader can judge its age themselves.
