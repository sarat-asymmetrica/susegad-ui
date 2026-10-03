# Folio documents

*Reference file for [`SKILL.md`](../SKILL.md), split out in rung 7 of docs/requests/2026-09-28-open-the-door.md so the top file stays short. Content moved verbatim; nothing here is new.*

## 8. Write a Folio document

A Folio document is one sealed `.html` file. It opens offline from that one file, loads nothing from the network, prints cleanly on A4 or Letter, and its footer says how to check that nobody has changed it. Use Folio for anything a person keeps, prints or signs: a proposal, a stay note, a lesson, a storybook. For a live page in an app, use the components directly.

Write the document in Markdown with directives (or as an HTML page), then build it:

```sh
npm run folio -- build notes/stay-note.md --budget 1.5MB --pdf
npm run folio -- verify notes/stay-note.folio.html
```

`packages/folio/README.md` has every detail. Decisions 0011 (what the builder depends on), 0012 (the Markdown parser) and 0013 (the diagram contract) say why it works the way it does.

### Markdown with directives

```markdown
---
title: Restoring the house at Balcão
lang: en-IN
register: warm
---
# Restoring the house at Balcão

:::scene{name=kolam seed=7}
## Where we start
Markdown inside a scene sits over the drawing.
:::

:::note{tone=warning}[Before you sign]
The rate card is provisional until the owner confirms it.
:::

::price-table{from=kernels-booking arrival=2026-11-16 departure=2026-11-20 guests=2}

:::timeline
- 2026-11-02: Survey the roof
- 2027-02: New roof on
:::

:::diagram{title="How a guest books" steps}
Guest -> Portal: chooses dates
> The guest picks dates on the booking portal.
Portal => Owner: asks to hold
> The portal asks the owner to hold the house.
:::

::signature{name="The owner" role="for the family" required}
```

- **Front matter** sets `title`, `lang`, `register` (`quiet`, `warm`, `playful`), `theme` (`light`, `dark`) and `description`. Any other key is reported as unused, except where a recipe reads it (the proposal does, below).
- **The Markdown** is a small known subset: headings, paragraphs, block quotes, lists, fenced code, pipe tables with alignment, thematic breaks, raw HTML blocks, emphasis, strong, code spans, links, images and autolinks. It has no reference-style links, no indented code blocks, no footnote syntax, and HTML inside a paragraph is escaped.
- **A leaf directive** stands on its own line: `::name{...}`. **A container** opens with `:::name{...}`, holds lines, and closes with `:::` on its own line. Nest a container with more colons.
- **Attributes** are `{key=value key="a value" #id .class flag}`. A `[label]` goes before or after them.
- **Every mistake is reported at once, with its line number, and the build stops.** Fix the list and build again.

| Directive | Form | Takes | Without its module |
|---|---|---|---|
| `scene` | leaf or container | `name` (required), `register`, `seed`, `label`, `progress` (0 to 1), `paused`, and any scene parameter | the container's Markdown still reads |
| `note` | container | `tone`: `info`, `tip`, `warning`, `success`; a `[label]` (default Note, Tip, Take care, Done) | a plain aside |
| `diagram` | container | `title`, `steps`, `register`, `direction` (`right`, `down`); the line grammar below | the source lines, as written |
| `price-table` | leaf | `from=kernels-booking` (required); `view=bands` for the whole rate card, or `arrival` and `departure` (real dates, at most 90 nights) for one stay; `guests` (1 to 20, default 2), `room`, `register` | a sentence saying which dates the prices are for |
| `timeline` | container | `title`, `scrub`; steps in one of two forms (below) | an ordered list |
| `signature` | leaf | `name`, `role`, `for`, `label`, `field`, `required`; `option` to choose one of the document's options first, or `options="A\|B"` to name the choices | a labelled input to type a name |

A directive's element is used only if its module is in the project. Otherwise its plain version stands, and the build says so.

