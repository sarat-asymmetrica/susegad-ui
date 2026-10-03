# Abri

*Deccani, from Persian: cloud paper, the marbled paper of Bijapur and Golconda.*

Drops of indigo, ochre, madder and grey-green are shaken onto a tray of thickened size, and each one spreads and pushes the others into rings. A stylus is drawn back and forth through them, the colours drift into clouds, and a sheet is laid on the surface and lifted off with the pattern on it. In playful, move through the size to marble it yourself before the paper goes down, or press Enter to drop a colour where your hand is.

```html
<script type="module" src="susegad/scenes/abri/index.js"></script>

<!-- warm: sheet after sheet, at an easier pace -->
<sg-scene name="abri" register="warm">
  <h2>Every sheet is one of a kind</h2>
  <p>Made by hand, one at a time.</p>
</sg-scene>

<!-- playful: move through the size to marble it; Enter drops a colour -->
<sg-scene name="abri" register="playful" seed="4"></sg-scene>
```

No params: the register, the seed and the theme decide everything. A seed is a sitting: sheet after sheet, each taking the next seed.

## The prompt

Show a sheet of Deccani abri, the marbled paper of Bijapur and Golconda, being made, in canvas JavaScript with no image files. Look down into a wooden tray of cream size. From a seed, pick a restrained mineral palette of indigo, ochre, rose-madder and grey-green on cream, and let drops of colour land one after another; each drop spreads into a circle and pushes every earlier colour boundary outward, so repeated drops make rings. Keep the boundaries as crisp polygons and move their points, not pixels. Then draw a stylus back and forth through the colours: have it write velocity into a displacement field that eases off like thick liquid, and advect every boundary point through it. Let the size drift into soft clouds with a slow flow made from domain-warped noise, noise of noise, so the pattern veins and billows. Lay a sheet of paper on the surface from one edge, lift it and turn it over to show the print, mirrored as a real print is, with a deckle edge, paper grain and a few tiny air bubbles. Hold it, then start a new sheet. Let the viewer drag through the size to marble it themselves. Give it three registers: quiet is the lifted print as a finished still, warm makes sheet after sheet at an easier pace, and playful takes the viewer’s hand, from the pointer or the arrow keys, with Enter dropping a colour. Where the page lays its words over the tray, hold the size still under them and let no drop land there.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| each drop spreads into a circle and pushes every earlier colour boundary outward | fields | A drop of radius r moves every point p away from its centre c to c + (p − c)·√(1 + r²/‖p − c‖²). That formula keeps areas exact, so old drops become thin rings around new ones without any pixels being smeared. |
| move their points, not pixels | colour | Every colour is one closed polygon, painted oldest first. Because the marbling moves only the outlines, the edges stay sharp however far they are pulled. |
| write velocity into a displacement field that eases off like thick liquid | interaction | The stylus and your hand stamp their velocity into a coarse grid of 14-unit cells. The grid fades by e^(−4.2·dt) each step, and every boundary point is carried along by it, so the colours keep gliding for a moment after the stylus has passed. A key press counts as one stroke of a tenth of a second. |
| a slow flow made from domain-warped noise, noise of noise | noise | Noise is sampled at coordinates that are themselves bent by noise, and the flow is taken as the curl of that field. A curl never piles colour up or thins it out, so the clouds swirl without losing paint. |
| From a seed, pick a restrained mineral palette | seed | The seed chooses one of four historical colour pairings, where every drop lands, and whether the stylus combs straight passes, waves or a spiral. Each new sheet takes the next seed. |
| a deckle edge, paper grain and a few tiny air bubbles | texture | The print is captured once into a layer, multiplied by painted paper, cut to a torn edge and dotted with pale specks where air was trapped under the sheet. |
| hold the size still under them and let no drop land there | calm | The page reports where its text sits. Boundary points in those boxes, and within 30 units of them, are not carried by the stylus, the hand or the drift; drops aimed there never land, and the ripples and the stylus are not drawn there. |

## Accessibility

The drawing is decorative: its name is its `alt`, and it shows no state. Quiet and reduced motion show the lifted print, face up; it takes a moment to make, and the element reports ready once it is there. In playful the drawing takes focus: the arrow keys move a hand (a small ring) that drags the colours with it, and Enter or Space drops a colour where the hand is. Under any words laid over the tray the size holds still, and no drop lands there.

## Credit

Abri, cloud paper, was made in the Deccan courts of Bijapur and Golconda, where marbling came from Persia. The name, the gloss and the four historical palettes are on the owner's confirm list.
