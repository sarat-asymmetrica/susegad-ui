# Site nav

`<sg-site-nav>` is a site header: a brand link and the page links, in a native `<details>` that is a Menu button on narrow screens and a row of links on wide ones. It needs no JavaScript.

## Markup

| Element | What it is |
|---|---|
| `<nav aria-label>` | required |
| `a.sg-site-nav-home` | optional brand link |
| `details.sg-site-nav-menu` with `<summary>` | the disclosure; the summary's words are the menu button's |
| `<ul>` of `<li><a>` | the page links; mark the current one `aria-current="page"` |

Mark the current page on the server (in Astro: compare `Astro.url.pathname`). If none is marked, the element marks one from `location.pathname` with `current()` from `site-nav.core.js`, which a build step can call too.

## Behaviour

| Width of the element | Without JavaScript | With JavaScript |
|---|---|---|
| under 40rem | Menu button (the summary); press to show the links | the same, and Escape closes the open menu |
| 40rem and over | a row of links, summary hidden (`::details-content`) | the same; where `::details-content` is missing, the element opens the disclosure and hides the summary |

Without JavaScript in a browser that lacks `::details-content`, the Menu button stays on wide screens too. No link is ever hidden without a way to it.

## Registers

| | Look |
|---|---|
| quiet | plain links over a hairline rule; the current page underlined |
| warm | links in the hand over a pencil rule; a pencil line under the current page |
| playful | stamped tabs at slight angles; the current tab inked in the accent colour |

Nothing moves in any register.

## The Wave 5 seam

The `<summary>` is the only part that a drawer would replace. With `<sg-drawer>` on the page, swap the summary's disclosure for `<a href="/menu/" data-sg-drawer="site-menu">Menu</a>` (a real page without JavaScript) and move the `<ul>` into the drawer. The marking of the current page and the registers don't depend on the disclosure.

## Accessibility

- A named nav, a current page in `aria-current`, 44 px targets.
- The narrow menu is a disclosure, not a dialog: focus isn't trapped and the page behind stays usable.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The only drawing is the warm pencil line under the current link, an SVG set `aria-hidden="true"`: `packages/components/site-nav/site-nav.check.mjs`, "warm: a two-pass pencil line sits under the current link, inside its width, aria-hidden". The links and the Menu button are text. |
| 1.3.1 Info and relationships | Meets | A native `<nav>` with a label, a `<ul>` of links and, narrow, a `<details>` and `<summary>` disclosure. `site-nav.check.mjs` finds every link on screen or one press of Menu away with JavaScript off, at 1280 and 390 px ("no JavaScript at <width> px: every link on screen or one press away"), and exactly one `aria-current` per nav. |
| 1.4.1 Use of color | Meets | The current page is set by `aria-current` and shown by weight and a thick underline in quiet, a pencil line in warm and a bordered chip in playful, never by colour alone: `packages/components/site-nav/site-nav.css`, `a[aria-current]` rules; `site-nav.check.mjs`, "each nav has exactly one aria-current" and the warm pencil check. |
| 1.4.3 Contrast (minimum) | Meets | Link text is the token text roles: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: every text role on every surface is 4.5:1 or more"). axe, 0 violations: `site-nav.check.mjs`, "axe, <theme>, all three registers" for light and dark, and "axe without JavaScript" (at 1280 and 390 px). |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent in a 320 px wide window (stricter than 200 percent alone), three registers, page width 320, nothing clipped (throwaway Playwright script). Sizes are in `rem` with `min-height: 2.75rem`: `packages/components/site-nav/site-nav.css`. |
| 1.4.10 Reflow | Meets | `site-nav.check.mjs`: "at 390 px the page does not scroll sideways". Manual test, 2026-10-07: the demo at 320 CSS px, three registers, page width 320 (throwaway Playwright script). Below 40rem the links fold into the Menu disclosure instead of running off the side. |
| 1.4.11 Non-text contrast | Meets | The focus ring is `--sg-focus`, and the current-page underline, pencil line and playful chip border are `--sg-text`: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: focus ring and control borders are 3:1 or more on every surface"). |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, page width 320 with no sideways scroll (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | Every link and the Menu summary are native and take Tab, Enter and Space as any link or disclosure does. `site-nav.check.mjs`, "narrow: Tab goes into the open menu; Escape closes it and focus returns to Menu". |
| 2.1.2 No keyboard trap | Meets | The narrow menu is a disclosure, not a dialog: focus is not trapped and the page behind stays usable. `site-nav.check.mjs`: Tab goes into the open menu, Escape closes it and focus returns to the summary. |
| 2.4.3 Focus order | Meets | The links and Menu button are in document order, and a menu that opens inline puts its links right after the Menu button: `site-nav.check.mjs`, "Tab goes into the open menu" finds `Home`, the first link, as the next stop. |
| 2.4.4 Link purpose (in context) | Meets with author's part | The links are the author's own `<a>` and their text; the component adds none (`packages/components/site-nav/site-nav.js`). The words must say where each goes. |
| 2.4.7 Focus visible | Meets | `packages/components/site-nav/site-nav.css` sets a `:focus-visible` outline in the token focus colour on the summary and the links; `tools/touch.check.mjs` Tabs onto the first focusable control in the component, in the quiet register, and requires an outline, ring or style change. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/site-nav/site-nav.css` uses no `position: fixed` or `sticky`, and the narrow menu opens inline, not over the page. A navigation that the page makes sticky, or a banner or toast it adds, can cover the content that scrolls under it when it takes focus. |
| 2.5.3 Label in name | Meets | The accessible name of each link is its visible text, and the Menu button's is its visible text; `packages/components/site-nav/site-nav.js` adds an `aria-label` only to the `<nav>` itself and none to a link or the Menu button. |
| 2.5.8 Target size (minimum) | Meets | `site-nav.check.mjs`: "every visible link is at least 24 px tall" and "Menu buttons are at least 24 px tall". Manual test, 2026-10-07: the smallest link on the demo is 149 by 38.9 px and the Menu button 104.5 by 46 px, in all three registers (throwaway Playwright script, 1280 px). |
| 4.1.2 Name, role, value | Meets | A named `<nav>` landmark (the element adds an English `aria-label` only when the page gave none), the current page in `aria-current`, a native disclosure whose open state is the browser's. axe, 0 violations in every register, light and dark, with JavaScript off, at 1280 and 390 px (`site-nav.check.mjs`). |

**The page author owns:**

- The link text, in the language of the page, and `lang` on a link in another language (3.1.2).
- The navigation's label: the element adds the English default when the `<nav>` has none, so on a page in another language give it one.
- Marking the current page with `aria-current="page"` on the server where the address cannot say it (the element marks it from the address only when the page did not).
- Making the navigation sticky, if wanted, without covering the focused control (2.4.11), and keeping it the same on every page (3.2.3, 3.2.4).
