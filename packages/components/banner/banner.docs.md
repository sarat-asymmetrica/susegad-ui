# Banner

`<sg-banner>` is a line of news across the top of a page: closed for the monsoon, doors open at half past nine. A visitor can send it away with a cross, and it stays away on that browser. It is announced to a screen reader once per visit, it can carry an end date after which it shows nothing, and it still reads and dismisses when the browser keeps nothing. Its words are ordinary text on the page, so they can also be read in browse mode.

## Use

```html
<link rel="stylesheet" href="susegad/components/banner/banner.css">
<script type="module" src="susegad/components/banner/banner.js"></script>

<sg-banner id="monsoon" until="2027-09-30">
  Closed for the monsoon, back <time datetime="2027-10-01"></time>.
</sg-banner>
```

The words are yours and sit inside the element, so the page reads without any script. Put the banner first in `<body>` after the skip link, above the header. Use one at a time; a second is a different banner for a different reason, and a burst of announcements is read as the last one.

An empty `<time datetime="…">` is filled with the date in words, read in IST, in the language of the page: "1 October", or "1 ऑक्टोबर" on a Konkani page. A `<time>` that already has text is left alone. The `back` attribute does the same for the common case:

```html
<sg-banner id="shop" until="2027-09-30" back="2027-10-01">Closed for the monsoon.</sg-banner>
<!-- English: "Closed for the monsoon. Back 1 October"; Romi: "… 1 Otubr porot" -->
```

From a script:

```js
const banner = document.querySelector('sg-banner');
banner.addEventListener('sg-banner-dismiss', e => console.log(e.detail)); // { id, reason: 'user' | 'api', remembered }
await banner.dismiss();   // as if the cross were pressed; resolves to whether the browser kept it
banner.reset();           // forget the dismissal and show it again (a "show announcements" setting)
```

## Attributes

| Attribute | Values | What it does |
|---|---|---|
| `id` | text | Names the banner in the browser's memory (`sg-banner:<id>`). With an id, editing the words keeps a dismissal; without one, the key comes from the words, so a banner whose words change shows again. |
| `until` | `2027-09-30` or `2027-09-30T18:00` | Read in IST. A date alone means through the end of that day; with a time, until that moment. After it the banner shows nothing, is not announced, and takes no room. Absent or not a date: it never expires. |
| `back` | `2027-10-01` | Adds the line "Back 1 October" after the words, in the page's language. |
| `label` | text | The region's name for assistive technology. Default "Announcement" (or its Konkani). |
| `register` | `quiet`, `warm`, `playful` | Inherited from the page by default. |

## Registers

| | Look | Motion |
|---|---|---|
| quiet | a plain strip with one hairline under it | fades out in 120 ms when dismissed |
| warm | a sheet of paper with a pencil rule ruled under it, drawn a little differently for each banner | the rule is drawn in two strokes when the banner arrives; the strip folds away in 200 ms |
| playful | bunting strung along the bottom edge, small paper flags in the palette's colours | the flags drop in one after another and swing once; the strip folds away in 200 ms |

Under reduced motion every register shows the finished strip, and a dismissal is instant. In forced colours the decoration is dropped, the room it reserved goes with it, and the strip gets a plain border.

## What it remembers

A dismissal is one `localStorage` key per banner, `sg-banner:<id>`, holding the time it was dismissed. Every read and write is wrapped, because storage can be missing (a private window, blocked site data, a sandboxed frame) or full. With no storage the banner shows on every visit, a dismissal lasts for the life of the page, and `dismiss()` resolves to `false` so the page can say so. Nothing leaves the visitor's browser.

An expired banner beats a dismissed one, and a banner that arrives already dismissed or out of date says nothing aloud.

## Words

The label, the cross's name, the announcement and the "Back" line are in `banner.strings.js`, in English and in Konkani (Devanagari and Romi). The Konkani is a draft for a native reader. The language is the nearest `lang` above the banner.

## Accessibility

