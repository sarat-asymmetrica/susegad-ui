# Tabs

`<sg-tabs>` turns a table of contents into the ARIA APG tabs pattern.

## Markup

```html
<sg-tabs>
  <nav aria-label="Room details">
    <ul>
      <li><a href="#overview">Overview</a></li>
      <li><a href="#amenities">Amenities</a></li>
    </ul>
  </nav>
  <section id="overview"><h2>Overview</h2>…</section>
  <section id="amenities"><h2>Amenities</h2>…</section>
</sg-tabs>
```

- The `<nav><ul>` list of links and the `<section id>`s it points to are the whole component without JavaScript: every section shows, and each link jumps to its heading. Give the `<nav>` (or the `<ul>` itself) an `aria-label`, or pass `label` on `<sg-tabs>`.
- Each link's `href` must be a `#fragment` matching a section's `id`. Sections are looked up inside `<sg-tabs>` first, then in the whole document.
- Give exactly one `<ul>` (or `<ol>`) inside `<sg-tabs>`; its direct `<li><a>` children become the tabs.

## Behaviour

With JavaScript, `tabs.js` enhances the list into a tablist (`role="tablist"` / `role="tab"` / `role="tabpanel"`) and hides every panel but the selected one. Activation is automatic: the arrow keys move focus and select together (Left/Right; wrapping at the ends), Home and End jump to the first and last tab. A plain click also selects; a click with a modifier key, or a middle/right click, is left alone so "open in a new tab" keeps working. The starting tab is the one matching `location.hash`, then the one marked `aria-current`, then the first.

## Attributes and members

| | |
|---|---|
| `label` | The tablist's accessible name, when the markup gives it none of its own. |
| `select(index, { focus = false })` | Select a tab from code. `focus` also moves keyboard focus there. |
| `activeIndex` | Read only. |
| `register` | `quiet`, `warm` or `playful`, as usual. |

## Events

`sg-tab-change`: `{ index, tab }`, fired after every selection except the silent first one.

## The registers

