// Tinto: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in tinto.prompt.md (prompts.test.js checks).
import { W, H, STILL_TIME } from './model.js';

export const meta = {
  id: 'tinto',
  title: 'Everyone in the square',
  word: 'Tinto',
  gloss: 'Konkani: the market square of a Goan village or town, where the bakery, the taverna, the bus stop and the gossip meet',
  alt: 'A crowded Goan village square in ink and flat colour: a market arcade, a chapel, a bakery and a taverna around a big tree, and seventeen people and animals, each busy with something of their own.',
  caption:
    'A village square at half past ten: the bread man on his second round, a fish seller and the cat she has promised the heads to, a card game under the tree, a motorcycle pilot reading yesterday’s paper, the bus to Mapusa filling up, and a dog asleep in the one place everyone has to walk around. Point at anyone to read their line; every line is also written out for screen readers. A study for crowded pictures that stay friendly and readable, where the detail rewards a second look: an empty state, a 404, and later, who is here.',
  after: {
    who: 'Mario Miranda',
    took: 'density that rewards looking, and affection for everyone in the frame',
    left: 'his drawings, his people and his line: these figures are our own round little folk',
  },
  keys: 'Arrow keys move a hand over the square and show the line of whoever it is near. Enter or Space shows the next person’s line.',
  W, H, seed: 1, stillTime: STILL_TIME,
  tier: 'local',
  credit: 'The tinto is the heart of a Goan village or town. The poder (the bread man and his horn), the bus conductor’s call and the taverna are everyday Goa, drawn with affection. After Mario Miranda’s crowds, not his drawings.',
  techniques: ['wobble', 'boil', 'interaction', 'loop', 'calm'],
  prompt:
    'Draw a crowded Goan village square in ink and flat colour on paper, in plain JavaScript on a canvas. Paint the buildings once (a market arcade, a small whitewashed chapel, a blue bakery and a green taverna with a clock), a big tree with a round laterite platform, and the dusty square. Then draw more than a dozen small round figures live, each a little looping story: the bread man cycling a slow circuit and sounding his horn, a fish seller with a basket and a waiting cat, two old men playing cards on the platform, a dog asleep in the middle, a motorcycle taxi rider reading a paper, children chasing a ball, a coconut seller swinging his knife, a lost tourist turning his map, the bus with its conductor calling out, crows on the wire. Scale the figures by how far down the square they stand. Give each vignette one caption: show the one nearest the pointer on a small hand-lettered card with a leader line, and when the pointer is away, show them one after another. Keep every caption as real text beside the drawing too, so a screen reader can read the whole square. Give it three registers: quiet is a finished still with no card, warm is an easier morning with a slow round of captions, and playful is the full square, where the arrow keys move a hand and Enter shows the next person’s line. Where the page puts its own words over the square, let the people under them hold still, and keep the card on the other side. When the page asks for words in the world, chalk its own words onto a board outside the taverna, laid line by line into the board’s arched shape, and hang each shop’s hours on a plaque under its sign that opens the shop’s detail when pressed; where the board is too small to read, leave the words on their panel.',
  map: [
    ['draw more than a dozen small round figures live', 'wobble', 'Every figure is built from the same few parts (a bean for a body, a circle for a head, inked strokes for limbs), posed by a handful of numbers. That keeps a crowd cheap enough to draw every frame.'],
    ['each a little looping story', 'loop', 'Each vignette is a function of time: the bicycle’s angle on its circuit, the ball’s bounce, the knife’s swing, the cat’s tail. Nothing is stored between frames. The people are redrawn 8 times a second in warm and 12 in playful, on twos like hand-drawn animation, and not at all between.'],
    ['show the one nearest the pointer', 'interaction', 'Each vignette hands back an anchor that moves with it. The nearest anchor within 90 units of the pointer wins, and its card is drawn beside it with a pencil line back to the figure.'],
    ['Paint the buildings once', 'boil', 'The square and its buildings are painted once into a cached layer; only the people boil, re-rolling their wobble 4 times a second in warm and 6 in playful, which is what makes the place feel alive.'],
    ['Keep every caption as real text beside the drawing', 'calm', 'The renderer writes a list of all seventeen lines next to the canvas, hidden from the eye and read by screen readers, and says one line aloud (politely, once) when the keyboard hand picks someone.'],
    ['let the people under them hold still', 'calm', 'Anyone standing under the page’s text stops moving and boiling; the bread man, the walker and the children step behind the words until their path comes out the other side. The round skips them, and the card is placed on the side away from the text.'],
    ['chalk its own words onto a board', 'calm', 'With words="world", the type tier (Pretext) lays each line into the arch at the largest size you can read, and the words stay real text over the drawing, where they can be selected and translated. Only the line boxes hold still; in playful, chalk rain runs down round them. On a phone or with text at 200% they go back to the panel, and the plaques to a plain list.'],
  ],
};
