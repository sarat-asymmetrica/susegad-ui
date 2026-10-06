# Community square: a template draft

A static HTML draft of a village community's home page, built on Susegad UI's
Wave B pieces. It exists to show how the library's components compose into a
real community site: the lane (the hero), the square (the gatherings and the
people), and the balcão (the welcome at the bottom).

The community is made up. The Riverside Makers Guild, Aldona is an invented
group of potters, weavers, boat builders and printers; every name, rupee and
caption on the page is placeholder copy. Aldona is a real village in Goa, used
here as the sample location. No real person or business appears on the page.

## What it shows

- **The lane.** A hero opened by the library's `tinto` scene (the square),
  imported repo-relative the way the demos do it.
- **Gatherings.** Three `sg-event-card`s: an upcoming workshop with seats
  left, a mela with no seats line, and a past class that is over.
- **People.** Four `sg-person-card`s showing initials, not faces.
- **A consent-first gallery.** One `sg-gallery` with two granted slots
  (the template's own drawings standing in for photographs) and two pending
  slots, which stay drawn frames until consent is recorded.
- **The shared ledger.** An `sg-data-table` with a small made-up account,
  rupees written the Indian way, sortable headings and an unsorted foot.
- **The balcão.** "Pull up a chair": an `sg-accordion` of joining questions,
  then an `sg-site-footer` with the sign-off.

The page default is the warm register. `?register=quiet` or `?register=playful`
on the URL shows one register on its own; reduced motion always wins and shows
the scene's still.

## How to open it

Serve the repo root, then open the page:

```sh
node tools/serve.mjs          # port 5173
```

Then visit `http://localhost:5173/templates/community-square/index.html`.

No build step. There is no JavaScript on the page beyond the module imports
the components need; the gallery, table and footer all read fine with scripts
off, and the accordion opens and closes on the browser's own details and
summary.

## Files

- `index.html`: the whole page, one file.
