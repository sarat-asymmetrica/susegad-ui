# Tinto

*Konkani: the market square of a Goan village or town, where the bakery, the taverna, the bus stop and the gossip meet.*

A village square at half past ten: the bread man on his second round, a fish seller and the cat she has promised the heads to, a card game under the tree, a motorcycle pilot reading yesterday’s paper, the bus to Mapusa filling up, and a dog asleep in the one place everyone has to walk around. Point at anyone to read their line; every line is also written out for screen readers. A study for crowded pictures that stay friendly and readable, where the detail rewards a second look: an empty state, a 404, and later, who is here.

```html
<script type="module" src="susegad/scenes/tinto/index.js"></script>

<!-- a 404: the tourist's line stays up -->
<sg-scene name="tinto" register="warm" focus="tourist" label="A village square">
  <h2>This page isn't here</h2>
  <p>Try the menu above, or go back to the start.</p>
</sg-scene>

<!-- playful: the arrow keys move a hand; Enter shows the next line -->
<sg-scene name="tinto" register="playful"></sg-scene>

<!-- glass words: the panel becomes a pane of frosted glass you can drag by its grip, and the people make room -->
<sg-scene name="tinto" movable label="A village square">
  <h2>Come for the rain</h2>
  <p>Our lowest rate, June to September.</p>
</sg-scene>

<!-- words in the world: the heading and paragraph are chalked on the Taverna’s board -->
<sg-scene name="tinto" words="world" label="A village square">
  <h2>Come for the rain</h2>
  <p>Our lowest rate, June to September.</p>
</sg-scene>
```

| Param | Values | Default | What it does |
|---|---|---|---|
| `focus` | a vignette id: `crows`, `taverna`, `bakery`, `shoppers`, `walker`, `fish`, `cards`, `tourist`, `cow`, `coconut`, `pilot`, `poder`, `dog`, `cart`, `kids`, `post`, `bus` | absent | Pins that person's line, in every register, quiet included. |
| `lines` | boolean | true | `false` draws the square with no caption cards. The list for screen readers stays. |
| `words` | `panel`, `world` | `panel` | `world`: in warm and playful the slotted words (a heading and paragraphs of plain text) go on the Taverna’s chalkboard, and each shop hangs its hours on a plaque that opens its detail. Quiet, small screens and text at 200% keep the words on the panel and the shops in a plain list. The type tier and Pretext load only then. |

## The prompt

Draw a crowded Goan village square in ink and flat colour on paper, in plain JavaScript on a canvas. Paint the buildings once (a market arcade, a small whitewashed chapel, a blue bakery and a green taverna with a clock), a big tree with a round laterite platform, and the dusty square. Then draw more than a dozen small round figures live, each a little looping story: the bread man cycling a slow circuit and sounding his horn, a fish seller with a basket and a waiting cat, two old men playing cards on the platform, a dog asleep in the middle, a motorcycle taxi rider reading a paper, children chasing a ball, a coconut seller swinging his knife, a lost tourist turning his map, the bus with its conductor calling out, crows on the wire. Scale the figures by how far down the square they stand. Give each vignette one caption: show the one nearest the pointer on a small hand-lettered card with a leader line, and when the pointer is away, show them one after another. Keep every caption as real text beside the drawing too, so a screen reader can read the whole square. Give it three registers: quiet is a finished still with no card, warm is an easier morning with a slow round of captions, and playful is the full square, where the arrow keys move a hand and Enter shows the next person’s line. Where the page puts its own words over the square, let the people under them hold still, and keep the card on the other side. When the page asks for words in the world, chalk its own words onto a board outside the taverna, laid line by line into the board’s arched shape, and hang each shop’s hours on a plaque under its sign that opens the shop’s detail when pressed; where the board is too small to read, leave the words on their panel.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| draw more than a dozen small round figures live | wobble | Every figure is built from the same few parts (a bean for a body, a circle for a head, inked strokes for limbs), posed by a handful of numbers. That keeps a crowd cheap enough to draw every frame. |
| each a little looping story | loop | Each vignette is a function of time: the bicycle’s angle on its circuit, the ball’s bounce, the knife’s swing, the cat’s tail. Nothing is stored between frames. The people are redrawn 8 times a second in warm and 12 in playful, on twos like hand-drawn animation, and not at all between. |
| show the one nearest the pointer | interaction | Each vignette hands back an anchor that moves with it. The nearest anchor within 90 units of the pointer wins, and its card is drawn beside it with a pencil line back to the figure. |
| Paint the buildings once | boil | The square and its buildings are painted once into a cached layer; only the people boil, re-rolling their wobble 4 times a second in warm and 6 in playful, which is what makes the place feel alive. |
| Keep every caption as real text beside the drawing | calm | The renderer writes a list of all seventeen lines next to the canvas, hidden from the eye and read by screen readers, and says one line aloud (politely, once) when the keyboard hand picks someone. |
| let the people under them hold still | calm | Anyone standing under the page’s text stops moving and boiling; the bread man, the walker and the children step behind the words until their path comes out the other side. The round skips them, and the card is placed on the side away from the text. |
| chalk its own words onto a board | calm | With words="world", the type tier (Pretext) lays each line into the arch at the largest size you can read, and the words stay real text over the drawing, where they can be selected and translated. Only the line boxes hold still; in playful, chalk rain runs down round them. On a phone or with text at 200% they go back to the panel, and the plaques to a plain list. |

## Accessibility

The drawing's name is its `alt`. Beside it, inside the element, is a list of all seventeen lines as real text ("The poder on his bicycle. The poder, on his second round. The horn means bread."), hidden from the eye and read by screen readers in order, far to near. In playful the drawing takes focus: the arrow keys move a hand over the square and the nearest person's line is shown and said once in a polite live region; Enter or Space shows the next person's. Nothing the square shows is only in the drawing. With `words="world"`, the words on the board are the page’s own heading and paragraph, one span per line, read in order before the people’s lines; each plaque is a button named with its shop ("Mercado, Open 7 to 1") that opens the detail beside it, and Escape closes it. The board and plaques hold only while their words are at least 0.875rem (body), 1.25rem (heading) and 0.75rem (plaque, on a 24 px target); below that the words are flat again.

## After

After **Mario Miranda**: density that rewards looking, and affection for everyone in the frame. Left: his drawings, his people and his line; these figures are our own round little folk (HOMAGE.md, rule 1).

## Credit

The tinto is the heart of a Goan village or town. The poder, the bus conductor's "Mapsa, Mapsa, Mapsa!" and the taverna are everyday Goa, drawn with affection. The lines are on the owner's confirm list for a Goan reader before anything leaves the building.
