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

## Lineage

No plate is ported for Tabs itself. It shares Wave 5's harvested Teental stagger (`packages/tokens/tokens.js`, `talaDelay`) where a page uses tabs inside a staggered list, but the tab strip and its underline are original to this register system.

## Budget

See `registry.json`.
