// Nod: what the scene is called, what it shows, and how to ask for it.

export const meta = {
  id: 'nod',
  title: 'The helper that asks first',
  word: 'Nod',
  gloss: 'The small yes a person gives before anything goes out in their name (a working title)',
  caption:
    'A cutting chai steams on a marble café table beside a phone. A message arrives, a helper drafts the reply in a dashed card with an empty tick, and the draft waits. It goes out only when a person nods.',
  alt: 'A glass of chai beside a phone showing a drafted reply waiting for approval',
  keys: 'Enter or Space is your nod: it sends the waiting draft. Then the next message comes, and the next draft waits for you.',
  W: 1200,
  H: 800,
  seed: 1,
  stillTime: 4.5,
  tier: 'pan-indian',
  credit:
    'The ribbed cutting-chai glass and its curl-noise steam are ported from the Susegad sketchbook\'s Chai plate. The Irani café table, white marble on a dark edge, is a Bombay and Pune institution that Goa\'s cafés share.',
  techniques: ['model', 'noise', 'particles', 'boil', 'texture', 'interaction', 'calm'],
  prompt:
    'Draw a café table from the front on a canvas with no image files: a lime-washed wall with a darker dado, a white marble table top with grey veins, and on it a ribbed cutting-chai glass of milky tea at the left and a phone on a small wooden stand at the right. Let the steam rise as thin wisps that follow a curl-noise field, each wisp travelling up its streamline and fading. On the phone, show a chat drawn with scribble in place of words: a message arrives from the left, three dots show the helper typing, and a reply appears on our side as a draft in a dashed card, with a small pen nib and an empty tick circle. The draft waits. Nothing is sent until a person nods: in the warm register a finger comes up once and taps the tick, the tick fills green, and the draft becomes a sent bubble; after that only the steam moves. In playful, the draft waits for the viewer: a click, Enter or Space is the nod, and then the next message comes and the next draft waits. Write the whole conversation as a pure function of time and of the moments someone nodded, where a nod counts only while a draft is waiting. Redraw the glass\'s ink outline and the steam on twos so they boil like paper animation. Quiet is a hairline still of the phone with the draft waiting, unticked. Fade the steam where words sit over the drawing.',
  map: [
    ['follow a curl-noise field', 'noise', 'Curl noise is the swirl of a smooth noise field. It never bunches up or drains away, so steam built on it curls and drifts like the real thing. Ported from the sketchbook\'s Chai plate.'],
    ['each wisp travelling up its streamline and fading', 'particles', 'A wisp is a short window sliding along a path traced through the field. One is born every 0.8 seconds and fades by 4.8, so the loop never needs resetting.'],
    ['a pure function of time and of the moments someone nodded', 'model', 'thread(t, nods) returns the bubbles, the typing dots and the draft. A nod before the draft appears is ignored, so the tests can prove that without a nod at the right moment nothing is ever sent.'],
    ['a click, Enter or Space is the nod', 'interaction', 'The renderer keeps the moments you nodded and passes them to thread(). The finger comes back briefly after each nod, as if it had tapped.'],
    ['on twos so they boil like paper animation', 'boil', 'The glass\'s outline re-rolls its wobble eight times a second in warm and twelve in playful, and the steam and the typing dots move on the same beat, so between beats the frame is skipped.'],
    ['a white marble table top with grey veins', 'texture', 'The wall, the table, the tea in the glass and the phone\'s body are painted once into a cached layer. Each frame draws the ink outline, the steam and the screen over it.'],
    ['Fade the steam where words sit over the drawing', 'calm', 'A wisp whose middle falls in or near a slotted block of text is drawn at a sixth of its strength.'],
  ],
};
