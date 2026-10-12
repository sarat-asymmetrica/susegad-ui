# Greeting card

A card with a flower of its own, for a guest, a speaker or a volunteer. Type a name and a bloom grows from it: the same name always gives the same flower, and no two names give the same one. The card is the name, a line of text and the flower on paper, drawn on one canvas and exported as a picture.

It composes:

| Piece | Used for |
|---|---|
| `<sg-bloom>` | the flower, seeded from the name (`seed-from`) and drawn off screen |
| `packages/export/png.js` | the bloom's SVG to a bitmap, and the finished card to a PNG |
| `engine/paper.js` | the paper the card is printed on |

## The prompt

Build a greeting-card maker for an event: a name field and a line-of-text field beside a live preview of a 4:5 portrait card. The card is warm paper with a marigold in the upper half, the name in the display face below it, a short rule, and the line in the body face, centred. The marigold is `<sg-bloom seed-from="the name">` drawn off screen and rasterised, so every name has its own flower and the same name always has the same one. The card is paper and ink, the same on a light page and a dark one and in every register except quiet, where the flower is a head of plain dots. Two buttons: Save as PNG (lossless, to keep) and Make a JPG to share (messaging apps handle JPG predictably; use the system share sheet with the file where the browser offers it, and a download where it does not). Every export reports the type it really produced, read from the file's first bytes, and names the file after those bytes (`greeting-card-maria-fernandes.png`), because a browser that cannot encode the type asked for hands back PNG. Say plainly what was made, in a status line: the file name, the format and its size. Nothing downloads or shares until a button is pressed. Redraw as the person types, after a short pause, and make the preview an image whose label names whose card it is and what it says. With no JavaScript, say the cards are made in the browser.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| every name has its own flower | `seed-from` | `<sg-bloom seed-from="Asha">` hashes the text with the engine's `hashSeed`; the head is `vogel()` with a seeded turn, jitter and palette. The name is case sensitive. |
| drawn off screen and rasterised | `svgToPng` | A hidden `<sg-bloom register="warm">` draws its head; its SVG is cloned, given a `color` for the quiet dots, rasterised by `export/png.js` and drawn onto the card. |
| paper and ink, the same in every theme | `PALETTE` | The card's colours are fixed in `card.core.js`, not read from tokens: it is a thing to keep, not part of the page. |
| lossless to keep, JPG to share | `exportCard(canvas, 'save' \| 'share')` | `save` asks for `image/png`, `share` for `image/jpeg` (decision 0023). |
| the type it really produced | `sniff(bytes)` | The type is read from the first bytes of the file. `asked` is what was requested; `type` is what came back; `filename` takes its extension from `type`. |
| the same name, the same card | seeds only | The bloom and the paper are seeded and nothing else varies, so one name makes the same pixels and, in one browser, the same bytes. The check proves it. |
| nothing downloads until a button is pressed | consent | `make()` runs only from the two buttons. |

## Files

| File | What it is |
|---|---|
| `index.html` | The page and the demo. Reads `?register`, `?theme` and `?palette`. |
| `recipe.js` | `drawCard`, `exportCard`, `digest` and `mountCard`. |
| `card.core.js` | The pure part: card size, palette, `sniff`, `slug`, `fileName`, `wrap`, `fitSize`, `layout`. |
| `recipe.css` | The page around the maker. |
| `recipe.test.js` | Node tests of `card.core.js`. |
| `recipe.check.mjs` | The proof: three names make three different cards, one name twice makes the identical card, PNG is PNG and JPG is JPG by their bytes, a type the browser cannot encode is reported as what it became, the journey by keyboard, axe. `--cards` writes the three cards to `.shots/cards/`. |

## Notes

- Same name, same bytes holds within one browser and version. Encoders differ between engines, so the check also compares the decoded pixels, which hold whatever the encoder does.
- The flower is a flower: do not place the card beside deity imagery or call it a puja element. See the bloom's docs.
- Fonts: the card draws in Castoro and Mukta, loaded by `document.fonts.load` before drawing, because canvas text does not trigger a web-font download.
