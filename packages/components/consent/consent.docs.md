# Consent notice

`<sg-consent>` is the plain notice a form shows before it keeps someone's details. It says what is collected, why, for how long, whom to ask, how to take consent back and where to complain, and it ends in a box the visitor ticks. The box is never ticked for them.

> **Not yet reviewed by a lawyer. Get a legal read before you go live.** This notice is written in plain words so that a visitor can follow it. It is a starting point, not legal advice, and it has not been read by a lawyer. India's Digital Personal Data Protection Act, 2023 sets duties for anyone who collects personal data, and what you must say depends on what you collect and why. Before the site goes live, someone who knows the Act should read the notice against your form. The Act expects people to be able to complain to the Data Protection Board if they are not satisfied. The sample names no body, so `consent.complain` is a placeholder line that you fill in; this is where that goes. Two things the sample does not decide for you: the length of time you keep details (the sample says 30 days after the event; that is a placeholder) and the contact (the sample leaves it blank on purpose). If a form may be used by people under 18, ask about that too: the Act has particular rules.

This note is for builders, so it may name the Act; it is the one place in the kit that does. The words a visitor reads name no law and no body.

## Use

```html
<link rel="stylesheet" href="susegad/components/consent/consent.css">
<link rel="stylesheet" href="susegad/components/check/check.css">
<link rel="stylesheet" href="susegad/components/field-note/field-note.css">
<script type="module" src="susegad/components/consent/consent.js"></script>

<form action="/register" method="post">
  <label for="name">Your name</label> <input id="name" name="name" autocomplete="name">
  <label for="email">Your email address</label> <input id="email" name="email" type="email" autocomplete="email">

  <sg-consent site="Mandovi Conclave"
              fields="your name and your email address"
              purpose="confirm your place and send you the ticket and any change to this event"
              period="30 days after the event"
              contact="hello@conclave.example.in"
              complain="If you are not satisfied with our answer, write to the organisers at the same address."></sg-consent>

  <button>Register</button>
</form>
```

The element writes the notice from those attributes, in the language of the page. The attributes hold your own words, in the page's language: a Konkani page gives its values in Konkani.

### As plain HTML, with no script

A notice that has to be there with no script is written ahead of time. `renderConsent()` in `consent.core.js` is the same markup the element writes, as a string for a build script or a server; the event template's `pages.mjs` uses it:

```js
import { renderConsent } from './susegad/components/consent/consent.core.js';

renderConsent({ lang: 'en', id: 'register-consent', values: { fields, purpose, period, contact, site, complain } });
```

The box in that markup is a native `<input type="checkbox" name="consent" required>` inside its label, so the browser itself blocks the form until it is ticked, with or without any component. When the element is loaded it finds the notice already there and only enhances it.

## Attributes

| Attribute | What it is | If you leave it out |
|---|---|---|
| `fields` | what the form asks for: "your name and your email address" | `[fields: what the form asks for]` |
| `purpose` | why: "confirm your place and send you the ticket"; the notice adds "and for nothing else" | `[purpose: why you need them]` |
| `period` | how long: "30 days after the event"; the notice adds "then we delete them" | `[period: how long you keep them]` |
| `contact` | whom to write to: a real address | `[contact: the site fills in a real address]` |
| `site` | who is asking, in the tick box's words: "Mandovi Conclave" | `[site name]` |
| `complain` | where a visitor can complain if they are not satisfied: your own line | `[complaint line: the site fills this in, naming where a visitor can complain if they are not satisfied]` |
| `level` | the heading's level, 2 to 6 | 3 |
| `register` | `quiet`, `warm`, `playful` | inherited |

A value you leave out is not hidden. It shows as a highlighted `[placeholder]` in square brackets, the notice gets a dashed border, `data-incomplete` is set, and the console says once that placeholders are left. No site publishes the sample by mistake. Every placeholder is written in English, in every language, and marked `lang="en"`: it is for the site builder who fills it in, not for a visitor, and a screen reader does not read it in another language's voice.

## Events and form

| | |
|---|---|
| `sg-consent` | Bubbles when the box changes: `{ checked, id }`. |
| `consent.checked`, `consent.box` | The state and the native checkbox. |
| the form field | `consent=yes` is sent when ticked, and the form is not sent when it is not. |

Nothing is stored by the notice. If you must be able to show what a visitor agreed to, keep the text of the notice (or its version) beside the consent in your own records; that is yours to decide, with your legal reader.

