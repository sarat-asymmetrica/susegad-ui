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

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The playful frame is `aria-hidden` (`packages/components/reach/skins/playful.js`); the contact lines are text: the label, the address and the number. `packages/components/reach/reach.check.mjs`: "the WhatsApp links read back to the number and the written message", "the email links are mailto: with a subject". |
| 1.3.1 Info and relationships | Meets | A native `<address>` with a label and a native `<a>` on each line; the copy button is a native `<button>` and its result is in a `role="status"` line (`packages/components/reach/reach.js`). `reach.check.mjs`: axe with and without JavaScript, 0 violations. |
| 1.4.1 Use of color | Meets | The links keep their underline in every register (`packages/components/reach/reach.css` only recolours it in warm: `text-decoration-color`), and the copy result is said in words ("Copied +91 90000 12345. Paste it into WhatsApp or your phone."). |
| 1.4.3 Contrast (minimum) | Meets | `packages/components/reach/reach.test.js`, "AA: <palette>: the inland letter's words read at 4.5:1, in either theme (it is always light)"; `packages/tokens/tokens.test.js` for the other registers; `reach.check.mjs`: "axe, <theme>, all three registers: 0 violations". |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and nothing clipped (throwaway Playwright script). |
| 1.4.10 Reflow | Meets with author's part | `reach.check.mjs`: "at 390 px the page does not scroll sideways", "at 320 px the page does not scroll sideways". The 320 px check failed before the demo was fixed (the demo page scrolled 32 px sideways, 352 px wide, from its own grid's `minmax(21rem, 1fr)` columns); the demo's grid is now `minmax(min(100%, 21rem), 1fr)` and the page is 320 px wide. A page that lays reach cards in a grid keeps its columns able to shrink to the screen. |
| 1.4.11 Non-text contrast | Meets | The copy button's border is `--sg-rule-strong`: 3.66:1 against the page in light and 3.69:1 in dark in the default palette, in all three registers (manual test, 2026-10-07, painted colours read from the demo). `packages/tokens/tokens.test.js` asserts 3:1 or more for the rule and the focus ring on every surface for every palette and theme; `reach.test.js` asserts the focus ring 3:1 on the inland letter's paper. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo at 320 px and at 1280 px, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `reach.check.mjs`: "keyboard: email, WhatsApp, then the copy button; Enter copies". The links and the button are native. |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07: `packages/components/reach/reach.js` binds a `click` on the copy button only: no `keydown`, no `tabindex`; focus leaves with Tab as for any link or button. |
| 2.4.3 Focus order | Meets | `reach.check.mjs`: "keyboard: email, WhatsApp, then the copy button", the reading order. |
| 2.4.4 Link purpose (in context) | Meets with author's part | Each link's text is the address or the number (`packages/components/reach/reach.check.mjs`, "the WhatsApp links read back to the number and the written message"), and its label ("Email", "WhatsApp") sits in the same line, which is the link's context. The labels and the written WhatsApp message are the author's. |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the links and the button in each register and requires a focus style; `reach.test.js` asserts the ring 3:1 on the inland letter's paper. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test, 2026-10-07: `packages/components/reach/reach.css` uses no `position: fixed` or `sticky`, and a document scan of the demo found none. A sticky header or banner the page adds can cover a line that is scrolled to. |
| 2.5.3 Label in name | Meets | A link's name is its visible text, and the button's is its visible words ("Copy number", then "Copied"): `reach.check.mjs`, "copy: the number is on the clipboard and a status line says so in words". |
| 2.5.8 Target size (minimum) | Meets | `reach.check.mjs`: "the copy button is at least 24 px tall". Manual test, 2026-10-07, 390 px touch: the copy button is 111.3 by 32.0 px, and the links are 32.1 to 38.0 px tall and 115.4 px or more wide, in all three registers. |
| 4.1.2 Name, role, value | Meets | Native links and button; the button's name changes with its state. `reach.check.mjs`: axe with and without JavaScript, 0 violations. |
| 4.1.3 Status messages | Meets | One `role="status"` line says the copy result in words, and says so on failure with the number: `reach.check.mjs`, "copy: the number is on the clipboard and a status line says so in words", with a control ("a button that copies silently fails the same probe"). The check needs clipboard permission and is skipped in an engine that does not grant it. |

**The page author owns:**

- The labels, the address, the number, the written WhatsApp message and the hours, in the language of the page, and `lang` on text in another language (3.1.2).
- The grid a page puts several reach cards in, so its columns can shrink to a 320 px screen (1.4.10).
- Sticky headers and banners that could cover a line when it takes focus (2.4.11).
- The colours the page sets behind the card, if it overrides the tokens.
