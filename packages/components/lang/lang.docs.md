# Language switcher

`<sg-lang>` is a row of links, one per language of a site. Each link goes to a real page in its own language. It needs no JavaScript. The design is in `docs/decisions/0025-languages.md`.

## Markup

| Element | What it is |
|---|---|
| `<nav aria-label>` | required; write the label in the page's language |
| `<ul><li><a>` | one link per language, the page's own included |
| `a[hreflang]` | the language of the page it goes to, as a BCP 47 tag: `en-IN`, `gom-Deva`, `gom-Latn` |
| `a[lang]` | the same tag, so the name is read in its own language |
| `a[aria-current="page"]` | the page you are on |
| link text | the language in its own script: English, कोंकणी, Konknni |

Write all of this on the server. With JavaScript the element fills in what is missing (the nav's label, each link's `lang`, an empty link's name, the current link) and never changes what is there.

## The three pages

A site with the language in the path:

| Language | Tag | Address |
|---|---|---|
| English | `en-IN` | `/events/` |
| Konkani, Devanagari | `gom-Deva` | `/gom-deva/events/` |
| Konkani, Romi | `gom-Latn` | `/gom-latn/events/` |

Each page sets `<html lang>` to its own tag and lists all the alternates in its head, itself included, with `x-default` for the page a visitor gets when none of the languages match theirs:

```js
import { hreflangHtml, urlFor } from './lang.core.js';
const alternates = ['en-IN', 'gom-Deva', 'gom-Latn'].map(lang => ({ lang, href: 'https://example.in' + urlFor('/events/', lang) }));
hreflangHtml(alternates, { xDefault: 'en-IN' });   // four <link> lines for the head
```

`urlFor(path, lang, { scheme })` makes `/gom-deva/events/` (prefix, the default) or `events.gom-Deva.html` (suffix, for plain files). `hreflangLinks()` gives the same links as data. Addresses in hreflang should be absolute; the demo pages use root-relative ones because they are served from files, and the check fetches each with HEAD, which is a demo convenience.

## Attributes

| Attribute | |
|---|---|
| `register` | `quiet`, `warm` or `playful`; read from the page when absent |
| `remember` | keep the last language clicked in `localStorage`; the link for it carries `data-remembered` when it is not this page, and `element.remembered` returns the tag. The dot is only a picture, so the link also carries a visually hidden "Last chosen" (`.sg-lang-last`) for a screen reader. It never redirects. Show your own "continue in कोंकणी" line from it if you want one. |

## Registers

| | Look |
|---|---|
| quiet | plain names with a hairline between; the current one underlined |
| warm | names in the hand; a pencil line under the current one |
| playful | stamped tabs at slight angles; the current tab inked in the accent colour |

Nothing moves in any register. A press answers in every one (the touch contract).

## Type

Each link has its own `lang`, so Devanagari gets the Devanagari leading (1.45 for snug) even in an English page, and English inside a Devanagari page gets Latin leading (1.3), because the tokens set leading per language and `:lang(en)` is one of them. Letter-spacing and capitals are switched off for Indic scripts; Romi Konkani keeps them. The faces (Mukta, Kalam, Tiro Devanagari Marathi) follow the glyphs through `unicode-range` in `fonts.css`, so a page that shows no Devanagari downloads none. The switcher itself shows the Konkani name, so every page that carries it downloads Mukta's Devanagari face.

## Strings

The library's own words follow `lang` through `core/strings.js`. `strings(BY_LANG, langOf(el))` gives the table for the nearest `lang`, English underneath, so a word with no Konkani yet shows in English. The shared words are in `core/strings.table.js`. The Konkani entries there are a first draft by a writer who is not a native reader, so each one ships flagged until a native reader signs it into `REVIEWED`. `node tools/strings-review.mjs` lists what is still unchecked and any English key with no Konkani draft (it only warns; `--strict` exits 1), and `npm run check` prints it.

## Accessibility

- A named nav, a current language in `aria-current="page"`, `lang` on every link. Two switchers on one page (a header and a footer) need different `aria-label`s, since landmarks must be unique.
- 44 px targets that wrap; no sideways scroll at 320 px.
- Forced colours: the current language keeps an underline in quiet, the pencil line (`LinkText`) in warm, and a double border with an underline in playful, whose accent fill is stripped.
- A screen reader may have no Konkani voice. The tag is correct, and that is what translation tools and search read.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The names are text, each in its own script. The one picture, the "last chosen" dot, is only a picture: the link carries a visually hidden "Last chosen" for a screen reader (`packages/components/lang/lang.check.mjs`: "remember: nothing before a click; after one the other link is marked (and says \"Last chosen\" to a screen reader, visually hidden) ..."). |
| 1.3.1 Info and relationships | Meets | A named `<nav>` holding a list of links, with `aria-current="page"` on the current one. `lang.check.mjs`: "<tag>: three switchers, each link has lang = hreflang and a name, exactly one aria-current and it is this page", with a control that fails it ("links with no lang, hreflang or aria-current fail the shape test"), and "a bare switcher: the label is in the page language, empty links get their own-script names and lang, aria-current comes from <html lang>". |
| 1.4.1 Use of color | Meets | The current language is told from the others by more than colour: an underline in quiet, a pencil line in warm, an inked tab in playful, and `aria-current` for assistive technology. `lang.check.mjs`: "<register>, forced colours (its own skin mounted): the current language differs from the others by more than colour", with a control that removes the mark and sees it fail. |
| 1.4.3 Contrast (minimum) | Meets | `lang.check.mjs`: "axe, <tag>, <theme>, all three registers: 0 violations" on all three pages, light and dark, and with a switcher link focused; text roles are tested at 4.5:1 on every surface in `packages/tokens/tokens.test.js`. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07 (throwaway Playwright script): all three demo pages (English, Konkani in Devanagari, Konkani in Romi) in quiet, warm and playful, with the root font size at 200 percent at 1280 px wide, and at 320 px wide (plain, and with the WCAG text-spacing values injected: line height 1.5, letter 0.12em, word 0.16em, paragraph 2em); the page was never wider than the screen (document scroll width minus window width was 0 in every case) and no box that hides its overflow had text running out of it. The clipping probe is coarse (it only sees boxes with `overflow: hidden`). |
| 1.4.10 Reflow | Meets | `lang.check.mjs`: "<width> px: no sideways scroll, every language link at least 44 px tall, no link text clipped", and "<width> px: no layout shift on any page". Manual test, 2026-10-07: all three pages at 320 px in three registers, document scroll width 320 (see 1.4.4). |
| 1.4.11 Non-text contrast | Meets | The marks that tell the current language (underline, pencil line, tab fill) are the text colour or the accent in the tested pairs: the focus ring is `--sg-focus` and rules are `--sg-rule-strong`, tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07 (throwaway Playwright script): all three demo pages in quiet, warm and playful, with the root font size at 200 percent at 1280 px wide, and at 320 px wide (plain, and with the WCAG text-spacing values injected: line height 1.5, letter 0.12em, word 0.16em, paragraph 2em); the page was never wider than the screen (document scroll width minus window width was 0 in every case) and no box that hides its overflow had text running out of it. The clipping probe is coarse (it only sees boxes with `overflow: hidden`). |
| 2.1.1 Keyboard | Meets | `lang.check.mjs`: "<with or without> JavaScript: Tab to कोंकणी and Enter gives <html lang=...>; Tab to Konknni and Enter gives ...". The links are native `<a href>`. |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07: `packages/components/lang/lang.js` and its skins bind no key handler, set no `tabindex` and call no `focus()`; the switcher is native links, so Tab and Shift+Tab pass through. |
| 2.4.3 Focus order | Meets | Manual test, 2026-10-07 (throwaway Playwright script): the three demo pages at 390 px in quiet, warm and playful, Tab pressed through every stop (11 stops in each register, three switchers per page); each focused control was on screen and not covered (the element at its centre is the control itself) and every stop came after the previous one in document order. The same script on a page with a full-screen fixed layer added reported every stop covered, so it can fail. The order is the order of the links in the list, which is the order the author wrote. |
| 2.4.4 Link purpose (in context) | Meets | Each link is the language's own name ("English", "कोंकणी", "Konknni") with `lang` and `hreflang`, inside a nav named by the author. `lang.check.mjs`: "each language is named in its own script". A language name in its own script is the purpose of the link. |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the links in each register and requires a focus style; `lang.check.mjs`: "axe, <tag>, <theme>, with a switcher link focused: 0 violations". |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | `packages/components/lang/lang.css` has no `position: fixed` or `sticky`, so the component never covers a focused link itself. Manual test, 2026-10-07 (throwaway Playwright script): the three demo pages at 390 px in three registers, every Tab stop was on screen and not covered; the same script with a full-screen fixed layer added reported every stop covered, so it can fail. A sticky header the page adds can still cover a link. |
| 2.5.3 Label in name | Meets | A link is named by its own visible text; where the markup leaves a link empty the element fills in the language's name in its own script (`lang.check.mjs`: "a bare switcher: ... empty links get their own-script names and lang"). The hidden "Last chosen" is added after the visible name, so the visible text is still contained in the name. |
| 2.5.8 Target size (minimum) | Meets | `lang.check.mjs`: "<width> px: no sideways scroll, every language link at least 44 px tall, no link text clipped". |
| 3.1.2 Language of parts | Meets | Every link carries `lang` equal to its `hreflang`, so each name is read in its own language, and the "Last chosen" word carries `lang="en"` on a Konkani page because the table has no Konkani for it yet (`lang.check.mjs`: "on a gom-Latn page the English \"Last chosen\" carries lang=\"en\", not the page lang"). |
| 4.1.2 Name, role, value | Meets | Native links in a named nav, `aria-current` for the current one. `lang.check.mjs`: axe with 0 violations in all three registers, light and dark, with a link focused, and "axe without JavaScript, <tag> at 390 px: 0 violations". |

**The page author owns:**

- The nav's `aria-label`, in the page's language, and a different one for each switcher on a page (landmarks must be unique).
- A real page in each language behind each link, with `<html lang>` set to its own tag, and the hreflang links in its head (`hreflangHtml`).
- Translation of the page itself: the switcher only links to it. The Konkani words in `packages/core/strings.table.js` are a draft until a native reader checks them.
- A sticky header or banner that could cover a link when it takes focus (2.4.11).
