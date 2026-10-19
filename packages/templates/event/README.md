# Event page (template)

A starter site for a one-day event: a header with a language switcher, a picture
at the top, the agenda, the speakers, the venue and a footer. It comes in
English and in Konkani in both scripts, Devanagari and Romi.

```sh
npx @susegad/cli create my-event-site
```

(After installing the package, the command is `susegad`; `susegad diff` and `susegad add` find this folder on their own.)

makes this folder, and copies the pieces it uses into `susegad/` beside it. The
event is made up (Mandovi Conclave, a day of talks on AI for public services in
Panjim), and so are its speakers. Change every word.

## Open it

The pages are plain files. There is no build step, and nothing to install. Any
static server will do:

```sh
npx serve
```

Open the address it prints. Opening `index.html` straight from the folder shows
the page, but the scripts are modules and browsers load those only from a server.

## What each part is

| File | What it is |
|---|---|
| `index.html` | The English page, at `/`. |
| `gom-deva/index.html`, `gom-latn/index.html` | The Konkani pages, in Devanagari and in Romi (the address scheme of decision 0025: the language tag, in lower case, before the path). |
| `package.json` | Says the files are modules (so `node pages.mjs` runs without a warning), and gives `npm start` (serves the folder) and `npm run pages`. Nothing to install. |
| `strings.js` | **Every word**, by language, and the facts the pages share: the day, the sessions and their times, the speakers, the venue's coordinates, the site's address and the look it starts in. |
| `KONKANI-FOR-READER.md` | Every Konkani key beside its English, with notes, for a native reader to check. |
| `pages.mjs` | Writes the three pages from `strings.js`. Optional. |
| `page.js` | The one script on the page: the components, "now on stage", the map links, the Play button and the registration form's sample note. |
| `look.js` | Lets the address pick a look: `?register=warm`, `?theme=dark`. |
| `site.css` | The page's layout. The pieces bring their own styles. |
| `sw.js`, `offline.html`, `gom-deva/offline.html`, `gom-latn/offline.html` | The offline worker and the page it shows when there is no connection (written by `pages.mjs`). |
| `posters/hero.*` | The picture at the top, in three formats. It is the first thing painted. |
| `susegad/` | The library pieces the page uses, copied by the CLI. They are yours to change; `npx @susegad/cli diff` shows what you changed. |
| `susegad.json` | What the CLI copied, so it can tell your edits from its own files. |

The look is **quiet** to begin with. That is the register for a page a government
office or an auditor will read: no motion beyond what a state needs, hairline
rules, and the picture at the top stays a still. Anyone can still press *Play the
picture* to see the scene move. Try `?register=warm` or `?register=playful` on any
page to see the others, and change `REGISTER` in `strings.js` to make one the
default. Every register passes the same accessibility checks.

The picture has one poster, the scene's own finished still, and there is no separate dark one: the scene is a painting of a room at dawn, so its still is the same in a dark theme (decision 0023 asks for a poster to be the scene's own still, never a different picture). In a dark theme the bright window sits on a dark page; that is the painting, not a mistake.

## Change the words

1. Edit `strings.js`. The English is under `'en-IN'`; each Konkani block has the
   same keys.
2. Run `node pages.mjs` in this folder of a site `susegad create` made (it imports `./susegad/...`, so it does not run inside the library repo itself). It writes the three pages again.
3. `node pages.mjs --check` says whether the pages on disk match `strings.js`.

If you would rather edit the HTML by hand, do, and stop running `pages.mjs`: the
pages do not need it. The change to make by hand in each page is the same
everywhere, so the script is kinder when there are several languages.

The Konkani is a draft by a non-native writer, for a native Goan reader to check.
Every Konkani key counts as unreviewed until it is in `REVIEWED` in `strings.js`
(`unreviewed()` lists what is left), and `KONKANI-FOR-READER.md` sets each key
beside its English so a reader can check it in one sitting. An entry that reads
`[TODO gom-Deva hero.title]` is one nobody has written; it stays visible on the page
on purpose, so it cannot be published by mistake. The words the library itself
shows (the switcher's name, the footer's label) are in
`susegad/core/strings.table.js`, as a draft that a Konkani reader still has to
check.

The registration form (`#register`; markup in `pages.mjs`, handler at the end of `page.js`) sends nothing
to any server. A valid send fires `sg-register` with `{ name, email }`, and `page.js` answers it by
making the visitor's ticket: an id made on their own device, kept in that device's `localStorage` (the
name, the event, the time and the id; no email address), and shown above the form as `<sg-ticket>`,
with the QR code, a Save as picture button and one closing line said aloud. The ticket opens again on
their next visit, offline too. To register people for real, send `{ name, email }` to your own server in
that listener, then make the ticket from what it answers (`ticket.issue(name)`).

