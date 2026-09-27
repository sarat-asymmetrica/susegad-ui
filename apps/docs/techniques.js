// The pencil box: the handful of techniques that do nearly all the work.
// Ported from the Susegad sketchbook's TOOLS table. Scene meta lists technique
// ids from this table; the plates link each tag back here.
//
// Copy lives here so a writer can edit it in one place.

export const TECHNIQUES = {
  loop: ['The frame loop', 'requestAnimationFrame calls one draw function about sixty times a second. Each frame is a picture of the world at time t.'],
  wobble: ['Wobbly ink', 'Lines are cut into tiny steps and nudged sideways by smooth noise, and their width breathes like pen pressure.'],
  hatch: ['Hatching', 'Tone comes from short parallel strokes, packed tighter where it is darker, instead of smooth gradients.'],
  boil: ['Boiling lines', 'The wobble is re-rolled about ten times a second, so even a still drawing shimmers like hand-drawn animation.'],
  noise: ['Smooth noise', 'Perlin noise is randomness that flows: nearby inputs give nearby outputs. It moves wind, water, flame and paper grain.'],
  seed: ['Seeds', 'A seeded random generator draws the same picture for the same seed. Change the seed and a new one appears.'],
  easing: ['Easing and timelines', 'Story beats are windows of time. Easing curves make things start and settle the way real objects do.'],
  particles: ['Particles', 'Thousands of tiny marks, each following a few simple rules: flour, rain, sparks, fireflies.'],
  emergence: ['Emergence', 'Simple local rules grow a whole form: mirror curves, branching trees, fireflies falling into step.'],
  texture: ['Paper and grain', 'Anything that does not move is painted once into an offscreen canvas and reused every frame.'],
  interaction: ['Interaction', 'The pointer is just more input to the draw function. Wipe, scatter, stamp, snuff.'],
  physics: ['Ropes and springs', 'Points that remember where they were, tied together by sticks that keep their length. Garlands hang, swing and settle on their own.'],
  fields: ['Fields', 'A value or a direction at every point: which seed is nearest, which way the wind blows, how high the hill is. Cracks, grass and contour lines are read off them.'],
  pattern: ['Tilings and grammars', 'One tile and a rule for turning it, or one sentence that rewrites itself. Floors, borders and vines grow from very little.'],
  colour: ['Perceptual colour', 'Colours mixed in a space built around the eye (OKLCH), so a sky can go from apricot to indigo without a grey middle.'],
  scroll: ['Scroll as a timeline', 'Where the page is scrolled becomes the playhead. The reader decides how fast the drawing unfolds.'],
  svg: ['Declarative vectors', 'Shapes are elements the browser animates for you: one dash as long as the path slides into place, and the line draws itself.'],
  shader: ['The GPU', 'A tiny program runs once for every pixel, all at the same time on the graphics card. Light, water and glass at full resolution.'],
  model: ['A pure model', 'What to draw is a plain function of time, seed and settings. It runs anywhere, even in Node, so it can be tested; drawing it is a separate step.'],
  state: ['Real state', 'A scene can show something real, such as upload progress. Then only the real number moves it, time stands still, and the same number is also read out as text.'],
  calm: ['Calm zones', 'Text placed over a scene reports its boxes, and motion quietens in and around them so the words stay easy to read.'],
  fallback: ['Fallbacks', 'When the graphics card is missing or its context is lost, the scene draws a simpler version on a 2D canvas instead of going blank.'],
  governor: ['The quality governor', 'The scene times its own frames. When they run slow it draws less detail; when there is room it draws more.'],
  sound: ['Synthesised sound', 'A soundscape tied to what a scene already draws: no audio files, only Web Audio oscillators, only with the global sound switch on and a user gesture, and only for what is actually on screen.'],
};

/** Name of a technique id, lower-cased for tags; unknown ids show as themselves. */
export const techniqueName = id => (TECHNIQUES[id]?.[0] || id).toLowerCase();
