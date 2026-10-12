# Tooltip

`<sg-tooltip>` wraps a trigger and its accessible description. The trigger's `aria-describedby` always points to the tooltip text, whether or not it is ever shown on screen, so a screen reader has it regardless of hover.

**The tooltip's words must never be the only place a meaning lives.** Put anything a person must know to act (a price, a deadline, a policy) in real text nearby too; use the tooltip for a helpful extra, not the only copy of something that matters.

## Use

```html
<link rel="stylesheet" href="susegad/components/tooltip/tooltip.css">
<script type="module" src="susegad/components/tooltip/tooltip.js"></script>

<sg-tooltip>
  <button aria-describedby="cancel-note">Free cancellation</button>
  <span id="cancel-note" role="tooltip">No charge up to 48 hours before arrival.</span>
</sg-tooltip>
```

Leave `aria-describedby` and the `id` off and the element wires them itself, as long as the trigger and the `role="tooltip"` element are both direct children, trigger first.

## Attributes and properties

| | Values | Default |
|---|---|---|
| `register` | `quiet`, `warm`, `playful` | inherited |
| `open` (property, read only) | boolean | `false` |

## Registers

| | Look |
|---|---|
| quiet (and no JS) | a plain small label |
| warm | hand-lettered, in the hand face, a little larger |
| playful | the same, with a pencil leader line pointing from the panel to the trigger |

## How it shows

Without JavaScript, CSS alone reveals the panel on `:hover` and `:focus-visible`, by opacity only (never `display` or `visibility`), so the accessible description is never hidden by the visual state either way. With JavaScript, the panel becomes a `popover` (`hint` where the platform understands it, else `manual`), drawn in the top layer so it is never clipped by an ancestor, shown after a short delay on hover (to avoid flicker while the pointer passes over the page) and instantly on focus, and dismissed by Escape or by leaving. It opens above the trigger by default and below it when there is little room above.