## When the box is not ticked

The box is `required`, so a send without it stops, the box is marked `aria-invalid`, focus goes to it, and the note beside it says: "Please tick the box if you are happy to go on. We cannot use your details without it." The note is the library's `<sg-field-note>`, so it follows the same rules: it is read once, and it goes the moment the box is ticked. Ticking the box sends nothing by itself.

## Registers

| | Look | Motion |
|---|---|---|
| quiet | a plain block with a hairline border | none |
| warm | a notice on paper boxed in pencil: four strokes that cross at the corners, a little differently for each notice; the heading in the hand | the strokes are drawn in when the notice first comes into view |
| playful | a ticket: a round bite out of each side where the tear-off line meets it, a row of perforation dots just above the box | the ticket is stamped down, a small spring settle, when it first comes into view |

The tick box is the library's `<sg-check>` (a native checkbox inside its label), which has its own three looks. Under reduced motion every register shows the finished drawing. In forced colours the drawing is dropped and the notice gets a plain border.

## Words

The words are in `consent.strings.js`, in English and in Konkani (Devanagari and Romi). The Konkani is a draft for a native reader. The language is the nearest `lang` above the notice. Plain words, not a legal wall: "your details", not "personal data"; "write to", not "exercise your rights".

## Where it is used

The event template (`packages/templates/event/`): its registration form, in English and in both Konkani scripts. Its contact, site name and complaint line are left as placeholders for the site, and the template's Konkani values for what is collected, why and for how long are a draft for a native reader.

## Accessibility