### The diagram's line grammar

```markdown
:::diagram{title="How a direct booking reaches you" steps}
Site = Your site
group The house: Owner, Caretaker
Guest -> Site: chooses dates
> The guest picks dates on your own site.
Guest => Owner: pays
> The guest pays, and the money comes to you.
Owner <-> Caretaker: plan the stay
> You and the caretaker plan the stay together.
Guest -- Caretaker
> The caretaker looks after the guest in the house.
:::
```

| Line | Means |
|---|---|
| `A -> B: label` | an arrow, with an optional label |
| `A => B: label` | a flow: an arrow with things moving along it |
| `A <-> B: label` | both ways |
| `A -- B` | a plain line |
| `> words` | the step for the arrow just above: read out and listed. Write one for every arrow when you use `steps`. |
| `Name = Label` | show a node under a longer label |
| `group Name: A, B` | a named frame round A and B; a node is in one group at most |
| `title:` / `direction:` / `# ...` | the caption, `right` or `down`, a comment |

Names are what you type. Every diagram has a text alternative made from the same source, so what a screen reader hears and what the picture shows cannot drift apart. A line the grammar cannot read is reported with its line number and left out, and the rest still draws. A line that is only part of a connection, or has two arrows, is an error, never a box:

```markdown
:::diagram{title="Two mistakes"}
Guest -> Portal: books
Portal ->
Owner -> Caretaker -> Guest
:::
```

```
line 3: :::diagram: An arrow needs a name at each end, like Guest -> Portal.
line 4: :::diagram: Write one connection per line: A -> B, then B -> C on the next line.
```

`folio build` reports these, because it draws the diagram. Markdown shown in a page without a build checks only that a diagram has arrows, and the element draws what it can read, so build before you trust a diagram.

Keep a diagram to about a dozen boxes; the layout is simple and large graphs cross lines. `steps` adds Previous step and Next step buttons. Flows move in warm and playful, and stay as three still dots in quiet, under reduced motion and in print.

### The timeline, in two forms

Dated, when the dates are real (YYYY-MM-DD, YYYY-MM, or a label like Week 1):

```markdown
:::timeline{title="The roof"}
- 2026-11-02: Survey the roof
- 2026-12: Tiles ordered
- Week 12: New roof on
:::
```

Numbered, when the order is agreed but the dates are not:

```markdown
:::timeline
1. **You choose an option.** Reply on WhatsApp, or sign below.
2. **The shoot.** We write the brief and the shot list together.
3. **Your site goes live.** The story, the photographs and a sign-up.
:::
```

Use one form for every step, and at least two steps. Built, the plan has a "Walk through the plan" scrubber when JavaScript runs, and reads as a numbered list without it.

### Footnotes

Folio Markdown has no footnote syntax. Put a superscript number where the note is called for, and a paragraph that begins with the same number at the end of the section:

```markdown
MakeMyTrip and Goibibo can take more.¹ Each booking taken on your own site costs you only the payment fee.

¹ In a 2019 complaint to the Competition Commission of India, the hotel federation said standalone hotels were paying them 22 to 40%.
```

The proposal recipe sets such a paragraph small, under a short rule. Elsewhere it reads as a plain paragraph.

### Build, seal and verify

`folio build <page.html or doc.md>` reads the page in Chromium, bundles its modules with esbuild into one script, inlines the styles, keeps only the characters each font actually draws (through HarfBuzz, so Devanagari and Kannada still shape), turns images into data URIs (WebP, or AVIF when `sharp` is installed), adds the print sheet and a Content-Security-Policy that allows only what is inlined, seals the file, then opens it with every network request refused and reports what it found.

