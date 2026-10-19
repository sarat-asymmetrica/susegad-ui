# Picture postcard

*A postcard of Goa with a typed name on it, made in the browser, saved as a picture or a moving GIF.*

## The prompt

Build a postcard maker for Goa, with an event's words if there is one, from Susegad UI parts. A name field and a picture picker sit beside a live preview of a 3:2 landscape postcard, drawn on one canvas at 1800 by 1200. The card is warm paper. On the left is a framed picture, which is the still of one of the library's scenes of Goa (the old post office, the ferry, the salt pans, a village square, a green door in a lime-washed wall, an evening at the shore), taken from the scene's own `model()` and `createRenderer()` and cropped to fill a 3:2 mat. Under it, in the display face, is the typed name, centred. On the right are a perforated stamp in the top corner that carries the event's words, a round postmark over its left edge with the place along the top, the dates along the bottom and cancellation waves trailing to the left, three ruled lines for a message, and, small in the corner, a line saying where to make your own. The event's words (stamp, place, dates, an optional line) live in one config file, not in the code. The card is paper and ink, the same on a light page and a dark one.

The name is never corrected, only made to fit. It is set on one line as large as it can be (never smaller than 84 px there), then wrapped on two or three lines at a smaller size, and as a last resort broken inside a word, so a 60-letter name and a one-letter name both sit inside their place without touching the picture or the stamp. Names in Devanagari, Kannada, Malayalam, Tamil, Bengali and Urdu lay out the same way: the library's faces cover Latin, Devanagari and Kannada, any other script is drawn in the first system face that has it, and Urdu is set right to left. Cut a name at 60 characters, by grapheme, never inside a conjunct. Wait for the web fonts before drawing (canvas text does not trigger a font download) with `fontReady` from the type package, which gives up after four seconds.

The same name and the same scene make the same card: the paper, the stamp's tilt, the postmark and the scene are all seeded from the name, and nothing on the card reads the clock. Three buttons do the work. Save picture writes a PNG. Save GIF makes a three-second looping GIF, ten frames a second, 900 by 600: the name, the stamp and the postmark are drawn once and the GIF encodes only the picture's rectangle after its first frame, so it stays under 5 MB (try fewer colours if it does not). Make the GIF a frame at a time with the page breathing between steps, show a progress bar and say the stage in a status line, move focus to a Cancel button, and let Cancel stop it at the next step and say so. Share sends the file to the system share sheet where the browser has one and falls back to a download. Every file reports what it really is: read the type from the first bytes and name the file after them, such as `postcard-asha-naik.png`. Say plainly what was made. Under reduced motion, offer the GIF but do not play it on the page. Nothing leaves the device: typing a name, making a card and saving it send no request. Make the preview an image whose label reads the card, for example "A postcard of the ferry across the river for Asha, stamped Goa, postmarked Panjim 22–23 Oct 2026." With no JavaScript, say that cards are drawn in the browser.

Prove it with a check, in Chromium and in WebKit: the same name twice makes the same pixels and another name does not; long, one-letter, 60-letter and six-script names each sit inside their place and leave the rest of the card as it was; the PNG is a PNG and the GIF is a GIF89a of 30 frames under 5 MB whose first frame is the PNG's picture and whose name and stamp never move; no frame jumps from the one before; making the GIF never holds the page still for long and a cancel stops it; the keyboard journey; axe with the GIF in progress; no sideways scroll at 390 px; and not one network request after load.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a 3:2 postcard | `CARD`, `layout()` in `postcard.core.js` | 1800 by 1200. `layout({ name, scene, seed, event, measure })` returns where everything goes; it draws nothing and runs in Node. |
| the picture is a scene's still | `SCENES` in `scenes.js`, `openPicture` | One line per scene. The scene's own `createRenderer` draws into an off-screen canvas; its still is cropped to the mat by `coverRect`. |
| the event's words, in one file | `events/goa-oct-2026.js` | `{ stamp, place, dates, line }`. Another event is another file passed to `mountPostcard(root, { event })`. |
| the name as large as it can be, then wrapped, then broken | `fitName`, `fitLines`, `breakLines` | One line down to 84 px, then two and three lines down to 56 px, then inside a word. Every line is within 1056 px. |
| any script, Urdu right to left | `scriptOf`, `STACKS` | Names the script and whether it runs right to left; the canvas falls back glyph by glyph through the font stacks. |
| cut at 60, never inside a conjunct | `normaliseName`, `graphemes` | `Intl.Segmenter` graphemes; controls and bidi overrides are removed; case is never changed. |
| the same name, the same card | `seedFor`, `rng` | The name's hash seeds paper, tilt, postmark and scene. |
| a stamp with holes, a postmark | `stampImage`, `postmarkInk` | The perforations are cut out of the stamp's own canvas; the postmark is lettered along arcs by `arcText`. |
| a three-second looping GIF under 5 MB | `makeGif`, `GIF`, `gifTimes` | Draws the base once, the picture 30 times, one shared palette, then writes each frame; tries fewer colours if over budget. |
| only the picture changes | `createGifEncoder().addFrame(indices, delay, rect)` | After the first full frame, each frame is just the picture's rectangle. |
| a frame at a time, never freezing | `breathe`, `addFrameSliced`, `indexSliced` | A message-channel pause between steps; the large steps are cut into slices. |
| show progress, let it be cancelled | `onProgress`, `AbortSignal` | `{ stage, done, total }` after each step; `signal` stops at the next step with an `AbortError`. |
| the type it really is | `sniff`, `fileName` | PNG and GIF89a told apart by their first bytes; the extension follows. |
| share where the browser can | `deliver(out, { share: true })` | `navigator.share({ files })` after `canShare`; a download otherwise; a closed sheet is "cancelled", not an error. |
| nothing leaves the device | no request | The page only reads its own static files; the check watches the network. |
