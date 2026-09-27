# Proposal

Write a proposal in Markdown and build it into one sealed `.folio.html`: it opens offline from a single file, works on a phone, prints cleanly on A4 or Letter, works out its own prices from the booking kernels, and can be signed on screen or on paper.

```sh
node packages/recipes/proposal/build.mjs path/to/proposal.md --pdf
node packages/folio/bin/folio.mjs verify path/to/<name>.folio.html
```

`--pdf` also prints `<name>.A4.pdf` and `<name>.Letter.pdf`. `--register quiet|warm|playful` overrides the front matter. `--page-only` writes the unsealed page beside the source, to look at it served (`npm run serve`). The sample proposal (`examples/sample/proposal.md`) is what the tests and `npm run check` build against.

## Writing one

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
palette: casa
---

:::scene{name=paus}
# A booking site for the house at Aldona
For the owners of Casa Aldona, from the studio. November 2026.
:::

A line or two under the cover, before the first section.

## Your rate card

::price-table{from=kernels-booking view=bands}
::price-table{from=kernels-booking arrival=2026-11-16 departure=2026-11-20}

## What it costs

| What you get | Price |
|---|---|
| **Website.** Your own domain and an enquiry form. | ₹40,000 |

**Option 1, the website.** The site and the enquiry form. ₹40,000.

**Option 2, the website with the booking engine.** Everything in Option 1, and bookings. ₹95,000.

## The plan

:::timeline
1. **You choose an option.** Sign below, or reply with a message.
2. **The site goes live.** Rooms, rates and enquiries.
:::

## Saying yes

::signature{name="The owners" for="Casa Aldona" option}
```

| Part | How |
|---|---|
| Cover | A `:::scene` before the first `##` becomes the cover, with its heading over it. Without one, the title is set as a plain heading. |
| Meta | `for`, `from`, `date` and `valid-until` (YYYY-MM-DD) in the front matter, set under the cover. |
| Status | `status:` while it is a draft. The part before the first comma is stamped large. Take it out to send. |
| Sections | One per `##`. Keep `###` for parts of a section. |
| Rate card | `::price-table{from=kernels-booking view=bands}`: every season, weekday and weekend, shortest stay. |
| A stay | `::price-table{from=kernels-booking arrival=... departure=... guests=2}`: night by night, GST on its own line, the total, the deposit. Readers can try other dates. |
| Plan | `:::timeline` with `1. **Title.** What happens` lines, or `- when: what`. |
| Scope, costs, who does what | Plain Markdown tables. On a phone each row stacks into a card labelled by the column headings. A first column with an empty heading names each row. |
| Notes | `:::note` for anything the reader must not miss. |
| Options | Paragraphs that open with bold `**Option 1, ...**`. |
| Signing | `::signature{name=... for=... option}`; `required` makes the option and the signature required; `options="A\|B"` names the choices yourself. |

The words the page adds (For, From, Holds until, the keep button) are in `proposal.core.js`, and the tables' words in `price-table.core.js`.

## Registers

- **Quiet:** formal. Straight hairlines, no section numbers, no lift, the stamp square, the scene a still.
- **Warm** (the default): rules drawn with a pen, section numbers lettered by hand, notes on raised paper.
- **Playful:** the numbers in small accent discs, the rules in the accent, the stamp tilted a little more.

## On paper

Folio's print sheet sets the page (the reader's own paper, A4 or Letter), the running title and page numbers, and the seal. The proposal keeps each heading with what follows, keeps table rows, notes and the signing block whole, prints the options as circles to tick, the typed-name input as a line to sign on, a "Date signed" line, and a drawn signature if there is one.

## Without JavaScript

Everything reads: the cover's words, the tables (written at build time), the plan as a numbered list, the options as radios and a line to type a name. What needs a script (trying other dates, walking the plan, drawing a signature, the keep button) is simply not there.
