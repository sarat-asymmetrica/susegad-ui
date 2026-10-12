# 0025: a language is a page, a small strings table and a script

*Karigar, for the Sutradhar, rung 3 item 8, 6 October 2026. Status: proposed, for the owner's word.*

The event page that `npx susegad create` makes for the Goa government's AI conclave must switch to Konkani. Konkani is written in two scripts in Goa, Devanagari (the official one) and Romi (Roman), so "switch to Konkani" is really "switch among three": English, Konkani in Devanagari, Konkani in Romi. This decision fixes how a site offers them, how the library's own words follow, and how the type follows the script. It adds one component (`<sg-lang>`), one tiny core module (`strings.js`) and a few lines of token CSS. It adds no dependency.

## Language tags

| Page | Tag | Switcher text |
|---|---|---|
| English (India) | `en-IN` | English |
| Konkani, Devanagari | `gom-Deva` | कोंकणी |
| Konkani, Romi | `gom-Latn` | Konknni |

`gom` is Goan Konkani, ISO 639-3 and in the IANA registry. `kok` is the Konkani macrolanguage, which also covers Konkani as written and spoken in Karnataka and Kerala (`knn` is Maharashtrian Konkani). The pages here are Goan, so the pages declare `gom`, and the script subtag is always written out, because the whole point is that one language has two scripts and `gom` alone does not say which.

Why not `kok-Deva` and `kok-Latn`, which the tokens already match? Software support for `kok` is older and wider, and it is the tag a Karnataka site would use. So the library treats the two as one language: `:lang(kok)` and `:lang(gom)` both match in CSS, a visitor whose browser asks for `kok-Deva` is matched to a `gom-Deva` page, and the strings fall back from one to the other. A site that prefers `kok-Deva` works unchanged.

The platform agrees that the two are one language, in its own way. In ICU (Node, and so Chrome) `Intl.getCanonicalLocales('gom-Deva')` returns `kok-Deva`, `new Intl.Locale('gom').maximize()` is `kok-Deva-IN`, and `Intl.DisplayNames` calls `gom` just "Konkani"; CLDR treats `gom` as an alias of `kok`. A router built on `Intl.Locale` would therefore see `kok` where the page says `gom`. That is why `sameLanguage()` bridges the two in the library's own matching, and why every CSS rule that follows the script names both `:lang(gom)` and `:lang(kok)`. `gom` stays on the pages because it is the Goan, IANA-registered tag; whether the pages should say `kok` instead is the owner's call, and nothing here would have to change if it were. What the library never does is cross a script: `gom-Latn` never falls back to Devanagari strings, and bare `gom` or `kok` is read as Devanagari (the official script) and nothing else.

The tag goes on `<html lang>` and, for text in another language, on that element (`<a lang="gom-Deva">कोंकणी</a>`). Screen readers differ in what they do with a tag they have no voice for: most fall back to the page's default voice, some to a Hindi or Marathi voice for Devanagari. The tag is still right and is what translation tools and search read. Whether a given reader pronounces Konkani well is for a native listener to judge and is listed as a known limit, not promised.

## How a site offers languages

**One URL per language.** Each language is a real page with its own address, so it works with no JavaScript, can be linked to, cached and indexed, and a screen reader lands on a page that declares its own language. There is no client-side swap of the page's text.

**The alternates are declared in the head** on every page, each page listing all of them including itself:

```html
<link rel="alternate" hreflang="en-IN" href="https://example.in/">
<link rel="alternate" hreflang="gom-Deva" href="https://example.in/gom-deva/">
<link rel="alternate" hreflang="gom-Latn" href="https://example.in/gom-latn/">
<link rel="alternate" hreflang="x-default" href="https://example.in/">
```

`x-default` is the page for a visitor whose language none of these match: the default language's page. Hrefs are absolute, since that is what search engines require of hreflang.

**The URL scheme** is a path prefix with the tag in lower case: `/` for the default language and `/gom-deva/`, `/gom-latn/` before the same path. Lower case because paths are case sensitive and nobody types `gom-Deva` twice the same way. A site with files instead of folders can use the suffix scheme (`page.gom-Deva.html`); `urlFor()` in the core makes both, and the component demo uses the suffix scheme because it is served from plain files.

**The switcher is links.** `<sg-lang>` wraps a `<nav>` of `<a href hreflang lang>` with `aria-current="page"` on the page you are on. It is not a `<select>` and not a JS toggle, because choosing a language is navigation. Each language is named in its own script and nothing else, because someone who cannot read the current language must still find theirs. The nav's label ("Language") is written in the page's language.

