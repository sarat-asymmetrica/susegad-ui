# Kantar

*Konkani: a song sung between scenes in a tiatr*

A tiatr stage with a painted proscenium and the band in the pit. After each scene the curtain drops, a singer steps into the spotlight and sings a short kantar, and when the song ends the curtain rises on a new set: the church square, the beach at dusk, or a balcão at night. Click or tap to move to the next part. A study for interludes between long tasks, where waiting becomes part of the show.

```html
<script type="module" src="susegad/scenes/kantar/index.js"></script>

<!-- hero: on load curtain rises once, stage settles and rests -->
<sg-scene name="kantar" register="warm">
  <div class="lyrics" aria-live="polite">
    <p>Susegad: the unhurried contentment of a Goan afternoon</p>
  </div>
</sg-scene>

<!-- quiet: curtain open, lit still of the church square -->
<sg-scene name="kantar" register="quiet"></sg-scene>

<!-- playful: full tiatr show cycling through scenes, kantars and sets; click skips ahead -->
<sg-scene name="kantar" register="playful"></sg-scene>

<!-- controlled: curtain pinned halfway during an upload -->
<sg-scene name="kantar" progress="0.5" label="Upload in progress"></sg-scene>
```

| Param | Values | Default | What it does |
|---|---|---|---|
| `progress` | number (0..1) | null | Curtain position: 0 is fully raised, 1 is fully lowered. When unset, time drives the curtain. |
| `set` | integer (0..2) | null | Active painted backdrop: 0 for church square, 1 for sunset beach, 2 for balcão night. When unset, cycles with the show. |
| `spot` | number (0..1) | null | Spotlight intensity: 0 off, 1 full beam on the singer in front of the curtain. When unset, lights up during the kantar song. |
| `hero` | bool | false | The front door's mode. In playful the show runs only when asked: the curtain rises once and rests, and each click plays one act (the curtain drops, a kantar is sung, the curtain rises on the next set) and rests again. It sings our own line, not the plate's placeholder songs. Quiet and warm are unchanged: warm already rises once and rests. |
| `cue`, `acts` | number, integer | null, 0 | Hero only, set by the click: the scene-clock time the last act was struck and how many have been. Set them to put the stage at a chosen set without a click. |

## As the front door

The home page's masthead is this scene with `hero="true"`. It never loops a show by itself: after the first rise it rests, with no frame requested, it pauses off screen, and reduced motion shows the finished still. The words are never in the canvas: the line under the stage is real text on the page, and the song is announced in a live region. The stage sits in a frame the page owns (`.mast-frame`, with an empty `.mast-border` and a `--mast-frame-pad` for the room a border leaves it), so a later border, a kaavi of scraped laterite, can fill the frame without the stage changing.

## Try asking for

- Lower the curtain halfway while the file uploads.
- Switch the backdrop to the balcão at night for the late edition.
- Focus a tight spotlight on the singer in front of the curtain.

## The prompt

Draw a tiatr stage in plain JavaScript on a canvas: a painted proscenium with a gold-fringed pelmet, a sloping board floor, footlights, and the band’s heads and a trumpet in the pit. Paint three sets as flat, hand-inked backdrops (a whitewashed church square, a beach with a fishing canoe at dusk, a house’s balcão at night) and cache each one. Run the show as a timeline of phases: a scene, the curtain coming down, a kantar, the curtain going up on the next set. Draw the red curtain as a fold-shaded fill whose hem ripples with a damped wave when it lands. During the kantar, light an oval spot on the curtain, stand a singer at a microphone in it, with lyrics displayed in the page. A click skips to the next phase. Let the singer perform rather than stand: the hem of her gown swings a beat behind her body, the hips shift on the pulse, and on the refrain her free arm goes out toward the house and her head comes back on the held note. Put the first row of the house in the bottom of the picture, seen from behind, each head on its own phase and each taking a thin rim of stage light along the top, and have them nod on the beat. Let the pit play in the same beat: a bow that travels, a cymbal that shivers on the off beat, a conductor's arm coming down on one.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| Run the show as a timeline of phases | easing | The whole show is one clock. Each phase is a window on it, and everything on stage (curtain height, spot, lyrics) is read off the window with easing. |
| whose hem ripples with a damped wave when it lands | physics | When the curtain lands, the hem is given a wave that travels along it and dies away exponentially, so heavy velvet settles instead of stopping dead. |
| Paint three sets as flat, hand-inked backdrops … and cache each one | texture | Each set is painted once into its own offscreen canvas. Changing the scene behind the curtain is only a matter of which one is drawn. |
| A click skips to the next phase | interaction | The click moves the clock to the start of the next phase, so skipping never breaks the show: the curtain still comes down before the set changes. |
| with lyrics displayed in the page | calm | No text is drawn on the canvas. Kantar lyrics and scene titles live directly in DOM elements and polite live regions for accessibility. |
| Let the singer perform rather than stand | easing | One pulse drives everything on stage. performanceAt() reads the curtain landing as the beat clock, so the gown hem lags the body by a beat, the arm lifts on the refrain and the head tilts back on the final note, and every value is zero when the spotlight is off, which leaves quiet and warm exactly as still as they were. |
| Put the first row of the house in the bottom of the picture | loop | Seven backs of heads along the lower edge, each on its own phase because an audience is never in unison, each with a rim of stage light. They bob on the beat and one of them puts a hand up on the refrain. |
| Let the pit play in the same beat | loop | A bow that travels, a cymbal that shivers on the off beat and a conductor's arm that comes down on one, all read from the same beat as the singer. |

## Accessibility

The stage's accessible name is its `alt`. No text is drawn into the canvas. All song lyrics, scene titles, and interlude announcements live in real DOM elements inside `<sg-scene>` and polite `aria-live` regions. Screen readers announce the current set when it opens and the kantar words as they are sung. In the quiet register and under reduced motion, the scene presents a lit, calm still with no looping motion.

## After

After **the tiatr, and the stage painters and singers who kept it going for more than a century**. Taken: the interlude, where the audience is never left staring at a stagehand. Left: the songs themselves, where the lines here are our own English gloss, waiting for a Konkani ear.
