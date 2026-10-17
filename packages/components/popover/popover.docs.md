# Popover

`<sg-popover>` wraps a trigger and a native `[popover]` element. The `popovertarget` attribute opens it, closes it on an outside click or Escape, and moves focus, with or without JavaScript. This element places the panel near its trigger and lets the register skin the card.

## Use

```html
<link rel="stylesheet" href="susegad/components/popover/popover.css">
<script type="module" src="susegad/components/popover/popover.js"></script>

<sg-popover>
  <button popovertarget="rates">Today's rate</button>
  <div id="rates" popover>
    <h3>The garden room</h3>
    <p>₹8,200 a night, this week.</p>
  </div>
</sg-popover>
```

Leave the `id` and `popovertarget` off and the element wires them itself, as long as the trigger and the `[popover]` element are both direct descendants.

## Attributes and properties

| | Values | Default |
|---|---|---|
| `register` | `quiet`, `warm`, `playful` | inherited |
| `open` (property, read only) | boolean | `false` |

`showPopover()`, `hidePopover()` and `togglePopover()` on the element call the native panel's own methods.

## Registers

| | Look |
|---|---|
| quiet (and no JS) | a hairline card |
| warm | an inland-letter card: an accent margin and a folded top corner |
| playful | the same, with a dashed postmark in the corner |

The panel arrives and leaves as a CSS transition from `@starting-style`: quiet is 120 ms of opacity and nothing else, warm adds a short rise, playful a longer one on the spring. Reduced motion shows it at once. A plain trigger button that is a direct child of `<sg-popover>` is pressed too: the state answers in the same frame, with no transition, and eases back in under 150 ms. Quiet settles 1 px, warm shades the colour toward the ink, playful gives a little (scale 0.97, released on the spring). The keyboard never moves it, and under reduced motion the shade stays and the movement goes.

## Positioning

