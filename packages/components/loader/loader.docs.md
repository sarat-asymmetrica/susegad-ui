# Loader

`<sg-loader>` says that something is loading and what it is, when you cannot say how far along it is. Its words are read out through a polite status line, and a small drawing sits beside them.

## Usage

```html
<link rel="stylesheet" href="susegad/components/loader/loader.css">
<script type="module" src="susegad/components/loader/loader.js"></script>

<sg-loader label="Loading your bookings"></sg-loader>
<!-- or with its own words -->
<sg-loader>Checking the calendar for 14 to 18 October</sg-loader>
```

Change the words as the work moves on; each change is read out:

```js
loader.setAttribute('label', 'Making previews');
```

Remove the loader, or replace it with the content, when the work is done.

## Attributes and events

| Name | Kind | What it does |
|---|---|---|
| `label` | attribute | What is loading. Beats the element's own text. Without either, the register's default: "Loading" (quiet), "Getting things ready" (warm), "On its way" (playful). |
| `register` | attribute | `quiet`, `warm` or `playful`. Overrides the page's register for this element. |
| `sg-skin` | event | Fires when a register's drawing has loaded. |

## Registers

- **Quiet:** three small dots before the words, pulsing slowly in turn. Without JavaScript, only the words show.
- **Warm:** a small kolam. A light travels once round its line every 4.8 s, and each dot brightens as the line reaches it.
- **Playful:** a bambaram, a wooden spinning top with lacquer bands, turning on its nail and leaning in a slow circle. The words are set in the hand face.

## Accessibility

- The words are read from a polite status line (`role="status"`) inside the element. It starts empty and is filled a moment after the loader arrives, so a loader added to the page is announced once, even though its words were there from the start. After that, a change of label is read out as it happens.
- The visible copy of the words and the drawing are `aria-hidden`, so nothing is read twice. `loader.check.mjs` checks this.
- A loader never shows an amount. When the work can report progress, use `<sg-progress>`.
- With reduced motion, no animation starts in any register. All animation pauses while the loader is off screen.
- On WCAG 2.2.2 (pause, stop, hide): a loading indicator shown while the page cannot be used yet counts as essential under the Understanding document. If a loader sits beside content people are reading for longer than five seconds, prefer the quiet register or change the words as the work moves on.
- Zero axe violations in quiet, warm and playful, light and dark, desktop and phone.

## Credit

The warm kolam is the Kolam scene's mirror-curve geometry; see that scene for the practice and who draws it. The bambaram (a lattu or bhingri in other parts of India) is a pan-Indian wooden toy.
