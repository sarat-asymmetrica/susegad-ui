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

## Budget

| File | Bytes |
|---|---|
| `badge.js` + `badge.core.js` (behaviour) | 7.4 KB of 12 KB |
| `skins/quiet.js` | 0.2 KB |
| `skins/warm.js` | 2.1 KB |
| `skins/playful.js` | 1.3 KB |

Nothing runs per frame except a busy badge's single Web Animation in warm or playful.
