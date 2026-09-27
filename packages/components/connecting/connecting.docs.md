# Connecting

`<sg-connecting>` shows whether a live connection is up: a websocket, a sync, a booking calendar that updates itself. The words always say the state. In warm and playful, fireflies beside the words blink on their own while connecting and fall into step once connected.

## Usage

```html
<link rel="stylesheet" href="susegad/components/connecting/connecting.css">
<script type="module" src="susegad/components/connecting/connecting.js"></script>

<sg-connecting state="connecting" label="Live updates">
  <span role="status">Live updates: connecting</span>
</sg-connecting>
```

Set the state from your connection code:

```js
const indicator = document.querySelector('sg-connecting');
socket.addEventListener('open', () => { indicator.connection = 'connected'; });
socket.addEventListener('close', () => { indicator.connection = 'offline'; });
```

A server can swap the attribute instead (`state="connected"`); the element follows with no other code.

## Attributes and properties

| Attribute | Property | Values | What it does |
|---|---|---|---|
| `state` | `connection` | `connecting` (default), `connected`, `offline` | The connection's state. Anything else reads as `connecting`. |
| `label` | | text | Names what is connecting. With `label="Live updates"` the words become "Live updates: connected". |
| `seed` | | any number or word | Gives this indicator its own arrangement of fireflies. Without it, every indicator on the page matches. |
| `register` | | `quiet`, `warm`, `playful` | Overrides the page's register for this element. |
| `role="none"` | | | For a still that should not speak, such as a gallery of states: the words still show, in a plain span, but they are not a live region. |

## Registers

- **Quiet:** the words and a static dot. A ring while connecting, filled in the success colour when connected, struck through in the danger colour when offline. Nothing moves; the dot changes in 140 ms. This is also what shows without JavaScript.
- **Warm:** a 64 by 24 pixel slice of night with seven fireflies. They blink out of step while connecting, fall into step within about three seconds of connecting, and flash together after that. Offline, they slow and dim.
- **Playful:** the same, 108 by 30 pixels, with fourteen brighter fireflies.

## What moves, and why

The fireflies are only ever in step when the state is `connected`. While connecting or offline the model pushes them apart, so they cannot line up by chance. The words change the moment the state does; the picture follows within three seconds. The component does not retry or time anything itself: it shows what your code tells it.

## Accessibility

- The words live in a `<span role="status">`, a polite live region. Screen readers announce each change once, and never the state the page loads in: the first words are written with `aria-live="off"`, which the next change lifts. If you leave the span out, the element adds one.
- With `role="none"` on the element, the words are shown but never announced. Use it for pictures of a state, never for the one indicator that tracks a real connection.
- The dot and the fireflies are decorative (`aria-hidden`). Each state has its own dot shape, so colour is never the only difference.
- Nothing is focusable and nothing needs a keyboard.
- With reduced motion, warm and playful show a still: all lit together when connected, a scatter of bright and dim while connecting, dim when offline.

## Performance

The night and grass are painted once and cached; each frame stamps one glow sprite per firefly. The animation stops when the indicator is off screen or the tab is hidden, and the swarm steps at a fixed 60 Hz whatever the frame rate.
