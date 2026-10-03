# Vad

*Marathi: the banyan, India’s national tree, and the village’s shade, meeting place and landmark.*

The branches are not drawn. They are grown: invisible points fill the shape of a canopy, and every branch tip reaches toward the points nearest it until the space is claimed. Then the banyan does what only a banyan does. Roots drop from its limbs, a few reach the ground and slowly thicken into new trunks, which is how one tree becomes a grove. Set progress and the tree grows exactly as far as the work has gone.

```html
<script type="module" src="susegad/scenes/vad/index.js"></script>

<!-- a set-up that takes a while: the tree grows as the work does -->
<sg-scene id="setup" name="vad" progress="0" label="Setting up your account"></sg-scene>
<script type="module">
  // call this from your real work, never from a timer
  const setup = document.getElementById('setup');
  function onProgress(done, total) { setup.setAttribute('progress', (done / total).toFixed(3)); }
</script>

<!-- warm: it grows by itself, then the ink boils gently -->
<sg-scene name="vad" register="warm" seed="4"></sg-scene>
```

| Param | Values | Default | What it does |
|---|---|---|---|
| `progress` | 0 to 1 | absent | Absent: time grows the tree (about 45 s in warm, 36 s in playful). Set: the growth stands exactly that far along, 0 the bare platform and 1 the grown tree with its pillars, and the status says the percentage. |
| `words` | `panel`, `world` | `panel` | `world`: in warm and playful the slotted words (a heading and paragraphs of plain text) are written in the sky beside the tree, each line ending where the canopy begins, and re-laid four times as it grows. Quiet, small screens and text at 200% keep them on the panel. The type tier and Pretext load only then. |

## The prompt

Grow a banyan tree in pen and ink on handmade paper, in canvas JavaScript. Use the space-colonization algorithm: scatter about a thousand attractor points inside a wide, umbrella-shaped canopy, start a short stout trunk that splits into two or three leaders, and let every branch tip grow a small step toward the attractors nearest it, deleting attractors once a branch reaches them. Record the step at which each node was born, and replay the growth over about twenty seconds. Thicken limbs with the pipe model, so a parent’s thickness follows from its children’s. Draw thin branches as wobbly ink ribbons, and thick ones as outlines with hatching on the shaded side. Suggest leaf masses with short hatch strokes over a pale green wash. Then drop aerial roots from the limbs in hanging bunches; let a few reach the ground and thicken into new pillar trunks. Add a stone platform around the trunk and a bicycle leaning on it for scale. Redraw at twelve frames a second with the wobble re-rolled, so the ink boils gently. Give it a progress attribute that holds the growth exactly that far along, three registers (quiet shows the grown tree, warm grows it slowly, playful grows a new one on Enter), and show the grown tree, still, under any words laid over it. When the page asks for words in the world, write its own words in the sky beside the tree, each line ending where the canopy begins, and let the paragraph make room as the tree grows.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| space-colonization algorithm | emergence | No branch is placed by hand. Each tip only asks “which attractors are nearest me?”, and the whole branching structure emerges from that. |
| Record the step at which each node was born | seed | The tree is grown instantly and completely from a seed, then replayed in birth order. The growth animation is just a filter: show the nodes born before now. The whole replay, roots and pillars included, takes about 36 seconds (45 in warm). |
| outlines with hatching on the shaded side | hatch | Big limbs get two contour lines and diagonal strokes on the side away from the light, the way a pen illustrator models form. |
| wobbly ink ribbons | wobble | Every branch is a filled ribbon whose edges drift with smooth noise and whose width breathes, so no line is ruler-straight. |
| twelve frames a second with the wobble re-rolled | boil | While it grows, the tree is redrawn only on a twelve-a-second beat. Once it is grown, three boil variants are painted once and cycled 3 times a second in warm and 4 in playful, so the finished drawing shimmers for the cost of one image. |
| a progress attribute that holds the growth exactly that far along | state | With progress set, the moment of the growth comes from the number alone: 0 is the bare platform, 1 the grown tree with its pillars. Time never moves it, and the status says the percentage. |
| show the grown tree, still, under any words | calm | The page reports where its text sits; inside those boxes, and 20 units round them, the first finished variant is drawn over the growing tree, so the words never sit on moving ink. |
| write its own words in the sky beside the tree | calm | With words="world", the type tier (Pretext) lays each line from a fixed margin to the canopy’s edge, one width per line, at the largest size you can read; the words stay real text. The paragraph is laid again only four times while the tree grows, each time against the canopy as it will be when that quarter of the growth ends, so no leaf ever grows under a line. On a phone or with text at 200% the words go back to the panel. |

## Accessibility

The drawing's name is its `alt`. With `progress` set, the element says the percentage in a polite status region. Once grown, the ink boils a few times a second; the pause button stops it, and quiet and reduced motion show the grown tree still. In playful the drawing takes focus and Enter or Space grows a new banyan. Under any words laid over it, the tree is shown grown and still. With `words="world"`, the words in the sky are the page’s own heading and paragraph, one span per line, read in order; they hold only while the body is at least 0.875rem and the heading 1.25rem.

## Credit

The banyan and the stone platform round its trunk are the village meeting place across India. "Vad" (Marathi) and its gloss are on the owner's confirm list; Konkani has its own word for the banyan.
