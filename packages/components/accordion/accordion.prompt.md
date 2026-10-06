# Accordion

*Frequently asked questions: a homestay's FAQ, a workshop's common questions, a page of "how it works".*

A list of questions the reader opens one at a time. Built on the browser's own details and summary, so the keyboard, the screen reader and the exclusive group come from the platform; the component's job is the drawing and the account of what is open.

```html
<link rel="stylesheet" href="susegad/components/accordion/accordion.css">
<script type="module" src="susegad/components/accordion/accordion.js"></script>

<sg-accordion name="faq">
  <details name="faq" open>
    <summary>Where is the homestay, and how do I get there?</summary>
    <p>In Aldona, a village in the fields north of Panjim.</p>
  </details>
  <details name="faq">
    <summary>Is breakfast included?</summary>
    <p>Yes, on the veranda from 7:30 to 10.</p>
  </details>
</sg-accordion>
```

## The prompt

Make a FAQ accordion web component around native `<details>` and `<summary>`, in the light DOM only. Do not build your own open and close: the summary is already a button-like toggle that takes Tab and turns on Enter and Space, the open state is already in the accessibility tree, and several `<details>` sharing one `name` attribute already form an exclusive group, only one open at a time (Chromium and Safari, Firefox from 130). The element `<sg-accordion>` wraps a list of details; it copies its own `name` attribute onto any child that has none and leaves children that carry a name alone, so one accordion can hold an exclusive group and free-standing sections side by side. Two items of one group starting open are settled by the browser while parsing, so the element does not re-judge them; a build step can check the source with `resolveOpen()` from the pure core instead. The element keeps an account and hands it out: on every turn it dispatches `sg-accordion-change` with `{ open, total, exclusive }`, once per turn even though both group-mates fire a toggle, and exposes `details`, `items` and `account`. It adds no words anywhere: every word a reader sees is the author's markup, and the STRINGS shelf in the core is empty on purpose. The pure core (`accordion.core.js`) runs in Node with no DOM: groups from `groupsOf`, the clash plan from `resolveOpen` (first of each named group keeps open, the rest closed, each with a warning), the open account from `describeItems` (`{ total, open, exclusive, groups }`, exclusive false when two of a named group are open at once), and `othersToClose` for what one turn of a named item closes. Three registers. Quiet: hairline rules between items and across the top of the first, generous space, a thin chevron that turns when the item opens, nothing else. Warm: the marker drawn in the hand face, a small hand-set plus that becomes a minus when the item opens, and a soft open transition, the answer sliding down and fading in. Playful: the questions set in the hand face, and the marker a drawn glyph in the accent colour, each with its own small seeded tilt (two to seven degrees, from a seed), that flips 180 degrees with a spring ease when the item opens. The open transition animates the native `::details-content` (block size, opacity and content-visibility) with `interpolate-size: allow-keywords` set on the element, so the height animates to and from auto; every transition lives under the element's `data-motion` word, which is `still` under reduced motion, `state` in quiet, `ambient` in warm and `full` in playful. Under reduced motion nothing carries a transition and an item still opens and closes as a finished still.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| native details and summary | the platform | No custom toggle anywhere. The summary takes Tab and turns on Enter and Space; the open state is in the accessibility tree without a line of ARIA. |
| exclusive group | `<details name>` | Several details sharing a `name` keep each other: only one open at a time. Chromium and Safari, Firefox from 130. Without a name, every item stands alone. |
| the element's name adopts the children | `connected()` in `accordion.js` | A `name` on `<sg-accordion>` is set on every child that has none; a child that already carries a `name` keeps its own. |
| two open in one group at parse | the browser | The browser keeps the first and drops the rest while parsing, before custom element code runs. `resolveOpen()` in the pure core does the same job in the open, with a warning per closed item, for a build step. |
| the account | `describeItems(items)` in the core | `{ total, open, exclusive, groups }`. `exclusive` is false only when two items of a named group are open at once; an unnamed open one beside them does not break the promise. |
| tells the page what is open, once per turn | the element's `update()` | Both group-mates fire a `toggle` on one turn (the event bubbles in modern Chromium); the element signs the account and emits `sg-accordion-change` only when it changed. |
| no words of its own | `STRINGS = {}` in the core | Every word a reader sees is the author's markup. The shelf is empty on purpose, so a future string has a home. |
| hairline rules, a thin chevron | quiet register | CSS only: a chevron of two borders that rotates 45 degrees between closed and open, no easing, a state not a motion. |
| the marker in the hand face | warm register | CSS: `content: "+"` becomes `"–"` on `[open]`, set in `var(--sg-font-hand)` in the accent colour; the answer opens with a soft slide on `::details-content`. |
| a glyph that flips | playful register | CSS: the marker is a drawn glyph in the hand face, rotated by `--sg-acc-tilt` (set per item by the skin from a seed, two to seven degrees) and flipping 180 degrees more when the item opens, on the spring ease. |
| a soft open transition | `::details-content` | The answer's block size, opacity and content-visibility transition, with `interpolate-size: allow-keywords` on the element so the height animates to and from `auto`. Warm uses the ease-out, playful the spring. |
| nothing moves under reduced motion | `data-motion` | The element's motion word is `still` under reduced motion; every transition in the CSS is gated on `data-motion` and on `prefers-reduced-motion`, and the still is finished: items still open and close. |

## Accessibility

- No ARIA: `<details>` and `<summary>` already say everything.
- The markers and rules are pseudo-elements; they carry no meaning and sit outside the accessibility tree.
- The focus ring is visible in every register; the tab order is the order the questions are written.
- Without JavaScript, everything still opens and closes, and the quiet look applies.

## Checks

`accordion.check.mjs` proves all of it in a browser: axe in three registers and two themes and without JavaScript (0 violations everywhere), Tab reaching a summary with a visible ring, Enter and Space turning it, the exclusive group displacing its neighbours by click and by keyboard, two shipped-open items settled to one, a child with its own name left out of the adoption, no JavaScript (open and close, and the exclusive promise, on the platform alone), 390 px with no sideways scroll, reduced motion as a finished still with the transition under a millisecond, and a control: the same exclusive-group probe on plain unnamed details, where all three stay open, reads red once to prove the check has teeth.
