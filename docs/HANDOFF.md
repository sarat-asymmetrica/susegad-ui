# Handoff

For a front-end engineer, or someone checking accessibility, who has never seen Susegad UI and has to build a site with it. Everything here is a command you can paste or a file you can open. If one of them is wrong, that is a mistake in this page, and we want to hear about it (see "Report an issue").

## What this is

Susegad UI is a front-end library of plain ES modules and custom elements (`<sg-*>`), with no runtime dependencies and no build step required. Every piece has three registers, `quiet`, `warm` and `playful`, set with one attribute, so the same page can be as plain as an audit report or as lively as a festival poster. You copy the pieces you want into your own project, the way shadcn/ui works, and from then on the files are yours to change.

The library is MIT licensed. The documentation, stories and sample copy are CC BY 4.0. The fonts keep their own licences, mostly the SIL Open Font License. `docs/CHARTER.md` says what the library is for and what it will not do.

## Start in five minutes

You need Node 22 or later and Git. The only download after that is `serve`, the small web server in the last step: `npx` fetches it the first time you run it, which took about ten seconds when we tried. The site itself has no dependencies.

The `create` command makes a working event page: a header with a language switcher, a picture at the top, the agenda, the speakers, the venue and a footer. The published package on npm is 0.1.0, and `create` is newer than that, so for now run it from a clone of the repository:

```sh
git clone https://github.com/sarat-asymmetrica/susegad-ui
node susegad-ui/packages/cli/bin/susegad.mjs create my-site
```

If `susegad-ui/packages/templates/event/` is missing from your clone, the clone is older than the command; pull again. When a release after 0.1.0 reaches npm, the same thing will be `npx @susegad/cli create my-site`. (The package is `@susegad/cli`. There is no package called `susegad`, so asking npx for `susegad` fails.)

It asks "Go ahead?" first when it has a terminal (add `--yes` to skip that), and refuses a folder that is not empty before it writes anything. This is what it prints, abridged:

```
Starting the event site in my-site (look: quiet; pages: en-IN, gom-Deva, gom-Latn).

Made 14 files of your own, and copied 144 files from 21 library pieces into susegad/:
  gom-deva/index.html, gom-latn/index.html, index.html  (the pages)
  KONKANI-FOR-READER.md, look.js, package.json, page.js, pages.mjs, posters/, README.md, site.css, strings.js
  susegad/  (core-intl, core-strings, tokens, agenda, ... and venue)
I noted what I copied in susegad.json, so next time I can tell your edits from mine.

The Konkani is a first draft by a non-native writer. Ask a Goan reader to check KONKANI-FOR-READER.md before you publish.

What to do next
  1. Open it. ...
  2. Change the words. ...
  3. Read the docs. ...
```

The three next steps repeat the ones below, so you can stop reading the output there.

Serve the folder and open the address it prints:

```sh
cd my-site
npx serve
```

The pages are plain files. Opening `index.html` straight from the folder shows the page, but the scripts are modules and browsers load those only from a server.

### What you get

| In `my-site/` | What it is |
|---|---|
| `index.html`, `gom-deva/index.html`, `gom-latn/index.html` | The page in English, in Konkani in Devanagari and in Konkani in Romi. |
| `strings.js` | Every word on the pages, by language, and the shared facts: the date, the sessions and their times, the speakers, the venue's coordinates, the site's address, the starting look. |
| `pages.mjs` | Writes the three pages from `strings.js`. Optional. |
| `KONKANI-FOR-READER.md` | Each Konkani key beside its English, for a native reader to check. |
| `susegad/` and `susegad.json` | The library pieces the page uses, and a record of what was copied. |

The event in the template (Mandovi Conclave, a day of talks in Panjim) and its speakers are made up. Change every word. Nobody in it is meant, and the speakers have initials, not photographs: a photograph goes in only with the person's consent on record.

### The quiet default

The page starts in the `quiet` register. It is the one for a page an office or an auditor reads: no motion beyond what a state needs, hairline rules, and the picture at the top stays a still. A visitor can still press "Play the picture" to see the scene move. Add `?register=warm` or `?register=playful` to any address to see the others, and change `REGISTER` in `strings.js` to make one the default. Every register passes the same accessibility checks.

The page's own `look.js` reads two things from the address, `?register=` and `?theme=light` or `?theme=dark`, and nothing else. There is no `?palette=` on the page; to try a palette, set `data-palette` on `<html>` (see "Theming with tokens"). The picture at the top is a painting of a room at dawn, and it looks the same in both themes: the theme changes the page around it, not the painting.

### Change the words

