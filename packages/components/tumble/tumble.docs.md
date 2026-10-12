# Tumble

`<sg-tumble>` is a headline that arrives. It wraps a real heading and leaves it alone: the text stays one string in the page, read once, selectable and translatable. The moving letters are an `aria-hidden` copy laid exactly over it, built when the arrival starts and gone when it ends.

## Markup

```html
<link rel="stylesheet" href="susegad/components/tumble/tumble.css">
<script type="module" src="susegad/components/tumble/tumble.js"></script>

<sg-tumble><h2>Life is short, eat good pasta</h2></sg-tumble>      <!-- plays once, the first time it is seen -->
<sg-tumble manual id="hero"><h1>Saffron Spoon</h1></sg-tumble>      <!-- waits: document.getElementById('hero').play() -->
<sg-tumble manual hold><h1>Saffron Spoon</h1></sg-tumble>           <!-- hidden until played; let go after 8 s -->
```

Use a real `<h1>` to `<h6>` (or `role="heading"`). Style the heading as you like: the copy takes each letter's font, colour, spacing and case from the heading itself.

## Attributes, method, events

| | |
|---|---|
| `manual` | no auto-play; call `play()` |
| `hold` | with JavaScript running, hide the heading until it plays (so it does not flash before an arrival you will start later). A page that never plays it gets the heading back after 8 seconds. Never applies in quiet or under reduced motion. |
| `seed` | seeds the spin of the letters (default: the heading's text) |
| `register` | `quiet`, `warm`, `playful` |
| `play()` | plays the arrival; returns a promise that resolves when the heading has settled (at once when nothing moves) |
| `sg-tumble-start`, `sg-tumble-done` | events, bubbling |

`data-state` on the element is `held`, `playing` or `done` while there is something to say.

## Registers

| | |
|---|---|
| quiet | nothing moves |
| warm | lines slide in, alternately from the left and the right, a little past rest, and settle; each line follows the one above |
| playful | letters drop from above with a little spin, bounce once and settle, one after another (the whole arrival never takes more than about 2.6 seconds, however long the heading) |
| reduced motion | the finished heading at once; no copy is ever made |

## How it stays honest

- The text is never changed or split: the heading keeps its one text node. The copy is a sibling `aria-hidden` layer, outside the heading, with `pointer-events: none`, so selecting the heading while it plays selects the real text.
- The heading is hidden only once the copy is built and the animations have started (and with `hold`, before that). Without JavaScript, before the module runs, if measuring throws, on a resize, if the element leaves the page, or after a timeout, it is shown again.
- A heading with a transparent fill (gradient text) is left alone, because a copy of it would be invisible too. So is one with more than 160 letters.
- It waits for `document.fonts.ready` (for at most 3 seconds) before measuring, so a web font that arrives late does not leave the copy in the wrong places. The letters are measured with a `Range` for each, so ligatures are drawn as separate letters during the arrival and snap back at the end.
- Without `tumble.css` it still works: it makes the element a positioned block and hides the heading itself.

## Content-Security-Policy

No `<style>` element and no `style` attribute in anything it builds in markup: positions and typography are set through the CSSOM, the arrival through Web Animations. It runs under `style-src 'self'; script-src 'self'`.

## Accessibility

- The heading is announced by its own text, once; the copy is `aria-hidden`.
- Reduced motion and quiet show the finished heading and make no copy. High-contrast mode hides the copy.
- Nothing is in the tab order.
- Known limit: it only moves text. Text with a background-clip gradient, or in a canvas, is not copied.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The moving letters are an `aria-hidden` copy laid over the real heading: `packages/components/tumble/tumble.check.mjs`, "the moving copy is aria-hidden and outside the heading". The heading is text, so there is no image to describe. |
| 1.3.1 Info and relationships | Meets | The author's real `<h1>` to `<h6>` is left alone and stays one text node with its own string while the letters move: `tumble.check.mjs`, "the heading is still one text node with its own string while the letters move" and "the heading is announced by its own text". |
| 1.4.1 Use of color | Not applicable | The component carries no meaning in colour; it moves a heading that already says what it says in words. |
| 1.4.3 Contrast (minimum) | Meets with author's part | The heading keeps the colour the author gives it, and the copy takes each letter's colour from it, so contrast is whatever the heading's colour and ground give (token text roles pass 4.5:1 in `packages/tokens/tokens.test.js`). A heading with a transparent fill, such as gradient text, is left alone and never copied (`tumble.check.mjs`, "gradient text is left alone"). axe: `tools/axe.mjs --url /packages/components/tumble/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07; color-contrast was left for review by hand and is covered by the ratios in this table. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent at 1280 px, three registers, nothing wider than the screen (throwaway Playwright script). The real heading is what resizes; a resize during the arrival ends it cleanly and gives the heading back (`tumble.check.mjs`, "a resize mid-play ends it cleanly"). |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, page width 320. While the warm lines slide in, the copy sits outside the heading's box inside a clipped wrapper (`overflow: clip`) and the page does not scroll sideways; the copy is gone when the arrival ends (throwaway Playwright script). |
| 1.4.11 Non-text contrast | Not applicable | The component draws no control or graphic of its own; the letters are the heading's text. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, page width 320 with no sideways scroll (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.2.2 Pause, stop, hide | Meets | The arrival plays once, the first time the heading is seen, and ends: warm slides the lines in and playful drops the letters in about 2.6 seconds at most however long the heading, under the 5 seconds the criterion allows (`packages/components/tumble/tumble.test.js`, "playful: one plan per letter, in reading order, never slower than the cap however long the heading"; `tumble.check.mjs`, "first view: it plays once; scrolling away and back does not play it again"). Quiet and reduced motion move nothing. |
| 2.3.1 Three flashes or below threshold | Meets | Nothing flashes or changes brightness: the letters travel, spin and bounce once (`tumble.test.js`, "the bounce is only one: after the touch-down the letter lifts once and never goes below rest") and the warm lines slide (`tumble.test.js`, "warm: the slide ends at rest, passes a little over, and starts out of sight"). |
| 2.3.3 Animation from interactions | Meets | AAA, informative. Under reduced motion the finished heading shows at once and no copy is made: `tumble.check.mjs`, the reduced-motion probe, and `packages/components/tumble/tumble.docs.md`. |
| 4.1.2 Name, role, value | Meets | The component adds no role, state or control; the author's heading is announced by its own text, once (`tumble.check.mjs`, "the heading is announced by its own text"), and nothing is in the tab order. axe: `tools/axe.mjs --url /packages/components/tumble/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07; color-contrast was left for review by hand and is covered by the ratios in this table. |

**The page author owns:**

- The heading's text, in the language of the page, and its colour and ground: at least 4.5:1 for text (1.4.3), or 3:1 for large text.
- A real heading element (`<h1>` to `<h6>` or `role="heading"`) inside the element, and a sensible heading order for the page.
- `hold` only where a script will play the heading; a held heading is hidden until it plays, and is given back after 8 seconds if nobody plays it.
