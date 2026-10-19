# Picture postcard

A postcard of Goa with a name on it. Type a name, pick a picture, and a 3:2 card is drawn in the browser: a scene from the library in a framed mat, the name under it in any script, a perforated stamp and a postmark carrying an event's words, and a line saying where to make your own. Save it as a PNG, or as a three-second looping GIF, or send it to the share sheet. Nothing leaves the device, and the same name makes the same card.

It is a small gift of Goa, and it fits any occasion: the words on the stamp and postmark are one config file. `events/goa-oct-2026.js` is the one the /postcard page uses.

It composes:

| Piece | Used for |
|---|---|
| the scenes (`posta`, `ferry`, `mithagar`, `tinto`, `saanj`, `dar`, `rampon`) | the picture, by each scene's own `model()` and `createRenderer()` |
| `packages/engine` | the seeded paper (`paper`) and random numbers (`rng`, `hashSeed`) |
| `packages/type` | `fontReady`, which waits for the faces and gives up after four seconds |
| `packages/export` | `canvasToPng`, and `gif.stream.js` for the GIF a frame at a time |

## The prompt

See `recipe.prompt.md`: the words an agent needs to build this, and a table from each phrase to the code that answers it.

## Use

```js
import { preparePostcard, exportPng, makeGif, deliver, mountPostcard, CONCLAVE_2026 } from './recipe.js';

// the page: wires #name, #scene, #card, the buttons and the status line
mountPostcard(document, { event: CONCLAVE_2026 });

// or by hand
const pc = await preparePostcard({ name: 'Asha Naik', scene: 'ferry', event: CONCLAVE_2026 });
const canvas = document.createElement('canvas'); await pc.paint(canvas);
const png = await exportPng(canvas, 'Asha Naik');                  // { blob, bytes, type, filename }
const gif = await makeGif(pc, { onProgress, signal });             // { blob, bytes, frames: 30, width: 900, ms, withinBudget }
await deliver(gif, { share: true });                               // share sheet with the file, else a download
pc.destroy();
```

## Making your own

- **Another event:** copy `events/goa-oct-2026.js`, change the four fields (`stamp`, `place`, `dates`, `line`), and pass it to `mountPostcard`. There is no logo: an organiser's mark needs their files and permission, so the card's own drawn stamp stands in.
- **Other scenes:** `scenes.js` is one array, one line a scene. The order is the order of the picker. A scene must draw a good still at 3:2 and must not lean on `ctx.filter` blur (WebKit keeps the value and draws sharp). `blurb` finishes "A postcard of ..." for the alt text. `gif: { from }` is for a scene whose still is not where it should start moving (the card then shows that moment too, so the GIF's first frame is the PNG's picture; posta starts at 1 s, when the clerk is at the window); `still: true` is for a scene that does not move (dar) or whose GIF is too costly (saanj), which is offered as a picture only; `gif.warm` is how many milliseconds of live frames to draw first for a scene that loads its motion late (shet).

## Files

| File | What it is |
|---|---|
| `index.html`, `recipe.css` | The page and the demo. Reads `?register`, `?theme` and `?palette`. |
| `recipe.js` | `exportPng`, `makeGif`, `deliver`, `digest`, `mountPostcard`. |
| `postcard.core.js` | The pure part, runs in Node: `layout`, `fitName`, `fitLines`, `breakLines`, `scriptOf`, `normaliseName`, `seedFor`, `sniff`, `slug`, `fileName`, `gifTimes`. |
| `postcard.draw.js` | The drawing: `preparePostcard`, `drawPostcard`, the stamp, the postmark, `breathe`. |
| `scenes.js` | The scene list. |
| `events/conclave-2026.js` | The event's words (default, awaiting the owner). |
| `postcard.test.js` | Node tests of the core and its text fitting. |
| `recipe.check.mjs` | The proof, in `SG_ENGINE=chromium` or `webkit`. `--sheet` writes twelve names across six scenes, as PNG and as GIF first frames, with GIF times, to `.shots/postcard/<engine>/`. `--break=<mode>` plants a fault the check must catch. |
| `gif-read.mjs` | A small independent GIF reader the check decodes the GIF with. |

## The GIF

Thirty frames, ten a second, 900 by 600, looping. The base (paper, name, stamp, postmark) is drawn once; the picture is drawn thirty times; one palette is cut from all of it; frame one is the whole card, the rest are just the picture's rectangle. If the first pass is over 4.8 MB it tries 128, then 64, then 32 colours. A made GIF is 1.9 to 3.3 MB in the scenes that move. Work goes in steps with the page breathing between them (a message-channel pause, not a timer), the large steps are sliced, progress is reported after each, and an `AbortSignal` stops it at the next step. The one cost it cannot cut is a scene's first render, which is the scene's own.

## Notes

- Same name, same card holds within one browser. Fonts and encoders differ between engines, so the check compares within an engine and compares the GIF's first frame to the PNG's picture by a tolerance.
- A scene that has drawn its still does not start moving cleanly afterwards (shet stays a bare mat), so a card whose GIF is drawn live and warmed opens a second copy of the scene for it.
- Under reduced motion the PNG is the default and the GIF is offered but not played on the page.
- The pitch's "32 scenes" and the registry's 33 or 34 are not this recipe's business; it offers seven: posta, ferry, mithagar, tinto, saanj, dar and rampon. `shet` is left out (default, awaiting owner): its GIF takes 5 s, 12 s in WebKit and about 20 s at 4x CPU throttle.
