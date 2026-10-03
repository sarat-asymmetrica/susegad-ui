// Vahi: what the scene is called, what it shows, and how to ask for it.

export const meta = {
  id: 'vahi',
  title: 'The pile becomes a ledger',
  word: 'Vahi',
  gloss: 'Marathi: a notebook, and the account book a shop keeps its days in',
  caption:
    'Receipts, invoices, a carbon bill book and a scrawled chit lie in a heap on a teak table. One at a time, each paper lifts, drifts over the open account book while its line is written, and settles on a neat stack. When the last line is in, the book closes and its string is wound round.',
  alt: 'A pile of loose receipts and invoices being entered into a red cloth account book and stacked neatly',
  keys: 'Arrow keys move your hand over the table and nudge the loose papers. Enter or Space throws the pile again to be sorted afresh.',
  W: 1200,
  H: 800,
  seed: 3,
  stillTime: 1e6,
  tier: 'shared',
  credit:
    'The red cloth account book tied with string is kept by shopkeepers and traders across India. Some communities also honour the new year\'s book at Diwali; this drawing shows only a plain cover, with no mark of worship.',
  techniques: ['model', 'easing', 'texture', 'state', 'calm', 'interaction', 'seed', 'wobble'],
  prompt:
    'Draw a teak table seen from directly above, on a canvas with no image files. Paint the planks once into an offscreen layer: a warm wash, long flowing grain lines from smooth noise, a knot or two, and window light falling off across the table. On it lies a loose pile of paper: long thermal receipts torn at both ends, invoices folded in three with a ruled table, a pink or yellow carbon bill book slip with its perforated stub, and a small chit torn from a ruled notebook with pencil scrawl. Paint each paper once as a sprite with its own soft shadow, and draw the sprites turned and lifted each frame. Beside the pile, a red cloth account book lies open, ruled in pale blue with red columns, last month in faded ink on the left page. One paper at a time, lift it, carry it in a gentle arc over the book, hold it while a pen writes its line on the right-hand page in cursive-looking scribble, then settle it squared-up on a neat stack. When the last line is written, swing the left board over the spine to close the book, clamp the stack with a steel clip, and wind a cotton string round the cover. Make it a pure function of time so it can be tested in Node, and stop drawing once the book is shut. Add a progress attribute from 0 to 1: when set, sort exactly that much and let time stand still. In the quiet register, draw only hairlines: the closed book beside the stack. In playful, let the pointer nudge loose papers, and a click throws the pile again. When text sits over the drawing, move the table\'s action into the largest clear space beside it.',
  map: [
    ['Paint the planks once into an offscreen layer', 'texture', 'The table is painted once per size and theme into a cached canvas (grain lines from Perlin noise, knots, a light gradient) and blitted every frame, so a frame never redraws wood.'],
    ['Paint each paper once as a sprite with its own soft shadow', 'texture', 'Each paper is drawn once into its own small canvas at device resolution, with its shadow blurred once beside it. A frame only turns, lifts and places the eight sprites.'],
    ['carry it in a gentle arc', 'easing', 'A paper\'s journey is four beats of its own time: lift (ease-out), drift over the book (ease-in-out along a bowed path), hold while the line is written, then settle on the stack (ease-in-out), with the shadow growing as it lifts.'],
    ['cursive-looking scribble', 'wobble', 'A line of entry is a row of words made of looping humps, drawn with the engine\'s ink so its width breathes like pen pressure. The pen tip follows the end of the line being written.'],
    ['Make it a pure function of time', 'model', 'model({ time, seed, register, params }) returns every paper\'s pose, the entries written, the pen and how far the book has closed. It runs in Node, and returns settled once the string is wound, so the element stops drawing.'],
    ['when set, sort exactly that much and let time stand still', 'state', 'With progress set, the model ignores time: that many papers are on the stack and that many lines are on the page, the book closes only at 1, and the same number is read out as text.'],
    ['move the table\'s action into the largest clear space', 'calm', 'fitAround measures the slotted text\'s boxes and scales the pile, book and stack into the largest clear band beside them. The table itself stays put.'],
    ['a click throws the pile again', 'interaction', 'In playful, a click, Enter or Space reseeds the pile: every paper flies out from where it lay, pushed away from your hand, and the sorting starts again. Moving the pointer over loose papers shoves them along.'],
  ],
};
