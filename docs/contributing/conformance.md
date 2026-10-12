# Conformance notes

Every component's docs file says, in a table, which WCAG 2.2 level A and AA criteria it meets, how that was checked, and what the page author still owns. A compliance team auditing to GIGW starts at `docs/reference/accessibility.md` (the summary, written from the tables) and follows a link to one component. One check keeps the tables honest: `node tools/conformance.mjs`.

## The format

Under each component's `## Accessibility` section, after its prose:

```markdown
### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.4.11 Non-text contrast | Meets | `packages/components/toggle/toggle.test.js`: "1.4.11: <palette> <theme>" asserts 3:1 for every palette, light and dark. |
| 2.5.8 Target size (minimum) | Meets with author's part | Manual test, 2026-10-06: ... |
| 3.3.1 Error identification | Not applicable | A switch has no invalid state. |

**The page author owns:**

- The label text, in the language of the page.
- `lang` on a label in another language (3.1.2).
```

- **Criterion** is the number and the official name, as in the table above. The names are checked.
- **Status** is one of four:
  - `Meets`: the component meets it alone, and evidence in the repository shows it.
  - `Meets with author's part`: it is met only when the page author does a named thing. The row says what, and the author-owns list repeats it.
  - `Not applicable`: the criterion does not apply to this kind of component. The row says why.
  - `Does not meet`: a known gap. The row says what fails and how it was measured. The summary page lists every one under "Known gaps" until it is fixed. A table that cannot say this would claim more than the code does.
- **How it was checked** names the evidence. Any file in backticks must exist (it is looked up from the repository root, then beside the docs file). A `Meets` or `Meets with author's part` row needs at least one such file, or must start with `Manual test:` and say what was done, on what, and when. "It is fine" is not evidence. Prefer a check that can fail: a `*.check.mjs` assertion, a unit test of a contrast, `tools/axe.mjs` with its command and result.
- **The page author owns** is a bulleted list, at least one bullet. Alt text, headings, the language of parts, the colours the page sets itself, sticky headers that could cover focus.

Write a pipe inside a cell as `\|`. Copy is plain, sentence case, no em dashes (`node tools/copy-lint.mjs` reads these files too).

## Which criteria a component must answer

Every component has a row for each criterion in the **base** set, and for each criterion added by its **traits**. A row may say `Not applicable` with the reason; a missing row is a failure. The traits of each component are in `KINDS` in `tools/conformance.core.js`. A component not listed there fails until someone decides its traits.

| Trait | A component has it when it | Adds |
|---|---|---|
| (base, every component) | exists | 1.1.1, 1.3.1, 1.4.1, 1.4.3, 1.4.4, 1.4.10, 1.4.11, 1.4.12, 4.1.2 |
| `interactive` | takes input: a control, or a widget with several | 2.1.1, 2.1.2, 2.4.3, 2.4.7, 2.4.11, 2.5.3, 2.5.8 |
| `field` | collects a value that is submitted or read back | 1.3.5, 3.2.2, 3.3.1, 3.3.2 |
| `overlay` | opens above the page: dialog, drawer, popover, tooltip, menu, toast | 1.4.13, 2.1.2, 2.4.3, 2.4.11 |
| `live` | says something changed without taking focus | 4.1.3 |
| `motion` | moves or runs on its own, beyond answering a press | 2.2.2, 2.3.1 |
| `drag` | can be dragged to or on | 2.5.7 |
| `link` | carries links the reader follows | 2.4.4 |
| `media` | plays audio | 1.2.1 |

Reading the table: a `tile-band` (no traits) answers 9 criteria; a `toggle` (interactive, field, motion) answers 22; a `tooltip` (overlay) answers 13; a `file-drop` (interactive, field, drag, live) answers 22.

2.3.3 Animation from interactions is level AAA. It is accepted in a table, as informative, and is never required.

