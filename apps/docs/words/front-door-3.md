# Words for the front door, third edition

Kathakar, 8 October 2026, for `batch/door`. Every string a visitor meets in the front-door rebuild, keyed so the builder can find it. Request: front-door-3 (items 1 to 14).

How to read this file:

- **Key** is a suggested name for the string. Use it in code if that helps; it is only here so we can talk about one string at a time.
- **Where** says where the string shows.
- **Budget** is the most characters that should fit at 390 px, where space is tight. No budget means it can wrap.
- `{curly}` marks a value the page fills in. Never type it by hand.
- Facts are checked against the source named beside them. Anything I could not settle is under "For the builder and the Sutradhar" at the end.

Register for the site's own chrome: warm, plain. Sentence case everywhere. No em dashes.

---

## 1. The View control (header)

One button in the header opens an `sg-popover` with two groups. Palette is not shown to visitors.

| Key | Where | Text | Budget |
|---|---|---|---|
| `view.button` | The button's visible label | View | 6 |
| `view.button.name` | The button's accessible name (starts with its visible word, for WCAG 2.5.3) | View: {register} register, {theme} theme | |
| `view.panel.title` | Heading inside the popover | How this site looks | 24 |
| `view.register.legend` | First group's legend | Register | 10 |
| `view.register.intro` | One line under the legend | The same pieces, in three moods. | 36 |
| `view.register.quiet` | Option label | Quiet | 8 |
| `view.register.quiet.hint` | Its hint | Plain lines and little movement. | 36 |
| `view.register.warm` | Option label | Warm | 8 |
| `view.register.warm.hint` | Its hint | Drawn by hand, moving gently. | 36 |
| `view.register.playful` | Option label | Playful | 8 |
| `view.register.playful.hint` | Its hint | Bright colours, and things answer a tap. | 40 |
| `view.theme.legend` | Second group's legend | Theme | 10 |
| `view.theme.light` | Option label | Light | 8 |
| `view.theme.dark` | Option label | Dark | 8 |
| `view.theme.system` | Option label (the old "Auto") | Match device | 14 |
| `view.close` | The popover's close button (the shared `close` string in `packages/core/strings.table.js`) | Close | 8 |

