# Saving footer

A form that saves itself when the person pauses typing, with a footer that says what is happening: "Saving", "Saved at 14:32", or "Couldn't save. Check your connection and try again." When the connection drops, the footer shows the connection's state (fireflies, in warm and playful) and saves by itself once the connection is back.

It composes four library pieces:

| Piece | Used for |
|---|---|
| `<sg-loader>` | the picture while a save is in flight, and only then |
| `<sg-badge>` | the settled state: "No changes yet", "Changes not saved yet", "Saved at 14:32", "Not saved" |
| `<sg-toast-region>` | the error, which waits until dismissed and offers "Try again", and the note that the changes are safe once back online |
| `<sg-connecting>` | the link while it is down, reconnecting, and for four seconds after it is back |

## Files

| File | What it is |
|---|---|
| `transport.js` | A fake network, pure and seeded: saves take a seeded time, fail if the link is down when they start or drops while they are in flight, and the link comes back through a reconnect handshake. Swap it for your `fetch` or websocket. |
| `footer.core.js` | The state machine, the view and the words (`STRINGS`), pure. Also `createSession`, which joins the machine, a transport and the typing pause. |
| `recipe.css` | The footer's own styles: its layout, and `hidden` for the components inside it. The status line uses `.sg-vh` from `tokens.css`. |
| `recipe.js` | The wiring: `mountSavingFooter(form, { transport, toasts })`, plus `renderFooter` and `stillFooter` for the gallery. |
| `index.html` | The demo: a live form, a network switch standing in for the world, and every state of the footer. Works in a builder's project too. |
| `recipe.test.js` | Tests for the transport and the machine, driven by a virtual clock. |

## Put it on a page

Give your form a footer and mount it:

```html
<link rel="stylesheet" href="susegad/tokens/fonts.css">
<link rel="stylesheet" href="susegad/tokens/tokens.css"> <!-- the tokens, and .sg-vh for the status line -->
<link rel="stylesheet" href="susegad/components/loader/loader.css">
<link rel="stylesheet" href="susegad/components/badge/badge.css">
<link rel="stylesheet" href="susegad/components/toast/toast.css">
<link rel="stylesheet" href="susegad/components/connecting/connecting.css">
<link rel="stylesheet" href="susegad/recipes/saving-footer/recipe.css">

<form id="notes">
  <!-- your fields -->
  <footer class="saving-footer"></footer>
</form>
<sg-toast-region></sg-toast-region>

<script type="module">
  import { mountSavingFooter } from './susegad/recipes/saving-footer/recipe.js';
  import { createTransport } from './susegad/recipes/saving-footer/transport.js';
  await customElements.whenDefined('sg-toast-region');
  mountSavingFooter(document.getElementById('notes'), {
    transport: createTransport(),            // swap for your own, see below
    toasts: document.querySelector('sg-toast-region'),
  });
</script>
```

The CLI also copies `index.html`, the demo: it links the tokens relatively and reads `?register`, `?theme` and `?palette`, so it opens in your project as it does here.

## Use it with a real server

`createSession` only needs an object with `request(at, bytes)` returning an id, and `poll(now)` returning the events that have happened: `{ type: 'saved' | 'failed', id, at }` and `{ type: 'link', state: 'down' | 'reconnecting' | 'up', at }`. Wrap your `fetch` so a finished request queues a `saved` event with the time it finished, a failed one queues `failed`, and `online`, `offline` and your reconnect logic queue `link` events.

## What moves, and why

- The footer changes only on the transport's events. There is no timer that pretends: the loader is shown exactly while a save is in flight, and "Saved at" is the time the save finished.
- Edits made during a save are saved straight after it, never dropped.
- One error toast per outage, however many tries fail. When the connection is back, the footer tries again by itself, clears the error and says so.
- The typing pause (1.2 s) only decides when to start a save. It never shows progress.

## Accessibility

- One polite status line (`role="status"`, visually hidden) says the footer's state. The loader and badge are its picture and are hidden from screen readers, so nothing is said twice.
- The connection indicator has its own status line ("Connection: offline", "Connection: connecting", "Connection: connected").
- The error toast is spoken through the region's alert line and stays until dismissed or resolved. Its "Try again" button is a real button.
- "Save now" is a real submit button; Ctrl+S (Cmd+S) saves too.
- A screen reader user who types steadily hears "Saving" and "Saved at…" each time they pause. For long writing, consider announcing only failures and a save after a longer pause.

## Verify

```sh
node --test packages/recipes/saving-footer/recipe.test.js
MSYS_NO_PATHCONV=1 node tools/matrix.mjs --url /packages/recipes/saving-footer/index.html --jobs 1
MSYS_NO_PATHCONV=1 node tools/axe.mjs --url /packages/recipes/saving-footer/index.html
```
