# Paus

*Konkani: rain, and the whole season of it.*

A Goan window in the monsoon. The paddy is under water and the palms lean into the wind. On the glass, small drops gather until one gets heavy enough to run, leaving a clear trail through the fog.

```html
<script type="module" src="susegad/scenes/paus/index.js"></script>

<sg-scene name="paus" register="warm" intensity="0.6">
  <h2>Come for the rain</h2>
  <p>Our lowest rate, June to September.</p>
</sg-scene>

<!-- as state: an upload 40% done clears the glass 40% of the way up -->
<sg-scene name="paus" progress="0.4" label="Upload progress"></sg-scene>
```

## The prompt

Draw the view from a Goan window in the monsoon as a web component, in canvas JavaScript with no image files. Paint a wooden frame with a strip of translucent oyster-shell panes at the top, and behind the glass a muted landscape: misty hills, coconut palms swaying in noise-driven wind, and flooded paddy fields with rain rippling their surface. Fog the glass by drawing a downscaled, blurred copy of the view through a condensation mask. Simulate raindrops as particles: small beads collect, merge when they touch, and once heavy enough they slide down, swallowing beads in their path and wiping a clear trail through the fog. Let the pointer wipe the fog too, and let it creep back slowly. Show each large drop as a tiny lens holding an upside-down view of the scene. Keep the palette soft and grey-green, with warm wood and a cutting-chai glass on the sill, and in a dark theme paint the same window at dusk with a lamp lit inside. Give it three registers. Quiet: one finished still of a calm, mostly clear pane with a few beads, no rain outside and no motion. Warm: slow rain, a few runners, palms in a softer wind, and the pointer wipes. Playful: the full storm, steam rising from the chai, the arrow keys moving a cloth over the glass, and a hand that wipes a patch now and then when nobody has. Keep the drops away from any text placed over the glass. Add a progress attribute from 0 to 1: when it is set, let the fog clear from the sill up exactly as far as the task has come, never moved by time, and say the percentage in text for screen readers. With reduced motion, show the finished still of the current register.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| small beads collect, merge when they touch | particles | Every drop is a position and a radius. Each step applies three rules: grow, merge on contact, run once heavy. The winding runs down the glass come out of those rules, and a seed makes them repeat exactly. |
| a downscaled, blurred copy of the view through a condensation mask | texture | Shrinking the scene to a tiny canvas and stretching it back is a cheap blur. A low-resolution mask decides where that blur shows, and wiping erases parts of the mask. |
| Let the pointer wipe the fog too | interaction | Pointer movement stamps soft erasing circles into the fog mask. In the playful register the arrow keys move a wiping cloth too. A little fog is added back every half second, so the glass slowly clouds over again. |
| coconut palms swaying in noise-driven wind | noise | Wind is Perlin noise read over time, so each palm bends smoothly and differently and never falls into a visible loop. |
| Paint a wooden frame | wobble | The frame’s edges and grain are inked with slightly wandering, pressure-varied lines rather than perfect rectangles, which keeps it looking drawn. |
| Keep the drops away from any text | calm | Slotted text reports its boxes. Fewer beads form there, runners slide round the top of the box instead of crossing it, and the fog grows back faster behind the words so they sit on frosted glass. |
| let the fog clear from the sill up exactly as far as the task has come | state | The progress param moves a soft, uneven clearing line up the glass. Only progress moves it, never time, so the window clears exactly as fast as the work does, and the same number is read out as text. |

## Params

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `intensity` | number 0 to 1 | 0.8 | How hard it rains: beads per second, streaks outside, rings on the paddy. 0.8 is the sketchbook plate. |
| `fog` | number 0 to 1 | 0.8 | How thick the condensation is and how fast it creeps back. |
| `progress` | number 0 to 1, optional | unset | Scene as state. Unset, the glass behaves as weather. Set, the fog clears from the sill up in step with it, and a status region says "Upload progress: 40% done" (the `label`, then the amount). |
| `wipe` | bool | true | Pointer and keyboard wiping, and the passing hand in playful. |

## Registers

- **quiet**: one finished still. A calm, mostly clear pane, a few beads, no rain outside, no motion.
- **warm**: slow rain, a few runners, the fog creeps back, palms sway at a slower wind. The pointer wipes.
- **playful**: the full storm. The pointer and the arrow keys wipe (the drawing becomes focusable and says so), a hand wipes a patch now and then when nobody has, and steam rises from the chai.
- **Reduced motion**: the finished still of the current register. Pressing play still plays it.

Light and dark: in a dark theme the same window is painted at dusk, with a lamp lit inside that warms the sill and the chai glass.

## Notes for builders

- **How a simulation fits a pure model.** `model({ time, seed, register, params })` returns the per-frame data: palm sway, steam, bead rate, fog opacity and regrowth rate, and the progress value. Heavy static geometry (fields, palms) is memoised per seed. The drops are a stepper, `createDrops(seed)`, whose `step(dt, wipes?)` is deterministic for a seed and a sequence of dt values and returns the trails runners cleared. The renderer owns one stepper, feeds it the element's dt, and erases the returned trails from the fog mask. So time drives everything except the water already on the glass, which is state by nature. Tests run the stepper in Node.
- **First paint is time-sliced.** The fog field, eight seconds of pre-warmed rain and the four painted layers (wall, sky, fields, frame) are built a slice at a time across the first frames, with a 1×1 read after each slice so the rasteriser works inside it. Until then the stage shows the bare wall, then crossfades. `sg-ready` waits until the layers are ready, so the first frame it reports is the real painting.
- **The quality governor** steps down after about 2.5 seconds of frames slower than 30fps: first fewer lens drops, a slower fog refresh and fewer streaks, then a lower pixel density (1.25x). A fast machine never leaves the top level, which is exactly the sketchbook rendering. Paus is the frame-time baseline for every other scene.
- **Seed 1** (the default) reproduces the sketchbook plate exactly. Other seeds reshuffle the fields, palms, rain and the fog.

## Accessibility

- The drawing is an image with the label "A Goan window in the monsoon: raindrops on fogged glass, with flooded paddy and palms beyond", or the `label` attribute.
- With `progress` set, a status region names the work and the amount: "Upload progress: 40% done" with `label="Upload progress"`, or "Monsoon, through the glass: 40% done" without one. It speaks only when the number changes, at most once a second.
- In playful the drawing takes focus. The arrow keys move a cloth over the glass to wipe the fog; hold Shift to move further.
- In warm and playful a pause button sits in the corner whenever the rain can move (WCAG 2.2.2). Reduced motion shows the finished still, and the same button plays it on request.

## Credit

Oyster-shell windows are a Goan craft, made from the flat shells of the windowpane oyster.
