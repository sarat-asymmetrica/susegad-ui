# Scroll section

`<sg-scroll-section>` advances a child `<sg-scene>`'s `progress` as the section travels through the viewport, following the Ghat plate's own scroll arithmetic.

## Markup

```html
<sg-scroll-section>
  <sg-scene name="paus" register="warm"></sg-scene>
  <p class="sg-scroll-reveal">Come for the rain. Our lowest rate runs June to September.</p>
</sg-scroll-section>
```

- Without JavaScript this is a plain `<section>`-like wrapper (the custom element never upgrades): its content shows at rest, nothing scroll-linked.
- A direct child `<sg-scene>` gets its `progress` attribute set every frame the section is near the viewport, in warm and playful. Quiet and reduced motion never touch it: they remove the `progress` attribute and call the scene's own `.still()`, so the scene shows its own finished frame (the charter's register table already gives a scene a still in quiet; this component adds nothing on top of that, and importantly does not pin `progress="1"` on the way there, which produced a blank canvas in an earlier draft, see "known limits" below).
- A `.sg-scroll-reveal` child needs no `<sg-scene>` and no JavaScript at all: `scroll-section.css` gives it a native `animation-timeline: view()` fade-and-lift, entirely in CSS, wherever the browser supports the at-rule (`@supports (animation-timeline: view()) { … }`); elsewhere it simply shows at rest.

## Why two different mechanisms

Setting an element's **attribute** (to drive a child `<sg-scene progress>`) inherently needs JavaScript, CSS cannot write an attribute. Any purely **visual** scroll effect that needs no attribute (a fade, a lift) can be genuinely CSS-only, native `animation-timeline: view()`, no JavaScript, no IntersectionObserver, no rAF loop. `scroll-section.js` is the JavaScript path, for the case that actually requires it.

## Reading progress yourself

```js
const section = document.querySelector('sg-scroll-section');
section.addEventListener('sg-scroll-progress', e => console.log(e.detail.progress)); // 0..1
section.progress; // the last value, read only
```

`--sg-scroll-progress` (0..1) is also set as a CSS custom property on the host every frame, for your own `calc()`-based effects.

## The registers

- **Quiet:** no parallax, no scrubbing. The scene (if any) shows its own still.
- **Warm:** a slow parallax lift on a child `<sg-scene>` (`data-scroll-parallax`, `--sg-scroll-parallax: 1`), the charter's "one living thing per screen."
- **Playful:** the same parallax, bolder (`--sg-scroll-parallax: 1.6`).

Reduced motion takes the same still path as quiet, in every register.

## Accessibility

The section adds no role, label or control of its own, so this section is the conformance table.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Not applicable | The section adds no image, icon or media of its own. The `<sg-scene>` a page puts inside it carries its own text alternative (see the scene's docs). |
| 1.3.1 Info and relationships | Meets | `packages/components/scroll-section/scroll-section.js` adds no role, no wrapper and no reordering: it sets one CSS custom property on the host and the `progress` attribute on a child scene, so the author's markup reads in the order it was written. Without JavaScript it is a plain block. |
| 1.4.1 Use of color | Not applicable | The section carries no meaning in colour; it moves content and shows no state of its own. |
| 1.4.3 Contrast (minimum) | Meets | Without the opt-in `.sg-scroll-reveal` class the component sets no opacity, and the page's own text uses `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: every text role on every surface is 4.5:1 or more"). With the class, the fade ends when the element has fully entered the screen (`animation-range: entry 0% entry 90%` in `packages/components/scroll-section/scroll-section.css`), so text that is the last thing on a page still ends fully shown. `packages/components/scroll-section/scroll-section.check.mjs`: "a .sg-scroll-reveal paragraph, the last thing on the page, ends fully shown" read opacity 0.12 before the fix (the range was `entry 0% cover 40%`, which a last paragraph can never reach) and 1.00 after, with a control ("with 1400 px of page after it") at 1.00 both times. Chromium; browsers without scroll timelines show the text at once. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent at 1280 px, three registers, nothing wider than the screen (throwaway Playwright script). The section has no text or fixed size of its own. |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, page width 320 (no sideways scroll; throwaway Playwright script). The section is `display: block` and sets no width. |
| 1.4.11 Non-text contrast | Not applicable | The section draws nothing and has no control. A scene inside it is a drawing with its own rules. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no sideways scroll (throwaway Playwright script). The section sets no text sizes or fixed heights. No check in the repository asserts it yet. |
| 2.2.2 Pause, stop, hide | Meets | Nothing moves on its own: the scroll scrub and the warm and playful parallax follow the reader's scroll and stop when scrolling stops. Quiet and reduced motion never scrub (`packages/components/scroll-section/scroll-section.check.mjs`: "quiet never scrubs", "reduced motion, warm: the section never scrubs") and nothing runs while the section is off screen ("no sg-scroll-progress events fire while off screen"). |
| 2.3.1 Three flashes or below threshold | Meets | The only visual changes are a vertical shift of at most 24 px (38 px in playful) and an opacity fade, both tied to scroll position, never to time: `packages/components/scroll-section/scroll-section.css`. Nothing flashes. |
| 2.3.3 Animation from interactions | Meets | AAA, informative. Under reduced motion the `.sg-scroll-reveal` animation and the parallax transform are removed in CSS, and the script settles to the still: `scroll-section.check.mjs`, "reduced motion, warm: the section never scrubs, staying at its still value". |
| 4.1.2 Name, role, value | Not applicable | The section is not a control and adds no role or state. axe on the demo: `tools/axe.mjs --url /packages/components/scroll-section/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07, and again at 390 px with touch and with JavaScript off, 0 violations; color-contrast was left for review by hand. |

**The page author owns:**

- The label, or `alt`, on the `<sg-scene>` inside, and the text of anything in the section.

## Performance

The IntersectionObserver-gated loop only runs while the section is near the viewport (A4: pause off screen); a fast scroll safety net (a passive, rAF-throttled `scroll` listener) catches the case where a single very fast jump could skip past the observer's own near zone entirely. Measured against the Paus baseline in the same run: at rest (the page as loaded, section below the fold) the page is well under the baseline's own cost, since the section is idle; while actively being scrubbed, mean frame time comes in at parity with the Paus baseline (about 1.0x), see the registry gate evidence for the exact numbers.

## Known limits

- An earlier draft pinned the child scene's `progress` attribute to `"1"` on the way to calling `.still()`. That left the scene painting a blank box instead of its finished frame, a real, screenshot-caught bug, not a hypothesis. The fix removes the `progress` attribute entirely before calling `.still()`, handing the scene back to its own default the way `SKILL.md` documents ("remove the attribute to hand the scene back to time"). A regression check now asserts the still scene actually paints a `<canvas>` or `<svg>`, not just that progress reads `1`.
- Register changes made to an *ancestor* element (a page-level register switcher) after this component has already connected are picked up on the next scroll or intersection event, not instantly, there is no dedicated "motion changed" hook to react to sooner.

## Lineage

*After:* the Ghat plate, a topographic survey sheet whose land inks itself in as the sheet scrolls into view.
*What we took:* the scroll-progress arithmetic (`scrollProgress()` in the plate, ported as `progressFromRect` here), how far a section has travelled through the viewport, as one number from its own box and the viewport's height.
*What we left:* everything else. Ghat's own reveal (contours inking in from sea level, rivers, a road, monsoon clouds) stays inside the Ghat scene itself; this component only supplies the scroll number, generically, to whatever scene or content a page puts inside it.
