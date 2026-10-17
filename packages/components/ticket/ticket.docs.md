# Ticket

`<sg-ticket>` is what a visitor is given when they register: their name, the event, the time in IST, a ticket id, and the id as a QR code with its text beside it. It is made on their own device, kept only there, saved as a picture on request, and it opens again on their next visit, offline too.

## Use

```html
<link rel="stylesheet" href="susegad/components/qr/qr.css">
<link rel="stylesheet" href="susegad/components/ticket/ticket.css">
<script type="module" src="susegad/components/ticket/ticket.js"></script>

<sg-ticket id="ticket" event="Mandovi Conclave" at="2026-11-21T09:30"></sg-ticket>
```

With nothing kept on the device the element is hidden and takes no room. Make a ticket when a registration succeeds:

```js
const ticket = document.getElementById('ticket');
const made = await ticket.issue('Maria Fernandes');   // { ticket, kept }, or null if the name is empty
```

`issue()` makes the id, keeps the ticket on the device, shows it, and ends with the finishing moment (below). When the visitor comes back, the element shows the kept ticket by itself, quietly: nothing is said aloud, nothing settles, focus is not taken.

The event template wires it to its registration form: the form fires `sg-register` with `{ name, email }`, and `page.js` answers by calling `ticket.issue(name)`. To register people for real, send `{ name, email }` to your own server in that listener first, then make the ticket from what it answers.

## Attributes

| Attribute | Values | What it does |
|---|---|---|
| `event` | the event's name | Shown on the card, in the page's language. |
| `event-id` | a name for the event in no language, such as `mandovi-conclave` | What a kept ticket is matched by. The event's name is written differently on each language's page, so matching on it made a ticket made on one page vanish on the next; with an id the same ticket shows on every page of the event. Give every page the same one. Without it the name and the time must match. |
| `at` | `2026-11-21T09:30`, read in IST | When it is, written in words in the page's language ("Saturday 21 November, 9:30 am"; in Konkani "शेनवार 21 नोव्हेंबर, सकाळीं 9:30"). A date and time with an offset (`+05:30`, `Z`) is read at that offset. |
| `register` | `quiet`, `warm`, `playful` | Inherited from the page by default. |

## Methods and events

| | |
|---|---|
| `el.issue(name, { id?, issued? })` | Make a ticket for `name`, keep it, show it, finish. Resolves to `{ ticket, kept }` (`kept` says whether the browser kept it; the ticket shows either way), or `null` when the name, the event or the time is missing or wrong. `id` and `issued` are for tests. |
| `el.show(ticket, { isNew?, kept? })` | Show a ticket (a record from `makeTicket()`) without the finishing moment. Returns whether it was valid. Does not keep it. |
| `el.forget()` | Forget the ticket on this device and take the card away. It says "Forgotten. The ticket is no longer on this device." once, and moves focus on if it was on the card. The card has a **Forget this ticket** button that does the same. |
| `el.ticket` | The ticket on show, or `null`. |
| `sg-ticket` | Bubbles when a ticket is shown: `{ ticket, kept, isNew }`. |
| `sg-ticket-forget` | Bubbles when the ticket has been forgotten. |

## What is on the card

A heading ("Your ticket"), the closing line ("You are on the list. See you there."), then the facts (name, event, time in IST) beside the stub: the QR code with the ticket id as real text next to it and what to do at the door. Below: the line that it opens again without a connection, the line that the ticket is kept on this device only and nothing was sent to a server, and the Save as picture button with a status line under it. The words are in `ticket.strings.js`, in English and in Konkani (Devanagari and Romi), from the words written for the conclave kit; the language is the nearest `lang` above the card. The Konkani is a draft for a native reader.

## The id

Eight characters in two groups, "K7QD-M3PX", made on the device from the browser's own random numbers (`crypto.getRandomValues`). The 31 characters have no 0, O, 1, I or L, because an id is read aloud and typed at a door. Bytes that would make some characters likelier than others are thrown away, so every character is equally likely. `newId()`, `isId()` and `spokenId()` ("K 7 Q D, M 3 P X") are in `ticket.core.js`.

