# Empty state

*Before there is anything here, the rain on the window.*

What a place shows before there is anything in it: a heading, a sentence about what will appear there, and the one thing to do next. The words are yours and work without JavaScript. The register brings the picture. Quiet draws a small window in pencil, warm lets a scene drift beside the words, and playful lets you play with it.

```html
<link rel="stylesheet" href="susegad/components/empty/empty.css">
<script type="module" src="susegad/components/empty/empty.js"></script>

<sg-empty scene="paus" scene-intensity="0.55">
  <h2>No bookings yet</h2>
  <p>When a guest books a room, their stay shows up here with the dates and what they asked for.</p>
  <a href="/share">Share your listing</a>
</sg-empty>
```

## The prompt

Build an empty state as a light-DOM custom element, `<sg-empty scene="paus">`, whose heading, sentence and action are ordinary children, so it reads and works without JavaScript. Gather the children into one body, give the element `role="region"` named by its heading with `aria-labelledby`, and pass any `scene-<param>` attribute through to the scene as `<param>`. Give it three registers. Quiet: a small hairline drawing of the scene beside the words, drawn once in SVG with non-scaling strokes in the soft ink colour and never moving. For Paus that is the window: an oyster-shell strip, two panes, a sill, a few drops and one runner's trail. Warm: load the scene only now, as an `<sg-scene>` with its name and params set before it connects, and place it beside the words on a wide box and above them on a narrow one, never behind the text. It follows the page's register, so it drifts slowly, pauses off screen, keeps its own pause button and name for screen readers, and shows its finished still under reduced motion. Playful: the same scene, playing in full and there to be played with; the scene makes itself focusable and reads out how to use it. A quiet page never downloads the scene. Keep the picture as weather: an empty state has nothing in progress, so nothing in it should suggest that something is loading or on its way.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| ordinary children, so it reads and works without JavaScript | progressive enhancement | The heading, words and link are plain HTML. Without JavaScript the stylesheet gives them a hairline card and room to breathe. |
| `role="region"` named by its heading | accessibility | The element gives the heading an id if it has none and points `aria-labelledby` at it, so the region is announced by its words, "No bookings yet". |
| pass any `scene-<param>` attribute through | attribute pass-through | `scene-intensity="0.55"` becomes `intensity="0.55"` on the `<sg-scene>`. A MutationObserver forwards changes, so a server can swap one with no glue code. |
| drawn once in SVG with non-scaling strokes | hairline art | The window is plain path data from a pure function. `vector-effect: non-scaling-stroke` keeps every line one pixel wide at any size. |
| load the scene only now | lazy loading | The warm and playful skins import `<sg-scene>` and the scene module when they mount. The quiet skin imports neither. |
| beside the words on a wide box and above them on a narrow one | layout | Flexbox with wrapping: the scene and the words each have a basis, and on a narrow box the words drop below the picture instead of covering it. |
| keeps its own pause button and name | accessibility | The backdrop is a real `<sg-scene>`, so everything the scene contract promises comes with it: a pause button, the still for reduced motion, pausing off screen, and keyboard help in playful. |
