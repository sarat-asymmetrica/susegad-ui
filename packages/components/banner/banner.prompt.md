# Banner

*An announcement across the top of a page: "Closed for the monsoon, back 1 October."*

A visitor can dismiss it, and it stays dismissed on their browser. It says itself aloud once, and it goes away by itself on its date.

```html
<link rel="stylesheet" href="susegad/components/banner/banner.css">
<script type="module" src="susegad/components/banner/banner.js"></script>

<sg-banner id="monsoon" until="2027-09-30">
  Closed for the monsoon, back <time datetime="2027-10-01"></time>.
</sg-banner>
```

| Attribute | Values | What it does |
|---|---|---|
| `id` | text | Names the banner in the browser's memory. |
| `until` | a date, or a date and time, in IST | After it the banner shows nothing. A date alone means through that day. |
| `back` | a date | Adds "Back 1 October" after the words. |
| `label` | text | The region's name. Default "Announcement". |

## The prompt

Make an announcement banner web component, `<sg-banner id="monsoon" until="2027-09-30">`, that sits at the top of a page and holds the site's own words as text, so the page reads without script. Add a dismiss button that is a native button showing a cross and named "Dismiss this announcement", at least 44 by 44 px. Remember a dismissal for that visitor in `localStorage` under a key made from the id (or from the words, when there is no id, so new words show again), and wrap every read and write in try/catch: with no storage, or full storage, the banner still renders and dismisses for the page and returns on the next visit, with no errors. Say the banner through the library's `announce()` once per visit (remember it in `sessionStorage`, wrapped, so a visitor on three pages hears it on the first), the first time it is on show ("Announcement: " and the words), never for a banner that arrives dismissed or out of date, and do not make the banner a live region. Take an optional `until` attribute read in Asia/Kolkata: a date alone means through the end of that day, a date with a time means that moment, and after it the banner is hidden, silent and takes no room, whatever zone the visitor's phone is in. Fill an empty `<time datetime>` with the date in words in the page's language through the library's `core-intl`, and add a `back` attribute that appends "Back 1 October" in the language's own order. When a dismissal happens while focus is in the banner, move focus to the next focusable thing on the page, else to `<main>` (with `tabindex="-1"`); never leave it on the body. Without script the banner is only its words (no cross, no `until`); say so. The label, the dismiss name, the announcement and the "Back" line come from a strings table in English and in Konkani in both scripts. Give it three registers: quiet is a strip with one hairline; warm is a sheet of paper with a seeded pencil rule drawn in two strokes; playful is seeded bunting strung along the bottom edge whose flags drop in and swing once. Reserve room for the decoration so it never covers the words, drop it in forced colours, and show the finished strip under reduced motion with an instant dismissal. Answer a press in every register as the touch contract says.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| remember the visitor's dismissal | storage | `safeStore()` wraps `localStorage` so every read and write is in try/catch; `storageKey(id, text)` names it; `rememberDismissed()` says whether the browser kept it. Unit-tested with a store that is missing, blocked and full. |
| a banner whose words change shows again | hash | With no `id` the key is `hashText(text)`, an FNV-1a of the words with whitespace collapsed. An `id` keeps a dismissal across edits. |
| announced once per visit | announce | `announce()` is called the first time the phase is `shown` on a page, only when `shouldSay()` finds no mark in `sessionStorage`, and not at all for `dismissed` or `expired`. The banner is not a live region. |
| read in IST | intl | `expiryOf()` parses the `until` text with `parseWhen()` (IST), adding a day to a bare date. A visitor in New York or Auckland sees the banner go at the same moment. |
| dates in words, in the page's language | intl | `dateText()` writes "1 October" in English and uses `formatKonkani()` for a Konkani page ("1 ऑक्टोबर", "1 Otubr"), always in IST. |
| the strings, in three languages | strings | `banner.strings.js` is keyed `en`, `gom-Deva`, `gom-Latn` and read through `strings()`, so Romi never borrows Devanagari. |
| focus after dismissal | focus | `landing()` takes the first focusable element after the banner in document order, else `<main>` with `tabindex="-1"`; focus goes there when it was inside. |
| a pencil rule, drawn a little differently each time | seed | `rulePaths(width, seed)` in the warm skin makes two wandering strokes from a Park-Miller generator seeded from the banner's id; the dash slides to 0 to draw them. |
| bunting | seed | `bunting(width, seed)` in the playful skin hangs flags from a parabola of string, coloured from palette tokens, each a little off; they drop in with a staggered spring and swing once. |
| room for the decoration | layout | The warm and playful skins pad the strip's bottom so the rule and the flags sit inside it, below the words. |
| the strip folds away | WAAPI | The skin's `leave()` animates `block-size` and opacity for 200 ms; the element is hidden after, and the held last frame is cancelled. |
| under reduced motion, show it all at once | still | Every skin checks `ctx.motion === 'still'`; the CSS drops transitions; a dismissal does not wait for an exit. |
