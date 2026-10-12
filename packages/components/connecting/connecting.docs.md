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

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The dot and the fireflies are decoration: the firefly canvas is `aria-hidden` (`packages/components/connecting/skins/fireflies.js`) and the dot is a CSS pseudo-element with no content (`packages/components/connecting/connecting.css`). The state is the words: `packages/components/connecting/connecting.test.js`: "the state is always in words". |
| 1.3.1 Info and relationships | Meets | The words live in a `<span role="status">` that the element adds if the page leaves it out (`packages/components/connecting/connecting.js`). Manual test, 2026-10-07: the demo's element reads `role=status` with the text "Connecting", then "Connected" after the `state` attribute changed (throwaway Playwright script). |
| 1.4.1 Use of color | Meets | The state is in words ("Connecting", "Connected", "Offline") and in the dot's shape: a ring, a filled dot, a dot struck through (`packages/components/connecting/connecting.css`, the comment above `sg-connecting::before`); `connecting.test.js`: "the state is always in words". |
| 1.4.3 Contrast (minimum) | Meets | The words are `--sg-text`, tested at 4.5:1 or more on every surface in `packages/tokens/tokens.test.js`. `tools/axe.mjs --url /packages/components/connecting/demo.html`: 0 violation(s) across 6 run(s) (three registers, light and dark, desktop), nothing to review by hand, 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-06: the demo with the root font size at 200 percent in three registers (1280 px wide), no sideways scroll and no clipped text (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test at 320 CSS px, three registers, 2026-10-06: no sideways scroll and no element past the viewport (throwaway Playwright script). No check in the repository asserts it yet. |
| 1.4.11 Non-text contrast | Meets | The dot's border is `--sg-text-soft`, `--sg-success` or `--sg-danger`, all text roles tested at 4.5:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. The fireflies are decoration and the words say the state, so they need no contrast of their own. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-06: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected on the demo in three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.2.2 Pause, stop, hide | Meets with author's part | In warm and playful the fireflies move for as long as the element is on screen, which is more than five seconds, with no on-page pause control. They stop under `prefers-reduced-motion` (a still: all lit when connected, a scatter while connecting, dim when offline) and while the element is off screen (`packages/components/connecting/skins/fireflies.js`: `ctx.motion === 'still'` and `ctx.visible`; `connecting.test.js`: "offline is dim; the still shows the state"). Quiet moves nothing. A page that shows a connecting state for a long time in warm or playful owns offering the quiet register or a motion switch. |
| 2.3.1 Three flashes or below threshold | Meets | Each firefly flashes at about 0.5 Hz, a quick rise and a slow afterglow, on a small canvas (`packages/components/connecting/connecting.core.js`, the comment above the swarm model and `flash`); `connecting.test.js`: "flash rises to 1 at the flash and fades; lights stay in the field". Even in sync, the swarm flashes once every two seconds, under the three-per-second limit. |
| 4.1.2 Name, role, value | Meets | A `role="status"` span whose text is the state, with `role="none"` on the element available for a still that should stay silent (`packages/components/connecting/connecting.js`). axe: 0 violations, `tools/axe.mjs --url /packages/components/connecting/demo.html`, 2026-10-07. |
| 4.1.3 Status messages | Meets | The words are a polite live region and each change is read once; the first words are written with `aria-live="off"`, which the next change lifts, so a page that loads in a state is not announced (`packages/components/connecting/connecting.js`, `#words`). Manual test, 2026-10-07: the span carries `role="status"` and its text follows the `state` attribute; the announcement itself was not heard with a screen reader (throwaway Playwright script). No check in the repository asserts it yet. |

**The page author owns:**

- The `label` text, in the language of the page, and `lang` on a label in another language (3.1.2).
- Choosing `role="none"` only for pictures of a state, never for the one indicator that tracks a real connection.
- A motion switch or the quiet register for the warm and playful fireflies when the state stays on screen for long (2.2.2).
- The colours the page sets behind the element, if it overrides the tokens.

## Performance

The night and grass are painted once and cached; each frame stamps one glow sprite per firefly. The animation stops when the indicator is off screen or the tab is hidden, and the swarm steps at a fixed 60 Hz whatever the frame rate.