Announced to screen readers when a choice changes (the shell's `#announce` region):

| Key | Text |
|---|---|
| `view.announce.register` | Register set to {register} |
| `view.announce.theme` | Theme set to {theme} |
| `view.announce.theme.system` | Theme now matches this device |

`view.announce.register` is the shell's current wording, kept as it is.

Fallbacks:

| Key | When | Text |
|---|---|---|
| `view.nojs` | JavaScript is off. Shown in place of the button, or inside the panel if it opens without script. | The view settings need JavaScript. Every page reads well without them. |
| `view.storage-off` | Saving to `localStorage` throws. Shown once, inside the panel, under the groups. | Your choice holds on this page. This browser is not keeping settings, so the next page opens in the usual view. |

---

## 2. The hero

The caption stays as it is. Read aloud as one line now the per-word spans are gone, it sounds right:

> Susegad: the unhurried contentment of a Goan afternoon.

| Key | Where | Text | Budget |
|---|---|---|---|
| `hero.cta.start` | Solid button, links to `/start` | Start building | 18 |
| `hero.cta.scenes` | Second button, links to `/scenes` | Browse the scenes | 20 |
| `hero.install.lead` | Small line above the command (optional; leave it out if the command alone reads well) | Or make a whole site from the command line: | 46 |
| `hero.install.code` | The command, in a code block | `npx @susegad/cli create my-site` | |
| `hero.install.copy` | Copy button, visible label | Copy | 8 |
| `hero.install.copy.name` | Copy button, accessible name | Copy the command | |
| `hero.install.copied` | The button's label for 1.6 s after a copy | Copied | 8 |
| `hero.install.copied.announce` | Announced to screen readers | Copied the command | |
| `hero.install.npm-note` | Under the command, **only while `create` is not yet on npm** (see the note at the end) | `create` arrives on npm with version 0.2.0. Until then, Start here shows how to run it from a clone. | |

---

## 3. What is inside

Section heading and intro stay:

> **What is inside**
> Every piece has a page of its own, with its prompt and its install line. The indexes show a still of each; the drawing runs when you open it.

Four cards, each led by a picture. The title is the link; the count after it stays generated (`door-count`). Lines fit the current 90-character budget (`sentences(k.blurb, 90)`).

| Key | Picture | Title | Line | Budget |
|---|---|---|---|---|
| `inside.scenes` | The kolam | Scenes | Drawings that do a job, like this kolam: one unbroken line round every dot. | 90 |
| `inside.components` | A dialog over the Carepa backdrop | Components | Keyboard and screen reader support underneath, a skin for each register on top. | 90 |
| `inside.recipes` | The booking ribbon | Recipes | Pieces put together for real work, like a booking under its season ribbon. | 90 |
| `inside.foundations` | The bloom | Foundations | What every piece stands on. The engine lays out this marigold, floret by floret. | 90 |
| `inside.foundations.toy` | A small link under the bloom card's line, to the templates page's `#bloom` | Grow one from a name | 24 |

Pictures are decoration beside a link that names the door, so each stays `aria-hidden` as today. If the builder gives them alt text after all:

| Key | Alt text |
|---|---|
| `inside.scenes.alt` | A kolam drawn in rice flour, one closed line looping round a grid of dots |
| `inside.components.alt` | A dialog open over a Goan window glazed with oyster shell |
| `inside.recipes.alt` | Two months of a booking calendar under a ribbon of seasons |
| `inside.foundations.alt` | A marigold seen face-on, its florets spiralling out from the centre |

---

## 4. Newest

Built from data every time. Nobody types an entry.

| Key | Where | Text | Budget |
|---|---|---|---|
| `newest.title` | Section heading | Newest | |
| `newest.item.title` | The item's link | {title} | |
| `newest.item.meta` | Small line under the title | {Kind}, added {d Month yyyy} | 40 |
| `newest.item.line` | One line from the registry description, first sentence, trimmed to about 120 characters | {description} | 120 |
| `newest.empty` | If no item has a date (the section can also just hide) | The newest pieces will show here as they join the library. | |

`{Kind}` is the singular from `KINDS[type].one`, capitalised: Scene, Component, Recipe, Template, Foundation. Dates read as "7 October 2026": day, month in full, year, no comma, no "th".

Examples of what the pattern makes (illustrative; the real lines come from the registry):

> **Bloom**
> Component, added 7 October 2026
> A flower head laid out by Vogel's model, drawn face-on as SVG: a marigold (zendu) first.

> **Event page**
> Template, added 7 October 2026
> A starter site for a one-day event in Panjim: a header with a language switcher, a hero scene behind its poster, the agenda that knows what is on stage now, …

---

## 5. Item pages

| Key | Where | Text | Budget |
|---|---|---|---|
| `item.toc.title` | Heading of the side list | On this page | 16 |
| `item.toc.usage` | Link | Usage | |
| `item.toc.registers` | Link | Registers | |
| `item.toc.accessibility` | Link | Accessibility | |
| `item.toc.lineage` | Link | Lineage | |
| `item.toc.prompt` | Link, if the prompt fold is on the page | The prompt | |
| `item.demo` | The leading button (as today) | Open the live demo | 22 |
| `item.demo.template` | The same, for a template (as today) | See it working | 18 |
| `item.demo.inline` | If the piece opens in the page: a button that starts it | Try it here | 14 |
| `item.demo.inline.nojs` | In place of the in-page demo, without JavaScript | The live demo needs JavaScript. The picture shows it as it looks. | |

Only list a section the page has. A piece with no lineage section gets no Lineage link.

The conformance table on a component page:

| Key | Where | Text |
|---|---|---|
| `item.a11y.title` | Section heading | Accessibility |
| `item.a11y.intro` | One line before the table | How this component meets WCAG 2.2 level A and AA, criterion by criterion, how each was checked, and what your page still owns. |
| `item.a11y.more` | Link after the table, to the Trust page | All 53 tables, and how the library tests | 

`item.a11y.more` should take its number from the data (`{tables} tables`), not the text here.

---

## 6. The Trust door

### The label

| Key | Where | Text | Budget |
|---|---|---|---|
| `trust.nav` | Top navigation | Accessibility | 14 |
| `trust.foot` | Footer link | Accessibility and browsers | |

I suggest "Accessibility" in the nav rather than "Trust". It is the word a compliance reader looks for, and "Trust" asks to be believed where this page shows its work instead. The page itself covers browsers as well, and its title says so.

### The page (`/trust`, or `/accessibility`)

| Key | Where | Text |
|---|---|---|
| `trust.kicker` | Kicker | for an audit, or a careful look |
| `trust.title` | h1 | Accessibility and browsers |
| `trust.lede` | Lede | What Susegad UI checks, how it checks it, and where the checking stops. Each part links to the tables and checks behind it. |

**Section: the conformance tables**

| Key | Text |
|---|---|
| `trust.tables.title` | Every component, criterion by criterion |
| `trust.tables.body` | Each of the {tables} components has a conformance table against WCAG 2.2 at levels A and AA. For every criterion it says whether the component meets it, how that was checked (a check in the repository, an axe run, a contrast test, or a manual test written down), and what the page author still owns. |
| `trust.tables.statuses` | A table uses four words: Meets, Meets with author's part, Not applicable, and Does not meet. |
| `trust.tables.gaps` | Known gaps today: {gaps}. Each is listed with what fails. |
| `trust.tables.gaps.none` | Known gaps today: none. |
| `trust.tables.link` | Read the accessibility summary |

`{tables}` is 53 today (I counted the `### Conformance (WCAG 2.2 AA)` headings in `packages/**/*.docs.md`: 53, the same as the summary). `{gaps}` reads "1, the tooltip without JavaScript (1.4.13)" today, from the summary's "Known gaps" table. Both must come from the summary at build time.

**Section: what this is and is not**

| Key | Text |
|---|---|
| `trust.claim.title` | What a table can and cannot say |
| `trust.claim.body` | Conformance belongs to a whole page, not to a component. The tables show what each component does by itself, and list beside it the parts your page owns: the label text, the headings, the page's language, the alt text for your images. They are a statement of how the library is tested, not a certificate. |

**Section: GIGW**

| Key | Text |
|---|---|
| `trust.gigw.title` | If you are auditing to GIGW 3.0 |
| `trust.gigw.body` | GIGW 3.0 asks for WCAG 2.1 level AA. A table written to WCAG 2.2 level AA covers 2.1 level AA, so you can start from these tables and follow each link to the component's own. They can help an audit. They do not replace one. |

**Section: browsers**

| Key | Text |
|---|---|
| `trust.browsers.title` | Which browsers, and how we know |
| `trust.browsers.body` | The same checks run in three engines: Chromium, WebKit (the engine inside Safari) and Firefox. Chromium must pass before a change goes in; WebKit and Firefox run on every change and their results are published. Phones are emulated at 390 px with touch. We have not run the checks on a real phone, and the matrix says so wherever that matters. |
| `trust.browsers.link` | Read the browser support matrix |

**Section: how the library tests** (short; the summary has the long version)

| Key | Text |
|---|---|
| `trust.how.title` | How the library tests |
| `trust.how.body` | axe-core on every component's demo, in all three registers, light and dark, at desktop width and at 390 px, and with JavaScript off. A check beside each component for its keyboard paths, focus, names and roles. Contrast tests for every text colour on every surface. Screen reader behaviour is read from the browser's accessibility tree, not tested with a live screen reader. |

**Section: the handoff**

| Key | Text |
|---|---|
| `trust.handoff` | Building a site with it? The handoff has every command and file in one place. |
| `trust.handoff.link` | Read the handoff |

---

## 7. Start here

### The top of the page

| Key | Where | Text |
|---|---|---|
| `start.kicker` | Kicker | three ways in |
| `start.title` | h1 | Start here |
| `start.lede` | Lede | Pick the path that sounds like you. Each one ends with a page that works. |

### Three cards

Card titles are in italics in the request; on the page they are plain headings, in the first person, so a reader can say "that's me".

**Card 1**

| Key | Text | Budget |
|---|---|---|
| `start.site.title` | I'm building a site | 26 |
| `start.site.body` | One command makes a whole site from a template: an event page in English and in Konkani, with the pieces it uses copied in beside it. Change every word; the files are yours. | |
| `start.site.code` | `npx @susegad/cli create my-site` | |
| `start.site.npm-note` | Same rule as `hero.install.npm-note`. While `create` is not on npm: `create` arrives on npm with version 0.2.0. Until then, run it from a clone, as the handoff shows. | |
| `start.site.link` | Read the handoff | |

**Card 2**

| Key | Text | Budget |
|---|---|---|
| `start.add.title` | I'm adding pieces to a project | 34 |
| `start.add.body` | Copy just the pieces you want into your own code with `add`, and everything they stand on comes too. Already using shadcn? The same pieces are served for it at `/r/`. | |
| `start.add.code` | `npx @susegad/cli add scene-paus badge` | |
| `start.add.code.shadcn` | `npx shadcn@latest add https://susegad.asymmetrica.ai/r/button.json` | |
| `start.add.link` | Follow a first page, step by step | |

`start.add.link` points down the page to the homestay walkthrough, which stays below for this card. Its heading:

| Key | Text |
|---|---|
| `start.walk.title` | A first page, step by step |
| `start.walk.lede` | A homestay in Aldona: one page with a drawing, a badge and a footer. Do it by hand, with the CLI, or with an agent; each way arrives at the same page. |

**Card 3**

| Key | Text | Budget |
|---|---|---|
| `start.agent.title` | I'm working with an AI agent | 32 |
| `start.agent.body` | Give your agent the library's `SKILL.md` and say what you want, the way you would say it to a person. The skill carries the registers, the install lines and the scene contract. The MCP server goes further: your agent can search the shelf, read a piece's prompt and add pieces itself. | |
| `start.agent.code` | `npx @susegad/cli skill --harness claude --global` | |
| `start.agent.mcp.lead` | Small line before the second command | To add the MCP server to Claude Code: | |
| `start.agent.code.mcp` | `claude mcp add --transport stdio susegad -- npx -y @susegad/mcp` | |
| `start.agent.mcp.note` | Small line after it | It needs Node 22 or later. Run it from the project it should add pieces to. | |
| `start.agent.link.skill` | Read SKILL.md | |
| `start.agent.link.mcp` | Set up the MCP server | |

### Fix on the current page (not new words, but they are wrong today)

- Way 2's command reads `npx @susegad/cli add scene-paus sg-badge --dir src/lib`. The registry name is `badge`, and the CLI resolves names exactly (`packages/cli/src/commands.js`, `knownItem`), so `sg-badge` fails with "I do not have anything called sg-badge". It should read `npx @susegad/cli add scene-paus badge --dir src/lib`.
- Way 3's last sentence says "An MCP server that speaks the registry directly is on its way." It exists now (`packages/mcp/`). Replace it with: "The MCP server lets your agent search the shelf and add pieces itself; its page says how to set it up."

---

## 8. HANDOFF and BROWSERS on the site

Each page renders its Markdown below a short head of our own. The Markdown's first paragraph already introduces the page well, so the lede is short and the page's own text follows.

| Key | Where | Text |
|---|---|---|
| `handoff.kicker` | Kicker | for the person who builds the site |
| `handoff.title` | h1 | Handoff |
| `handoff.lede` | Lede | Every command you can paste and every file you can open, from an empty folder to a site you can ship. |
| `handoff.description` | Meta description | How to build a site with Susegad UI: the commands, the files you get, the checks, and what to do when something is wrong. |
| `browsers.kicker` | Kicker | for the engineer and the compliance colleague |
| `browsers.title` | h1 | Browsers |
| `browsers.lede` | Lede | Which browsers Susegad UI works in, what each one gets, and how we check. Where we have not checked something, the page says so. |
| `browsers.description` | Meta description | The browser support matrix for Susegad UI: the engines and versions we check, what degrades and how, and what we have not checked. |

---

## 9. The language switcher

The switcher is `<sg-lang>`. Its words already exist; I am reusing them, not writing new Konkani.

| Key | Language | Text | Source |
|---|---|---|---|
| `lang.label` | English | Language | `packages/core/strings.table.js`, `language` |
| `lang.label` | Konkani, Devanagari | भास | same file, draft |
| `lang.label` | Konkani, Romi | Bhas | same file, draft |
| `lang.en` | (link text) | English | `packages/components/lang/lang.docs.md` |
| `lang.gom-Deva` | (link text) | कोंकणी | same |
| `lang.gom-Latn` | (link text) | Konknni | same |
| `lang.last` | screen reader only, all three | Last chosen / फाटल्या खेपेक वेंचिल्लें / Fatlya khepek venchillem | `strings.table.js`, `lastChosen`, draft |

The nav's `aria-label` is `lang.label` in the page's own language (the lang docs ask for that).

### The draft note

There is no Konkani version of this note anywhere in the library. The lang demo pages show it in English with `lang="en-IN"` on their Konkani pages, and decision 0025 asks only that a page offering Konkani say so. I have followed that and written no new Konkani.

| Key | Where | Text | Budget |
|---|---|---|---|
| `lang.draft` | On every page that shows Konkani, near the top, with `lang="en-IN"` | The Konkani on this page is a first draft. A native reader has not checked it yet. | |
| `lang.draft.short` | Where the long note will not fit (beside the switcher, a tag on a card) | Draft, awaiting a native reader | 32 |

---

## 10. The templates page

| Key | Where | Text |
|---|---|---|
| `templates.kicker` | Kicker | {count} template, or {count} templates (generated, as today) |
| `templates.title` | h1 | Templates |
| `templates.lede` | Lede (the current blurb, kept) | Whole starter sites, not pieces: one command makes the folder, with the pages written and the pieces they use copied beside them. |

### The event template, live

| Key | Where | Text | Budget |
|---|---|---|---|
| `templates.event.title` | Heading | The event page, running | |
| `templates.event.body` | Line under it | This is the site `create` makes, as it comes out of the box. It starts in the quiet register, the way a conference site might. Its header switches between English and Konkani. | |
| `templates.event.madeup` | Small note under the frame | The event is made up, and so are its speakers. | |
| `templates.event.registers` | Label for a quiet / warm / playful switch on the frame, if there is one | See it as | 10 |
| `templates.event.frame` | The `<iframe>`'s `title` | The event template, live | |
| `templates.event.open` | Link to open it full size | Open it in its own tab | 24 |
| `templates.event.code` | Under the frame | `npx @susegad/cli create my-site` (with `hero.install.npm-note` beside it while `create` is not on npm) | |

The Konkani pages of the event template carry `lang.draft` too.

### The bloom toy

| Key | Where | Text | Budget |
|---|---|---|---|
| `bloom.title` | Heading (`id="bloom"`, the home card links here) | A marigold for a name | |
| `bloom.body` | Line under it | Type a name and a marigold grows from it. The same name always grows the same flower. Save the card to keep it. | |
| `bloom.field` | The field's label | A name | 12 |
| `bloom.field.default` | Drawn on the card while the field is empty (the greeting card recipe's own default) | Your name | |
| `bloom.save` | Button | Save the card | 16 |
| `bloom.saved` | Status line, `role="status"`, after a save | Saved as {filename}. Look in your downloads. | |
| `bloom.saved.other-type` | If the browser made a different format (the recipe reports the real one) | Saved as {filename}. This browser made a {kind} instead. | |
| `bloom.private` | Small note under the field | The name stays in your browser. Nothing is sent anywhere. | |
| `bloom.card.name` | The canvas's accessible name (the recipe's wording) | Greeting card for {name} | |

Fallbacks:

| Key | When | Text |
|---|---|---|
| `bloom.nojs` | JavaScript is off | With JavaScript on, you can grow a marigold from any name here. |
| `bloom.save.failed` | The export throws | The card could not be saved. Try once more; if it still will not save, another browser may manage it. |

---

## 11. Shared fallbacks

| Key | When | Text | Budget |
|---|---|---|---|
| `copy.failed` | The clipboard refuses; the text is selected instead. Button label | Press Ctrl+C | 14 |
| `copy.failed.announce` | Announced, and shown as a title on the button | Selected. Press Ctrl+C, or Cmd+C on a Mac, to copy it. | |
| `copy.copied` | Every copy button, after a copy | Copied | 8 |
| `nojs.drawing` | A scene or poster that cannot start without JavaScript (the poster stays) | This drawing moves with JavaScript on. The still shows how it looks. | |

`copy.failed` replaces today's button text, "Selected. Press Ctrl+C or Cmd+C", which is about 31 characters and pushes the button wide at 390 px.

---

## For the builder and the Sutradhar

Things the request asks the words to say that the site cannot back yet, or that I could not settle from the source:

1. **`create` is not on npm yet.** `docs/HANDOFF.md` says npm has `@susegad/cli` 0.1.0, which has `list`, `info`, `add`, `diff`, `skill` and `check`, and that `create` is newer; `packages/cli/package.json` still reads 0.1.0. So `npx @susegad/cli create my-site` in the hero and on Start here fails today for anyone who pastes it. Either publish 0.2.0 before this deploys, or show `hero.install.npm-note` beside the command until it is published. The goal names v0.2.0 but I found no publish date.
2. **The status words.** The request lists "Supports", "Partially supports", "Does not meet", "Not applicable". Those are VPAT words. The tables say **Meets**, **Meets with author's part**, **Not applicable**, **Does not meet** (`docs/reference/accessibility.md`, "What the statuses mean"). The Trust page uses the tables' own words.
3. **53 is right today.** I counted 53 `### Conformance (WCAG 2.2 AA)` tables in `packages/**/*.docs.md`, and the summary says "53 of 53". There are 54 folders under `packages/components/`, so the next component adds a table; read the number from the summary at build time.
4. **One known gap.** The tooltip does not meet 1.4.13 without JavaScript. The Trust page should name it, from the summary's "Known gaps" table, not say "no known gaps".
5. **Newest needs a date the registry does not have.** No `registry.json` carries an "added" date. The date has to come from git (the commit that first added the item's `registry.json`) or from `CHANGELOG.md`. I wrote the pattern; the source is the builder's choice.
6. **The MCP server's install.** Settled by the Sutradhar on 8 October: `@susegad/mcp` 0.1.0 is on npm (`npm view`), so the agent card names `npx -y @susegad/mcp`. The package has one bin (`susegad-mcp`), so `npx` runs it, and `packages/mcp/src/tools.mjs` imports `@susegad/cli` by package name, which its npm dependency provides. Nobody has yet run that line from an empty folder; please try it once before deploy. `packages/mcp/README.md` still says "Nothing here is published to npm yet" and "must run from the Susegad UI repo"; both are out of date.
7. **Private paths in pages the site will now render.** `docs/BROWSERS.md` cites `docs/reviews/2026-10-06-overlays.md` (line 79) and `docs/LEDGER.md` (line 220). `packages/components/tooltip/tooltip.docs.md` cites `docs/reviews/2026-10-07-a11y.md` in its conformance table, which component pages now show. The request's pointer check will fail on these.
8. **The bloom card.** The four pictures map to four doors. The bloom has no kind of its own on the home page, so I put it on Foundations (true: its layout is the engine's `phyllotaxis.js`, as the bloom's registry budget says). If Templates gets a door, it could move there.
9. **"No two names give the same one."** The greeting card recipe says this. A seed from a name can collide, so I did not repeat it. "The same name always grows the same flower" is safe.
10. **Where does the site show Konkani?** The switcher in the header needs Konkani pages to point to. The docs site has none today; the event template's Konkani pages are the only ones. If only the templates page links to Konkani, the switcher may belong on that page, not every page. That is a design call for the Sutradhar.

The three strings I am least sure of, and why:

1. `trust.nav`, "Accessibility" in place of "Trust". It is the reader's own word and it is honest about what is there, but it leaves Browsers out of the nav label. If the owner prefers "Trust", the page title still says "Accessibility and browsers".
2. `view.register.playful.hint`, "Bright colours, and things answer a tap." Playful varies by piece (ants come for the kolam's flour, the bloom shivers). The hint has to be true of the whole site in 40 characters, and "answer a tap" is the closest I could get without promising something a given page lacks.
3. `bloom.saved`, "Saved as {filename}. Look in your downloads." Some browsers ask where to save, and on a phone a download can land somewhere else. The recipe's own line ("Made {file}, a PNG of {n} KB") is more exact but colder; I chose the warmer line and it may need the recipe's wording if a reviewer finds it misleading on iOS.
