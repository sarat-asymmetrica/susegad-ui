# Badge

`<sg-badge>` is a word or two of status: Paid, Draft, Overdue, Saving. The text is the meaning; a shape per tone backs it up; colour comes last.

## Use

```html
<link rel="stylesheet" href="susegad/components/badge/badge.css">
<script type="module" src="susegad/components/badge/badge.js"></script>

<p>Your booking is <sg-badge tone="success">Confirmed</sg-badge>.</p>
<sg-badge tone="info" busy>Saving</sg-badge>
```

A server can swap the words (htmx `hx-swap="innerHTML"`) or the `tone`; the badge re-fits its outline and re-detects the script.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `tone` | `neutral`, `accent`, `success`, `warning`, `danger`, `info` | `neutral` |
| `busy` | boolean: the thing is still happening | absent |
| `seed` | any string, for the warm outline | the text |
| `register` | `quiet`, `warm`, `playful` | inherited |

| Tone | Shape | Use it for |
|---|---|---|
| neutral | ring | archived, counts, facts |
| accent | diamond | new, featured, direct |
| success | tick | paid, confirmed, done |
| warning | triangle with a bar | due soon, peak season, needs a look |
| danger | cross | failed, overdue, declined |
| info | circled i | draft, returning guest, checking |

## Registers

| | Look | When busy |
|---|---|---|
| quiet | text colour, the tone's shape, a hairline rule | nothing moves; the words say it |
| warm | the tone's ink, a hand-inked outline drawn twice | the shape breathes slowly |
| playful | a chip of the tone, words in the page colour, a kolam flower on the corner | the flower turns |

Reduced motion keeps every register still. Busy motion pauses when the badge is off screen.

## Accessibility

- Inline text, never focusable. If a status needs an action, put a button next to it.
- Do not rely on the tone: "Failed" in a red badge still says "Failed".
- Busy badges must say in words what is happening ("Checking payment", not only a turning flower).
- Contrast: warm text is 4.5:1 or more on every surface; the playful chip's text is 4.5:1 or more on its own fill, in every palette and theme (tested).
- Devanagari and Kannada badges get more line height, so matras are not clipped.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The tone shape is a CSS mask on `::before` with no content, and the warm outline and playful flower are `aria-hidden` SVG (`packages/components/badge/badge.css`, `packages/components/badge/skins/warm.js`, `packages/components/badge/skins/playful.js`), so assistive technology reads only the words. |
| 1.3.1 Info and relationships | Meets | The badge is inline text. The status is its words, so there is nothing for markup to add (`packages/components/badge/badge.js` sets no role). Where the badge sits in a table or list is the author's markup. |
| 1.4.1 Use of color | Meets | The words carry the status and every tone has its own shape: ring, diamond, tick, triangle, cross, circled i. `packages/components/badge/badge.test.js`: "every tone has its own shape, so colour never carries the meaning alone". |
| 1.4.3 Contrast (minimum) | Meets | `packages/components/badge/badge.test.js`: "AA: <palette> <theme>: warm badge ink and the playful chip read at 4.5:1" for every tone on three surfaces, every palette, light and dark. Quiet text is `--sg-text`, tested in `packages/tokens/tokens.test.js`. axe `color-contrast` is clean in the run cited under 4.1.2. |
| 1.4.4 Resize text | Meets with author's part | Manual test, 2026-10-06: the demo with the root font size at 200 percent in three registers, no sideways scroll and no clipped text (throwaway Playwright script). The badge does not wrap (`white-space: nowrap` in `packages/components/badge/badge.css`), so keep the words to a word or two. |
| 1.4.10 Reflow | Meets with author's part | Manual test at 320 CSS px, three registers, 2026-10-06: the demo does not scroll sideways and no element passes the viewport. Because a badge never wraps, a long phrase in a narrow column would overflow it: that is the author's to keep short. |
| 1.4.11 Non-text contrast | Meets | The tone shape and the warm outline are drawn in the tone's ink, tested at 4.5:1 on every surface for every palette and theme (`packages/components/badge/badge.test.js`, warm ink and playful chip rows); the quiet hairline is `--sg-rule-strong`, tested 3:1 or more in `packages/tokens/tokens.test.js`. The shape repeats what the words say, so it is not needed to understand the badge. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-06: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em) injected on the demo in three registers, no clipped or overlapping text (throwaway Playwright script). Devanagari and Kannada badges get more line height in `packages/components/badge/badge.css`. No check in the repository asserts text spacing yet. |
| 2.2.2 Pause, stop, hide | Meets with author's part | Only a `busy` badge moves: a slow fade in warm and a turning flower in playful, which stop under `prefers-reduced-motion`, in quiet, and while off screen (`packages/components/badge/badge.test.js`: "busy: still in quiet and under reduced motion, breathes in warm, turns in playful"). There is no on-page pause control, so a page that shows a busy badge for more than five seconds in warm or playful owns offering the quiet register or a motion switch. |
| 2.3.1 Three flashes or below threshold | Meets | The busy motion is a fade between full and 40 percent opacity over 1.4 s, or a turn every 2.4 s, on a shape about 0.85em across: under one change a second and far below the flash area (`busyMotion` in `packages/components/badge/badge.core.js`). |
| 4.1.2 Name, role, value | Meets | A badge has no role and no state of its own: its name is its text. `tools/axe.mjs --url /packages/components/badge/demo.html` (WCAG 2.2 AA, three registers, light and dark, desktop): 0 violation(s) across 6 run(s), 2026-10-07. No check file beside the component runs axe on it. |

**The page author owns:**

- The words, in the language of the page, and `lang` on a badge in another language (3.1.2).
- Keeping the words short, since a badge never wraps (1.4.4, 1.4.10).
- A busy badge that says in words what is happening ("Checking payment"), and a way to stop its motion, such as offering the quiet register (2.2.2).
- An action for a status: the badge is never focusable, so put a button next to it.
- The colours the page sets behind the badge, if it overrides the tokens.

## Budget

| File | Bytes |
|---|---|
| `badge.js` + `badge.core.js` (behaviour) | 7.4 KB of 12 KB |
| `skins/quiet.js` | 0.2 KB |
| `skins/warm.js` | 2.1 KB |
| `skins/playful.js` | 1.3 KB |

Nothing runs per frame except a busy badge's single Web Animation in warm or playful.