1. Edit `strings.js`. The English is under `'en-IN'`, and each Konkani block has the same keys.
2. Run `node pages.mjs` in the site folder. It prints `wrote index.html`, `wrote gom-deva/index.html` and `wrote gom-latn/index.html` (with backslashes on Windows).
3. `node pages.mjs --check` says whether the pages on disk match `strings.js`. After an edit and before step 2 it prints `index.html is not what strings.js makes` and exits 1.

If you would rather edit the HTML by hand, do, and stop running `pages.mjs`. The pages do not need it.

### The Konkani pages

The Konkani is a first draft by a non-native writer. It has not been checked by a native reader, and nobody should publish it before one has. `KONKANI-FOR-READER.md` sets every key beside its English so a reader can check it in one sitting. A key that reads `[TODO gom-Deva hero.title]` is one nobody has written; it stays visible on the page on purpose, so it cannot be published by mistake.

The words the library itself shows (the language switcher's name, the footer's label, "close", "next") are drafts as well. `node tools/strings-review.mjs`, run in the repository, lists every key still waiting for a native reader.

### Make it yours

- **The address.** `SITE` in `strings.js`, or `--site https://your.address` when you create the site. `hreflang` links need full addresses, so set this before you publish.
- **The venue.** `VENUE` (latitude and longitude) and the venue words. The coordinates point at central Panjim.
- **The sessions.** `SCHEDULE` lists each one: id, start and end (IST, 24-hour), room and track. Keep each session's `speaker` key in step with `SPEAKERS`.
- **The picture.** `packages/templates/event/README.md` says how to put another scene at the top and make its poster.
- **Another look from the start.** Add `--register warm` to the `create` command. Other options are `--lang en-IN,gom-Deva` (fewer pages) and `--template event`.

## Add a piece

The same command line works for any piece, in a new site or an old one. It comes from the clone, as `node susegad-ui/packages/cli/bin/susegad.mjs`, or from npm as `npx @susegad/cli` once a release after 0.1.0 is out (0.1.0 has `list`, `info`, `add`, `diff`, `skill` and `check`, and reads the live registry at susegad.asymmetrica.ai).

Where you run it decides where the files go:

- **In a site made by `create`**, run it inside the site's folder. The lockfile is in that folder, and `add` and `diff` find it with no `--dir`.
- **In a project of your own**, add `--dir src/lib` (or any folder). The pieces go into `<dir>/susegad/`, and the lockfile is `<dir>/susegad.json`.

In a created site, with the clone next to it as in the steps above, type these (`list` and `info` only read):

```sh
cd my-site
node ../susegad-ui/packages/cli/bin/susegad.mjs list                # everything on the shelf, by type
node ../susegad-ui/packages/cli/bin/susegad.mjs info date-range     # files, what it depends on, its prompt and docs
node ../susegad-ui/packages/cli/bin/susegad.mjs add date-range      # copies it, and kernels-booking, which it needs
node ../susegad-ui/packages/cli/bin/susegad.mjs diff                # where your copy and the library differ
```

The command is long, so the rest of this page and the CLI's README write `susegad` for all of it. `susegad` on its own is not a command until you make it one. In a project of your own, run it from the project's folder (here the clone is next door too), with `--dir` on `add` and `diff`:

```sh
node ../susegad-ui/packages/cli/bin/susegad.mjs add stamp date-range --dir src/lib
node ../susegad-ui/packages/cli/bin/susegad.mjs diff --dir src/lib
```

`add` copies the piece and everything it depends on, and prints the two lines to put on your page. Pieces you already have print "already here": the event page already uses `stamp`, so `add stamp` in a created site changes nothing, and `add date-range` brings `kernels-booking` as well (16 new files, on our run). Each file's hash goes into the lockfile. On the next `add`, a file you have not touched is updated, and a file you have changed is left alone until you pass `--overwrite`. `susegad diff <item> --patch` shows what differs first.

`diff` exits 0 when every file matches the library and 1 when any file differs. In a created site it lists the page and `strings.js` as "edited" as soon as you change the words, because they are yours now; that is expected, not a fault. A step in a CI pipeline that stops on exit 1 will stop on it, so use `diff` there to read the list, not as a pass or fail, unless you mean to guard the copied pieces under `susegad/`.

Everything the CLI does is in `packages/cli/README.md`, including installing from a commit with `--ref`.

### If the project already uses shadcn

`npx shadcn@latest add https://susegad.asymmetrica.ai/r/button.json` works once the docs site that serves `/r/` is published with this release (until then, `references/install-shadcn.md` shows how to serve the view from a clone), after three small files that shadcn insists on (a `package.json`, a `components.json` and a `jsconfig.json`). `references/install-shadcn.md` has them.

