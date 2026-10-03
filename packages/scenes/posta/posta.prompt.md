# Posta

*Konkani and Portuguese: the post office.*

The sorting room of the old post office in Fontainhas: morning sun through oyster-shell carepa panes, cubbies holding jute-tied letter bundles, a brass letter balance, a rubber stamp on a sorting manifest, and a heritage crimson postbox. As progress advances, letter bundles slide into their pigeonholes.

```html
<script type="module" src="susegad/scenes/posta/index.js"></script>

<sg-scene name="posta" register="warm">
  <h2>The Sorting Desk</h2>
  <p>Every dispatch finds its pigeonhole.</p>
</sg-scene>
```

## The prompt

Draw the sorting desk of an old post office in Fontainhas, in ink and wash on paper, using canvas without external image files. On the lime wall, place a carepa oyster shell window whose panes catch morning light and cast a warm sunbeam across the room. Under the window, build a wooden pigeonhole rack with twelve cubbies holding jute-tied bundles of envelopes and postcards. Shade the rosewood bevels and cubby depths with delicate ink hatching. On the rosewood desk, set a brass balance scale with twin hanging pans, an ink pad, a turned wooden rubber stamp, and on the right, a heritage crimson postbox with a hinged brass flap. Paint the desk, window, rack and postbox once into a background texture. In the sunbeam, let golden dust motes float as drifting particles. A letter drops through the letterbox as the brass flap swings open and settles as a damped pendulum; the brass scale tilts and rocks gently to equilibrium; and the rubber stamp descends with smooth easing to leave a purple postmark on a sorting manifest. Let letter bundles slide into the cubbies as progress advances. In quiet, draw only hairlines with everything settled. In warm, let the motes drift, the flap settle, and the scale come to rest. In playful, clicking the flap lifts it, clicking the scale tips the pans, and clicking the desk drives the stamp. Let the beam off the carepa panes swing across the room to the right, narrow and drop lower as the day wears on, going from the apricot of morning to the low gold of late afternoon, so that progress is the day rather than a counter. Let one person come to the window: head and shoulders dark against a bright pane of oyster shell inside the opening, a rim of morning light down the shoulder nearest the glass, and their long shadow lying across the sorting manifest. Shape the three sounds like the things making them, a short wooden knock for the flap, a long brass ring for the balance and a dull thud for the rubber stamp, each with a little noise under the tone, and let the global sound switch govern them.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| let golden dust motes float as drifting particles | particles | Dozens of dust motes move through the sunbeam with gentle sinusoidal drift and soft alpha fading, calculated as a pure deterministic function of time. |
| brass flap swings open and settles as a damped pendulum | physics | The letterbox flap angle follows an exponentially decaying cosine: flapAngle(t) = amplitude * exp(-decay * t) * cos(omega * t). Interactive pushes in playful add new damped impulses. |
| rubber stamp descends with smooth easing | easing | The stamp drops vertically along an ease-in-out curve to press the manifest, pauses for the impression, and returns smoothly to its resting height. |
| Let letter bundles slide into the cubbies as progress advances | state | When progress is passed from a real workflow, envelopes and jute-tied bundles fill their cubbies in exact proportion to the sorted state, pausing time. |
| Paint the desk, window, rack and postbox once into a background texture | texture | The architectural framework, wall wash, wood moulding and oyster shell panes are rendered once into an offscreen canvas and blitted every frame. |
| In quiet, draw only hairlines with everything settled | model | model() computes positions, angles and settlement flags purely. In quiet mode or after resting time, settled is true and rendering pauses. |
| clicking the flap lifts it, clicking the scale tips the pans, and clicking the desk drives the stamp | interaction | activate() identifies pointer hits on the postbox flap, the balance scale pans, or the stamping manifest to trigger responsive animations. |
| twelve cubbies holding jute-tied bundles | seed | The seed determines the mix of airmail envelopes, folded chits and postcards tucked into each cubby, keeping the same postal character reproducible. |
| Shade the rosewood bevels and cubby depths with delicate ink hatching | hatch | Deep shadows beneath the desk rim and within empty pigeonholes are drawn with angled ink hatching strokes spaced for paper texture. |
| Let the beam off the carepa panes swing across the room | easing | sunbeamAt() returns a different polygon, colour and intensity at every point of the day's progress, so the light in the room is a clock. |
| Let one person come to the window | loop | One every twenty six seconds, arriving from the left, standing a moment and going. Only the top half is inside the opening, which is all you would actually see from inside a sorting room. |
| Shape the three sounds like the things making them | sound | Each voice has its own oscillator, glide, decay and a band of filtered noise underneath, so wood is wood and rubber is rubber and not just pitched tones, and the global sound switch governs all of it. |

## Try asking for

- A vintage post office in Fontainhas with wooden cubbies and a brass scale.
- A quiet sorting desk where letters settle into cubbies as progress advances.
- A sunlit Goan post desk with floating dust motes and a crimson postbox flap.

## Accessibility

The drawing serves as visual atmosphere; slotted page text carries all essential messages. In quiet register or with prefers-reduced-motion, the scene presents a still architectural hairline drawing. In warm register, animations settle within eight and a half seconds and stop drawing. In playful, keyboard navigation with arrow keys and Enter or Space operates the flap, the balance scale, and the rubber stamp.

## Credit

The old post offices of Goa, the carepa oyster shell windows of Fontainhas, and the postal sorting desks of Correios da India and India Post.
