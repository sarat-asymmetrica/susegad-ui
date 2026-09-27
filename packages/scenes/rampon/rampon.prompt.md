# Rampon

*Konkani: the shore-seine net of Goa's traditional fishermen, the ramponkars.*

A ballpoint sea, a sun sinking into haze, and a ramponkar's canoe waiting near the shore with its net heaped inside. The sea is short blue hatching strokes, redrawn several times a second with a new wobble each time, so it shimmers like hand-drawn animation. Every seed is a different evening; in playful, a koel calls as dusk settles.

```html
<script type="module" src="susegad/scenes/rampon/index.js"></script>

<sg-scene name="rampon" register="warm" seed="3">
  <h2>Come for the evening</h2>
  <p>The boat goes out with the tide.</p>
</sg-scene>
```

## The prompt

Draw dusk on a Goan beach as a blue ballpoint sketch on cream paper, using only canvas JavaScript. Build the sea from rows of short horizontal hatching strokes that get longer and further apart toward the viewer. Redraw them several times a second with a fresh wobble each register's pace allows, so the drawing boils like hand-drawn animation, and hold it as one still frame in the quiet register. Lean two or three coconut palms over the water, with fronds made of inked spines and hanging leaflets that sway in Perlin-noise wind. Put a wooden outrigger fishing canoe near the shore, bobbing gently, with a heap of net inside and a broken reflection underneath. Sink the sun into the horizon haze as the only warm colour. Add a few distant birds, more of them the more playful the register. Drive every choice from one seed (palm placement, sky tone, sun height, boat position) so each seed is a different evening; in playful, clicking (or Enter or Space) draws a new one, and a koel calls, a rising three-note "ku-oo" repeated with increasing urgency, timed to the birds crossing the sky.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| short horizontal hatching strokes that get longer and further apart toward the viewer | hatch | There is no blue fill anywhere in the sea. Tone and depth come from stroke length, spacing and pressure, the way they would with a real pen; nearer rows get longer, more widely spaced strokes. |
| Redraw them several times a second with a fresh wobble | boil | boil(t, fps) turns time into a stepped integer at the register's own rate (0 for quiet, a still; 7 for warm; 12 for playful), and every stroke's jitter is seeded from it, so the sea shimmers like paper animation instead of sliding like video. |
| sway in Perlin-noise wind | noise | Each palm reads a smooth noise value over time as the strength of the wind, scaled by the register's own wind factor (0 in quiet), so fronds lean and recover without a visible loop. |
| Drive every choice from one seed | seed | makeScene(seed), ported unchanged from the sketchbook plate, is the whole pure core: one seeded random generator decides the whole evening. The same seed always gives the same evening. |
| inked spines | wobble | Trunks and frond spines are ribbons whose width follows pen pressure and whose path wanders slightly, so no line looks ruled. |
| a koel calls, a rising three-note "ku-oo" … timed to the birds crossing the sky | sound | packages/sound/scapes/rampon-koel.js: a call is a short rising two-tone whoop, repeated with a shortening gap (the koel's real urgency), only in playful, only with the switch on, and only while a bird is actually visible on screen. |

## Accessibility

The drawing is decorative; slotted text sits on the scrim as with any scene, and the calm zone applies the same way. The koel call is ambient sound only (decision 0015): it carries no meaning of its own and never gates anything a screen reader needs, and it never plays before a user gesture.

## Credit

The rampon, the shore-seine net worked from the beach by hand, is a Goan fishing tradition; the ramponkars who work it are credited by name in local fishing-village histories, not reused here. The koel (Asian koel, *Eudynamys scolopaceus*) is common across Goa and much of India; its rising "ku-oo" call, heard through the hot months, is a pan-Indian sound, not a local or sacred one.
