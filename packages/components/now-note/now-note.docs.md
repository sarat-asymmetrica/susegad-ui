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

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The tape, the frame and the chalk are CSS decoration with no words in them; the state is the badge's words ("Taking on one new project") and the date is text. `packages/components/now-note/now-note.check.mjs`: "without JavaScript: the words, the state in words and the date all show". |
| 1.3.1 Info and relationships | Meets | A `<section>` named by its heading, a `<time datetime>` for the date and the state in a `<p>`; the element adds the age after the date. `now-note.check.mjs`: "each note says how long ago, in words", and axe without JavaScript: 0 violations. |
| 1.4.1 Use of color | Meets | Availability is words ("Taking on one new project", "Heads-down till October", "Booked till March"); the badge's colour backs them up. An old note says "This note may be out of date." in words (`now-note.check.mjs`, "every note older than 45 days says it may be out of date; no fresh one does"). |
| 1.4.3 Contrast (minimum) | Meets | `packages/components/now-note/now-note.test.js`, "AA: <palette>: words on the sticky note and the chalkboard read at 4.5:1 in any theme" (the note and the board keep their own colours in either theme); `packages/tokens/tokens.test.js` for the plain register. `now-note.check.mjs`: axe in light and dark, all three registers: 0 violations. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and nothing clipped (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | `now-note.check.mjs`: "at 390 px the page does not scroll sideways". Manual test, 2026-10-07: demo at 320 CSS px, three registers, no sideways scroll (document width 320). |
| 1.4.11 Non-text contrast | Meets | There is no control and no graphic that carries meaning: state and age are words (`packages/components/now-note/now-note.check.mjs`, "without JavaScript: the words, the state in words and the date all show"). |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text, including the sticky note and the chalkboard (throwaway Playwright script). No check in the repository asserts it yet. |
| 4.1.2 Name, role, value | Meets | Native elements only, nothing to operate; the section is named by the author's heading. `now-note.check.mjs`: axe with and without JavaScript, 0 violations. |

**The page author owns:**

- The heading, the note, the availability words and the date, in the language of the page, and `lang` on text in another language (3.1.2).
- The `<time datetime>` being true, and a `stale-after` that suits how often the note changes.
- Using either the element's age line or the build's own `ageInWords()`, not both.