| Option | What it does |
|---|---|
| `--out <file>` | where to write it (default: `<page>.folio.html`) |
| `--budget <size>` | fail when the file is larger, for example `1.5MB` (default `3MB`). Every build prints a table of the parts, largest first. |
| `--page A4\|Letter\|auto` | the printed page (default A4; `auto` follows the reader's paper) |
| `--pdf [file]` | also print it to PDF through Chromium |
| `--no-check` | skip opening it with the network blocked |

- **Everything is inside the file.** A remote script, stylesheet or image fails the build with a plain message. A link (`<a href="https://...">`) is fine, because it is not loaded.
- **The seal** is the SHA-256 of the whole file, written into the file itself. `folio verify <file>` exits 0 when it matches and 1 when any byte has changed. In the document, the footer's file chooser checks it on the reader's device with Web Crypto, and sends nothing. On paper, the footer says to run `folio verify`.
- **The budget is real.** Aim well under it: the Wave 3 gate holds a proposal to 1.5 MB.
- **A module with a computed `import()` cannot be bundled.** `<sg-empty>` loads its scene that way, so import the scene directly in the page. The builder notes it.

Before you say a document is done: `folio verify` passes and fails when one byte changes; the network log is empty; it reads at 390 px; it prints to A4 and Letter; and every fact in it has a source (see the proposal recipe).

### Print

The print sheet gives a clean page whatever the screen theme: light colours, no buttons or inputs, scenes kept whole and at most 130 mm wide, link addresses after the links, headings kept with what follows, table rows kept whole, the title as a running header and page numbers. Every `<sg-scene>` draws its finished still before printing. The PDF is printed at twice screen density, so scenes stay sharp.

### The proposal recipe

Use it for a priced offer that someone will read, sign and keep: a proposal, a quote, a scope of work. For writing that has no prices or signature, use plain Folio Markdown. For taking a booking, use the booking recipe.

```sh
node packages/recipes/proposal/build.mjs path/to/proposal.md --pdf
node packages/folio/bin/folio.mjs verify path/to/proposal.folio.html
```

```markdown
---
title: A booking site for the house at Aldona
for: The owners, Casa Aldona
from: The studio
date: November 2026
valid-until: 2026-12-15
status: internal review, not for sending
lang: en-IN
register: warm
---

:::scene{name=paus}
# A booking site for the house at Aldona
For the owners of Casa Aldona, from the studio. November 2026.
:::

## Your rate card

::price-table{from=kernels-booking view=bands}

## What it costs

| What you get | Price |
|---|---|
| **Website.** Your own domain and an enquiry form. | ₹40,000 |

**Option 1, the website.** The site and the enquiry form. ₹40,000.

**Option 2, the website with the booking engine.** Everything in Option 1, and bookings. ₹95,000.

## Saying yes

::signature{name="The owners" for="Casa Aldona" option}
```

- **The cover** is a `:::scene` before the first `##`, with its heading over it. `for`, `from`, `date` and `valid-until` in the front matter are set under the cover. `status` stamps the draft (the part before the first comma, large); take it out to send.
- **One section per `##`.** Scope, costs and who does what are plain tables, and on a phone each row stacks into a card.
- **Room prices come from the booking kernels**, never typed by hand: `view=bands` for the rate card, `arrival` and `departure` for a stay, night by night, with GST on its own line. Readers can try other dates.
- **Options** are paragraphs that open with bold `**Option 1, ...**`. `::signature{... option}` finds them and asks the reader to choose one before signing; `required` makes the choice and the name required.
- **Registers:** quiet is formal (straight hairlines, no section numbers); warm (the default) draws its rules with a pen and letters the section numbers by hand; playful sets the numbers in accent discs.
- **Every fact has a source.** A proposal names real people, places, fees and laws. Keep a `SOURCES.md` beside it: each claim, where it came from (a file, or a public page with the date you read it), and a status: sourced, owner to confirm, or unsourced. Soften or remove the unsourced ones before anyone reads the proposal. `packages/recipes/proposal/examples/sample/` is the worked example.

`packages/recipes/proposal/proposal.docs.md` has the rest, including how it looks on paper and without JavaScript.
