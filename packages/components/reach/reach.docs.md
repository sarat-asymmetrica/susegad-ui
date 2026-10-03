# Reach

`<sg-reach>` is a contact block around an `<address>`: email and WhatsApp links, a copy-the-number button, and a line on reply times.

## Build the links

```js
import { waLink, mailtoLink } from './susegad/components/reach/reach.core.js';

waLink('+91 90000 12345', 'Hello! I saw your site.');
// https://wa.me/919000012345?text=Hello!%20I%20saw%20your%20site.
mailtoLink('hello@example.com', { subject: 'A project' });
// mailto:hello@example.com?subject=A%20project
```

`readWaLink(href)` returns `{ digits, text }`, for a test that the site's links are right.

## Markup

| Element | What it is |
|---|---|
| `<address>` | required |
| `p.sg-reach-line` | one way to reach you: a `.sg-reach-label` and a link |
| `button.sg-reach-copy[data-copy][hidden]` | copies `data-copy`; keep `hidden` in the HTML |
| `p.sg-reach-when` | optional: when replies usually come |

The element adds a `<p class="sg-reach-status" role="status">` when there is a copy button.

## Attributes and events

| | |
|---|---|
| `seed` | the playful frame's tilt and ink |
| `register` | `quiet`, `warm`, `playful` |
| `sg-reach-copy` | after a copy; `detail: { value, ok }` |

## Registers

| | Look |
|---|---|
| quiet | plain lines, labels in small capitals |
| warm | an inland letter: pale blue (the palette's info hue, `oklch(from var(--sg-info) 0.91 0.032 h)`) by day and by night, fold lines, a perforated edge, a postage square |
| playful | a rubber-stamped card: an ink-starved double frame at a slight tilt |

Nothing moves.

## Reused

The playful frame uses `stampPose()` and `inkMask()` from `packages/components/stamp/stamp.core.js`.

## Accessibility

- Without JavaScript: the links work and the copy button stays hidden.
- The copy result is said in words, once: "Copied +91 90000 12345. Paste it into WhatsApp or your phone." A failure says so and gives the number.
- The inland letter's words are tested at 4.5:1 on its paper, and the focus ring at 3:1.