The QR code holds the id and **nothing else**. The picture's accessible name says so ("QR code for ticket K7QD-M3PX. It holds the ticket id and nothing else."), and a unit test and a browser check decode the code the page drew, and the saved picture, with an independent decoder (jsQR) to prove it reads as the id beside it. If you ever put more in the code, change that name to match.

## What the device keeps, and what it never does

The ticket is one `localStorage` entry, `sg-ticket`, with a few facts: the name, the event (and its `event-id`), the time, the id and when it was made. **It is deleted by itself on the seventh day after the event's day, read in IST**, the next time the page looks for it (a ticket for 21 November is kept through 27 November); and **the visitor can remove it at any time** with the Forget this ticket button. Every read and write is wrapped in try/catch, because storage can be missing (a private window, blocked site data) or full. With no storage the ticket still shows for the page and `issue()` resolves with `kept: false`, so a page can say so. A record from another version, or damaged text, reads as no ticket.

**No email address is kept**, and the form's email field goes nowhere: `makeTicket()` copies only the four named facts, so an email handed to it is dropped. **Nothing is sent to any server.** The ticket is made in the browser and drawn from the browser's storage; the offline recipe's cache never holds it (`docs/decisions/0028-offline-cache.md`: the cache holds the page that draws a ticket, never a ticket). The visitor can remove it from the browser's site settings at any time.

## Save as picture

The button draws the ticket on a canvas and turns it into a PNG with `packages/export/png.js`, as decision 0023 says exports are made, then hands it over as a download named `ticket-<id>.png`. The picture reads well with nothing around it: the same labels and values as the page, in the page's language, then the code with its id under it, then the closing line. It is always on light paper, 600 CSS pixels wide at 2x, whatever the theme of the page, because a picture lives in a phone's photos or on a printout; the colours come from the page's own tokens read as light, so a different palette gives a ticket in that palette. The right face for the words' script is loaded before the canvas is drawn (canvas text does not start a font download), so Devanagari is set in a Devanagari face.

If the picture cannot be made, the status line says what happened and what to do ("The picture did not save. Try again, or take a screenshot of this page.") in place, and the button stays. The picture maker is loaded only when the button is pressed (`ticket.png.js`), so it costs nothing until then.

## The finishing moment

A new ticket ends in one recognisable moment, and it is the smallest honest one: it lives in its own file, `ticket.finish.js`, so that a site's own success moment (the one it shows after paying, say) can take its place without touching the ticket. It does four things, once, when a ticket is made (never when one is only shown again):

- **settles the card:** a short spring in playful, a plain fade in warm, nothing in quiet or under reduced motion;
- **a soft confirming sound,** only if the sound switch is on and only after this press, never on load;
- **says one sentence aloud** through `announce()`: the closing line, then the id a character at a time ("You are on the list. See you there. Ticket id: K 7 Q D, M 3 P X.");
- **moves focus to the ticket's heading,** so a keyboard or a screen reader user is where the news is.

To replace it, change the `finish()` call in `ticket.js`'s `issue()`; it takes the card, the sentence, the motion, the register and the element to focus.

## Registers

| | Look | Motion |
|---|---|---|
| quiet | a card with hairlines and a dashed line where it would tear | none |
| warm | a paper ticket boxed in four seeded pencil strokes that cross at the corners, torn along a dashed pencil line; the heading in the hand | the strokes are drawn in when the card is first shown; a new ticket fades in |
| playful | a ticket with a round bite out of each edge where it tears, and a row of perforation dots along the tear | a new ticket settles with a small spring |

The tear runs between the facts and the QR stub: down the card on a wide screen (the stub beside the facts) and across it on a phone (the stub below). The skins read where the stub starts, so it follows the layout. The drawing is `aria-hidden`, sits under the words and lets every click through. Under reduced motion every register is simply drawn. In forced colours the drawing is dropped and the card gets a plain border.

