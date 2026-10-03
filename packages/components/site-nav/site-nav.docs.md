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
