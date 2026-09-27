# Stamp

*The mark an office, a shop or a printer leaves when something is done: held, received, paid.*

A small block of carved words that lands when something real has happened. The words are ordinary text, so a screen reader reads them once, when the stamp lands; the block print is decoration laid over them.

```html
<link rel="stylesheet" href="susegad/components/stamp/stamp.css">
<script type="module" src="susegad/components/stamp/stamp.js"></script>

<sg-stamp tone="success" pending>
  <p role="status"><strong>Held</strong> <span>12 to 15 Oct, for 20 minutes</span></p>
</sg-stamp>

<script>
  // when the hold really succeeds
  document.querySelector('sg-stamp').stamp();
</script>
```

| Attribute | Values | What it does |
|---|---|---|
| `tone` | `accent`, `success`, `warning`, `danger`, `info`, `neutral` | The ink. Each is a token text colour, 4.5:1 or more on every surface. |
| `pending` | present or absent | Present: not stamped yet; the space is kept, nothing shows, nothing is said. Removing it lands the stamp and announces it. |
| `seed` | any word or number | The tilt and the ink texture. Defaults to the text, so the same words always print the same way. |

## The prompt

Make a web component for a rubber stamp that marks a real event, such as dates being held or a payment received. Keep the words as real text inside a `role="status"` paragraph: a big word in a `<strong>` and a detail line under it, so a screen reader reads them and the browser shapes Devanagari and Kannada properly. Without JavaScript, show a plain ruled rectangle around the words. Give it three registers. Quiet: that ruled rectangle, square, in the tone's ink, with only a short fade when it lands. Warm: a carved block print. Draw a thick outer rule and a thin inner rule, tilt the whole stamp by a few degrees chosen from a seed, add a faint off-register ghost two pixels down and right, and starve the ink: compute a seeded alpha mask of fine speckle and soft noise patches and lay it over the frame and the big word as a CSS mask, leaving the small detail line crisp. Land it with a short press. Playful: tilt it further, ink it a little heavier, cut a small diamond into each side of the frame, and when it lands let it come down, press past flat and settle while a halo of ink spreads into the paper and fades. Set Latin words in capitals with wide letter spacing, but never space out Devanagari or Kannada; detect the script and keep those at their natural spacing and weight. Only land the stamp when the work is done: a `pending` attribute hides it, and removing it lands it and announces the words once. With reduced motion, show the landed stamp without movement.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| keep the words as real text | native first | The stamp is the builder's own `<p role="status">`. The skin adds only `aria-hidden` spans; the words are never painted into a canvas. |
| starve the ink … as a CSS mask | seed | `inkMask(seed, w, h)` is a pure function: about 0.034 flecks per square pixel, then 3 px cells of noise that fade the ink where the block missed the paper (the recipe from the Casa held stamp). The skin writes it into a canvas once, turns it into a blob URL and hands it to `mask-image`. It is repainted only when the size or seed changes. |
| over the frame and the big word … detail line crisp | contrast | The mask sits on the frame and the `<strong>` only, with the mask shifted so the texture runs continuously across both. Small text keeps its full token contrast. |
| tilt … chosen from a seed | seed | `stampPose(seed, register)` gives 1.5 to 4 degrees in warm and 3 to 7 in playful, mostly leaning left the way a right hand stamps. The same words always land the same way. |
| off-register ghost | layering | A `drop-shadow` filter with no blur in the tone at 26%, offset by the pose's ghost. The filter runs before the mask, so the ghost is starved too. |
| never space out Devanagari or Kannada | script | `scriptOf(text)` counts letters by Unicode script. Only lines tagged `latin` get capitals and tracking; Indic words keep the Tiro face at its one weight and skip the texture, because the thin strokes lost whole letters under it. |
| press past flat and settle … a halo of ink spreads | easing | Web Animations keyframes from `landing(motion, rotate)`: scale 1.28, 0.95, 1.02, 1, with the rotation in every frame so the stamp never snaps square. The halo scales out and fades. Both animations are cancelled when they finish. |
| only land the stamp when the work is done | state | `pending` hides it. `stamp()` removes `pending`; the element then takes the words out of the live region and puts them back on the next frame, which is what makes screen readers announce a change. |

## Accessibility

- The words are text in a `role="status"` region. They are announced once: when `pending` is removed, or when a stamp is added after the page has loaded (a server swap). A stamp in the page from the start is read as part of the page.
- Every tone is a token text colour at 4.5:1 or more on every surface. The ink texture never touches the detail line, and it covers the big word only in Latin, where the word is 1.6rem and bold.
- The tilt is at most 7 degrees. The frame, the ghost, the diamonds and the halo are `aria-hidden`.
- Reduced motion shows the landed stamp with no movement. Quiet's only motion is a 120 ms fade.

## Credit

Harvested from the "held" stamp on a villa's booking card (`carveBlock` and `drawStamp`), which borrowed from the rubber stamps of Indian offices and shops and from the hand block printing of Sanganer and Bagru. Tier: pan-Indian.
