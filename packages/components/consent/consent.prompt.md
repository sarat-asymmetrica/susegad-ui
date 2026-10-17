# Consent notice

*The plain notice a form shows before it keeps someone's details: what we ask for, why, for how long, whom to ask, how to withdraw, and a box.*

A starting point, not legal advice: a legal read is the site's to get before it goes live.

```html
<link rel="stylesheet" href="susegad/components/consent/consent.css">
<link rel="stylesheet" href="susegad/components/check/check.css">
<link rel="stylesheet" href="susegad/components/field-note/field-note.css">
<script type="module" src="susegad/components/consent/consent.js"></script>

<sg-consent site="Mandovi Conclave"
            fields="your name and your email address"
            purpose="confirm your place and send you the ticket"
            period="30 days after the event"
            contact="hello@conclave.example.in"
            complain="If you are not satisfied with our answer, write to the organisers at the same address."></sg-consent>
```

| Attribute | Values | What it does |
|---|---|---|
| `fields`, `purpose`, `period`, `contact`, `site`, `complain` | the site's own words | Fill the notice. Left out, each shows as a visible [placeholder]. |
| `level` | 2 to 6 | The heading's level. Default 3. |

## The prompt

Make a consent notice web component for a form, `<sg-consent>`, for a site that collects personal details under India's Digital Personal Data Protection Act, 2023. Say it in plain words, not a legal wall: a heading ("What we do with your details") and six short lines in this order: what is collected ("We ask for {fields}."), why ("We use them to {purpose}, and for nothing else."), for how long ("We keep them until {period}, then we delete them."), whom to ask ("To ask what we hold, to correct it, or to have it deleted, write to {contact}."), how to withdraw (consent can be taken back at any time by writing to the same address, taking it back does not undo what was done before, and we will say if it changes what we can do), and a line where the site says where a visitor can complain. Name no law and no body in the visitor's words. End with a checkbox that is never ticked for the visitor, in its label ("I have read this, and I agree that {site} may use my details in this way."), as a native required checkbox named `consent`, so the browser's own validation stops the form until it is ticked, with or without script. When the form is sent without the tick, mark the box invalid, move focus to it and say, in the note beside it, "Please tick the box if you are happy to go on. We cannot use your details without it." Take every value as an attribute in the page's language; a value the site has not given is shown as a visible, highlighted [placeholder] in square brackets (always English, in every language, and marked `lang="en"`, because it is for the builder and not for a visitor), the notice gets a dashed border, and the console says once that placeholders are left, so no site publishes a sample by mistake. Write the same markup as a pure function for a build script or a server, so a page can carry the notice as plain HTML and read with no script. Give the words in English and in Konkani in both scripts through a strings table, and escape every value. Make a named group of it, headed by its heading. Give it three registers: quiet is a block with a hairline border; warm is the notice boxed in four seeded pencil strokes that cross at the corners, with the heading in the hand; playful is a ticket with a round bite out of each side at a perforated tear line just above the box, stamped down with a small spring settle. The drawing is hidden from assistive technology, sits under the words, lets every click through, is dropped in forced colours, and under reduced motion simply is there. Compose the library's own checkbox and field note rather than drawing new ones.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| plain words, in three languages | strings | `consent.strings.js` is keyed `en`, `gom-Deva`, `gom-Latn` and read through `strings()`. A function entry takes the site's value. |
| a value the site has not given is visible | placeholder | `noticeText()` puts the `blank` placeholder in square brackets where a value is missing; `unfilled()` finds them; the element marks `data-incomplete` and warns once. |
| the same markup with no script | pure render | `renderConsent()` and `consentInner()` return the HTML as a string; the element writes it when it is empty and only enhances it when it is already there. |
| never pre-ticked, enforced by the browser | native | The box is `<input type="checkbox" name="consent" required>` in its label; unit-tested to have no `checked`. |
| say what is missing | field note | `<sg-field-note for validate data-value-missing="…">` shows the "please tick" words, marks the box invalid and moves focus on a send. |
| no law and no body in the visitor's words | copy | A test fails if the visitor's words contain "Act", "Board", "DPDP" or a ministry. The complaint line is the site's own. |
| escape what the site gives | safety | `esc()` runs over every value before it is set into the markup; unit-tested with `&`, `<` and quotes. |
| boxed in pencil | seed | `framePaths(w, h, seed)` in the warm skin draws four strokes that run past their corners, wobbled by a Park-Miller generator seeded from the notice's id; the dash slides to 0 to draw them. |
| a ticket with a tear line | geometry | `ticketPath(w, h, y)` in the playful skin makes a rounded outline with a bite out of each side at `y`, taken from where the tick box starts, and a dotted line between the bites. |
| the drawing never blocks a click | layout | The drawing is the first child, `pointer-events: none`, with the words positioned above it. |
| under reduced motion, show it all at once | still | Every skin checks `ctx.motion === 'still'`; nothing is animated. |