Beside the fields the form carries the library's consent notice, written for India's DPDP Act in plain
words. **Get a legal read of that notice before the site goes live.** Its contact, the site's name and
the complaint line are left as visible [placeholders]: fill them in by adding `contact`, `site` and
`complain` to `register.consent` in `strings.js`, then run `node pages.mjs`.

**Offline.** `sw.js` is a small service worker that keeps the site's own pages and the files they need,
and nothing else (decision 0028 in the Susegad UI repo says what, and what never): no response to a
form, nothing from another address, no personal data. After one visit the pages open again with no
connection, and a page never visited shows `offline.html` (one for each language, with the words in
`susegad/recipes/offline/recipe.strings.js`). `pages.mjs` writes `sw.js` and the offline pages; if the
site is served from a folder, change `SCOPE` in `strings.js`. The worker's version is a content hash of every file the
worker keeps, computed by `node pages.mjs`: edit a kept file without running it again and returning visitors keep the old file, and `node pages.mjs --check` fails when you forgot. The offline pages say the event page and the ticket still open: keep that true.

The days, months and the times on the Konkani pages come from
`susegad/core/intl.kok.js`: a time reads "सांजे 7:00" (the part of the day, then the
clock), a date "शेनवार 21 नोव्हेंबर". The words are the same in every browser. If
you change the day or the date in `strings.js`, write the Konkani date the way the
library does (`formatKonkani()` gives it) and run `node pages.mjs`.

Two things are still English on a Konkani page: the words the agenda writes by
itself ("Now on stage, until 11:15 am", "Next, at 2 pm"). They are marked as
English for a screen reader. They will follow the page's language when the agenda
recipe gets its Konkani words.

## Make it yours

- **The address.** `SITE` in `strings.js`, or `susegad create --site https://...`.
  `hreflang` needs full addresses, so this one matters before you publish.
- **The venue.** `VENUE` (latitude and longitude) and the `venue` words. The
  coordinates point at central Panjim.
- **The sessions.** `SCHEDULE` lists each one: id, start and end (IST, 24-hour),
  room and track. Keep a speaker's `speaker` key in step with `SPEAKERS`.
- **The picture.** Another scene for the top: `npx @susegad/cli list` shows what is on
  the shelf, and `susegad add scene-<name>` copies one. Change the `src` and
  `name` in the `sg-lazy` of `pages.mjs`, and make a poster from the scene's own
  still in three formats (AVIF, WebP, JPG), as decision 0023 describes. This
  one's poster is the `pahat` scene, the desk at dawn, shot under reduced motion.
- **The speakers' photos.** There are none, only initials. A photo goes in only
  with the person's consent on record: see the person card's docs.

## Add a language

1. Add the language to `LANGS` in `strings.js`, for example
   `{ tag: 'hi', folder: 'hi' }`, and a `COPY.hi` block with the same keys as
   `'en-IN'` (start by copying it).
2. Add its name in its own script to `names` in `pages.mjs`, and, if the library's
   shared words (`susegad/core/strings.table.js`) have it, they follow the tag.
3. Run `node pages.mjs`. The new page appears at `/<folder>/`, every page lists it
   in its switcher and in its `hreflang` links.

Konkani is written in two scripts, so it is two pages. A language with one script
is one page.

## What it is made of

The recipes `agenda`, `speakers` and `venue`, the components `lang`,
`person-card` and `site-footer`, `sg-lazy` and the `pahat` scene. Their own
READMEs say how each behaves. The speakers recipe's track filter is left out, so
that no English word the recipe writes appears on a Konkani page; add it back
from the recipe's README if you want it.

## Why a template is a registry item

`susegad create` reads a template like any other thing on the shelf: from
`registry/registry.json` as an item of type `template`, named `template-event`,
with the same hashes, so it works from a checkout and from the live registry,
and `susegad diff` keeps working afterwards. It lives under `packages/templates/`
for the same reason every item lives under `packages/`: the CLI, the docs mirror
and the shadcn view all copy from there. Its files land at the root of your
folder, where a site's pages belong, instead of under `susegad/`. The pages
refer to the library as `susegad/...`, the way they will after the copy, and the
registry build checks that every such reference is a file that gets copied.

The people, the event and every place are made up, except Panjim and the Mandovi
river, which are real. Nobody is meant.