The panel is a popover in the top layer. Where CSS anchor positioning is supported it sits above its trigger, centred on it, and the browser flips it below when there is no room above (`position-try-fallbacks: flip-block`); elsewhere the element measures and places it (`tooltip.core.js`'s `placement()`). It arrives and leaves as a CSS transition from `@starting-style`: quiet is 120 ms of opacity, warm adds a short rise, playful a rise on the spring; reduced motion shows it at once. A plain trigger button that is a direct child is pressed like every Susegad control: 1 px in quiet, a shade in warm, a small give in playful.

## Accessibility

- `aria-describedby` links the trigger to the tooltip's text at all times.
- Touch: a tap on the trigger shows the tooltip and a second tap hides it; a tap anywhere else, or Escape, hides it too. It reacts to `pointerup`, so it works in WebKit, which never focuses a tapped button, and the trigger's own click still fires once (`tooltip.check.mjs`, the "touch:" cells, with a real tap in Chromium, WebKit and Firefox).
- Escape dismisses it without moving focus.
- The panel's background and text hold 4.5:1 contrast in every palette and theme (tested).

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Not applicable | The tooltip is text, and it adds no image or icon. The trigger is the author's. |
| 1.3.1 Info and relationships | Meets | `aria-describedby` links the trigger to the panel's text at all times, so the text reaches assistive technology whether or not it is shown: `packages/components/tooltip/tooltip.check.mjs`, "no JS: the trigger already names the tooltip text as its description" and "no JS: the button carries the description in its accessible tree". `packages/components/tooltip/tooltip.test.js`: the CSS reveals the panel by opacity only, never `display` or `visibility`. |
| 1.4.1 Use of color | Not applicable | The tooltip carries no meaning in colour. |
| 1.4.3 Contrast (minimum) | Meets | `packages/components/tooltip/tooltip.test.js`: "contrast: <palette> <theme>: the panel's text reads against its own background" (the panel is `--sg-surface` text on a `--sg-text` ground, tested for every palette in light and dark). axe: `tools/axe.mjs --url /packages/components/tooltip/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent at 1280 px, three registers, nothing wider than the screen (throwaway Playwright script). The panel is sized in `em` with `max-width: 22em` and `width: max-content`: `packages/components/tooltip/tooltip.css`. |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, page width 320, no sideways scroll (throwaway Playwright script). With JavaScript the panel is clamped inside the viewport (`tooltip.test.js`, "placement: centred on the trigger, clamped inside the viewport"). |
| 1.4.11 Non-text contrast | Not applicable | The tooltip is a text panel with no control or state of its own; its focus is the trigger's, which is the author's. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, page width 320 with no sideways scroll (throwaway Playwright script). The panel grows with its text (`width: max-content`). No check in the repository asserts it yet. |
| 1.4.13 Content on hover or focus | Does not meet | With JavaScript it meets all three parts. Dismissible: while the panel is open, Escape closes it wherever focus is, including with the pointer alone and no focus on the trigger, without moving focus (`packages/components/tooltip/tooltip.js`, a `keydown` listener on the document while open; `packages/components/tooltip/tooltip.check.mjs`: "<register>: pointer on the <trigger or panel>, no focus: Escape closes it and focus does not move", which failed on the trigger in all three registers before the fix, and passes in Chromium, WebKit and Firefox). Hoverable and persistent: the shown panel takes the pointer (`pointer-events: auto` while open), and the 8 px gap between trigger and panel belongs to the tooltip too, through two invisible bands as tall as the gap (`--sg-tooltip-gap`, 8 px) on the element itself, above and below the trigger (`sg-tooltip[data-open]::before` and `::after` in `packages/components/tooltip/tooltip.css`; they sit on the element, not the panel, because the panel's `overflow: auto` clipped a bridge drawn on it, and each band stops where the gap stops, so neither the trigger nor a button one gap away is covered: `tooltip.check.mjs`, "a click 1 px inside a button one gap below the trigger lands on that button", which failed with 12 px bands). Leaving the element (trigger, panel or bands) hides it after 300 ms. `tooltip.check.mjs`: "<register>: the point midway across the 8 px gap belongs to the tooltip (the panel or its bridge), not the page" (the element at that point was the page's `section` before the fix), "the pointer rests in the gap for 450 ms (longer than the 300 ms hide delay) and the tooltip is still open" (red with the bands removed), and "moving the pointer onto the panel keeps it open", in all three registers in Chromium, WebKit and Firefox. Without JavaScript it does not meet the dismissible part: CSS alone reveals the panel on `:hover` and `:focus-within`, and CSS cannot answer a key, so Escape does nothing (manual test, 2026-10-07, JavaScript off: opacity 1 on hover and still 1 after Escape, a reviewer's probe). The no-JS reveal is hover and focus on the trigger, which the reader ends by moving away. |
| 2.1.1 Keyboard | Meets | The trigger is the author's native control, reached by Tab, and focus opens the panel at once: `packages/components/tooltip/tooltip.check.mjs`, "<register>: focus opens it instantly, no delay". Escape closes it (see 1.4.13). The panel itself is not a control and takes no focus. On touch a tap on the trigger reveals it (`tooltip.check.mjs`: "touch: a tap on the trigger shows the tooltip", "it stays open while the reader reads", "a second tap on the trigger closes it", "a tap elsewhere closes it", and "the tap still pressed the button"), in Chromium, WebKit and Firefox. |
| 2.1.2 No keyboard trap | Meets | Manual test: `packages/components/tooltip/tooltip.js` takes no focus and binds `keydown` only for Escape (on the trigger, and on the document while the panel is open), which closes the panel without moving focus; Tab and Shift+Tab are untouched. |
| 2.4.3 Focus order | Meets | The panel is never focusable, so it adds no tab stop, and the trigger keeps its place in the page's order (`packages/components/tooltip/tooltip.js`). Focusing the trigger opens it at once: `tooltip.check.mjs`, "focus opens it instantly, no delay". |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs --only tooltip` requires and proves a focus style in each register on the trigger; the rule is `sg-tooltip :is(button, a, [tabindex]):focus-visible` in `packages/components/tooltip/tooltip.css`. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | The panel sits above the trigger, or below it when there is no room above, never over it: `tooltip.check.mjs`, "the panel opens below a trigger with no room above" (`panelTop >= triggerBottom - 2`). It does not take focus. A sticky header or banner the page adds can cover a trigger that is scrolled to. |
| 2.5.3 Label in name | Meets | The trigger is named by its own visible text; the tooltip adds only `aria-describedby`, never `aria-label` (`packages/components/tooltip/tooltip.js`). |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07 (throwaway Playwright script): the trigger is the author's control, and on the demo at 390 px with touch, in each register, every trigger at least 124 by 47 px (127 by 49 in playful). |
| 4.1.2 Name, role, value | Meets | The panel is `role="tooltip"` and described by the trigger's `aria-describedby`; `tooltip.check.mjs` reads `button "Free cancellation"` with its description, with JavaScript off and on, and the touch probe shows it on a tap that focuses the button. axe: `tools/axe.mjs --url /packages/components/tooltip/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07. |

**The page author owns:**

- Loading the script on any page where a tooltip's text is more than a hint: without it the panel cannot be dismissed with Escape (1.4.13).
- The trigger: a real `<button>` or link with its own name, and the tooltip's words, in the language of the page, and `lang` on a tooltip in another language (3.1.2).
- Never putting a meaning someone must act on (a price, a deadline) only in a tooltip: say it in real text nearby too.
- Sticky headers and banners that could cover the trigger when it takes focus (2.4.11).

## Budget

Behaviour 4.4 KB (`tooltip.js` + `tooltip.core.js`); skins quiet, warm and playful are each a no-op mount, under 0.2 KB: the look is entirely in `tooltip.css`, keyed off `[data-skin]`, `[data-open]` and `[data-above]`.