- The notice is a `role="group"` named by its heading ("What we do with your details"), so a screen reader says what the box belongs to.
- The box is a native required checkbox, named by its label, and is never pre-ticked. The whole label is the click target (51 px tall at 390 px).
- The "please tick" message is in words, linked to the box with `aria-describedby`, and read once.
- A placeholder is highlighted and in square brackets, so it is not shown by colour alone.
- The drawing (the pencil frame, the ticket) is `aria-hidden`, sits under the words and lets every click through.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The notice has no images. The pencil frame and the ticket are `aria-hidden`: `packages/components/consent/consent.check.mjs`, "<register>: the drawing, if there is one, is hidden from assistive technology". |
| 1.3.1 Info and relationships | Meets | A group named by its heading, the box inside its label, and the note linked by `aria-describedby`: `packages/components/consent/consent.check.mjs`, "a named group, headed "What we do with your details"", "the box is a native required checkbox named consent, in its label, never pre-ticked" and "the box is marked invalid, points at the note, and has focus". |
| 1.3.5 Identify input purpose | Not applicable | The box asks for agreement and collects no personal data of its own. The name and email fields beside it belong to the form, which sets their `autocomplete` (the author's part). |
| 1.4.1 Use of color | Meets | An open value is in square brackets as well as highlighted, and the "please tick" message is words: `packages/components/consent/consent.core.js` (`blank` placeholders) and `packages/components/consent/consent.check.mjs`, "the note says what is missing, in words". |
| 1.4.3 Contrast (minimum) | Meets | Manual test, 2026-10-08 (throwaway Playwright script, the demo, painted colours read in the browser): the notice's text is 13.57:1 and 12.71:1 in quiet (light, dark), 11.36:1 and 15.27:1 in warm, 12.71:1 and 10.27:1 in playful; the softer lines (withdraw, complain) are 5.96:1 or more everywhere; a placeholder on its highlight is 10.27:1 in light and 8.66:1 in dark. Axe, 0 violations: `packages/components/consent/consent.check.mjs`, "axe, <theme>, <register>: 0 violations". |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-08: the demo at 320 px with the root font size at 200 percent, three registers: page width 320 and every notice inside the screen with its text in full (throwaway Playwright script). Sizes are `rem`, `em` and tokens: `packages/components/consent/consent.css`. |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-08: the demo at 320 CSS px, three registers: page width 320, every notice inside the screen. `packages/components/consent/consent.check.mjs`, "<register>: no sideways scroll at 390 px". |
| 1.4.11 Non-text contrast | Meets | The box is the library's checkbox: `packages/components/check/check.test.js`, "1.4.11: <palette> <theme>: the box edge and the tick are 3:1 or more" on every surface, light and dark; the focus ring is tested in `packages/tokens/tokens.test.js`. The pencil frame and the ticket are decoration, not information. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-08: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo at 320 px, three registers: every notice grows to hold its text, the box and its label stay inside, page width 320 (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | The box is a native checkbox: `packages/components/consent/consent.check.mjs`, "Tab goes from the email field to the box" and "Space ticks it and the note goes at once, and ticking sends nothing by itself". |
| 2.1.2 No keyboard trap | Meets | Nothing takes focus by itself except the box after a send that lacked the tick, and Tab leaves it: `packages/components/consent/consent.check.mjs`, "the box is marked invalid, points at the note, and has focus". |
| 2.2.2 Pause, stop, hide | Meets | The only motion is a drawing or a stamp that happens once, in under half a second, when the notice first comes into view; nothing repeats: `packages/components/consent/consent.check.mjs`, "warm: the four strokes are drawn in when a notice first comes into view" and "<register>, reduced motion: no animation runs, the notice is simply drawn". |
| 2.3.1 Three flashes or below threshold | Meets | Nothing flashes: strokes are drawn in once and the ticket settles by 2.5 percent in scale (`packages/components/consent/skins/warm.js`, `skins/playful.js`). |
| 2.4.3 Focus order | Meets | The notice sits where the author puts it, before the send button, and its one control is the box: `packages/components/consent/consent.check.mjs`, "Tab goes from the email field to the box". |
| 2.4.7 Focus visible | Meets | The rule is `input:focus-visible` in `packages/components/consent/consent.css` and `input[type="checkbox"]:focus-visible` in `packages/components/check/check.css`; `tools/touch.check.mjs` requires a focus style. |
| 2.4.11 Focus not obscured (minimum) | Meets | The notice is in the flow of the page and is never fixed or sticky (`packages/components/consent/consent.css` sets no `position: fixed` or `sticky`), so nothing of its own covers the box when it takes focus. |
| 2.5.3 Label in name | Meets | The box's accessible name is its visible label, word for word: `packages/components/consent/consent.check.mjs`, "the box's accessible name is the visible label". |
| 2.5.8 Target size (minimum) | Meets | The click target is the whole label, not only the box: `packages/components/consent/consent.check.mjs`, "<register>: the label is a thumb's height" (51 px tall and 311 to 324 px wide at 390 px). |
| 3.2.2 On input | Meets | Ticking the box changes nothing else: it sends the `sg-consent` event and nothing is submitted or moved: `packages/components/consent/consent.check.mjs`, "Space ticks it and the note goes at once, and ticking sends nothing by itself". |
| 3.3.1 Error identification | Meets | A send without the tick says so in words, beside the box, and marks it `aria-invalid`: `packages/components/consent/consent.check.mjs`, "the note says what is missing, in words". |
| 3.3.2 Labels or instructions | Meets | The notice is the instruction: what is asked, why, for how long, whom to ask, how to withdraw, and a label that says what ticking means: `packages/components/consent/consent.test.js`, "the notice says what is collected, why, for how long, whom to ask and how to withdraw". |
| 4.1.2 Name, role, value | Meets | A named group and a native checkbox with its label, in the demo and as plain HTML: `packages/components/consent/consent.check.mjs`, "axe on the notice as plain HTML: 0 violations" and "axe, <theme>, with the "please tick" note showing: 0 violations". |
| 4.1.3 Status messages | Meets | The "please tick" message is a polite live region from `<sg-field-note>`, read once: `packages/components/field-note/field-note.check.mjs`, "a single note is spoken politely", and `packages/components/consent/consent.check.mjs`, "the note says what is missing, in words". |

**The page author owns:**

- A legal read of the notice against the form, before the site goes live (see the note at the top).
- Every value: what is collected, why, for how long, the contact, the site's name and the complaint line, in the language of the page; and keeping them true as the form changes.
- `autocomplete` on the form's own fields (1.3.5), and `lang` on a value in another language (3.1.2).
- What is done with a withdrawal: the notice promises that writing to the contact takes consent back, so someone must read that address and act.
- Records of what a visitor agreed to, if the site has to show it.

## Checks

`node --test packages/components/consent/consent.test.js` covers the pure core: the notice's lines and their order, the values in each (English, Devanagari, Romi), the visible placeholders and how they are found, escaping, the markup (a native required checkbox, never ticked), that the visitor's words name no law or body, and the shapes of the pencil frame and the ticket. `node packages/components/consent/consent.check.mjs` checks the behaviour in a browser: the markup, sending without and with the tick, placeholders and the console, the notice as plain HTML, Konkani in both scripts, the three registers, reduced motion and axe.
