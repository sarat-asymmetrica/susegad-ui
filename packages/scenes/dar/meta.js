// Dar: what the scene is called, what it shows, and how to ask for it.

export const meta = {
  id: 'dar',
  title: 'Yours to keep',
  word: 'Dar',
  gloss: 'Konkani and Marathi: a door (a working title)',
  caption:
    'The front of a Goan house: laterite under lime plaster, a painted door in a lime-white surround, a window of oyster-shell panes with its shutters folded back, and bougainvillea over the door. A key on a ring swings in, catches on the brass hook beside the door and sways to rest, and the bolt slides home.',
  alt: 'The front door of a Goan house, with a brass key hanging on a hook beside it',
  keys: 'Enter or Space swings the key. Move your hand to the bolt on the door with the arrow keys, and Enter or Space slides it.',
  W: 1200,
  H: 800,
  seed: 4,
  stillTime: 20,
  tier: 'local',
  credit:
    'The lime-plastered laterite, the moulded door surround and the oyster-shell (carepa) window panes belong to the old houses of Goa and the people who built and keep them. The brass tower bolt follows the Toggle component\'s warm skin.',
  techniques: ['model', 'physics', 'easing', 'texture', 'interaction', 'seed', 'hatch'],
  prompt:
    'Draw the front of a Goan house as an elevation, in ink and wash on paper, with canvas and no image files. Lay lime plaster over a laterite wall, streaked by rain from the eave, and let the plaster fall away in a few seeded patches that show the red blocks, their mortar joints and their pits. Put a row of Mangalore tiles above a dark fascia board. In the middle, a door in two leaves painted deep green, each with three raised panels lit on the top and left bevels, framed by a lime-white moulded surround with a shallow pediment; a stone step before it; bougainvillea spilling over the top left corner. To the right, a window of oyster-shell panes in a wooden grid, with blue shutters folded back on the wall; at night the panes glow with a lamp inside. On the door, a brass tower bolt, and beside the door a brass hook. Paint all of that once. Then a key on a steel ring with a wooden tag swings in along a gentle arc, catches on the hook, and sways to rest as a damped pendulum; then the bolt slides home and its handle turns down, and the drawing stops. Make the swing and the bolt pure functions of time. In quiet, draw only hairlines: the door, the bolt home and the key on its hook. In playful, a click swings the key, and a click by the bolt slides it back or home.',
  map: [
    ['sways to rest as a damped pendulum', 'physics', 'The key\'s angle is a cosine that shrinks exponentially: swingAngle(t) = amplitude × e^(−0.75 s) × cos(3.1 s). Each push in playful adds another damped swing from its own moment.'],
    ['swings in along a gentle arc', 'easing', 'The key follows a quadratic curve from off the top right to the hook, eased in and out, arriving tilted exactly as far as the swing then starts, so there is no jump.'],
    ['Make the swing and the bolt pure functions of time', 'model', 'model() returns where the key is, its angle and how far the bolt has slid. After the bolt is home the frame is settled and the element stops drawing.'],
    ['Paint all of that once', 'texture', 'The wall, the laterite, the tiles, the door, the window and the bougainvillea are painted into one cached layer. A frame is that layer, the bolt\'s shaft and the key.'],
    ['a few seeded patches that show the red blocks', 'seed', 'weather(seed) decides where the plaster has fallen and where the bougainvillea flowers. The same seed always gives the same wall.'],
    ['a click by the bolt slides it back or home', 'interaction', 'activate() looks at where your hand is: within reach of the bolt it toggles the bolt, anywhere else it gives the key a push away from your hand.'],
    ['Lay lime plaster over a laterite wall', 'hatch', 'Every surface is a wash under hatching: the laterite pitted and hatched, the tiles hatched darker at each row\'s edge, the panels shaded on their lower bevels.'],
  ],
};
