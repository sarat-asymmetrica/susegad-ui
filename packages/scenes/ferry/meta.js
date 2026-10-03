// Ferry: what the scene is called, what it shows, and how to ask for it.

export const meta = {
  id: 'ferry',
  title: 'Four stops across the river',
  word: 'Ferry',
  gloss: 'The river ferries of Goa: flat open decks that carry scooters and people across the Mandovi and the Zuari',
  caption:
    'A river ferry crosses from a small jetty on the far bank, past two channel posts, to a big jetty on the near side, growing as it comes to you. Each stop has a lamp: the ones behind are lit, the one it is at glows, the ones ahead are dark. It moves only when the page says the next step has begun.',
  alt: 'A river ferry on a sketched river, with four lamps along its route from the far bank to the near one',
  keys: 'Enter or Space sends the ferry on to the next stop. After the fourth, it goes home to the first.',
  W: 1200,
  H: 800,
  seed: 2,
  stillTime: 1,
  tier: 'local',
  credit:
    'Goa\'s river ferries have carried people, scooters and the day\'s shopping across the Mandovi, the Zuari and the smaller rivers for generations. This ferry is drawn from the general shape of the boats, with no department\'s livery or name.',
  techniques: ['hatch', 'boil', 'texture', 'state', 'easing', 'calm', 'interaction', 'seed'],
  prompt:
    'Draw a Goan river from a high bank as a blue ballpoint sketch on cream paper, using only canvas JavaScript. Hatch the sky thinning toward a warm haze, hatch low hills behind a far bank of mangrove, palms and tiled roofs, and bring a laterite bank into the bottom right corner with a concrete ramp. Build the water from rows of short horizontal strokes that get longer and further apart toward you. Draw three versions of the water once and cycle them on twos, so the river boils like paper animation without redrawing anything. Lay a dotted route from a small jetty on the far side, past two lashed channel posts, to the ramp, and give each of the four stops a lamp: lit behind, glowing where the ferry is, dark ahead. Draw a flat open ferry with a laterite hull, a cream band, raised ramps at both ends, a wheelhouse, two scooters and a few passengers, once as a sprite, and scale it with perspective so it grows as it comes toward you, with a faint broken reflection and a wake while it moves. Take a step attribute from 1 to 4: when it changes, ease the ferry along the route to that stop; when it is absent, keep the ferry bobbing at the first stop and never move it on by itself, and say "stop 2 of 4" in text for screen readers. Quiet is a hairline still. In playful, a click or Enter sends it to the next stop and a kite circles overhead. Keep the water still under any text laid over the drawing.',
  map: [
    ['rows of short horizontal strokes that get longer and further apart toward you', 'hatch', 'There is no blue fill in the river. Depth comes from stroke length, spacing and weight, the way it would with a real pen: near rows are longer, heavier and further apart.'],
    ['Draw three versions of the water once and cycle them on twos', 'boil', 'The water is painted into three cached layers, each with its own wobble, and the frame shows one of them in turn, seven times a second in warm and twelve in playful. A frame is a blit, not a redraw.'],
    ['once as a sprite', 'texture', 'The bank, hills, jetties and route are painted once per theme. The ferry is painted once at full size into its own canvas and drawn scaled, so a crossing costs one image per frame.'],
    ['scale it with perspective so it grows as it comes toward you', 'easing', 'scaleAt(y) maps height on the water to size, from about a third at the far jetty to full size at the ramp, and the crossing eases in and out like a boat pulling away and coming alongside.'],
    ['when it is absent, keep the ferry bobbing at the first stop and never move it on by itself', 'state', 'Only a change of step moves the ferry. The model has no clock for the stops at all, so there is no timer to go wrong, and the same stop is read out as text.'],
    ['In playful, a click or Enter sends it to the next stop', 'interaction', 'activate() sets the next step on the element, the same way a page would, so the status text follows the ferry.'],
    ['Keep the water still under any text', 'calm', 'Strokes that fall under slotted text use the same wobble in all three water drawings, so the river under the words does not move.'],
    ['a dotted route from a small jetty on the far side', 'seed', 'The route is a Catmull-Rom curve through the four stops, measured once so the ferry can be placed by stop number. The far bank\'s palms, roofs and hills come from the seed.'],
  ],
};