- **Quiet:** a static hairline under the selected tab (`box-shadow`, no JavaScript-drawn element).
- **Warm:** the ink underline travels between tabs (`tabs.css`'s `transition: left, width`, on the `--sg-dur-calm` / `--sg-ease-ink` tokens).
- **Playful:** the same underline plus a small bead riding its centre, on the spring ease.

Panel swaps use a same-document View Transition where the browser supports one (Chromium today), so the outgoing and incoming panel content cross-fade; without it, or under reduced motion (the duration tokens collapse to near zero), the swap is instant. Two `<sg-tabs>` on one page never collide: each names only its own active panel, and only while it is mid-swap.

## Accessibility

- Full ARIA APG tabs semantics: `aria-selected`, roving `tabindex`, `aria-labelledby` on each panel.
- The underline and its bead are `aria-hidden`; the selected state is always also in `aria-selected` and the hidden panel.
- Works with no JavaScript as a table of contents; degrades to native anchor navigation.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The travelling underline and its bead are drawn with `aria-hidden="true"` (`packages/components/tabs/skins/warm.js`, `skins/playful.js`); the quiet look is a CSS hairline. Everything a tab says is its text. |
| 1.3.1 Info and relationships | Meets | The tablist, each tab and each panel carry their roles, and each panel is labelled by its tab: `packages/components/tabs/tabs.check.mjs`, "<register> the tablist is announced with its tabs and their selected state" (`tablist "Room details"`, `tab "Overview" [selected]`). Without JavaScript it is a table of contents of plain anchors over headed sections ("no JS: the element is never defined, every section shows, and the links are plain anchors"). |
| 1.4.1 Use of color | Meets | The selected tab is set by `aria-selected`, bold weight and an underline, not colour alone: `packages/components/tabs/tabs.css` (`[aria-selected="true"]`, the quiet hairline, the warm and playful underline); `tabs.check.mjs` asserts the selected state in the accessibility tree. |
| 1.4.3 Contrast (minimum) | Meets | Tab text is `--sg-text-soft` and the selected tab `--sg-text`, both text roles: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: every text role on every surface is 4.5:1 or more"). axe: `tools/axe.mjs --url /packages/components/tabs/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent at 1280 px, three registers, nothing wider than the screen (throwaway Playwright script). Sizes are in `rem` and tokens: `packages/components/tabs/tabs.css`. |
| 1.4.10 Reflow | Meets with author's part | Manual test, 2026-10-07: demo at 320 CSS px, three registers, page width 320 (the page does not scroll sideways). The row of four tabs, "Overview" to "Reviews", is 425 px wide, so the tablist scrolls sideways inside its own box (`overflow-x: auto`, `packages/components/tabs/tabs.css`) with every tab still reachable by keyboard or touch (throwaway Playwright script). Short labels, or fewer tabs, fit without scrolling; whether a scrolling tab row is acceptable for 1.4.10 is a judgement for the audit. |
| 1.4.11 Non-text contrast | Meets | The underline and bead are `--sg-accent-text`, a text role at 4.5:1; the quiet hairline is `--sg-text`; the list rule is decorative; the focus ring is `--sg-focus`: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: focus ring and control borders are 3:1 or more on every surface"). |
| 1.4.12 Text spacing | Meets with author's part | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers: the page does not scroll sideways; the right edge of the tab row moves from 425 to 495 px and the row scrolls inside its own box (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `packages/components/tabs/tabs.check.mjs`: ArrowRight moves focus and selects together, End jumps to the last tab, ArrowRight wraps from the last to the first and ArrowLeft back, a click selects; Home and the arrow keys are unit-tested in `packages/components/tabs/tabs.test.js`. |
| 2.1.2 No keyboard trap | Meets | Manual test: `packages/components/tabs/tabs.js` handles only the arrow keys, Home and End on a tab, with roving `tabindex`: Tab leaves the tablist for the selected panel and onward, and Shift+Tab comes back. The panels hold focus like any content. |
| 2.4.3 Focus order | Meets | One tab stop in the tablist (the selected tab), then the selected panel, which is `tabindex="0"`, then the rest of the page; hidden panels are `hidden` and take none (`packages/components/tabs/tabs.js`, roving `tabindex` and `aria-selected`). |
| 2.4.7 Focus visible | Meets | `packages/components/tabs/tabs.css` sets a `:focus-visible` outline in the token focus colour on each tab and on the panel; `tools/touch.check.mjs` Tabs onto the first focusable control in the component, in the quiet register, and requires an outline, ring or style change. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/tabs/tabs.css` uses no `position: fixed` or `sticky` and no overlay, and the focus ring sits inside the tab (`outline-offset` is negative). A sticky header or banner the page adds can cover a panel's start when focus moves to it. |
| 2.5.3 Label in name | Meets | The accessible name of a tab is its visible text; the component adds no `aria-label`: `tabs.check.mjs` reads `tab "Overview"` and the others. |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07: each tab is 106 by 39.4 px at 1280 px, in all three registers (throwaway Playwright script on the demo), from the padding in `packages/components/tabs/tabs.css`. No check in the repository asserts target size for the tabs yet. |
| 4.1.2 Name, role, value | Meets | Full ARIA tabs semantics (`aria-selected`, roving `tabindex`, `aria-labelledby` on each panel): `tabs.check.mjs`, "the tablist is announced with its tabs and their selected state" and "the second tablist keeps its own selection independent of the first". axe: `tools/axe.mjs --url /packages/components/tabs/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07. |

**The page author owns:**

- The label of the tablist (`aria-label` on the `<nav>`), the tab text and the panel headings, in the language of the page, and `lang` on any in another language (3.1.2). The element falls back to a name from the host when none is given.
- Tab labels short enough to fit the narrowest width, or accepting that the row scrolls (1.4.10).
- Sticky headers and banners that could cover a panel when focus moves to it (2.4.11).

## Lineage

No plate is ported for Tabs itself. It shares Wave 5's harvested Teental stagger (`packages/tokens/tokens.js`, `talaDelay`) where a page uses tabs inside a staggered list, but the tab strip and its underline are original to this register system.

## Budget

See `registry.json`.
