# File upload

Choose photos and PDFs, watch each one upload, and see a "Received" stamp when every file has arrived. A file that is too large is refused in plain words beside the field. A file that drops part way says so, keeps the bar where it stopped, and offers "Try again".

It composes five library pieces:

| Piece | Used for |
|---|---|
| `<sg-empty>` | before any files: what will appear here, and a "Choose files" action |
| `<sg-field-note>` | beside the file field: a file too large, or of the wrong kind, and why it was not added |
| `<sg-progress>` | one per file, driven only by the bytes the transport reports. In warm the kolam closes only when the server confirms the file |
| `<sg-toast-region>` | an error per dropped file, with "Try again", and one success note when everything has arrived |
| `<sg-stamp>` | "Received, 3 files, 5.7 MB", landed once every file is safe |

## Files

| File | What it is |
|---|---|
| `transport.js` | A pretend upload service, pure and seeded: a short wait, chunks of bytes at a varying rate with the odd slow patch, a pause while the server checks the file, then `done`. It can drop a file part way. Swap it for your own. |
| `upload.core.js` | The words (`STRINGS`), the rules (size and kind), and the session: files, the transport's events, and what the page must say next. Pure. |
| `recipe.js` | The wiring: `mountFileUpload(root, { transport, maxBytes, accept, toasts })`, plus `freezeAt(t)` to show a moment for a gallery. |
| `recipe.css` | Layout only; each piece brings its own look. |
| `index.html` | The demo: a live uploader with sample files, and three frozen moments. It is copied with the recipe and works in your project: open it from any static server, and add `?register=`, `?theme=` or `?palette=` to try the looks. |
| `recipe.test.js` | Tests for the transport and the session, driven by a virtual clock. |

## Use it with a real server

The session needs an object with three methods:

- `start(file, at)` returns an id and begins sending;
- `poll(now)` returns what has happened since the last poll, as `{ type: 'progress', id, loaded, total, at }`, `{ type: 'done', id, at }` or `{ type: 'failed', id, at, loaded }`;
- `busy()` says whether anything is still on its way.

Wrap `XMLHttpRequest` (its `upload.onprogress` gives `loaded` and `total`) or a `fetch` with a streamed body. Queue a `progress` event for each report, `done` when the server answers that it has the file, and `failed` on an error or abort.

## What moves, and why

- A bar shows only bytes the transport has reported. The page's clock runs only while something is on its way; when nothing is moving, nothing is drawn.
- Each bar's maximum is the file's bytes plus one step for the server's check. When the last byte has left, the bar reads 99% and the label says "checking the file". It reaches the end, and the warm kolam closes, only when the server says the file is safe.
- A dropped file keeps its bar where it stopped. Nothing pretends it finished.
- The stamp lands only when every file chosen has arrived. Add more files and it lifts until they have arrived too.
- One success toast each time everything so far has arrived; one error toast per dropped file, dismissed as soon as that file is sent again.

## Accessibility

- The file field is the browser's own `<input type="file">` with a visible label, and the hint is linked with `aria-describedby`. The field note joins it while it shows an error.
- Each file's progress is a native `<progress>` named by the file name and size. Screen readers hear the value from the element itself.
- "Try again" is a real button in the file's row, named for its file ("Try room-rates-2026.pdf again"). The error toast has the same action.
- Errors are spoken through the toast region's alert line; the success note and the stamp through polite status lines.
- The empty state's words and "Choose files" action are plain HTML in reading order.

## Try it

Serve the repo (`node tools/serve.mjs`) and open `/packages/recipes/file-upload/index.html`, or open the copied `index.html` in your own project. Add `?register=quiet`, `warm` or `playful`, and `&theme=dark`. The sample set includes a 14.2 MB photo, which is refused, and a PDF that drops half way on its first try.
