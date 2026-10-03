// Mithagar: what the scene is called, what it shows, and how to ask for it.

import { W, H } from './model.js';

export const meta = {
  id: 'mithagar',
  title: 'The White Fields of Ribandar',
  word: 'Mithagar',
  gloss: 'Konkani: salt pans, from meeth (salt) and agar (field)',
  caption:
    'The ancient salt pans of Ribandar along the Mandovi river: geometric clay bunds, shallow brine reflecting the dawn sky, and crystalline salt drying in raked pyramids. As evaporation advances, brine recedes and the white harvest grows. In playful, sandpipers run along the bunds and clicking rakes the salt heaps.',
  alt: 'A geometric grid of Goan salt pans at dawn in Ribandar, with shallow brine pools reflecting the sky, crystalline salt crusts, and pyramidal salt heaps.',
  keys: 'Arrow keys move across the bunds. Enter or Space rakes a salt pyramid at your hand.',
  W,
  H,
  seed: 1,
  stillTime: 0,
  tier: 'local',
  credit:
    'The salt pans of Goa belong to the Mithgaud community who have cultivated the estuary tides with wooden rakes and manos sluice gates for centuries.',
  techniques: ['model', 'hatch', 'colour', 'texture', 'state', 'seed', 'wobble', 'interaction'],
  sparks: [
    'Draw Ribandar at high noon with blinding sun and stark salt heaps.',
    'Let the brine water recede as our database migration completes.',
    'Show a quiet architectural grid of Goan salt pans with no motion.',
  ],
  prompt:
    'Paint the Ribandar salt pans at dawn in ink and wash on paper, using canvas with no external image files. Lay a geometric grid of shallow evaporation pans separated by laterite clay bunds, with a wooden sluice gate controlling tidal brine from the Mandovi estuary. In the distance, draw the far bank of coconut palms and mangroves under a dawn sky that shifts from soft indigo to apricot and gold. In each pan, lay shallow brine reflecting the sky. As progress advances from zero to one, let the water recede, nucleate sparkling white salt crusts along the clay edges, and raise raked pyramidal salt heaps at the pan corners. In quiet, draw a crisp hairline grid of bunds, settled salt heaps and calm water with no movement. In warm, let soft ripples drift across the brine and heat shimmer rise from the clay. In playful, let sandpipers scurry and peck along the bunds, and let clicking near a heap rake its salt pyramid. Let the water in each pan reflect the sky at that pan\'s own depth rather than repeating one picture, so the field carries one continuous sky from violet at the far edge to the apricot of the horizon near you, and lay the sun\'s track on the water as a column of glitter widening as it comes toward you. Let the salt take the field as a moving front from the far corner outward instead of fading everywhere at once. Put one person in it: a raker bent over the near pan with a long wooden rake, throwing a shadow a body length and a half long at either end of the day and shrinking toward noon.',
  map: [
    ['geometric grid of shallow evaporation pans', 'model', 'panLayout() calculates perspective bounds for twelve pans and their bunds as pure geometry in Node.'],
    ['laterite clay bunds', 'hatch', 'Bund faces are filled with warm laterite wash and hatched with short slanting strokes to show compacted river mud.'],
    ['dawn sky that shifts from soft indigo to apricot and gold', 'colour', 'skyAtmosphere() blends coastal dawn pigments based on timeOfDay, mirrored softly in the brine pools.'],
    ['wooden sluice gate controlling tidal brine', 'texture', 'The manos gate with its timber planks and laterite piers is rendered into the landscape layer.'],
    ['As progress advances from zero to one', 'state', 'The progress parameter drives water recession, crystal rim nucleation, and the height of pyramidal salt heaps.'],
    ['nucleate sparkling white salt crusts along the clay edges', 'seed', 'Seeded crystal clusters expand inward from bund edges as brine evaporates, forming faceted white borders.'],
    ['raise raked pyramidal salt heaps at the pan corners', 'hatch', 'Salt pyramids grow four-faceted geometry with a sunlit face and a shaded face hatched in cool slate pencil.'],
    ['soft ripples drift across the brine and heat shimmer rise from the clay', 'wobble', 'Sinusoidal wavelets displace water reflections while subtle vertical micro-oscillations suggest coastal heat.'],
    ['let sandpipers scurry and peck along the bunds', 'model', 'Deterministic bird state machines compute running legs, standing pauses, and pecking dips along bund edges.'],
    ['clicking near a heap rake its salt pyramid', 'interaction', 'Clicks or Enter keys trigger raking strokes, expanding salt pyramids and scoring concentric rake lines in the clay.'],
    ['reflect the sky at that pan\'s own depth rather than repeating one picture', 'colour', 'reflectY() maps a height in the field onto its height in the sky and skyAt() samples the three stop ramp there, so each pan shows its own slice of one continuous sky instead of a tiled copy of the horizon.'],
    ['lay the sun\'s track on the water', 'particles', 'A column of glitter under the sun, widening and fading as the pans come nearer, scaled by how bright that hour\'s sun is.'],
    ['Let the salt take the field as a moving front', 'state', 'panDrying() gives every pan its own place in the drying order, so the progress value crosses the ground as a front and the slider becomes something you watch move.'],
    ['a raker bent over the near pan', 'physics', 'One figure, bent at the waist, the rake travelling across the clay. Her shadow is thrown away from wherever the sun actually is, and its length is a body length and a half at either end of the day, which is the reason to be there then.'],
  ],
};
