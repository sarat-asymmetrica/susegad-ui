# Language switcher

*For a site that offers its pages in more than one language: an event, a government service, a homestay with guests from other places.*

A row of links, one per language, each named in its own script. Each link goes to a real page in that language, so the switcher works with no JavaScript, for search, and for a screen reader.

```html
<head>
  <link rel="alternate" hreflang="en-IN" href="https://example.in/">
  <link rel="alternate" hreflang="gom-Deva" href="https://example.in/gom-deva/">
  <link rel="alternate" hreflang="gom-Latn" href="https://example.in/gom-latn/">
  <link rel="alternate" hreflang="x-default" href="https://example.in/">
  <link rel="stylesheet" href="susegad/components/lang/lang.css">
  <script type="module" src="susegad/components/lang/lang.js"></script>
</head>
<html lang="en-IN">
<sg-lang>
  <nav aria-label="Language">
    <ul>
      <li><a href="/" hreflang="en-IN" lang="en-IN" aria-current="page">English</a></li>
      <li><a href="/gom-deva/" hreflang="gom-Deva" lang="gom-Deva">कोंकणी</a></li>
      <li><a href="/gom-latn/" hreflang="gom-Latn" lang="gom-Latn">Konknni</a></li>
    </ul>
  </nav>
</sg-lang>
```

## The prompt

Make a language switcher web component for a site with one page per language: English (en-IN), Konkani in Devanagari (gom-Deva) and Konkani in Romi (gom-Latn). It is a named `<nav>` holding a list of ordinary links, not a select and not a script toggle, because choosing a language is going to another page. Each link carries `hreflang` and a `lang` with the same tag, so a screen reader pronounces the name in its language, and each language is named only in its own script (English, कोंकणी, Konknni). The page you are on is `aria-current="page"`. The nav's label ("Language") is written in the page's language. With JavaScript, fill in what the markup leaves out: the label, each link's `lang`, an empty link's name, and `aria-current` from `<html lang>`. An optional `remember` attribute keeps the last language clicked in localStorage and marks that link `data-remembered` when it is not this page, with a visually hidden "Last chosen" beside the dot for a screen reader; it never redirects. Treat `gom` and `kok` as one language and never fall back from one script to the other. Give it three registers. Quiet: plain names with a hairline between, the current one underlined. Warm: the names in the hand, with a two-pass pencil line under the current one fitted to its width. Playful: stamped tabs, each at its own slight angle, the current one inked solid. Under every register, Devanagari gets no letter-spacing and no capitals, and a link is at least 44 px tall.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| one page per language | native first | Each link is a real address. Nothing is swapped in the page, so search, sharing and the back button work. |
| `hreflang` and a `lang` with the same tag | accessibility | `hreflangLinks(alternates)` and `hreflangHtml()` make the head's alternates and `x-default`; the link's `lang` tells a screen reader which voice to use. |
| named only in its own script | pure core | `labelFor(tag)`: English, कोंकणी, Konknni. |
| gom and kok as one language, never across a script | pure core | `currentIndex(tags, pageLang)` and `chain(tag)` in `core/strings.js`: Romi never reads Devanagari strings. |
| the label in the page's language | strings | `strings(BY_LANG, langOf(el))` from `core/strings.js` and `core/strings.table.js`. A missing Konkani key is English. |
| remember … never redirects | storage | `localStorage` in a try/catch; `data-remembered` on the link; the page decides what to show. |
| a two-pass pencil line | noise | `pencilLine(w, seed)`, refitted by a ResizeObserver. |
| stamped tabs at slight angles | seeded tilt | `tabTilt(seed, i)`, 0.5 to 2 degrees, as `--sg-lang-tilt`. |
| no letter-spacing and no capitals for Devanagari | type | A `:lang()` rule on the link, since tracking pulls conjuncts apart. |

## Accessibility

- A named `<nav>`; the current language is `aria-current`, not only a colour.
- `lang` on each link, so a name is read in its own language. Whether a given screen reader has a Konkani voice is its own matter; the tag is right either way.
- Links are at least 44 px tall and wrap on a narrow screen; nothing is clipped at 320 px.
- Forced colours: the current language keeps an underline (quiet), the pencil line (warm) or a double border with an underline (playful), since the accent fill is stripped.
- Two switchers on one page need different `aria-label`s.