## Without JavaScript

The ticket is made and drawn by script, so without it there is no ticket: the element is empty and hidden. A site that must work without script keeps its registration on a server and renders the confirmation itself; this component is for a ticket that lives on the visitor's device. The page around it (the event, the form with its consent notice) reads with no script, and the offline recipe's pages say honestly what still works.

## Accessibility

- The card is a `<section>` named by its heading ("Your ticket"). The facts are a description list, and the time is a `<time datetime>` so the machine-readable time stays beside the words.
- The QR picture has a name that says what it holds. Its words (the id as text, and what to do if it will not scan) are real text beside it, so a person who cannot scan can read the id out.
- The new-ticket announcement is made once, and the card is not a live region, so nothing is read twice. The save result is a polite status line.
- Save as picture is a native button, at least 44 px tall, and answers a press in every register (`docs/contributing/touch-contract.md`). The heading takes focus programmatically only, after a new ticket.
- Nothing shows by colour alone, and nothing flashes.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The QR picture has a name that says what it holds ("QR code for ticket K7QD-M3PX. It holds the ticket id and nothing else.") and its words sit beside it as text; the pencil frame, the tear and the ticket outline are `aria-hidden`: `packages/components/ticket/ticket.check.mjs`, "the code is named, and says it holds the id and nothing else" and "<register> at <width> px: the drawing is hidden from assistive technology and lets clicks through". |
| 1.3.1 Info and relationships | Meets | The card is a `<section>` named by its heading, the facts are a description list, and the time is a `<time datetime>`: `packages/components/ticket/ticket.check.mjs`, "the card is a group named "Your ticket"", "the facts carry the deck's labels and the time in words, read in IST" and "the time is a <time> with its IST datetime". |
| 1.4.1 Use of color | Meets | Everything the card says is words: the closing line, the labels and values, the id. The accent colour on the closing line adds nothing the words do not say: `packages/components/ticket/ticket.check.mjs`, "the facts carry the deck's labels and the time in words, read in IST". |
| 1.4.3 Contrast (minimum) | Meets | `packages/components/ticket/ticket.check.mjs`, "every line of text on the card holds 4.5:1 in every register and theme" reads the painted colours in the browser (lowest 5.96:1, the labels in light warm). Manual test, 2026-10-08 (throwaway Playwright script, the demo, six register and theme pairs): values and the id 10.27:1 to 15.27:1; labels and notes 5.96:1 to 9.60:1; the closing line 6.09:1 to 9.05:1 (it was 3.72:1 in dark playful until the check found it, and is now the accent pulled toward the ink); the Save as picture label on its button 4.69:1 in light and 6.34:1 in dark. Axe, 0 violations: `tools/axe.mjs --url /packages/components/ticket/demo.html` (desktop and phone, 6 runs each). Axe lists contrast as "incomplete" under the drawing, so the numbers above are the evidence. |
| 1.4.4 Resize text | Meets | `packages/components/ticket/ticket.check.mjs`, "<register> at 320 px with text at 200 percent: no sideways scroll": the QR plate shrinks to fit (190 px wide) instead of running off the screen, which it did at 336 px before that check. Manual test, 2026-10-08: the demo at 320 px with the root font size at 200 percent, three registers: page width 320 and every card inside the screen with its text in full (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-08: the demo at 320 CSS px, three registers: page width 320, every card inside the screen, the stub below the facts. `packages/components/ticket/ticket.check.mjs`, "<register> at 390 px: no sideways scroll". |
| 1.4.11 Non-text contrast | Meets | The QR modules on their plate are 16.38:1 or more in every register and theme (manual test, 2026-10-08, as above); the plate is light in every theme by design. The Save button's fill is `--sg-accent` (the 1.4.3 row gives its label contrast), and the focus ring is `--sg-focus`: `packages/tokens/tokens.test.js`, "focus ring and control borders are 3:1 or more on every surface". |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-08: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo at 320 px, three registers: every child of every card ends inside the card and the page stays 320 wide (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | Save as picture is a native button: `packages/components/ticket/ticket.check.mjs`, "Save as picture works from the keyboard (Enter on the focused button downloads the same file)". |
| 2.1.2 No keyboard trap | Meets | Focus moves to the heading only after a new ticket is made, the heading is not a control, and Tab leaves it: `packages/components/ticket/ticket.check.mjs`, "focus is on the ticket's heading". |
| 2.2.2 Pause, stop, hide | Meets | The only motion is a single settle of a new ticket (240 to 360 ms) and the pencil strokes drawn once; nothing repeats, and under reduced motion nothing animates: `packages/components/ticket/ticket.check.mjs`, "playful: a new ticket settles" and "reduced motion: nothing animates when a ticket is made". |
| 2.3.1 Three flashes or below threshold | Meets | Nothing flashes: the card fades or settles by 3 percent in scale once (`packages/components/ticket/ticket.finish.js`). |
| 2.4.3 Focus order | Meets | The card has one control, Save as picture, after the words; a new ticket moves focus to its heading, then Tab goes on to the button: `packages/components/ticket/ticket.check.mjs`, "focus is on the ticket's heading". |
| 2.4.7 Focus visible | Meets | `packages/components/ticket/ticket.css` draws the token focus outline on the button and on the heading; `tools/touch.check.mjs` requires a focus style. |
| 2.4.11 Focus not obscured (minimum) | Meets | The card is in the flow of the page and never fixed or sticky (`packages/components/ticket/ticket.css` sets no `position: fixed` or `sticky`), and the heading is focused with scrolling allowed, so it comes into view. |
| 2.5.3 Label in name | Meets | The button's name is its visible text, "Save as picture" (and its Konkani), set from the one string in `packages/components/ticket/ticket.strings.js`; `packages/components/ticket/ticket.check.mjs`, "the status says it saved, in words" presses it by its visible name. |
| 2.5.8 Target size (minimum) | Meets | `packages/components/ticket/ticket.check.mjs`, "<register> at <width> px: Save as picture is a thumb's height": 44 px tall in every register at 1000 and 390 px. |
| 4.1.2 Name, role, value | Meets | A named section, a native button with its name, and a named QR picture; axe, 0 violations on the demo in both themes and every register, and with a ticket just made and its heading focused: `packages/components/ticket/ticket.check.mjs`, "axe, <theme>, with a ticket just made and its heading focused: 0 violations". |
| 4.1.3 Status messages | Meets | A new ticket is announced once through `announce()`, in words, with the id a character at a time, and a ticket shown again says nothing; the save result is a polite status line: `packages/components/ticket/ticket.check.mjs`, "one sentence is said, once: the closing line and the id a character at a time", "after a reload the same ticket shows again, quietly" and "the status says it saved, in words". |

**The page author owns:**

- The words of the event and the name the visitor typed, in the language of the page; `lang` on a value in another language (3.1.2).
- Telling the visitor the ticket is only on their device if the site keeps no copy: the card says so, but a site that also keeps a record on a server must say that too, in its own notice.
- A way to get a ticket back if the visitor clears their browser or changes phones. The component keeps nothing elsewhere.
- Not putting the card under a sticky header that could cover it when it takes focus (2.4.11).

## Words

`ticket.strings.js` holds every string, keyed `en`, `gom-Deva`, `gom-Latn`. The page's own facts (the name, the event) are whatever the page gives, in the page's language.

## Checks

`node --test packages/components/ticket/` covers the pure core: the id (no look-alikes, no bias), the record, the time in words (English and both Konkani scripts, under three machine zones), the rows and the picture's blocks, that the matrix decodes to the id beside it, storage that is missing, blocked, full or damaged, the line-wrapping of the picture and the shapes the skins draw. `node packages/components/ticket/ticket.check.mjs` checks the behaviour in a browser: the card, a ticket made and kept, a reload that shows it quietly, storage trouble, a downloaded PNG that decodes to the id, Konkani, the three registers at 1000 and 390 px, motion and axe.
