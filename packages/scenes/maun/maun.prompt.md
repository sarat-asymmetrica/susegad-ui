# Maun

*silence; a stillness kept on purpose.*

A painting that makes itself and then stops. A warm ground goes down first, then thin veils of colour are rolled across it, some pressed hard and some barely touching, and others are scraped back so the ground glows through. Once the last pass is down, nothing moves except a slow breath of light. Every seed is a different painting in one of four palettes: turmeric, monsoon, kokum and indigo on lime. A quiet background for words, and a cover for a document.

```html
<script type="module" src="susegad/scenes/maun/index.js"></script>

<!-- a quiet cover: the finished painting, words on it -->
<sg-scene name="maun" register="quiet" palette="indigo" seed="4">
  <h2>Annual report, 2026</h2>
  <p>For the members of the cooperative.</p>
</sg-scene>

<!-- warm: it paints itself in about ten seconds, then only breathes -->
<sg-scene name="maun" register="warm" palette="turmeric"></sg-scene>
```

| Param | Values | Default | What it does |
|---|---|---|---|
| `palette` | `seed`, `turmeric`, `monsoon`, `kokum`, `indigo` | `seed` | `seed` lets the seed choose, as the plate did. `indigo` is indigo on lime. |

## The prompt

Make a generative colour-field painting in plain JavaScript that builds itself on a canvas and then goes still. Keep two offscreen canvases: a luminous ground (a warm glow with soft mottling) and a paint layer above it. From a seed, plan about forty passes, each either a roll (a broad, nearly horizontal band of thin, translucent paint with ragged ends and streaks along the roller’s direction) or a scrape (the same kind of band, erased out of the paint layer with destination-out so the ground glows through). Choose one restrained palette per seed. Apply one pass per frame so you can watch the painting accumulate. When the last pass is down, stop adding anything and let only a very slow, soft breath of light drift across the surface, and keep that breath away from any words laid over the painting. Give it three registers: quiet shows only the finished painting, warm lets it make itself and then breathe, and playful lets a click or the Enter key scrape a band back where the hand is.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| two offscreen canvases: a luminous ground … and a paint layer above it | texture | Keeping the ground apart from the paint means scraping can reveal real light instead of an empty hole. The ground is painted once; the paint layer only ever gets added to or taken from. |
| erased out of the paint layer with destination-out | texture | destination-out removes what is already there wherever you draw, in proportion to how opaque you draw it. A thin scrape leaves a ghost of the paint; a hard one goes back to the glow. |
| From a seed, plan about forty passes | seed | Every pass is decided up front from the seed: thirty passes over a denser zone, two darker edges and two last scrapes, 34 in all. So a seed is a painting, and replay makes exactly the same one. The finished still lays them down six a frame, so no frame stalls. |
| streaks along the roller’s direction | noise | Inside each band, hairline streaks follow the roller, their opacity set by smooth noise so the paint looks dragged rather than printed. On a slow machine the governor keeps fewer of them. |
| one restrained palette per seed | colour | Each palette is a glow and three or four paints close in hue, so the painting stays one quiet colour with depth in it rather than many colours competing. The palette attribute chooses one by name. |
| keep that breath away from any words laid over the painting | calm | The page reports where its text sits. Under those boxes, and 24 units round them, the painting is drawn again without the breath, so the words sit on paint that does not move. |

## Accessibility

The drawing is decorative: its name is its `alt`, and it shows no state. The making takes about ten seconds and then only a slow breath of light moves; the pause button stops even that. In playful the drawing takes focus, the arrow keys move a hand and Enter or Space scrapes a band of paint back, as a click does. Words laid over it sit on a scrim, and the breath keeps away from them.

## After

After **V. S. Gaitonde**: silence as a working method, layers of translucent colour scraped back with the light coming from underneath. Left: his paintings, his forms and his marks; this is a process, not a picture of his (HOMAGE.md).

## Credit

The palette names come from Goan colours: turmeric, the monsoon, kokum, and indigo on a lime-washed wall. They are on the owner's confirm list.
