# Skeleton

`<sg-skeleton>` stands in for a region while its content is loading, and steps aside the moment the content is there.

## Usage

```html
<link rel="stylesheet" href="susegad/components/skeleton/skeleton.css">
<script type="module" src="susegad/components/skeleton/skeleton.js"></script>

<sg-skeleton busy shape="list" lines="3" label="your guests">
  <!-- the real list goes here when it arrives -->
</sg-skeleton>
```

Put the content inside the element, then remove `busy` (or set `el.busy = false`). If the content is already there when the page renders, leave `busy` off and nothing is drawn.

Pick the shape that looks most like what is coming, so the page does not jump when it arrives:

| shape | draws |
|---|---|
| `text` (default) | `lines` bars of text, the last one shorter |
| `card` | a picture, a title and `lines` bars |
| `list` | `lines` rows, each a circle and two bars |
| `media` | one 16:9 picture |

## Attributes, properties and events

| Name | Type | What it does |
|---|---|---|
| `busy` | boolean attribute, and the `busy` property | While set, the content is hidden, the element is `aria-busy`, and the placeholder shows. |
| `shape` | `text`, `card`, `list` or `media` | The placeholder layout. Unknown values fall back to `text`. |
| `lines` | number, 1 to 12 (default 3) | Lines of text, or rows of a list. |
| `label` | text | What is loading, as a noun phrase in lower case: `label="your guests"` gives "Loading your guests", then "Your guests loaded". |
| `seed` | number or text | Changes the bar widths. The same seed always gives the same placeholder. |
| `register` | `quiet`, `warm` or `playful` | Overrides the page's register for this element. |
| `sg-loaded` | event | Fires once when `busy` goes away, with `detail: { label }`. |

## Registers

- **Quiet:** flat blocks a shade deeper than the surface. Nothing moves while waiting; the content fades in within 150 ms.
- **Warm:** the placeholder drawn in pencil, with light shading where a picture goes. Nothing moves while waiting. When the content arrives, each outline is traced in ink (about a third of a second), then the drawing gives way to the content.
- **Playful:** soft colour washes, a doodled picture, and a wobble on twos while waiting. The ink is the accent colour.
- **Reduced motion:** the placeholder is still, and the content appears at once when it arrives.

## Accessibility

- While busy, the element has `aria-busy="true"` and holds a visually hidden `role="status"` line saying what is loading. The drawing is `aria-hidden`.
- The content is hidden with `display: none` while busy, so nobody reads stale or half-rendered content.
- When the content arrives it joins the accessibility tree at once, even while the warm ink-in is still playing, and "… loaded" is announced once.
- Nothing in the skeleton takes focus.

## What moves, and why

A skeleton does not know how far along the work is, so nothing in it suggests an amount. Playful's wobble says only that something is still coming, and it stops when the region is off screen. The ink-in is triggered by the content arriving, never by a timer.