The fonts caveat matters: a shadcn install carries no font files and no audio, so do not link `susegad/tokens/fonts.css` after one, or the page logs 404s for faces that are not there. Text uses system fonts instead. To get the real faces, run `susegad add tokens`, which brings the `.woff2` files, and then link `fonts.css`. A shadcn install writes no `susegad.json`, so `susegad diff` has nothing to compare against.

## Theming with tokens

Colour, type, space and motion are CSS custom properties from `tokens/tokens.css`. Two places on your page matter. In the `<head>`, load the fonts first, then the tokens:

```html
<link rel="stylesheet" href="susegad/tokens/fonts.css">
<link rel="stylesheet" href="susegad/tokens/tokens.css">
```

And on the `<html>` element at the top of the page, say which look you want:

```html
<html lang="en-IN" data-register="quiet" data-palette="casa" data-theme="dark">
```

| Attribute | Values | Notes |
|---|---|---|
| `data-register` | `quiet`, `warm`, `playful` | The default is `warm`. Reduced motion always wins over the register. |
| `data-palette` | `susegad`, `casa`, `azulejo`, `haldi` | The default is `susegad`. |
| `data-theme` | `light`, `dark` | Leave it off to follow the visitor's system setting. |

All three work on `<html>` or on any element, so one section of a page can be warm inside a quiet page.

Read roles, never raw colours. The ones people actually use:

| Role | For |
|---|---|
| `--sg-surface`, `--sg-surface-raised`, `--sg-surface-sunk` | the page, cards, wells and inputs |
| `--sg-text`, `--sg-text-soft`, `--sg-text-faint` | text; all three are 4.5:1 or better on every surface |
| `--sg-accent`, `--sg-on-accent`, `--sg-accent-text` | the main action as a fill, the text on it, and the accent as text |
| `--sg-success`, `--sg-warning`, `--sg-danger`, `--sg-info` | status text and icons |
| `--sg-focus` | focus rings |
| `--sg-rule`, `--sg-rule-strong` | hairlines, and the borders of anything a person must see to operate |

Space is `--sg-space-1` to `--sg-space-8`, fluid type is `--sg-step--1` to `--sg-step-5`, and motion durations are `--sg-dur-quick`, `--sg-dur-calm` and so on. The register sets the durations and reduced motion collapses them, so animate with these and you get both for free.

To change a colour, set the role in your own CSS, after `tokens.css`, with a value for each theme:

```css
:root {
  --sg-accent: light-dark(oklch(50% 0.13 250), oklch(72% 0.12 250));
  --sg-accent-text: light-dark(oklch(46% 0.13 250), oklch(72% 0.12 250));
}
```

You own the contrast when you do this. The built-in palettes pass 4.5:1 for text and 3:1 for focus rings and control borders on every surface, in both themes, and a colour you pick has not been checked. Run `node tools/axe.mjs` on the result (see "Checks you can run"). To make a whole palette from a client's photographs, `node packages/tokens/tools/palette-from-photo.mjs a.jpg b.jpg --name client --out client.css` writes a `[data-palette="client"]` block and a report of every contrast ratio.

Everything else is in `packages/tokens/README.md` and `references/tokens.md`, including the sixteen-beat stagger and the `.sg-vh` class for text that only a screen reader should hear.

### Fonts by script

`tokens/fonts.css` declares the self-hosted faces, split by script with `unicode-range`, so a page downloads only the scripts it shows. Nothing is fetched from another site. Display is Castoro with Tiro Devanagari Marathi and Tiro Kannada. Body is Mukta with Noto Sans Kannada. Each stack falls back to a matched system face, so a page still reads if the fonts fail.

Mark every run of Indian-language text with `lang`. Devanagari carries marks above and below the line, so `:lang(hi|mr|kok|gom|kn|sa|ne)` raises the line height (decision 0025). Konkani in Romi (`gom-Latn`) keeps Latin line height. Declare `line-height: var(--sg-leading-body)` on the text elements themselves, because a custom property only changes the line height where `var()` is used.

## Languages

A language is a page. Decision 0025 (`docs/decisions/0025-languages.md`) sets the rules, and the event template follows them:

