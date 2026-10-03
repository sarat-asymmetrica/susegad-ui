# Studio home (a mock)

A one-person studio's home page built from the seven studio-site pieces: `site-nav`, `now-note` (with `badge`), `postcard` (with its status as a `badge`), `quote`, `chat-thread` with a `voice-note` inside, and `reach`. Every name, number and word on it is placeholder copy, and the banner at the top says so.

Open it with `?register=quiet`, `warm` or `playful` (the banner links do this), and `&theme=dark`.

## How it was made

`index.html` is static, as an Astro page would write it. The thread was built with `renderThread()` (a phone number and a name went in and did not come out), the contact links with `waLink()` and `mailtoLink()`. Nothing on the page needs JavaScript to be read; with it off, it is the quiet page.

## Checks

`recipe.check.mjs`: axe in all three registers, light and dark, and without JavaScript; every piece gets its skin; no page errors; no `play()` before a press; no redacted text in the page; no sideways scroll at 390 px.
