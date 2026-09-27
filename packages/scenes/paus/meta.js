// Paus: what the scene is called, what it shows, and how to ask for it.

export const meta = {
  title: 'Monsoon, through the glass',
  word: 'Paus',
  gloss: 'Konkani: rain, and the whole season of it',
  caption:
    'A Goan window in the monsoon. The paddy is under water and the palms lean into the wind. On the glass, small drops gather until one gets heavy enough to run, leaving a clear trail through the fog.',
  W: 1200,
  H: 800,
  stillTime: 6,
  tier: 'local',
  credit: 'Oyster-shell windows are a Goan craft, made from the flat shells of the windowpane oyster.',
  alt: 'A Goan window in the monsoon: raindrops on fogged glass, with flooded paddy and palms beyond',
  keys: 'Arrow keys move a cloth over the glass to wipe the fog. Hold Shift to move further.',
  techniques: ['particles', 'interaction', 'noise', 'texture', 'wobble'],
  prompt:
    'Draw the view from a Goan window in the monsoon as a web component, in canvas JavaScript with no image files. Paint a wooden frame with a strip of translucent oyster-shell panes at the top, and behind the glass a muted landscape: misty hills, coconut palms swaying in noise-driven wind, and flooded paddy fields with rain rippling their surface. Fog the glass by drawing a downscaled, blurred copy of the view through a condensation mask. Simulate raindrops as particles: small beads collect, merge when they touch, and once heavy enough they slide down, swallowing beads in their path and wiping a clear trail through the fog. Let the pointer wipe the fog too, and let it creep back slowly. Show each large drop as a tiny lens holding an upside-down view of the scene. Keep the palette soft and grey-green, with warm wood and a cutting-chai glass on the sill, and in a dark theme paint the same window at dusk with a lamp lit inside. Give it three registers. Quiet: one finished still of a calm, mostly clear pane with a few beads, no rain outside and no motion. Warm: slow rain, a few runners, palms in a softer wind, and the pointer wipes. Playful: the full storm, steam rising from the chai, the arrow keys moving a cloth over the glass, and a hand that wipes a patch now and then when nobody has. Keep the drops away from any text placed over the glass. Add a progress attribute from 0 to 1: when it is set, let the fog clear from the sill up exactly as far as the task has come, never moved by time, and say the percentage in text for screen readers. With reduced motion, show the finished still of the current register.',
  map: [
    ['small beads collect, merge when they touch', 'particles', 'Every drop is a position and a radius. Each step applies three rules: grow, merge on contact, run once heavy. The winding runs down the glass come out of those rules, and a seed makes them repeat exactly.'],
    ['a downscaled, blurred copy of the view through a condensation mask', 'texture', 'Shrinking the scene to a tiny canvas and stretching it back is a cheap blur. A low-resolution mask decides where that blur shows, and wiping erases parts of the mask.'],
    ['Let the pointer wipe the fog too', 'interaction', 'Pointer movement stamps soft erasing circles into the fog mask. In the playful register the arrow keys move a wiping cloth too. A little fog is added back every half second, so the glass slowly clouds over again.'],
    ['coconut palms swaying in noise-driven wind', 'noise', 'Wind is Perlin noise read over time, so each palm bends smoothly and differently and never falls into a visible loop.'],
    ['Paint a wooden frame', 'wobble', 'The frame’s edges and grain are inked with slightly wandering, pressure-varied lines rather than perfect rectangles, which keeps it looking drawn.'],
    ['Keep the drops away from any text', 'calm', 'Slotted text reports its boxes. Fewer beads form there, runners slide round the top of the box instead of crossing it, and the fog grows back faster behind the words so they sit on frosted glass.'],
    ['let the fog clear from the sill up exactly as far as the task has come', 'state', 'The progress param moves a soft, uneven clearing line up the glass. Only progress moves it, never time, so the window clears exactly as fast as the work does, and the same number is read out as text.'],
  ],
};