- The banner is a named region ("Announcement"). The cross is a native button named "Dismiss this announcement"; it shows a cross only, and the name says what it dismisses, so two banners are not both "Dismiss".
- The announcement is made through `announce()` **once per visit**, not once per page: the first page that shows the banner says "Announcement: Closed for the monsoon, back 1 October.", and the pages a visitor opens after it in the same tab do not. This is remembered in `sessionStorage` (every read and write wrapped), so closing the tab or opening a new one starts a new visit. With no session storage there is no memory and it is said on each page load. The banner is not a live region, so it is not read twice on one page, and its words are ordinary text in the page, so a screen-reader user can always read them in browse mode.
- **Without script** the banner is only its words: there is no cross, `until` is not read, and an expired banner stays on the page. Dismissal and the end date both need JavaScript. A site that must not show an expired banner to a browser with no script removes it from its pages when the date has passed.
- When the banner goes while focus is in it, focus moves to the next thing a person could focus on the page; if there is none, to the page's `<main>` (given `tabindex="-1"` if it has none), never to nowhere.
- The cross is 44 by 44 px and answers a press in every register (`docs/contributing/touch-contract.md`).
- The decoration (the rule, the bunting) is `aria-hidden` and sits in room the strip reserves for it, so it never covers the words.
- The dates in words are `<time datetime>` elements, so the machine-readable date stays beside the words.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The cross is an SVG set `aria-hidden="true"` inside a button that carries the name, and the rule and the bunting are `aria-hidden`: `packages/components/banner/banner.check.mjs`, "every banner is a named region with a named cross" and "the decoration is hidden from assistive technology". |
| 1.3.1 Info and relationships | Meets | The banner is a `role="region"` with a name, and each date is a `<time datetime>`: `packages/components/banner/banner.check.mjs`, "every banner is a named region with a named cross" and "each <time> keeps its datetime beside its words". |
| 1.4.1 Use of color | Meets | The banner says what it says in words; no colour carries meaning, and the cross is a shape. The playful flags are decoration and `aria-hidden`: `packages/components/banner/banner.check.mjs`, "the decoration is hidden from assistive technology". |
| 1.4.3 Contrast (minimum) | Meets | Manual test, 2026-10-08 (throwaway Playwright script, the demo, painted colours read in the browser): message text on the strip is 13.57:1 and 12.71:1 in quiet (light, dark), 11.36:1 and 15.27:1 in warm, 12.48:1 and 9.41:1 in playful; the cross is 5.92:1 or more in every register and theme. Axe, 0 violations: `packages/components/banner/banner.check.mjs`, "axe, <theme>, <register>: 0 violations". |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-08: the demo at 320 px with the root font size at 200 percent, three registers: page width 320 and no banner text clipped (throwaway Playwright script). Sizes are `rem`, `em` and tokens: `packages/components/banner/banner.css`. |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-08: the demo at 320 CSS px, three registers: page width 320, every banner inside the screen. `packages/components/banner/banner.check.mjs`, "<register>: no sideways scroll at 390 px". |
| 1.4.11 Non-text contrast | Meets | The cross is `--sg-text-soft`, 5.92:1 or more on the strip in every register and theme (the 1.4.3 row), and its focus ring is `--sg-focus`: `packages/tokens/tokens.test.js`, "focus ring and control borders are 3:1 or more on every surface". |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-08: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em) injected on the demo at 320 px, three registers: every banner's last line ends above the strip's lower edge (554 of 570 px for the first quiet banner) and the bunting and the rule stay below the words (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | The cross is a native button: `packages/components/banner/banner.check.mjs`, "Enter on the cross dismisses it and focus moves on to the next thing on the page" and "Space works too". |
| 2.1.2 No keyboard trap | Meets | Nothing takes focus by itself and Tab passes through: `packages/components/banner/banner.check.mjs`, "Tab reaches the cross first"; dismissing with the keyboard moves focus on. |
| 2.2.2 Pause, stop, hide | Meets | The only motion is a single arrival of at most 0.8 s and a 200 ms exit; nothing repeats. The banner can be hidden with the cross. `packages/components/banner/banner.check.mjs`, "reduced motion: no animation runs on arrival" and "playful: the strip folds away over several frames". |
| 2.3.1 Three flashes or below threshold | Meets | Nothing flashes: the flags move once, through a swing of a few degrees (`packages/components/banner/skins/playful.js`), and the strip fades or folds. |
| 2.4.3 Focus order | Meets | The banner sits where the author puts it (first in the page, after the skip link) and has one control. When it goes with focus inside, focus moves to the next focusable thing after it: `packages/components/banner/banner.check.mjs`, "Enter on the cross dismisses it and focus moves on to the next thing on the page". |
| 2.4.7 Focus visible | Meets | `packages/components/banner/banner.css` draws the token focus outline on the cross and on links in the words; `tools/touch.check.mjs` requires a focus style. |
| 2.4.11 Focus not obscured (minimum) | Meets | The banner is in the flow of the page and is never fixed or sticky (`packages/components/banner/banner.css` sets no `position: fixed` or `sticky`), so it cannot cover another control. |
| 2.5.3 Label in name | Meets | The cross shows no text, so there is no visible label to match; its name, "Dismiss this announcement", says what it does: `packages/components/banner/banner.check.mjs`, "every banner is a named region with a named cross". |
| 2.5.8 Target size (minimum) | Meets | `packages/components/banner/banner.check.mjs`, "<register>: the cross is a thumb's size": 44 by 44 px in every register at 390 px. |
| 4.1.2 Name, role, value | Meets | A named region and a native button with a name: `packages/components/banner/banner.check.mjs`, "every banner is a named region with a named cross". Axe, 0 violations, with a cross focused: "axe, <theme>, with a cross focused: 0 violations". |
| 4.1.3 Status messages | Meets | The announcement is made through `announce()` once per visit: `packages/components/banner/banner.check.mjs`, "ariaNotify: said once, with the label and the words", "a second page of the same visit does not say it again" and "no ariaNotify: one polite live region says it once"; a banner that arrives dismissed or out of date says nothing ("a banner that arrives already dismissed says nothing", "gone at midnight in Panjim, and silent"). |

**The page author owns:**

- The words, in the language of the page, short and specific, with a date rather than "tonight" or "today" so that a banner cannot outlive its night. `lang` on a banner in another language (3.1.2).
- An `until` date on a banner that is about a day or a season, so it ends by itself.
- Where the banner sits: first on the page, after the skip link, and not fixed or sticky over other controls (2.4.11).
- Links inside the words: meaningful text, not "click here" (2.4.4).

## Checks

`node --test packages/components/banner/banner.test.js` covers the pure core: `until` read in IST (also with the machine in New York, London and Auckland), the phases, the storage key, storage that is missing, blocked or full, the dates in words in English and in both Konkani scripts, the announcement and the shapes of the rule and the bunting. `node packages/components/banner/banner.check.mjs` checks the behaviour in a browser: the markup, a dismissal that survives a reload, storage that throws, the announcement said once through both paths, `until` at the minute it turns over in three zones, focus after a dismissal, the three registers, reduced motion and axe.
