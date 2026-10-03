// Kantar: metadata, prompts, techniques, and sparks.
//
// A tiatr stage with proscenium arch, footlights, orchestra pit, and three
// painted backdrops (church square, dusk beach, balcão night) behind a heavy
// red velvet curtain. No em dashes in copy, comments or prompts.

import { W, H, RISE_TIME } from './model.js';

export const meta = {
  id: 'kantar',
  word: 'Kantar',
  gloss: 'Konkani: a song sung between scenes in a tiatr',
  title: 'A Song While the Set Changes',
  caption:
    'A tiatr stage with a painted proscenium and the band in the pit. After each scene the curtain drops, a singer steps into the spotlight and sings a short kantar, and when the song ends the curtain rises on a new set: the church square, the beach at dusk, or a balcão at night. Click or tap to move to the next part. A study for interludes between long tasks, where waiting becomes part of the show.',
  alt:
    'A painted tiatr stage with proscenium arch, footlights, orchestra pit, and three alternating backdrops behind a heavy red velvet curtain.',
  after: {
    who: 'the tiatr, and the stage painters and singers who kept it going for more than a century',
    took: 'the interlude: the audience is never left staring at a stagehand',
    left: 'the songs themselves: the lines here are our own English gloss, waiting for a Konkani ear',
  },
  W,
  H,
  seed: 1,
  stillTime: RISE_TIME,
  tier: 'local',
  credit:
    'Tiatr is the popular musical theatre of Goa, staged in village halls and town auditoriums for over a century. The kantar interlude turns set changes into lively song.',
  techniques: ['easing', 'physics', 'texture', 'interaction', 'calm'],
  prompt:
    'Draw a tiatr stage in plain JavaScript on a canvas: a painted proscenium with a gold-fringed pelmet, a sloping board floor, footlights, and the band’s heads and a trumpet in the pit. Paint three sets as flat, hand-inked backdrops (a whitewashed church square, a beach with a fishing canoe at dusk, a house’s balcão at night) and cache each one. Run the show as a timeline of phases: a scene, the curtain coming down, a kantar, the curtain going up on the next set. Draw the red curtain as a fold-shaded fill whose hem ripples with a damped wave when it lands. During the kantar, light an oval spot on the curtain, stand a singer at a microphone in it, with lyrics displayed in the page. A click skips to the next phase. Let the singer perform rather than stand: the hem of her gown swings a beat behind her body, the hips shift on the pulse, and on the refrain her free arm goes out toward the house and her head comes back on the held note. Put the first row of the house in the bottom of the picture, seen from behind, each head on its own phase and each taking a thin rim of stage light along the top, and have them nod on the beat. Let the pit play in the same beat: a bow that travels, a cymbal that shivers on the off beat, a conductor\'s arm coming down on one.',
  map: [
    ['Run the show as a timeline of phases', 'easing', 'The whole show is one clock. Each phase is a window on it, and everything on stage (curtain height, spot, lyrics) is read off the window with easing.'],
    ['whose hem ripples with a damped wave when it lands', 'physics', 'When the curtain lands, the hem is given a wave that travels along it and dies away exponentially, so heavy velvet settles instead of stopping dead.'],
    ['Paint three sets as flat, hand-inked backdrops … and cache each one', 'texture', 'Each set is painted once into its own offscreen canvas. Changing the scene behind the curtain is only a matter of which one is drawn.'],
    ['A click skips to the next phase', 'interaction', 'The click moves the clock to the start of the next phase, so skipping never breaks the show: the curtain still comes down before the set changes.'],
    ['with lyrics displayed in the page', 'calm', 'No text is drawn on the canvas. Kantar lyrics and scene titles live directly in DOM elements and polite live regions for accessibility.'],
    ['Let the singer perform rather than stand', 'easing', 'One pulse drives everything on stage. performanceAt() reads the curtain landing as the beat clock, so the gown hem lags the body by a beat, the arm lifts on the refrain and the head tilts back on the final note, and every value is zero when the spotlight is off, which leaves quiet and warm exactly as still as they were.'],
    ['Put the first row of the house in the bottom of the picture', 'loop', 'Seven backs of heads along the lower edge, each on its own phase because an audience is never in unison, each with a rim of stage light. They bob on the beat and one of them puts a hand up on the refrain.'],
    ['Let the pit play in the same beat', 'loop', 'A bow that travels, a cymbal that shivers on the off beat and a conductor\'s arm that comes down on one, all read from the same beat as the singer.'],
  ],
  sparks: [
    {
      prompt: 'Lower the curtain halfway while the file uploads.',
      uses: 'progress',
    },
    {
      prompt: 'Switch the backdrop to the balcão at night for the late edition.',
      uses: 'set',
    },
    {
      prompt: 'Focus a tight spotlight on the singer in front of the curtain.',
      uses: 'spot',
    },
  ],
};
