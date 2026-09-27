# Stamp

`<sg-stamp>` marks that something real has happened: dates held, files received, a payment made. It enhances a `<p role="status">` that holds the words.

## Use

```html
<link rel="stylesheet" href="susegad/components/stamp/stamp.css">
<script type="module" src="susegad/components/stamp/stamp.js"></script>

<sg-stamp tone="success" pending>
  <p role="status"><strong>Held</strong> <span>12 to 15 Oct, for 20 minutes</span></p>
</sg-stamp>
```

Land it when the work is done, not before:

```js
const stamp = document.querySelector('sg-stamp');
await holdDates();        // the real work
stamp.stamp();            // lands and is announced once
stamp.lift();             // hides it again, for example when the hold is released
```

From a server (htmx): swap in an `<sg-stamp>` without `pending`. A stamp added after the page has loaded is announced; one that was in the page from the start is not.

## Markup

- `<strong>`: the big word. Keep it to one or two words: Held, Paid, Received, मिळाले.
- Anything after it: the detail line. One short line; it wraps if it has to.
- Mark Indian-language text with `lang`. The element also detects the script of each line itself: Latin lines get capitals and letter spacing, and Devanagari and Kannada keep their natural spacing.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `tone` | `accent`, `success`, `warning`, `danger`, `info`, `neutral` | `accent` |
| `pending` | boolean | absent (stamped) |
| `seed` | any string | the text |
| `register` | `quiet`, `warm`, `playful` | inherited |

## Properties, methods and events

- `stamped` (read only): `true` unless `pending`.
- `stamp()`, `lift()`.
- `sg-stamp` event, bubbling, `detail: { tone }`, when it lands.
- `sg-skin` event when a skin mounts (from the component base).
- Plays `complete` when it lands, through the sound switch (`packages/sound`). Silent unless the switch is on and a gesture has already happened.

## Registers

| | Look | Motion |
|---|---|---|
| quiet | a ruled rectangle, square, words in the tone's ink | a 120 ms fade when it lands |
| warm | a carved double frame, a tilt of 1.5 to 4 degrees, an off-register ghost, seeded ink starvation | a 220 ms press when it lands |
| playful | as warm, tilted 3 to 7 degrees, heavier ink, a diamond on each side | comes down, presses past flat, settles; ink spreads and fades |

Reduced motion shows the landed stamp in every register.

## Accessibility

- A stamp that pictures news the page already says in words (the Form's answer, a gallery) takes `role="none"` on the element: its words stay on it, in a plain paragraph, and are not a live region, so the news is heard once.
- The words are text in a `role="status"` live region, announced once per landing.
- Every tone meets 4.5:1 on every surface. The texture sits on the frame and on Latin big words only; the detail line is never textured.
- All decoration is `aria-hidden`. No stamp takes focus; it is a status, not a control.
- Without JavaScript you get the quiet look, and `pending` stays hidden, so only render `pending` when a script will land it.

## Budget

| File | Bytes |
|---|---|
| `stamp.js` + `stamp.core.js` (behaviour) | 9.4 KB of 12 KB |
| `skins/quiet.js` | 0.6 KB |
| `skins/warm.js` | 4.0 KB |
| `skins/playful.js` (loads warm.js) | 0.4 KB + 4.0 KB |

The texture is computed once per size and seed, about 29,000 pixels for a typical stamp at 2× density, and handed to CSS as a mask. Nothing runs per frame.