Criteria that belong to the page and not to a component are not in the tables: 2.4.1 bypass blocks, 2.4.2 page titled, 2.4.5 multiple ways, 2.4.6 headings and labels, 3.1.1 language of page, 3.2.3 and 3.2.4 consistent navigation and identification, 3.2.6 consistent help, 1.2.x time-based media. The summary page lists them under "Always the page author's". A component that does something to one of them (a site navigation, a media player) may add its own row.

## The check

```
node tools/conformance.mjs                 judge every component; exempt ones may still be pending
node tools/conformance.mjs --strict        ignore the exempt list: every component must pass
node tools/conformance.mjs --report        which components lack a valid table (always exits 0)
node tools/conformance.mjs --summary       write docs/reference/accessibility.md from the tables
node tools/conformance.mjs --summary --check   fail if that page is out of date
node tools/conformance.mjs --file X.docs.md --traits interactive,field   judge one file
```

It fails when a table is missing, misplaced or malformed; a criterion is not a real WCAG 2.2 A or AA criterion, or its name is wrong, or it appears twice; a status is not one of the four; "How it was checked" is empty, names a file that does not exist, or makes a claim with no file and no `Manual test:`; the author-owns list is missing or empty; a `Manual test` with no file has no date (YYYY-MM-DD) or no measured value or named observation besides it ("looked fine" fails); or a required criterion has no row. Two more guards: `npm test` fails when a component's `interactive` trait disagrees with what `tools/touch.check.mjs` finds, and `--file` refuses `--traits` that differ from `KINDS` for a real component.

The tests are in `tools/conformance.test.mjs`, with a fixture for each failure under `tools/fixtures/conformance/`: each goes red for its named reason and no other, and the `good` and `known-gap` fixtures go green. They run in `npm test`.

### The exempt list

While tables were being written, the components still without one were named in `tools/conformance.exempt.json`, one name per entry. A component on the list could fail the check without failing the run; one that passed while still listed was reported ("ready to come off"). Every table is written now, and the list is `[]` (7 October 2026): every component must have the table, and `npm test` fails on one that does not.

## GIGW 3.0

GIGW 3.0 (the Guidelines for Indian Government Websites and Apps, third edition, from NIC under MeitY) asks for accessibility to WCAG 2.1 level AA. WCAG 2.2 level AA is a superset for our purposes: it adds six criteria at levels A and AA (2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8) and removes 4.1.1, which 2.1 conformance claims often still list. A table written to 2.2 AA therefore covers every 2.1 AA criterion except 4.1.1, which modern browsers make moot.

What we could verify, and what not:

- The WCAG 2.1 AA requirement and the mention of IS 17802 (the Indian standard for web accessibility, itself based on WCAG) come from secondary sources: the GIGW overview pages at skynettechnologies.com, accordcompliance.org and digit.in (a search result summary, not the manual). We could not read the primary GIGW Manual 3.0 text (guidelines.india.gov.in) while writing this, so the requirement is not confirmed against the manual.
- We have not mapped GIGW's own checkpoints (it counts 88 across quality, accessibility, cybersecurity and lifecycle, per the same secondary sources) to WCAG criteria. The accessibility checkpoints reference WCAG; the mapping, and everything GIGW asks beyond WCAG (content governance, security, lifecycle), is for the compliance team and the page author. This library says nothing about those.
- GIGW certification (STQC's Certificate of Quality for Websites) is granted to a site, not a component. The tables are input to that audit, not a claim of certification.

If you hold the manual, check the accessibility checkpoints against the criteria in the tables and tell us where this note is wrong.

## Adding a component

1. Decide its traits and add it to `KINDS` in `tools/conformance.core.js`.
2. Write the table from what its checks and tests do. If a criterion has no evidence yet, say `Does not meet` or add the check; do not write `Meets`.
3. `node tools/conformance.mjs --file packages/components/<name>/<name>.docs.md` until it passes, then take the name off `tools/conformance.exempt.json` and run `node tools/conformance.mjs --summary`.