- **One address per language.** `/` for English, `/gom-deva/` and `/gom-latn/` for the two Konkani scripts. Each page works with no JavaScript and can be linked to and indexed. There is no client-side swap of text.
- **Tags.** `en-IN`, `gom-Deva` (Konkani, Devanagari) and `gom-Latn` (Konkani, Romi). Goan Konkani is `gom`, and the script is always written out.
- **`hreflang`.** Every page lists all the alternates in its head, itself included, with `x-default` for visitors none of them match, and with full addresses.
- **`<sg-lang>`** is a row of ordinary links, each language named in its own script, with `aria-current="page"` on the current one. It never redirects by itself. `packages/components/lang/lang.docs.md` has the markup.
- **The library's own words** (close, menu, next, loading) live in `core/strings.table.js`. A Konkani key that is missing falls back to English, never to a blank.

To add a language to a created site: add it to `LANGS` in `strings.js` (for example `{ tag: 'hi', folder: 'hi' }`), copy the English block to a new `COPY.hi` and translate it, add the language's name in its own script to `names` in `pages.mjs`, and run `node pages.mjs`. The steps are in the site's own `README.md`.

Konkani strings stay drafts until a native reader signs them off. A signed key goes into the `REVIEWED` list in `strings.js`, and `unreviewed()` and `tools/strings-review.mjs` show what is left. Machine translation is a first draft, never the last word.

## Scenes and performance

A scene is a drawing made in code that hosts your words. On a page you want to be light, wrap it in `<sg-lazy>` (decision 0024), so the picture arrives first and the scene's code arrives only when it is needed:

```html
<sg-lazy src="susegad/scenes/pahat/index.js">
  <picture>
    <source type="image/avif" srcset="posters/hero.avif"><source type="image/webp" srcset="posters/hero.webp">
    <img src="posters/hero.jpg" width="720" height="450" alt="A desk at dawn." decoding="async">
  </picture>
  <sg-scene name="pahat" hidden></sg-scene>
</sg-lazy>
```

The poster is the first paint, and the page reads without JavaScript. The scene starts when the element is within 200 px of the screen and the page has loaded. It never starts by itself under any of these:

- the visitor asked for reduced motion;
- Save-Data is on;
- the register is `quiet`;
- the device reports 2 GB of memory or less.

In those cases the poster stays as the finished still. A page can offer a Play button that calls `start()`, which runs the scene anyway for a viewer who asks. `data-state` on the element says `poster`, `loading`, `live` or `failed`, and `data-hold` says why a scene is being held. If a scene fails to load, the poster stays and nothing breaks.

Images follow decision 0023: generated art stays code, drawn art is SVG, photographs and posters are AVIF then WebP then JPG inside `<picture>` (the JPG `<img>` carries the `alt`, `width` and `height`), and social preview images are JPG. No new GIFs. Every `<img>` declares its size so nothing shifts when it loads.

## Browsers

