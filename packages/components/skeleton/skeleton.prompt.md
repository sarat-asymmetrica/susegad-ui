# Skeleton

*A pencil sketch of the page, inked when the real thing arrives.*

A placeholder for a region whose content is on its way. While it waits, the region is `aria-busy` and a hidden line says what is loading. When the content arrives it shows at once, the arrival is announced, and in warm and playful the pencil outlines ink in before giving way.

```html
<link rel="stylesheet" href="susegad/components/skeleton/skeleton.css">
<script type="module" src="susegad/components/skeleton/skeleton.js"></script>

<sg-skeleton busy shape="card" lines="2" label="the room details"></sg-skeleton>

<script>
  const room = await fetch('/api/room').then(r => r.json());
  skeleton.innerHTML = renderRoom(room);   // the content goes inside
  skeleton.busy = false;                   // and only then does the skeleton step aside
</script>
```

## The prompt

Build a loading placeholder as a light-DOM custom element, `<sg-skeleton busy shape="text|card|list|media" lines="3" label="…">`, that wraps the region whose content is coming. While `busy` is set, hide the content, set `aria-busy="true"` on the element, and keep a visually hidden `role="status"` line that says "Loading" and the label; when `busy` is removed, show the content at once and change that line to "The room details loaded". Lay the placeholder out from the shape and a seed, in pixels for the element's width: bars for lines of text with the last one shorter, a picture block for media, a circle and two bars for each row of a list. Give it three registers. Quiet: flat blocks a shade deeper than the surface, with no shimmer and nothing moving; the content replaces them with a fade under 200 milliseconds. Warm: the same blocks drawn in SVG as two wandering pencil passes, the shape resampled and nudged by smooth noise, with light diagonal shading where a picture goes; nothing moves while waiting, and when the content arrives each outline is traced in ink with a dash offset, then the drawing crossfades to the content. Playful: soft colour washes in mango, sea, paddy and kokum, a doodled sun and two hills in the picture, and a wobble on twos while waiting: three drawings of the outlines swapped twelve times a second with step easing, run only while the region is busy and on screen; the ink is the accent colour. Show only what is true: nothing suggests an amount, the ink-in plays only on a real arrival, and with reduced motion the content simply appears. Without JavaScript, show one flat sunk block.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| `aria-busy="true"` and a visually hidden `role="status"` line | accessibility | Anyone reading the region hears "Loading the room details" instead of stale content. When `busy` goes, the same line says "The room details loaded" once, and the element fires `sg-loaded`. |
| lay the placeholder out from the shape and a seed | pure layout | `layout(shape, { lines, width, seed })` returns plain blocks and runs in Node. The same seed gives the same widths every time, so a list does not shuffle on each render. |
| two wandering pencil passes, nudged by smooth noise | wobble | Each block's outline is resampled every 4 pixels and pushed along its normal by Perlin noise. A second pass with a different seed sits slightly off the first, as pencil lines do. |
| traced in ink with a dash offset | stroke dashing | Each ink path's dash array is its own measured length, and the Web Animations API moves the dash offset from that length to zero, one outline after another. |
| a wobble on twos | hand-drawn animation | Three versions of the outlines are drawn once. Each is shown for one twelfth of a second in turn with `step-end` easing, so the lines boil the way animation drawn on twos does. |
| run only while the region is busy and on screen | budget | A shared IntersectionObserver pauses the wobble off screen, and it is cancelled the moment the content arrives. |
| the ink-in plays only on a real arrival | real arrival | The arrival is driven by `busy` going away, never by a timer. Under reduced motion the phase goes straight to done. |
