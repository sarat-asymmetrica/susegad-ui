# Carepa surface: the prompt and the words-to-code map

*After: the carepa windows of old Goan houses, glazed with the flat, milky
shells of the windowpane oyster. Took: a surface that lets light and life
through while keeping people's privacy. Left: the shells themselves; the
window is drawn, not photographed. (Rules from the harvest request:
principle, not likeness.)*

## The prompt

> Draw an old Goan window from the inside, in plain JavaScript on a canvas: a
> lime-washed wall, a deep reveal, and a teak frame with an arched fan light,
> divided into a grid of small panes of translucent oyster shell. Render the
> world outside (sky, a palm, a neighbour's wall, and now and then someone
> cycling past with a basket of bread) into a tiny offscreen canvas and scale
> it up, so that through the panes it reads only as soft moving colour. Over
> each pane lay a milky layer with faint concentric growth lines, and a thin
> iridescent sheen whose hue shifts with the angle between the pane and the
> light, so neighbouring panes catch slightly different colours. Let the
> pointer be the sun: moving it moves the brightest glow and turns the
> sheen. Fill the whole host element edge to edge (cover-fit, like CSS
> background-size: cover), so the window works as a dialog's or a drawer's
> backdrop at any aspect ratio, and so that whatever sits behind it is never
> legible as text through it. Give it a finished reduced-motion still, and a
> plain translucent CSS fallback for no JavaScript and no canvas.

## The map

| Words in the prompt | Technique | How the code does it |
|---|---|---|
| "Render the world outside… into a tiny offscreen canvas and scale it up" | texture | `outside()` in `render.js` paints the street at a tenth of its size into `tiny`; `glass()` draws it back at `W`×`H` with smoothing on, a blur that costs almost nothing so the passer-by can move every frame. |
| "a milky layer with faint concentric growth lines" | texture | `shells()` in `render.js`: each pane, painted once and cached, gets a milky wash (`model.js`'s `p.tone` varies its alpha slightly) then rings around one corner, like the growth rings of a real valve. |
| "an iridescent sheen whose hue shifts with the angle" | colour | `sheenHue(pane, sun)` in `model.js`: pure, reads the angle from the pane to the light around a circle of pinks, greens and blues. `sheenNear` gives the brightness that falls off with distance. Both are tested in Node (`carepa.test.js`). |
| "Let the pointer be the sun" | interaction | `render.js`'s `mount()` tracks the pointer over the host and feeds it into `model()` as `params.sun`; without a pointer, `driftSun(time)` (also pure) moves it slowly across the top of the window. |
| "Fill the whole host element edge to edge (cover-fit)" | layout | `mount()` measures the host with a `ResizeObserver`, then scales the fixed 1200×820 composition by `max(hostW/W, hostH/H)` and centres it, so it covers any box without letterboxing. This is what makes carepa work as a full-bleed dialog backdrop. |
| "never legible as text through it" | honesty | The room (`room()`) is painted opaque first — a lime-washed wall and a laterite reveal cover the whole canvas; only the small window shows the blurred, shell-milky "outside", which is drawn theatre, not a capture of the real page. There is nothing translucent onto the real DOM behind the surface: it is fully repainted. |
| "a finished reduced-motion still" | honesty | `mount({ reducedMotion: true })` calls `still()` once at a fixed time (4.2s, matching the plate's own still time) with the pointer treated as outside, and never starts the loop. |
| "a plain translucent CSS fallback" | fallback | `carepa.css`'s `.sg-carepa-css`: `background: var(--sg-scrim)` with a light blur, using tokens only, no canvas and no JavaScript. `:has(canvas)` steps the CSS wash aside once the drawing has mounted, so a page with JavaScript sees the drawing, not both. |
