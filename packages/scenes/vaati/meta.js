// Vaati: what the scene is called, what it shows, and how to ask for it.

export const meta = {
  id: 'vaati',
  title: 'The bowl fills',
  word: 'Vaati',
  gloss: 'Marathi and Hindi: a small bowl',
  caption:
    'A bowl seen from directly above. Pieces of fresh pasta fly in from the edges, each with a spin, and settle, nudging the ones already there. Sauce is poured and spreads in a swirl between them, grated cheese falls and catches, and basil leaves land. Then the bowl rests.',
  alt: 'A bowl of filled pasta seen from above, with tomato sauce, grated cheese and basil leaves',
  keys: 'Enter or Space tosses the pasta up so it lands again.',
  W: 1200,
  H: 800,
  seed: 3,
  stillTime: 1e6,
  tier: 'shared',
  credit: 'The wide bowl with a painted rim is the vaati and thali of Indian kitchens; the drawing shows a plain one with a rim of dots, with no mark of any maker or place.',
  techniques: ['model', 'easing', 'texture', 'state', 'interaction', 'seed', 'wobble'],
  prompt:
    'Draw a bowl seen from directly above, on a canvas with no image files, centred on a plain ground with room all round it. Paint the bowl once into a cached layer: a painted rim with a ring of dots and a glaze highlight, a sloping inner wall that darkens softly toward the rim, a flat floor, and a soft shadow on the table. Fresh pasta flies in from the edges of the canvas, mostly the top and bottom, one piece at a time, each along a curved arc with its own spin, looking larger while it is in the air, and settles with a small squash. Draw each kind of pasta from a small pure shape function and paint it once as a sprite: ravioli as a scalloped square pillow with a crimped edge and a domed centre, tortellini with a navel and a folded tip, gnocchi with ridges, farfalle as a pinched bow. When a piece lands it shoves the earlier ones a little, and they ease back with a small overshoot. Then pour the sauce: a glossy ribbon spirals out from the middle over the pasta while a pool spreads beneath and between the pieces. Then let grated cheese fall as small slivers and curls that catch on top, and last let three basil leaves land. Then the bowl rests and the scene stops drawing, and says once that the meal is made. Make it a pure function of time so it can be tested in Node. Add a progress attribute from 0 to 1: when set, show exactly that full and let time stand still. In the quiet register, draw only hairlines, with nothing washed. In warm, use ink and wash on handmade paper. In playful, use flat poster colour with a bold ink outline, brisker and bouncier, and let a click, Enter or Space toss the pasta up so it lands again in a new arrangement.',
  map: [
    ['Paint the bowl once into a cached layer', 'texture', 'The rim, wall, floor, dots, highlight and shadow are painted once per size, theme and register into a cached canvas and blitted every frame. Pieces, flakes and leaves are each painted once into a small sprite at device resolution, so a frame only places them.'],
    ['along a curved arc with its own spin', 'easing', 'Each piece has its own flight: a quadratic arc from an edge off the frame to its rest, eased out so it slows as it lands, with a seeded spin that unwinds and a scale that shrinks from the camera to the bowl.'],
    ['Draw each kind of pasta from a small pure shape function', 'seed', 'A shape is a function of a seeded rng that returns an outline and painted layers (fill and line roles the renderer colours). SHAPES lists each kind with its count and size, so a kitchen adds momo or modak with one entry.'],
    ['it shoves the earlier ones a little', 'model', 'makeBowl packs the rests with a seeded relaxation, then gives each earlier piece the shove of every later one that lands near it. A piece sits back by the sum of the shoves still to come, and settleCurve eases it forward with an overshoot as each lands.'],
    ['a glossy ribbon spirals out from the middle', 'wobble', 'The pour is a spiral from swirlPoint, drawn as a tapering ribbon with a highlight along it and a bright drop at its head. The pool beneath grows as a lumpy disc from a few low harmonics.'],
    ['says once that the meal is made', 'state', 'The renderer dispatches sg-scene-settled (bubbling, composed) once per run when the garnish lands, and sets data-settled for a page that came late. It never fires under progress, and a toss does not fire it again.'],
    ['Make it a pure function of time', 'model', 'model({ time, seed, register, params }) returns every piece, flake and leaf pose, the sauce, and done and settled. It runs in Node, and returns settled once the bowl is still, so the element stops drawing.'],
    ['when set, show exactly that full and let time stand still', 'state', 'With progress set, the model ignores time and shows the bowl that full, at 1 the finished still, and the same number is read out as text.'],
    ['draw only hairlines, with nothing washed', 'texture', 'Quiet paints outlines only, in the ink and sauce colours at a hairline width; a piece is filled with the paper so it still hides what lies under it. Each piece is drawn at 0.84 so paper shows between neighbours, with its outline and one defining stroke only (no folds, veins or hatching), and only every sixth fleck of cheese, so the pieces read as separate pieces at phone width.'],
    ['a click, Enter or Space toss the pasta up so it lands again', 'interaction', 'In playful the renderer sets tossAt and tossN on the element. The model lifts each piece in turn, turns it and lands it in a slightly different place, and reports the scene not settled until it has landed, so the loop wakes and then rests again.'],
  ],
};
