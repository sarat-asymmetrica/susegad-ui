# Scroll section

*A section whose scene advances as it travels through the viewport.*

```html
<sg-scroll-section>
  <sg-scene name="paus" register="warm"></sg-scene>
</sg-scroll-section>
```

## The prompt

Build a section wrapper that reads how far it has travelled through the viewport as one number, 0 to 1, and forwards it as a real `progress` value to a child scene, after the Ghat plate's own scroll arithmetic (its top and height against the viewport's own height, softened at both ends rather than a hard 0/1 cut). Use an `IntersectionObserver` to know when the section is anywhere near the viewport at all, and only run a per-frame loop while it is (pause entirely off screen, the engine's own discipline); add a lightweight, throttled `scroll` listener too, as a safety net for a single very fast scroll (a big keyboard jump, `scrollTo()`) that could carry the section from well below the viewport to well above it between two rendered frames, skipping the observer's own near zone before it ever reports "yes, near" — the safety net measures the section's rect directly and settles progress correctly even then, rather than leaving it stuck at whatever it last was. Separately, give any purely visual reveal that does not need a numeric attribute a native, JavaScript-free path: `animation-timeline: view()`, guarded by `@supports`, so a caption can fade and lift in as it scrolls into view with no observer and no loop at all. Never scrub in the quiet register or under reduced motion: hand the section's own scene back to its own finished still instead, and do not force the scene's `progress` attribute to a specific number on the way there — remove it, so the scene's own default takes over cleanly.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| after the Ghat plate's own scroll arithmetic | reuse | `scroll-section.core.js`'s `progressFromRect(rect, viewportHeight)` is Ghat's `scrollProgress()` formula, `(vh - top) / (vh*ease + height*ease)`, lifted out as a pure function and tested against a wide sweep of positions and sizes rather than assumed. |
| pause entirely off screen | A4, engine discipline | `IntersectionObserver`'s `rootMargin: '50% 0px'` decides "near"; the rAF loop only ever schedules its next frame while `#near` is true, and a check confirms zero `sg-scroll-progress` events fire during a quiet window once the section is genuinely off screen. |
| a safety net for a single very fast scroll | honest coverage | The bug this guards against is real, not hypothetical: an early draft only used the observer, and a single large `mouse.wheel()` scroll in a check carried the section clean through its near zone in one paint, so progress never moved from 0 even though the section had visibly passed. The fix adds a throttled `scroll` listener that measures the rect directly and settles progress to wherever the section actually is, whether or not that counts as "near" right now. |
| a native, JavaScript-free path … no observer and no loop at all | native first | `scroll-section.css`'s `@supports (animation-timeline: view()) { .sg-scroll-reveal { animation-timeline: view(); … } }`. CSS cannot write an HTML attribute, so this path is only for effects that stay inside CSS (opacity, transform); a numeric `progress` on a child element inherently needs the JavaScript path instead. |
| do not force the scene's progress attribute … remove it | A7/A8, a real bug found by looking | The first draft called `scene.setAttribute('progress', '1')` on the way to `still()`. The scene then painted a blank box, not its finished frame — caught by looking at an actual screenshot, not by any assertion, exactly the kernel's "look means naming" discipline. The fix removes the attribute instead of pinning it, matching `SKILL.md`'s own documented way to hand a scene back to its default ("remove the attribute … to hand the scene back to time"), and a regression check now asserts the still scene paints a real `<canvas>` or `<svg>`, not just that a number reads correctly. |

## Accessibility

- No JavaScript: a plain block of content, fully readable, nothing hidden pending scroll.
- The scene inside (if any) carries its own accessible status text for its `progress`, per the scene contract; this component adds nothing that isn't already in the DOM.
- The `.sg-scroll-reveal` CSS path respects `prefers-reduced-motion` on its own (the animation is simply removed, content shown at rest).

## Credit

*After:* the Ghat plate, a topographic survey sheet of the Western Ghats above Goa, whose contours ink themselves in as the sheet scrolls into view.
*What we took:* the scroll-progress arithmetic — one number from a box and the viewport's height.
*What we left:* the drawing itself. Ghat's contours, rivers, road and monsoon clouds live entirely inside the Ghat scene; this component only supplies the scroll number to whatever a page puts inside it.
