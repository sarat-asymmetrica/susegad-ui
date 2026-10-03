# The tiatr curtain

*Words to code.*

| The words | What it is | Where it lives |
|---|---|---|
| "a heavy red velvet curtain with vertical folds" | the tiled five-stop velvet strip, drifting slowly sideways | `curtain.js`'s `foldStrip` and the pattern in `drawCurtain` |
| "a hem that ripples when it lands" | the caller's own function: `hem(x, bottom)` returns the hem's y | the scene's `rippleAmp`, the interlude's `hemWave` |
| "gold fringe along the hem" | a thick gold ink stroke plus short tassels | the end of `drawCurtain` |
| "the curtain is down by this much" | `curtainEdge(box, drop, hem)`, pure, tested in Node | `curtain.test.js` |

Use it from a canvas: `drawCurtain(g, { x0, y0, x1, y1 }, { drop, hem, t, scale })`. `scale` is canvas units per design unit (1 for the scene; the interlude passes its width over the scene's opening). `within(g, path)` runs while clipped to the curtain, which is where the interlude puts its spotlight. It draws no text, and the pelmet, footlights and any singer are the caller's.