Where CSS anchor positioning is supported, the browser places the panel: `top: anchor(bottom)`, flipped above or across with `position-try-fallbacks` when it will not fit, and kept against its trigger as the page scrolls, with no script and no layout thrashing. A `popovertarget` trigger is the panel's implicit anchor, so this holds even with the element script blocked; the script names the anchor outright for the other cases. Elsewhere the element measures the trigger and the panel on open, on resize and on scroll, and places the panel below the trigger, or above it when there is little room below and more room above (`popover.core.js`'s `placement()`, pure and tested). Either way, the last step is fitting it to what a person can see: popover.js measures the open panel against `window.visualViewport` (its `visibleBox()` in the core; without one, the document's `clientWidth`) and, if it sits outside, slides it back to 8 px inside with a `--sg-fit-x` custom property that the stylesheet turns into a `translateX`. Not `window.innerWidth`: mobile Chromium widens it to fit overflowing content, and an anchored panel's containing block follows, so on a phone a panel opened near the right edge used to spill past the screen. The fit runs once more in the frame after `beforetoggle` (so the first painted frame is already fitted, not one task later), on resize, and on the visual viewport's resize and scroll; in playful it keeps 16 px from the edge so the postmark is not shaved. The fallback places from the trigger's top edge (`top = trigger top - gap - panel height`), never from `innerHeight`, which a phone widens. `fitShift()` is pure and tested; the phone cells of the check press it at 390 px on a clean page and on a widened one, with and without anchor positioning.

The trigger may also be `<button commandfor="rates" command="toggle-popover">`, the invoker form of `popovertarget`; `popovertarget` is the one to prefer, since it works in older browsers too.

## Accessibility

- The native popover API does the opening, closing, focus management and light-dismiss; a screen reader hears the trigger's own name and, once open, the panel's content.
- Escape closes it and returns focus to the trigger, as the platform does for every `popover="auto"` element.
- Forced colours: a plain 1px border, the postmark and letter-fold hidden.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The postmark and letter-fold are CSS decoration with no words in them, hidden in forced colours: `packages/components/popover/popover.check.mjs`, "<register>, forced colours: the postmark/fold is hidden". The panel's content is the author's. |
| 1.3.1 Info and relationships | Meets | A native trigger `<button popovertarget>` and a native `[popover]` panel, linked by the platform. `popover.check.mjs`: "no JS: ... popovertarget still opens the panel", and "the element's own \"open\" reflects the native panel". |
| 1.4.1 Use of color | Meets | Nothing is told by colour: the panel appears, with a border, under the trigger, and the platform reports the open state (`packages/components/popover/popover.check.mjs`, "the element's own \"open\" reflects the native panel"). |
| 1.4.3 Contrast (minimum) | Meets | The panel's text is a `--sg-text` role on `--sg-surface-raised`: `packages/tokens/tokens.test.js` ("AA: every text role on every surface is 4.5:1 or more") for every palette and theme. Axe: `tools/axe.mjs --url /packages/components/popover/demo.html`, 0 violations across 6 runs (3 registers, light and dark), desktop, 2026-10-07. With each of the three panels open, axe finds 0 violations in all three registers, light and dark (axe-core 4.13.0 run on that state, 2026-10-07); it leaves the playful panel heading's `color-contrast` for hand review (a pseudo element sits behind it), and that reads 13.6:1 in light and 12.7:1 in dark (painted colours). |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, each popover opened: panel 749 to 802 px wide at 1280 px, no sideways scroll, trigger still visible (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | `packages/components/popover/popover.check.mjs`: "<register> at <390 or 320> px: the open panels do not scroll sideways, inside the screen" opens both demo panels in each register, tries to scroll each one sideways (`scrollLeft = 50`, read back), and checks its box is inside the screen and the page is no wider. In playful the panel scrolled 16 px sideways before the fix (the postmark pokes past the corner and the UA's `overflow: auto` made that scrollable); the playful panel is now `overflow: clip` with `overflow-clip-margin: 14px` (`packages/components/popover/popover.css`), so the stamp still shows and nothing scrolls, in Chromium, WebKit and Firefox. On a phone (a touch, `isMobile` context at 390 px, a trigger pinned to the right edge) `popover.check.mjs` "<register>, phone, <clean or widened page>[, JS fallback]: a panel opened from the right edge stays inside the visual viewport" and "opening it adds no sideways scroll to the page" measure the open panel against `visualViewport` and the page with `tools/lib/overflow.mjs`; before the fix the panel sat past the screen on a widened page. |
| 1.4.11 Non-text contrast | Meets | The panel's border and the trigger's focus ring: `packages/tokens/tokens.test.js` asserts `--sg-rule-strong` and `--sg-focus` 3:1 or more on every surface for every palette and theme. The panel is identified by its words and its position under the trigger as well as its edge. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text with the panels closed (throwaway Playwright script). The open panels were not measured with the spacing injected. No check in the repository asserts it yet. |
| 1.4.13 Content on hover or focus | Not applicable | The panel opens on a press (click, Enter or Space on the trigger), not on hover or focus. It stays until the reader dismisses it: Escape, a click outside, or the trigger again, all native. |
| 2.1.1 Keyboard | Meets | Manual test, 2026-10-07, three registers: focusing the trigger and pressing Enter opens the panel (`:popover-open`) every time. `popover.check.mjs`: "no JS: clicking the trigger opens the panel". |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07, three registers: Escape closes the panel and focus returns to the trigger (`document.activeElement` is the `popovertarget` button). `popover.check.mjs`: "no JS: Escape closes it", "no JS: focus returns to the trigger". `packages/components/popover/popover.js` binds no `keydown`. |
| 2.4.3 Focus order | Meets with author's part | The platform places an open popover's content straight after its trigger (`packages/components/popover/popover.check.mjs`, "no JS: focus returns to the trigger") in the tab order, and closing returns focus to the trigger. The demo panels hold text only, so no tab order inside one was exercised; the controls a page puts in a panel are the author's. |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the trigger in each register and requires a focus style; the ring colour is tested at 3:1 in `packages/tokens/tokens.test.js`. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test, 2026-10-07: with each panel open at 390, 320 and (200 percent text) 1280 px, in all three registers, the trigger is the topmost element at its centre (`elementFromPoint`), and the panel's top edge is 6.1 px below the trigger's bottom edge (`popover.check.mjs`: "the panel's top edge sits within 8px of the trigger's bottom edge", "the panel opens above a trigger with no room below"). The panel can cover other controls beneath it while it is open, and a sticky header or banner of the page's own can cover a trigger that is scrolled to. |
| 2.5.3 Label in name | Meets | Manual test, 2026-10-07: the trigger is a native `<button>` whose only content is its visible text (`packages/components/popover/demo.html`), so its name and its label are the same words. |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07, 390 px touch: the triggers are 118.9, 109.4 and 190.3 px wide and 46.9 px tall in quiet and warm (48.9 px tall in playful). No check in the repository asserts target size for the popover yet. |
| 4.1.2 Name, role, value | Meets | A native button with `popovertarget`, which the platform exposes with its expanded state, and a native popover element. Axe with JavaScript off: `tools/axe.mjs --no-js --url /packages/components/popover/demo.html`, 0 violations across 6 runs, 2026-10-07. |

**The page author owns:**

- The trigger's text and the panel's content, in the language of the page, and `lang` on text in another language (3.1.2).
- Any controls inside the panel: their names, order and sizes (2.4.3, 2.5.8).
- What the panel may cover, and sticky headers or banners that could cover a trigger when it takes focus (2.4.11).
- The colours the page sets behind the panel, if it overrides the tokens.

## Budget

Behaviour 3.4 KB (`popover.js` + `popover.core.js`); skins quiet, warm and playful are each a no-op mount, under 0.2 KB: the look is entirely in `popover.css`, keyed off `[data-skin]`.
