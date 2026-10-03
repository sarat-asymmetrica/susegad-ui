# Neel

*Hindi: indigo, meaning the dye, the colour and the plant it comes from.*

A carved block is generated from the seed and pressed into cotton one impression at a time. Indigo outlines go down first, then a second block fills the flowers, never quite in register. Every impression is a little starved of ink and a little turned, because hands are. In playful, click the cloth, or use the arrow keys and Enter, to press one yourself. Set progress and exactly that share of the impressions is printed.

```html
<script type="module" src="susegad/scenes/neel/index.js"></script>

<!-- an order being made: exactly that share of the length is printed -->
<sg-scene id="order" name="neel" progress="0" label="Printing your order"></sg-scene>
<script type="module">
  // call this from your real work, never from a timer
  const order = document.getElementById('order');
  function onProgress(done, total) { order.setAttribute('progress', (done / total).toFixed(3)); }
</script>

<!-- playful: click the cloth, or use the arrow keys and Enter, to press a block -->
<sg-scene name="neel" register="playful" seed="3"></sg-scene>
```

| Param | Values | Default | What it does |
|---|---|---|---|
| `progress` | 0 to 1 | absent | Absent: the printer's clock prints the length (about 84 s in warm, 56 s in playful) and rests. Set: exactly that share of the impressions is printed (outlines first, then the fill), the block is home, and the status says "40% done". |

## The prompt

Simulate Rajasthani hand block printing on khadi cotton in canvas JavaScript, with no image files. Paint the cloth once into an offscreen layer: an off-white base with fine crossing warp and weft threads and a few thick slubs. From a seed, generate a small buti motif (a bud, a rosette or a sprig) with bilateral symmetry, built from simple petal and leaf curves. Stamp it across the cloth in a half-drop repeat, one impression at a time: show the wooden block’s shadow descend, press and lift, starting slow and settling into an unhurried rhythm with a breath between impressions. Make every impression imperfect: erase patches with a noise mask so the ink looks starved, let the ink fade between dips, and add a slight random turn. Print indigo outlines first, then a second colour off-register on top, blended with multiply. Let a click press a new impression wherever the viewer clicks. Drive the printer from the clock alone, so any moment of the printing can be drawn again exactly, and give it a progress attribute: when it is set, print exactly that share of the impressions and rest. Leave the cloth plain wherever the page lays its own words over it. Give it three registers: quiet is the finished length, warm prints it at an unhurried pace and rests, playful prints faster and takes the hand.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| fine crossing warp and weft threads | texture | The cloth is thousands of faint lines painted once into a cached layer, in four bands so no frame stalls. Every impression is multiplied over it, so the weave shows through the ink. |
| From a seed, generate a small buti motif | seed | The seed picks the motif type, petal count, proportions and colourway. Each part is drawn once on one side and mirrored, which is how a carver keeps a block symmetric. |
| erase patches with a noise mask so the ink looks starved | noise | Smooth noise decides where the ink failed to transfer, so the gaps come in soft patches instead of random pixels, the way a real block runs dry. |
| starting slow and settling into an unhurried rhythm | easing | Each impression’s duration eases from about a second and a quarter down to around six tenths of one, and the block hovers for a moment before moving on, so the printer seems to find a calm rhythm. A length takes about 84 seconds in warm, and two thirds of that in playful. |
| press a new impression wherever the viewer clicks | interaction | In playful a click, or Enter where the keyboard hand is, presses both blocks there at once: the outline, then the fill a few units off. |
| Drive the printer from the clock alone | model | printerAt(seq, t) is a pure function: how many impressions are down and where the block is at printer-time t, from each impression’s duration and breath. The renderer only prints the ones it has not printed yet. |
| print exactly that share of the impressions and rest | state | With progress set, the count comes from the number alone, the block goes home, the scene rests until the attribute changes, and the status says the percentage in words. |
| Leave the cloth plain wherever the page lays its own words over it | calm | An impression whose motif would land within 10 units of a text box is left out of the run, so the words sit on bare cotton and nothing is pressed under them. |

## Accessibility

The drawing's name is its `alt`. With `progress` set, the element says the percentage in a polite status region, at most once a second. The printing is slow and steady, and the pause button stops it. In playful the drawing takes focus: the arrow keys move a hand and Enter or Space presses both blocks there, as a click does. Nothing is pressed under any words laid over the cloth.

## Credit

Hand block printing with carved wooden blocks and natural dyes (indigo, madder, turmeric, iron black) is a living craft across India; the prompt names its Rajasthani form. The motifs are generated from a seed and copy no printer's block. "Neel" and the craft's names are on the owner's confirm list.
