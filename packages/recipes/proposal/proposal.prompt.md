# Proposal

*A proposal you write in Markdown and send as one sealed file: it opens offline, prints cleanly, works out its own prices, and can be signed on screen or on paper.*

## The prompt

Build a recipe that turns a proposal written in Markdown into one self-contained, sealed HTML document. Read front matter for the title, who it is for and from, the date, the date it holds until, a status while it is a draft, the language, the register and the palette. Make a cover: a scene with the title and a line of byline laid over it, the draft status stamped across the picture's corner with `<sg-stamp>` (the words stay DOM text), and the meta set below like a letterhead in a definition list. Wrap each `##` heading and what follows in its own section, with a pen-drawn rule above the heading and the section's number lettered by hand at the rule's end. Write the price tables at build time from the booking kernels, so the figures read and print with no script: the whole rate card by season (`view=bands`), and a stay night by night with before GST, GST on its own line, the total and the deposit, the word "provisional" wherever the house has not confirmed a figure, and a native disclosure to try other dates priced on the page by the same kernels. Make the plan an ordered list of steps on a rule, and with JavaScript add a native range above it that walks through the steps, marks the current one, quiets the ones done and says the step in words. Give every Markdown table a label on each cell from its column heading, so on a phone each row stacks into a small labelled card. For saying yes, turn the document's "**Option 1, ...**" paragraphs into native radios, then `<sg-signature>` for a drawn or typed signature, then a line that says whether it is signed and a button to print or save a signed copy. On paper, keep the radio circles and the signing line, add a line for the date, and print the drawn signature if there is one. Give it three registers: quiet is formal, with straight hairlines, no numerals and no lift; warm draws its rules by hand and letters its numerals; playful sets the numerals in small accent discs and tilts the stamp a little more, and never gets louder than the words.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| one self-contained, sealed HTML document | Folio | `build.mjs` renders the Markdown with Folio's parser and the directive renderers, wraps it with `proposalPage`, and hands the page to `packages/folio/build`, which inlines and subsets everything, writes a strict Content-Security-Policy, seals the file with its SHA-256 and opens it with the network blocked. |
| holds until | front matter | `valid-until: 2026-09-30` becomes `<time datetime>` in the meta, written the way people write dates. |
| the draft status stamped across the picture's corner | composition | `status: internal review, not for sending` becomes `<sg-stamp tone="warning">` with "Internal review" as its headline. The stamp is scaled and tilted from its corner, so it never covers the words on the scene. |
| one section per `##` heading | structure | The rendered Markdown is split at each `<h2 id>`, and each part becomes `<section aria-labelledby>`, so the outline is real and print can keep a heading with what follows. |
| a pen-drawn rule | mask | A tapered ink stroke as an inline SVG, used as a CSS mask over `--sg-rule-strong`, so it takes the palette and the theme. |
| lettered by hand | counter | `counter(section, decimal-leading-zero)` in the hand face, at the right end of the rule. |
| at build time from the booking kernels | pure core | `price-table.core.js` runs the kernels' `quote()` in Node; `::price-table{from=kernels-booking view=bands}` or `arrival=... departure=...` writes the finished `<table>`. `<sg-price-table>` only adds the try-other-dates form. |
| a native range that walks through the steps | native first | `<input type="range">` with `aria-valuetext` set to "Step 2 of 8: ...", and a polite status line that speaks only when the reader moves it. |
| stacks into a small labelled card | container query | `stackTables` adds `data-label` from the column heading to each cell; under 34rem the table's rows become blocks and each label is shown with `attr(data-label)`. |
| "**Option 1, ...**" paragraphs into native radios | directive | `::signature{name=... for=... option}` finds the options after rendering and writes a `<fieldset>` of radios before `<sg-signature>`, whose first input must stay the typed name. `options="A|B"` names them instead. |
| a button to print or save a signed copy | progressive enhancement | The keep block is `hidden` in the markup; `proposal.js` shows it, says "Signed by Maria for option 2" when a signature and option are there, and calls `print()`. |
| keep the radio circles and the signing line | print CSS | Folio's print sheet hides inputs; the proposal brings back the radios as drawn circles and the typed-name input as the line to sign on, and adds "Date signed" under it. |

## Accessibility

- Every live part has a plain reading: the tables are real tables with captions and row headers, the timeline is an ordered list, the signature is a labelled input, the options are a fieldset with a legend.
- The status is words in the stamp, not a picture of words.
- The scene's words sit in its reading panel, over a scrim; the scene is paused by its own button and still under reduced motion.
- Targets are at least 44 px tall: the options, the disclosure, the range and the buttons.

## Credit

The Casa Exemplo proposal, and the letterheads, rate cards and signed estimates that Goan builders and hoteliers still send on paper. Tier: pan-Indian.
