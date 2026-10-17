# Words pass 2: the builder's strings after Rasika's review

Kathakar, 8 October 2026. I read `git diff 35d16b8..9b3a99f -- apps/docs` and the built pages in `out/docs` (`accessibility.html`, `index.html`, `gom-deva/index.html`, `gom-latn/index.html`). Each correction is an exact old → new pair for the builder to apply. Where a fix needs a small code change as well as new words, the change is described in one line under the pair.

Most of the builder's words were good. The Konkani pages use the deck faithfully: every string in `konkani.core.js` matches `front-door-3-kok.md`, apart from `kel'le` → `kelle`, which is fine (it is on my list of Romi spellings for the reader to settle anyway).

---

## 1. The accessibility page: components without a table

**Where:** `apps/docs/words.core.js`, `W.trust.without`. Built text today:

> 4 more pieces the registry lists as components have no conformance table yet: depth-photo, folio-diagram, player, veranda-stage.

Three problems:

- It starts with a digit, and "pieces the registry lists as components" is a hedge where a plain noun will do.
- "yet" promises a table later. Nothing I can find says one is planned: `tools/conformance.exempt.json` is empty, and these four live outside `packages/components/`, which the summary reads.
- The paragraph above it says "Each of the 53 components has a conformance table". With four more components on the same page, "each" reads as "all".

### 1a. `without`

Old:

```js
without: (n, names) => `${n} more ${n === 1 ? 'piece' : 'pieces'} the registry lists as components ${n === 1 ? 'has' : 'have'} no conformance table yet: ${names}.`,
```

New:

```js
without: (n, names) => `${n === 1 ? 'One more component has' : `There are ${n} more components with`} no conformance table: ${names}. If your site uses ${n === 1 ? 'it' : 'one of them'}, test it on your own page as part of the audit.`,
```

Built, today: "There are 4 more components with no conformance table: depth-photo, folio-diagram, player and veranda-stage. If your site uses one of them, test it on your own page as part of the audit."

Code: join the names as a list with "and" before the last: `new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(withoutTable)` in place of `withoutTable.join(', ')`. That gives "a, b, c and d" (no Oxford comma, as in the rest of the site).

### 1b. `tablesBody`, so "each" stays true

`door.core.js` already computes `total` and does not use it. Pass it in.

Old:

```js
tablesBody: n => `Each of the ${n} components has a conformance table against WCAG 2.2 at levels A and AA. For every criterion it says whether the component meets it, how that was checked (a check in the repository, an axe run, a contrast test, or a manual test written down), and what the page author still owns.`,
```

New:

```js
tablesBody: (n, total = n) => `${n === total ? `Each of the ${n} components has` : `${n} of the ${total} components have`} a conformance table against WCAG 2.2 at levels A and AA. For every criterion it says whether the component meets it, how that was checked (a check in the repository, an axe run, a contrast test, or a manual test written down), and what the page author still owns.`,
```

Code: in `door.core.js`, `t.tablesBody(n)` becomes `t.tablesBody(n, total)`. Built, today: "53 of the 57 components have a conformance table against WCAG 2.2 …".

`item.a11y.more` (the link "All 53 tables …" on component pages) still reads true: it counts tables, not components.

### 1c. The code comment

`words.core.js`, the comment above `without`: "for her to read". Nobody has told us which pronoun Kathakar takes. Not reader-facing, but please make it:

Old: `// not in Kathakar's deck: written by the builder from the registry, for her to read`
New: `// not in Kathakar's deck: written by the builder from the registry; Kathakar's wording, pass 2`

---

## 2. The accessibility page: the browsers paragraph

**Where:** `W.trust.browsersBody`. The new sentence repeats the one before it ("WebKit and Firefox run on every change …. WebKit and Firefox do not block a change yet …"). One sentence can say both.

Old:

```
The same checks run in three engines: Chromium, WebKit (the engine inside Safari) and Firefox. Chromium must pass before a change goes in; WebKit and Firefox run on every change and their results are published. WebKit and Firefox do not block a change yet, and some checks still fail there; the matrix lists each. Phones are emulated at 390 px with touch. We have not run the checks on a real phone, and the matrix says so wherever that matters.
```

New:

```
The same checks run in three engines: Chromium, WebKit (the engine inside Safari) and Firefox. Chromium must pass before a change goes in. WebKit and Firefox run on every change and their results are published, but they do not hold a change back yet, and a few checks still fail there; the matrix lists each one and why. Phones are emulated at 390 px with touch. We have not run the checks on a real phone, and the matrix says so wherever that matters.
```

Source: `docs/BROWSERS.md`, "The short version" and "For maintainers" (each failing check listed with its reason). "A few" is fair: the last whole-suite run there names five checks still open (player, stepper, enquiry, field, field-note).

---

## 3. The copy button when the clipboard is refused

