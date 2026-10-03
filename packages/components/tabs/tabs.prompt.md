# Tabs

*A row of headed sections, read one at a time.*

Without JavaScript it is a table of contents. With JavaScript it becomes the ARIA APG tabs pattern, and the selected tab is marked by a line that travels to it instead of jumping.

```html
<link rel="stylesheet" href="susegad/components/tabs/tabs.css">
<script type="module" src="susegad/components/tabs/tabs.js"></script>

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

| Attribute / member | What it does |
|---|---|
| `label` | The tablist's accessible name, if the `<ul>` has no `aria-label` of its own. |
| `select(index, { focus })` | Select a tab in code; `focus` (default false) also moves keyboard focus there. |
| `activeIndex` | Read only: the selected tab's index. |
| `sg-tab-change` event | `detail: { index, tab }`, fired after a selection (not on the first, silent one). |

## The prompt

Build a tabs web component that starts as a table of contents: a `<nav>` with a `<ul>` of links to headed `<section>`s, each with its own `id`, so the page reads and works with no JavaScript at all. When JavaScript runs, enhance it into the ARIA APG tabs pattern with automatic activation: give the `<ul>` `role="tablist"`, each link `role="tab"` with roving `tabindex` (0 on the selected tab, -1 on the rest), and each linked section `role="tabpanel"`, hidden unless selected. The arrow keys both move focus and select, wrapping at the ends; Home and End jump to the first and last tab. A click selects and focuses, except when it carries a modifier key or isn't the primary button, so the browser's own "open in a new tab" still works on every tab. Draw the selected tab with an ink line that travels along the tablist to sit under it, instead of jumping: a static hairline in quiet, an inked line eased into place in warm, the same line with a small bead riding its centre, on a springier ease, in playful. Wrap the panel swap in a same-document View Transition where the browser has one, naming only the panel that is changing (per `<sg-tabs>`, so two on one page never collide), so the content can cross-fade; fall back to an instant swap. Keep the underline itself outside that transition, so it keeps travelling under the cross-fade rather than jumping with it.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| starts as a table of contents | native first | The `<ul>` of links to `<section id>`s is real navigation on its own. `tabs.js` only adds roles, `tabindex` and the hidden state; nothing about the markup requires it. |
| automatic activation … wrapping at the ends | ARIA APG | `tabs.core.js`'s `moveIndex(current, key, count)` is the whole keyboard model as one pure function, tested for every key and for wrapping in both directions; `tabs.js` only calls it and applies the result. |
| an ink line that travels … instead of jumping | layout, transition | `tabs.js`'s `state()` measures every tab's box relative to the tablist once per update; the warm and playful skins set that box's `left` and `width` as inline styles on one `<span>`, and `tabs.css` transitions those two properties, so the browser interpolates the travel — no animation loop. |
| a small bead riding its centre | geometry | `beadAt(box)` in `tabs.core.js` is the box's midpoint; a second, smaller element rides it on its own, springier transition. |
| a same-document View Transition … naming only the panel that is changing | native first | `document.startViewTransition()` wraps the panel-hidden toggle; the newly active panel alone gets a per-instance `view-transition-name` set just before the swap and cleared on the one it replaces, so two `<sg-tabs>` never fight over one name. |
| keep the underline itself outside that transition | separation | The underline lives in the light DOM as an ordinary positioned element with its own CSS transition; a View Transition only captures elements it names, and the underline is never named, so it keeps animating through the capture untouched. |

## Accessibility

- `role="tablist"`, `role="tab"` with `aria-selected` and roving `tabindex`, `role="tabpanel"` with `aria-labelledby`, exactly the ARIA APG pattern.
- Nothing the underline shows is the only place that state appears: `aria-selected` and the hidden panel say the same thing in the accessibility tree.
- The underline and the bead are `aria-hidden`.
- Reduced motion collapses the underline's transition and the View Transition to near-zero through the shared duration tokens; nothing needs to check for it separately.

## Credit

The travelling underline and the ink-with-a-bead treatment are original to Susegad UI's playful register; no plate is ported here (Wave 5's harvest touches Tabs only through the shared Teental stagger tokens, used elsewhere in the wave).
