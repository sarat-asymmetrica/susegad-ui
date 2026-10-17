# Ticket

*What a visitor is given when they register: their name, the event, the time in IST, an id, and the id as a QR code with its text beside it.*

It is made on their own device, kept only there, saved as a picture on request, and it opens again later, offline too.

```html
<link rel="stylesheet" href="susegad/components/qr/qr.css">
<link rel="stylesheet" href="susegad/components/ticket/ticket.css">
<script type="module" src="susegad/components/ticket/ticket.js"></script>

<sg-ticket id="ticket" event="Mandovi Conclave" at="2026-11-21T09:30"></sg-ticket>
```

```js
const { ticket, kept } = await document.getElementById('ticket').issue('Maria Fernandes');
```

| Attribute | Values | What it does |
|---|---|---|
| `event` | the event's name | Shown on the card, and a ticket kept for another event is not shown. |
| `at` | `2026-11-21T09:30`, read in IST | When it is; shown in words, in the page's language. |

## The prompt

Make a ticket confirmation web component for an event registration, `<sg-ticket event="Mandovi Conclave" at="2026-11-21T09:30">`, with a pure core, three registers and a finishing moment. It shows a card headed "Your ticket" with the name, the event, the time in IST written in words in the page's language (English, or Konkani in both scripts, through the library's `core-intl` and `core-intl-kok`), and a ticket id, then the id as the library's `<sg-qr>` with its text beside it as real text and a sentence on what to do at the door. The id is made on the device from `crypto.getRandomValues` (eight characters in two groups of four, from 31 characters without 0, O, 1, I or L, drawn without modulo bias), is the QR's value and nothing else, and a test must decode the drawn matrix and the saved picture to prove the code and the text agree. `issue(name)` makes and keeps the ticket and shows it; keep it only in `localStorage` with a try/catch around every read and write (the name, event, time, id and issue time; never an email address); with storage missing, blocked or full the ticket still shows and `issue()` says it was not kept. A kept ticket for this event is shown again when the element connects, quietly. Save as picture draws a canvas from the card's blocks (the same labels and values in the page's language, the code, the id, the closing line), always on light paper whatever the theme, with the right font loaded first for the words' script, and turns it into a PNG through the library's `packages/export/png.js`; on failure say so in place and keep the button. A new ticket ends in one finishing moment kept in its own small function so it can be replaced: a short settle (a spring in playful, a fade in warm, none in quiet or under reduced motion), a soft confirming sound only if the sound switch is on, one sentence said once through `announce()` (the closing line and the id a character at a time), and focus on the heading. Show "kept on this device only, nothing was sent to a server" on the card, and the line that it opens again without a connection once opened. Quiet is a hairline card with a dashed tear; warm is a paper ticket boxed in four seeded pencil strokes with a dashed pencil tear line between the facts and the QR stub; playful is a ticket with a round bite out of each edge where it tears and a perforated line, the tear running down the card on a wide screen and across it on a phone. Answer a press in every register as the touch contract says.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| an id made on the device, read aloud at a door | random | `newId()` draws from a 31-character alphabet with no look-alikes, throwing away bytes at 248 and over so no character is favoured. `spokenId()` reads it a character at a time. |
| the QR holds the id and nothing else | one source | `cardBlocks()` gives the `qr` block the id as its text; the element's `sg-qr` takes the same id as its `value`. A test decodes both the drawn matrix and the saved picture. |
| the time in IST, in words | intl | `timeText()` is core-intl in English and `formatKonkani()` for Konkani, with the part of the day. |
| kept only on the device | storage | `safeStore()` wraps `localStorage` in try/catch; `saveTicket()`, `loadTicket()` and `forgetTicket()` are tested with storage that is missing, blocked and full, and damaged text. |
| no email address | record | `makeTicket()` copies only the named fields, so an email handed to it is dropped. |
| saved as a picture | export | `ticketToPng()` draws the blocks on a canvas (wrapped with `wrapLines()`, the code from `encode()`), with the page's tokens read as light; `canvasToPng()` from `packages/export/png.js` makes the Blob; a link with a download name hands it over. |
| one finishing moment | seam | `finish()` in `ticket.finish.js`: announce, sound, focus, settle. A shared success moment, if the library gets one, replaces this file. |
| a tear where a ticket tears | geometry | The warm skin's `tearPath()` and the playful skin's `ticketShape()` take the tear's position from where the stub starts, down the card when the stub is beside the facts and across it when it is below. |
| a pencil box | seed | `framePaths()` wobbles four strokes with a Park-Miller generator seeded from the element's id. |
| under reduced motion, show it all at once | still | Every skin and `finish()` check `motion === 'still'`; nothing animates. |
