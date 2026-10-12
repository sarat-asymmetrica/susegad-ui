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

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The drawing (dots, kolam, bambaram) and the visible copy of the words are `aria-hidden="true"`, and the words are read once from the status line: `packages/components/loader/loader.check.mjs`, "<register>: a screen reader finds the words once, in a status". |
| 1.3.1 Info and relationships | Meets | The words are in a `role="status"` element inside the loader (`packages/components/loader/loader.js`); `loader.check.mjs` reads it from the accessibility tree in each register, and "no JS: the words show" with JavaScript off. |
| 1.4.1 Use of color | Meets | The state is words ("Loading your invoices") read from the status line, and the drawing carries no meaning of its own: `packages/components/loader/loader.check.mjs`, "<register>: a screen reader finds the words once, in a status". |
| 1.4.3 Contrast (minimum) | Meets | The visible words are a `--sg-text` role on the page surface: `packages/tokens/tokens.test.js` ("AA: every text role on every surface is 4.5:1 or more") for every palette and theme. Axe: `tools/axe.mjs --url /packages/components/loader/demo.html`, 0 violations across 6 runs (3 registers, light and dark), desktop, 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and nothing clipped (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, no sideways scroll (document width 320). |
| 1.4.11 Non-text contrast | Meets | The drawing repeats what the words say and is `aria-hidden` (`packages/components/loader/skins/warm.js`, `packages/components/loader/skins/playful.js`, `packages/components/loader/skins/quiet.js`); nothing in it is needed to understand or operate the page. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.2.2 Pause, stop, hide | Meets with author's part | The drawing loops while the work runs. Under `prefers-reduced-motion` no animation runs in any register (manual test, 2026-10-07, `document.getAnimations()` on the demo: 15, 70 and 15 running in quiet, warm and playful, and 0 in all three with reduced motion), and each skin pauses its animations when the loader is off screen (`packages/components/loader/skins/quiet.js`, `packages/components/loader/skins/warm.js` and `packages/components/loader/skins/playful.js`: `ctx.visible ? a.play() : a.pause()`). The component's notes treat a loader shown while the page cannot be used yet as essential (the Understanding document for 2.2.2); there is no on-page pause control, so a loader that sits beside content people read for longer than five seconds is the author's to handle, with the quiet register or by changing the words as the work moves on. |
| 2.3.1 Three flashes or below threshold | Meets | Manual test, 2026-10-07, every looping animation on the demo listed by element, property and period: quiet is 15 dots fading in opacity every 1.8 s (6 by 6 px); warm is a stroke-dash and 65 dots of 3 by 3 px fading over 4.8 s; playful is `transform` only (an 82 by 34 px group every 0.42 s, another every 1.1 s and a 15 by 3 px shadow every 1.1 s). None is a flash of a large area and none changes brightness more than three times in a second over more than a few pixels. |
| 4.1.2 Name, role, value | Meets | A `role="status"` with the words as its text and no value to misreport. Axe with JavaScript off: `tools/axe.mjs --no-js --url /packages/components/loader/demo.html`, 0 violations across 6 runs, 2026-10-07. |
| 4.1.3 Status messages | Meets | `loader.check.mjs`: "the status line starts empty when the loader arrives", "then it is filled once with the words, which is what gets announced", "a new label is announced as it changes" (Making previews). |

**The page author owns:**

- The words ("Loading your invoices"), in the language of the page, and `lang` on words in another language (3.1.2). When the work moves on, change them.
- Whether a loader that stays beside readable content for longer than five seconds needs a way to hide it (2.2.2): use the quiet register, or remove it when the work is done.
- Removing the loader when the work ends: the element does not know.
- The colours the page sets behind the loader, if it overrides the tokens.

## Credit

The warm kolam is the Kolam scene's mirror-curve geometry; see that scene for the practice and who draws it. The bambaram (a lattu or bhingri in other parts of India) is a pan-Indian wooden toy.
