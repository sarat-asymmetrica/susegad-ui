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
- A direct child `<sg-scene>` gets its `progress` attribute set every frame the section is near the viewport, in warm and playful. Quiet and reduced motion never touch it: they remove the `progress` attribute and call the scene's own `.still()`, so the scene shows its own finished frame (the charter's register table already gives a scene a still in quiet; this component adds nothing on top of that, and importantly does not pin `progress="1"` on the way there, which produced a blank canvas in an earlier draft — see "known limits" below).
- A `.sg-scroll-reveal` child needs no `<sg-scene>` and no JavaScript at all: `scroll-section.css` gives it a native `animation-timeline: view()` fade-and-lift, entirely in CSS, wherever the browser supports the at-rule (`@supports (animation-timeline: view()) { … }`); elsewhere it simply shows at rest.

## Why two different mechanisms

Setting an element's **attribute** (to drive a child `<sg-scene progress>`) inherently needs JavaScript — CSS cannot write an attribute. Any purely **visual** scroll effect that needs no attribute (a fade, a lift) can be genuinely CSS-only, native `animation-timeline: view()`, no JavaScript, no IntersectionObserver, no rAF loop. `scroll-section.js` is the JavaScript path, for the case that actually requires it.

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

## Performance

The IntersectionObserver-gated loop only runs while the section is near the viewport (A4: pause off screen); a fast scroll safety net (a passive, rAF-throttled `scroll` listener) catches the case where a single very fast jump could skip past the observer's own near zone entirely. Measured against the Paus baseline in the same run: at rest (the page as loaded, section below the fold) the page is well under the baseline's own cost, since the section is idle; while actively being scrubbed, mean frame time comes in at parity with the Paus baseline (about 1.0x) — see the registry gate evidence for the exact numbers.

## Known limits

- An earlier draft pinned the child scene's `progress` attribute to `"1"` on the way to calling `.still()`. That left the scene painting a blank box instead of its finished frame — a real, screenshot-caught bug, not a hypothesis. The fix removes the `progress` attribute entirely before calling `.still()`, handing the scene back to its own default the way `SKILL.md` documents ("remove the attribute to hand the scene back to time"). A regression check now asserts the still scene actually paints a `<canvas>` or `<svg>`, not just that progress reads `1`.
- Register changes made to an *ancestor* element (a page-level register switcher) after this component has already connected are picked up on the next scroll or intersection event, not instantly — there is no dedicated "motion changed" hook to react to sooner.

## Lineage

*After:* the Ghat plate, a topographic survey sheet whose land inks itself in as the sheet scrolls into view.
*What we took:* the scroll-progress arithmetic (`scrollProgress()` in the plate, ported as `progressFromRect` here) — how far a section has travelled through the viewport, as one number from its own box and the viewport's height.
*What we left:* everything else. Ghat's own reveal (contours inking in from sea level, rivers, a road, monsoon clouds) stays inside the Ghat scene itself; this component only supplies the scroll number, generically, to whatever scene or content a page puts inside it.
