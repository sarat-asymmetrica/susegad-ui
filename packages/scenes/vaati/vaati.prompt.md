# Vaati

*Marathi and Hindi: a small bowl.*

A bowl seen from directly above. Pieces of fresh pasta fly in from the edges, each with a spin, and settle, nudging the ones already there. Sauce is poured and spreads in a swirl between them, grated cheese falls and catches, and basil leaves land. Then the bowl rests.

```html
<script type="module" src="susegad/scenes/vaati/index.js"></script>

<!-- the opening on a site: the scene full-bleed (cropped to its middle on a phone held upright). Making
     the meal takes about 16 s in warm and about 6 s in playful (quiet is a finished bowl at once), so
     offer a way in from the first frame, and let the settle only bring in the words and the door -->
<button id="skip">Skip</button>
<sg-scene name="vaati" register="playful" label="Your order, being made"></sg-scene>
<button id="enter" style="visibility:hidden">Come in</button>
<script>
  const scene = document.querySelector('sg-scene');
  scene.addEventListener('sg-scene-settled', () => { skip.hidden = true; enter.style.visibility = 'visible'; });
  skip.onclick = () => scene.still();  // goes to the finished bowl, and the settle follows
</script>
<!-- size the scene width: max(100vw, 120svh) and centre it with margins, not a transform, so the bowl
     stays whole with room for pieces to arrive; pin ::part(toggle) to the viewport corner by arithmetic -->

<!-- what goes in the bowl -->
<sg-scene name="vaati" pieces="tortellini" sauce="pesto" topping="none" garnish="basil"></sg-scene>

<!-- a real order: set progress from the work, never from a timer -->
<sg-scene name="vaati" progress="0.4" label="Your order"></sg-scene>
```

Params: `pieces` (`ravioli`, `tortellini`, `gnocchi`, `farfalle`), `sauce` (`tomato`, `pesto`, `cream`, `none`), `topping` (`cheese`, `none`), `garnish` (`basil`, `none`), `progress` (0 to 1). `tossAt` and `tossN` are set by the scene itself when the bowl is tossed.

Events: `sg-scene-settled` (bubbles, composed) fires once per run when the garnish has landed, including for the still (quiet and reduced motion), and never under `progress`. A page that arrives late can read the `data-settled` attribute the scene sets at the same moment; it is cleared when the scene replays.

## The prompt

Draw a bowl seen from directly above, on a canvas with no image files, centred on a plain ground with room all round it. Paint the bowl once into a cached layer: a painted rim with a ring of dots and a glaze highlight, a sloping inner wall that darkens softly toward the rim, a flat floor, and a soft shadow on the table. Fresh pasta flies in from the edges of the canvas, mostly the top and bottom, one piece at a time, each along a curved arc with its own spin, looking larger while it is in the air, and settles with a small squash. Draw each kind of pasta from a small pure shape function and paint it once as a sprite: ravioli as a scalloped square pillow with a crimped edge and a domed centre, tortellini with a navel and a folded tip, gnocchi with ridges, farfalle as a pinched bow. When a piece lands it shoves the earlier ones a little, and they ease back with a small overshoot. Then pour the sauce: a glossy ribbon spirals out from the middle over the pasta while a pool spreads beneath and between the pieces. Then let grated cheese fall as small slivers and curls that catch on top, and last let three basil leaves land. Then the bowl rests and the scene stops drawing, and says once that the meal is made. Make it a pure function of time so it can be tested in Node. Add a progress attribute from 0 to 1: when set, show exactly that full and let time stand still. In the quiet register, draw only hairlines, with nothing washed. In warm, use ink and wash on handmade paper. In playful, use flat poster colour with a bold ink outline, brisker and bouncier, and let a click, Enter or Space toss the pasta up so it lands again in a new arrangement.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| Paint the bowl once into a cached layer | texture | The rim, wall, floor, dots, highlight and shadow are painted once per size, theme and register into a cached canvas and blitted every frame. Pieces, flakes and leaves are each painted once into a small sprite at device resolution, so a frame only places them. |
| along a curved arc with its own spin | easing | Each piece has its own flight: a quadratic arc from an edge off the frame to its rest, eased out so it slows as it lands, with a seeded spin that unwinds and a scale that shrinks from the camera to the bowl. |
| Draw each kind of pasta from a small pure shape function | seed | A shape is a function of a seeded rng that returns an outline and painted layers (fill and line roles the renderer colours). SHAPES lists each kind with its count and size, so a kitchen adds momo or modak with one entry. |
| it shoves the earlier ones a little | model | makeBowl packs the rests with a seeded relaxation, then gives each earlier piece the shove of every later one that lands near it. A piece sits back by the sum of the shoves still to come, and settleCurve eases it forward with an overshoot as each lands. |
| a glossy ribbon spirals out from the middle | wobble | The pour is a spiral from swirlPoint, drawn as a tapering ribbon with a highlight along it and a bright drop at its head. The pool beneath grows as a lumpy disc from a few low harmonics. |
| says once that the meal is made | state | The renderer dispatches sg-scene-settled (bubbling, composed) once per run when the garnish lands, and sets data-settled for a page that came late. It never fires under progress, and a toss does not fire it again. |
| Make it a pure function of time | model | model({ time, seed, register, params }) returns every piece, flake and leaf pose, the sauce, and done and settled. It runs in Node, and returns settled once the bowl is still, so the element stops drawing. |
| when set, show exactly that full and let time stand still | state | With progress set, the model ignores time and shows the bowl that full, at 1 the finished still, and the same number is read out as text. |
| draw only hairlines, with nothing washed | texture | Quiet paints outlines only, in the ink and sauce colours at a hairline width; a piece is filled with the paper so it still hides what lies under it. Each piece is drawn at 0.84 so paper shows between neighbours, with its outline and one defining stroke only (no folds, veins or hatching), and only every sixth fleck of cheese, so the pieces read as separate pieces at phone width. |
| a click, Enter or Space toss the pasta up so it lands again | interaction | In playful the renderer sets tossAt and tossN on the element. The model lifts each piece in turn, turns it and lands it in a slightly different place, and reports the scene not settled until it has landed, so the loop wakes and then rests again. |

## On a page

A bare `<sg-scene name="vaati">` mounts at once. Where the scene is not the first thing a reader needs (a long page, a phone, a slow connection), make it poster-first: put its poster, as a `<picture>` of AVIF, WebP and JPG, inside `<sg-lazy src="/packages/scenes/vaati/index.js">` with `<sg-scene name="vaati" hidden></sg-scene>` beside it, and link `core/lazy.css`. The scene is then fetched only when it is near the screen, and the poster stays as the still under reduced motion, Save-Data, the quiet register and small devices. See `core/lazy.docs.md`.

## Accessibility

The drawing is decorative unless it shows progress. With `progress` set, the element says the same number in a polite status region, named by `label` ("Your order: 40% full"), at most once a second and only when it changes. Nothing is said only by the drawing: the page text carries the message. In playful, the drawing takes focus and Enter or Space tosses the pasta. Quiet and reduced motion show the finished bowl. For a full-bleed opening, keep the pause button reachable (the demo's `?opening=1` pins `::part(toggle)` to the viewport's corner), keep "Come in" out of the tab order (`visibility: hidden`) until the settle, and offer Skip from the first frame; warm takes about 16 s, so a site that wants a short opening chooses playful (about 6 s).

## Credit

The wide bowl with a painted rim is the vaati and thali of Indian kitchens; the drawing shows a plain one with a rim of dots, with no mark of any maker or place.