**Where:** `apps/docs/shell.js`, the `fallback` in the copy handler, and `W.copy` in `words.core.js`.

The builder's change is right: a button beside an install line now selects that line. Four things still need words.

### 3a. Nothing was selected, but the words say "Selected"

When a button has `data-copy-text` and no `.install` around it, `el` is null, nothing is selected, and the button still says "Press Ctrl+C" and announces "Selected. …". Add two strings for that case.

New keys in `W.copy`:

```js
failedNone: 'Select to copy',
failedNoneAnnounce: 'This browser did not allow copying. Select the text and copy it from there.',
```

Code: in `fallback`, use `failed`/`failedAnnounce` when `el` exists, and `failedNone`/`failedNoneAnnounce` when it does not.

### 3b. On a phone there is no Ctrl+C

New keys:

```js
failedTouch: 'Hold to copy',
failedTouchAnnounce: 'Selected. Touch and hold it, then choose Copy.',
```

Code: when `matchMedia('(pointer: coarse)').matches`, use these in place of `failed` and `failedAnnounce`.

### 3c. The message leaves before it can be read

`reset()` puts the label back after 1.6 s. That suits "Copied", but "Press Ctrl+C" is an instruction, and it is gone before most people have read it and reached for the keys. Code only: wait 5 s before resetting after a fallback, and keep 1.6 s after a copy.

### 3d. English words on the Konkani pages

On `/gom-deva/` and `/gom-latn/` the fallback words are English (the deck keeps the rare fallbacks in English), but the button and the `#announce` region take the page's `lang`, so a screen reader reads "Press Ctrl+C" in a Konkani voice. Code only: while the button shows a fallback, set `btn.lang = 'en-IN'` (and remove it in `reset`), and give `#announce` `lang="en-IN"` for that one message.

And one more on the same pages. After a successful copy, the button shows the Konkani "नकल जाली" / "Nokol zali" (good), but a button with no `data-announce` announces the English `W.copy.copied`. On the Konkani home the hero button has its own Konkani `data-announce`, so nothing is wrong today; to keep it that way:

Old: `announce(btn.dataset.announce || W.copy.copied)`
New: `announce(btn.dataset.announce || (kok?.copied ?? W.copy.copied))`

---

## 4. The draft note under the switcher, on the English home page

**Where:** the View panel, `p.view-draft`, on `/` (English). It sits under the three language links and reads:

> Draft, awaiting a native reader

On the English page, a reader cannot tell what is a draft: the page they are reading, or the link beside it. On the Konkani pages the same spot says मसुदो / Masudo about the page itself, which is right.

Old (English pages only): `Draft, awaiting a native reader`
New (English pages only): `The Konkani pages are a draft, awaiting a native reader.`

Keep the short form, "Draft, awaiting a native reader", for a tag beside one Konkani link or card, where it is plain what it belongs to.

---

## 5. Posters: the sample quote loses its "Placeholder" label

**Where:** `apps/docs/posters.mjs`, `POSTER_STAGES`, the new `unplaceholder:x` step.

For `now-note` and `studio-home` this is fine: the pictures show sample status lines and a sample headline, and nobody is quoted.

For **`quote`** it is not. The quote demo reads "Placeholder quote: the order page does in one evening what took us a week of messages", signed **Maya Fernandes, Founder, Aldona Organics**. The step removes "Placeholder quote:", so the poster becomes a testimonial with a person's name and a business under it and no sign that it was made up. A visitor (or a search engine reading the image) would take it as a real client's words, and I cannot tell whether an Aldona Organics exists. The studio-home recipe gets this right by also writing "(placeholder)" into the role, which the step leaves alone.

Old:

```js
  quote: { steps: ['unplaceholder:x', 'wait:300'] },
```

New (either is fine):

```js
  quote: { steps: ['wait:300'] },
```

or keep the step and mark the role as made up, the way studio-home does:

```js
  quote: { steps: ['unplaceholder:x', 'css:.sg-quote-role::after{content:" (sample)"}', 'wait:300'] },
```

I prefer the first. The word "Placeholder" in the picture is honest, and the poster is small enough that it reads as a label.

---

## Unchanged, and fine

- Short column labels on the accessibility table at phone width: Meets, Author's part, N/A, Gap. Clear enough in a narrow cell. Every row's full label stays in `data-label`.
- The hero's lede stays whole in English and in both Konkani versions. On a phone the call to action now comes before it (picture, title, call to action, paragraph), so nothing is left out. (The `lede-more` span that once set its last sentence apart is gone.)
- The bloom toy draws a warm marigold in every register. That suits a gift, and no string mentions the register.
- The Konkani footer gives the licence in Konkani and then in English, as the deck asked. The English privacy line is passed in (`englishPrivacy`) but not used. That is fine: only the licence needs its English.
