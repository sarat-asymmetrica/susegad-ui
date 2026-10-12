# Greeting card

*A card with a flower of its own, grown from the guest's name.*

## The prompt

Build a greeting-card maker for an event from Susegad UI parts. A name field and a line-of-text field sit beside a live preview of a 4:5 portrait card. The card is warm paper with a marigold in the upper half, the name in the display face below it, a short rule, and the line in the body face, all centred. The marigold is `<sg-bloom seed-from="the name">`, drawn off screen and rasterised onto the card, so every name has its own flower and the same name always has the same one. The card is paper and ink: the same on a light page and a dark one, and in every register except quiet, where the flower is a head of plain dots. Draw it all on one canvas, wait for the web fonts before drawing text (canvas text does not trigger a font download), and size the name down to fit one line. Two buttons: Save as PNG (lossless, to keep) and Make a JPG to share (messaging apps handle JPG predictably). Use the system share sheet with the file where the browser offers it and a download where it does not. Every export reports the type it really produced, read from the first bytes of the file, and names the file after those bytes, such as `greeting-card-maria-fernandes.png`, because a browser that cannot encode the type asked for hands back PNG. Say plainly what was made in a status line: the file name, the format and its size. Nothing downloads or shares until a button is pressed. Redraw as the person types after a short pause. Make the preview an image whose label says whose card it is and what it says. With no JavaScript, say that cards are made in the browser. Prove it with a check: three names make three different cards, one name twice makes the identical card, a PNG is a PNG and a JPG is a JPG by their bytes, and a type the browser cannot encode is reported as the type it became.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a flower of its own, grown from the name | `<sg-bloom seed-from>` | The name is hashed by the engine's `hashSeed`. The head is `vogel()` with a seeded turn, jitter and palette. |
| drawn off screen and rasterised | `svgToPng` in `export/png.js` | A hidden bloom draws its head; the SVG is cloned, rasterised and drawn onto the card. |
| paper and ink, the same in every theme | `PALETTE`, `paper()` | Fixed colours in `card.core.js` and the engine's seeded paper. |
| wait for the web fonts | `document.fonts.load` | Called for each face before the first `fillText`, then the card is drawn. |
| size the name down to fit | `fitSize` | The largest size from 104 down to 48 at which the name fits one line. |
| the type it really produced | `sniff(bytes)` | PNG, JPEG, WebP, GIF and AVIF are told apart by their first bytes. `type` is what came back, `asked` what was requested. |
| named after those bytes | `fileName(name, type)` | `greeting-card-` + `slug(name)` + the extension of `type`. |
| nothing until a button is pressed | consent | The export runs only from the two buttons. |
| three names, three cards; one name twice, one card | `digest` | SHA-256 of the PNG bytes and of the decoded pixels, compared in the check. |
