# Now note

`<sg-now-note>` is a short, dated "what I'm up to" note with an availability state in words. It enhances a `<section>` (or an `<article>`, `<aside>` or `<div>`).

## Markup

| Element | What it is |
|---|---|
| a heading | "Now", or the business's own word |
| `<p>` | what is happening |
| `p.sg-now-state` with `<sg-badge>` | availability, in words: "Taking on one new project" (`success`), "Heads-down till October" (`warning`), "Booked till March" (`neutral`) |
| `p.sg-now-updated` with `<time datetime="YYYY-MM-DD">` | required: when it was last updated |

The element adds `, 3 days ago` after the date and, past `stale-after` days, a `p.sg-now-stale` saying "This note may be out of date."

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `stale-after` | days | 45 |
| `today` | an ISO date to count from, for demos, tests and print | the reader's today |
| `seed` | the warm lean | heading and date |
| `register` | `quiet`, `warm`, `playful` | inherited |

On a static site, the build can also compute the age with `ageInWords()` and `isStale()` from `now-note.core.js`, so a reader without JavaScript sees it. Use one or the other: the element adds its own age line whatever the HTML already says.

## Registers

| | Look |
|---|---|
| quiet | a dated line under a hairline |
| warm | a sticky note in the hand, with tape, always daylight yellow |
| playful | a café chalkboard in a wooden frame, always dark |

Nothing moves.

## Accessibility

- The state is words; the badge's shape and colour back it up.
- The sticky note and the board keep their own colours in either page theme; their words are tested at 4.5:1.