**Choosing is optional to remember and never automatic.** With the `remember` attribute the component stores the last language clicked, in `localStorage` (a try/catch, and nothing when storage is blocked). It never redirects, because an automatic redirect breaks the back button, breaks shared links and misleads search engines. It only exposes the remembered tag (`data-remembered` on that link, and `element.remembered`) so the page can show its own "continue in कोंकणी" line, which is the rung 8 banner's job. `matchLanguage(navigator.languages, available)` does the same for the browser's language list, for the same use. No cookie, no server read of `Accept-Language`, nothing sent anywhere.

## The library's own words

Components already keep their English in an exported `STRINGS` object (126 modules do). The mechanism that translates them is the smallest that fits that shape:

1. **`packages/core/strings.js`**, pure, no DOM at import:
   - `langOf(el)`: the nearest ancestor's `lang`, then the root's, then `en`.
   - `chain(tag)`: the lookup order for a tag, never crossing a script (`gom-Deva` then `kok-Deva` then `en`; `gom-Latn` then `kok-Latn` then `en`).
   - `strings(byLang, tag)`: the table for a tag, built by laying the chain's tables over each other with English at the bottom. A missing Konkani key is therefore English, never a blank or the word `undefined`.
   - `t(table, key, ...args)`: a string, or the result of a function entry (for plurals and names), as the existing `STRINGS` already do.
2. **The shared strings** live in `packages/core/strings.table.js`, keyed by language: the words several components need (close, dismiss, menu, main navigation, language, copy and copied, previous and next, loading). A component core imports `strings` and keeps its own `STRINGS` as the English table, adding a `gom-Deva` and `gom-Latn` table beside it when someone writes them.
3. **Konkani entries are flagged, and ship as a flagged draft.** The table's file exports `REVIEWED`, the set of `'<tag>:<key>'` a native reader has checked. A key not in it is unreviewed. `node tools/strings-review.mjs` prints, per language, how many keys are unchecked and which, and any English key with no Konkani draft yet; it only warns (`--strict` exits 1 for a release that wants to wait), and `npm run check` prints it. A test holds the invariants: every Konkani key has an English key, and every reviewed key is written. What a visitor gets in the meantime is the draft, so a page that offers Konkani should say so (the demo pages carry a note), and the owner decides whether a release waits for a reader to sign keys into `REVIEWED`.

The element reads `langOf(this)` when it renders. A page that changes `lang` without navigating (a single-page app) can call `update()`; sites made of pages do not need to.

Existing components are not rewired here. Their `STRINGS` stay as they are until each is given Konkani tables, one at a time, with Kathakar and a native reader.

## Type follows script

The faces are already split by `unicode-range` in `fonts.css`, so a page downloads Mukta's Devanagari only when it shows Devanagari, and the font stacks already carry Tiro Devanagari Marathi and Noto fallbacks. The font choice therefore follows the glyphs, not `lang`; `:lang()` does the rest, which is spacing:

- **Leading.** Devanagari carries matras above and below the line, and needs more room than Latin. `tokens.css` already raised the leading for `:lang(kok)`; `gom` is added to that list, and `:lang(gom-Latn)` joins `:lang(kok-Latn)` so Romi Konkani keeps Latin leading.
- **Latin inside a Devanagari page.** Leading is set per language, not inherited downward from the page: `:lang(en)` (which covers `en-IN`), `:lang(gom-Latn)` and `:lang(kok-Latn)` carry the Latin values, so an English name or price on a Konkani page sits at Latin leading and not at the page's.
- **No tracking, no case.** Letter-spacing breaks Devanagari conjuncts apart and upper-casing means nothing in it. Component CSS that tracks capitals (the playful register's labels) must switch both off for `:lang(gom-Deva)`; `<sg-lang>` does so. A sweep of the other components' labels is listed for the Sutradhar rather than done here.

## What this does not do

- Right-to-left layouts. None of these scripts needs it.
- Dates, numbers and currency by language. `Intl` does this and the lakh and crore work is separate.
- Machine translation. Konkani strings are written by a person and checked by a native reader.
- The announcement banner, offline use and the DPDP notice (rung 8).

## Follows from this

`npx susegad create` makes pages in the prefix scheme with `hreflangLinks()` in the head and `<sg-lang>` in the header, and ships the Konkani tables as marked placeholders until the native reader has signed them.