`docs/BROWSERS.md` has the full matrix and what degrades where. In two lines: the automated checks run in Chromium (required to pass), WebKit (Safari's engine) and Firefox (run on every change, with a few open findings that are written down), and phones are emulated at one size, not tested on real devices. The policy is the current and previous major versions of Chrome, Edge, Firefox and Safari; a browser without ES modules or custom elements is not supported.

## Accessibility and conformance

The target is WCAG 2.2 level AA. Each component's docs file (`packages/components/<name>/<name>.docs.md`) has a table under "Accessibility" that lists the A and AA criteria for that kind of component, whether each is met, how that was checked, and what the page author still owns. `docs/reference/accessibility.md` is the summary across all components, with the known gaps listed. `docs/contributing/conformance.md` explains the table format, the four statuses, and how the tables are checked.

What a component cannot do for you, and the page author still owns:

- **Alt text** for every informative image, and empty alt for decoration.
- **Headings** in a sensible order, and a page title.
- **The language of the page and of its parts**: `lang` on `<html>`, and on any run of text in another language.
- **Link text** that makes sense out of context.
- **Sticky headers and banners** that can cover a focused control. Test with the keyboard.
- **Colours you set yourself**, which no one has checked.

The touch contract (`docs/contributing/touch-contract.md`) says how every interactive piece answers a finger, a mouse and a key: it responds within one frame, in every register, with a colour change as well as movement, and motion under 300 ms. `node tools/touch.check.mjs` keeps it.

On GIGW 3.0: `docs/contributing/conformance.md` says what we could and could not verify about it. A table written to WCAG 2.2 AA covers the WCAG 2.1 AA criteria GIGW refers to, but we have not mapped GIGW's own checkpoints, and GIGW certification is given to a site, not to a component. The tables are input to that audit, not a claim of certification.

## Checks you can run

From a clone of the repository:

```sh
npm ci
npx playwright install chromium
```

`npm ci` ends by saying "4 high severity vulnerabilities". A security team will ask, so here is what that is, as of 7 October 2026. `npm audit` names two packages: `sharp` (an image library, with a flaw in the SVG library it bundles) and `undici` (an HTTP client, with several denial-of-service and caching flaws), the second reached through `wrangler`, the tool we publish the docs site with. Both are development tools of this repository: `npm audit --omit=dev` reports 0 vulnerabilities, and nothing from `node_modules` is copied into a site you make or ships to a visitor. They matter if you point those tools at images or servers you do not trust, which the commands on this page do not. The fix is newer versions of `sharp` and `wrangler`, which we have not taken yet; `npm audit fix --force` would install an older `wrangler`, so we do not suggest it. Run `npm audit` yourself for the current list.

| Command | What it proves |
|---|---|
| `npm test` | The pure logic of every piece (dates, money, timing, the registry, the copy tools) runs in Node and passes. On a quiet machine it took 48 seconds; with other work running, up to 88. |
| `npm run check` | The pieces work in a real browser: keyboard paths, focus, names and roles, reading with JavaScript off, target sizes, reflow at 390 px. Chromium by default. It runs 114 checks one after another and prints a line as each finishes. The first line can take a minute or two, so a quiet screen is not a hang. On a quiet machine the whole Chromium run took 72 minutes and 112 of the 114 passed; one of the two was fixed after the run and the other (`packages/transitions/page.check.mjs`) fails about one run in three on Chromium's cross-document view transitions and passes when run alone. Add `--engine=webkit` or `--engine=firefox` for the other engines: WebKit took 72 minutes (83 of 114) and Firefox 108 (101 of 114). Every one of those failures fails the same way on the previous release, and [BROWSERS.md](BROWSERS.md) lists what each engine leaves out. To check one piece, run its own file: `node packages/components/stamp/stamp.check.mjs` took 7 seconds. |
| `node tools/checks.mjs --engine=webkit` | The same checks in WebKit; `--engine=firefox` runs them in Firefox. Run `npx playwright install webkit firefox` once first. Unlike Chromium, these two have open findings that are written down in [Open findings](BROWSERS.md#open-findings-as-of-7-october) in `docs/BROWSERS.md`, so a FAIL here is not necessarily something you broke: compare it with that list before you decide. |
| `node tools/axe.mjs --url /packages/components/stamp/demo.html` | axe-core, with the WCAG 2.2 AA rules, in all three registers and both themes. Git Bash for Windows rewrites an argument that starts with `/` into a `C:/Program Files/Git/...` path; the library's tools undo that for `--url`, so the command works as written. If an error shows that path, put `MSYS_NO_PATHCONV=1` before the command. |
| `node tools/copy-lint.mjs` | The copy rules: sentence case, no em dashes, no marketing adjectives. |
| `node tools/strings-review.mjs` | Which Konkani strings still wait for a native reader. |
| `node tools/review-pack.mjs scene-kolam` | For someone changing the library: one folder of evidence for one piece, with screenshots in every register, axe, performance and its own tests. |

Automated checks find a good part of the problems and not all of them. They do not replace a person using the page with a keyboard and a screen reader.

## Report an issue

Open an issue at https://github.com/sarat-asymmetrica/susegad-ui/issues. <!-- owner: confirm the issue tracker is open -->

It helps us to know:

- **What you did**, with the page address or a few lines of HTML that show it.
- **What you expected, and what happened instead.** For a visual problem, a screenshot.
- **The browser, its version and your system**, for example Safari 18 on iPhone, or Firefox 140 on Windows 11. For an accessibility problem, the screen reader or other tool too.
- **The look and language**: the register, theme and palette, and the page language, since they change what a piece draws and says.
- **The piece and its version**, from `susegad.json`.
- **Anything in the browser console.**

For a Konkani wording problem, give the key (for example `hero.title`) and the word you would use. Please leave out names, phone numbers and anything else you would not want public: an issue is visible to everyone.

## Where to read next

- **A piece**: `packages/components/<name>/<name>.docs.md` for usage and accessibility, and `<name>.prompt.md` for the prompt you could give an AI agent to make it, with a map from its words to the techniques in the code. Scenes keep their prompt at `packages/scenes/<name>/<name>.prompt.md`, and recipes have a `README.md`.
- **The live gallery**: https://susegad.asymmetrica.ai, with every piece and scene in every register.
- **For an AI agent**: `SKILL.md`, and the files in `references/` (`components.md`, `scenes.md`, `tokens.md`, `folio.md`, `recipes.md`, `install-shadcn.md`).
- **Why things are the way they are**: `docs/decisions/`.
- **The command line**: `packages/cli/README.md`.
- **The event template**: `packages/templates/event/README.md`, or `README.md` inside a site you made.
- **What changed**: `CHANGELOG.md`.
