# Popover

*A word held near, until it's asked for: a hairline card, a letter with a folded corner, a postmarked note.*

A trigger and a native `popover`, unchanged: `popovertarget` does the opening, closing, focus and light-dismiss. This component only places the card and skins it.

```html
<link rel="stylesheet" href="susegad/components/popover/popover.css">
<script type="module" src="susegad/components/popover/popover.js"></script>

<sg-popover>
  <button popovertarget="rates">Today's rate</button>
  <div id="rates" popover><p>₹8,200 a night, this week.</p></div>
</sg-popover>
```

## The prompt

Make a popover web component around a real `[popover]` element and its trigger's `popovertarget`, so opening, closing, focus and light-dismiss (an outside click, Escape) are the browser's, with or without JavaScript. If either the panel's `id` or the trigger's `popovertarget` is missing, wire them from the first `[popover]` and the first button or link inside the host. Style the panel as a card: a hairline border, a radius, the `--sg-lift` shadow, a small fade-and-rise entry keyed off `:popover-open`, off under reduced motion. Give it three registers. Quiet: the plain card. Warm: an inland-letter look, an accent-coloured left margin and a folded top-right corner (a `::after` diagonal gradient triangle, one border box). Playful: the same, with a dashed, cancelled-looking postmark circle in the corner (a `::before` with two crossing gradient bands), all `aria-hidden` by being purely decorative generated content. Position the panel where CSS anchor positioning (`anchor-name` / `position-anchor`) is supported; everywhere else, measure the trigger and the panel on the popover's own `toggle` event and on resize and scroll, and place the panel below the trigger unless there is little room below and more room above, in which case flip it above. Keep the flip decision as a pure function of the trigger's box, the panel's size and the viewport, so it can be tested in Node without a browser. Place the panel with CSS anchor positioning, flipping it above or across when it will not fit, and keep the measured placement only for a browser without it. Let the panel arrive and leave as a transition from its first frame: quiet 120 ms of opacity only, warm a short rise, playful the spring.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a real `[popover]` element and its trigger's `popovertarget` | native first | Opening, closing, focus, outside-click and Escape are the platform's; the component adds no keyboard handling of its own. |
| wire them from the first `[popover]` and the first button or link | progressive enhancement | A builder who forgets the `id`/`popovertarget` pairing still gets a working popover; one already written by hand is left alone. |
| a fold in the corner … a postmark | CSS-only decoration | Both are generated content (`::before`/`::after`), so every skin's `mount()` is a no-op; `popover.css`, keyed off `[data-skin]` (set by the shared component base once the register resolves), does the whole drawing. |
| keep the flip decision as a pure function | Ω honesty, testability | `placement(trigger, panel, viewport)` in `popover.core.js` takes plain boxes and returns `{ left, above }`; it is unit tested for "room below", "flip above" and "clamped to the viewport" without ever opening a browser. |
| measure … on the popover's own `toggle` event | native event, no polling | `[popover]` fires `toggle` with `newState`; the element listens once and re-measures then, on resize and on scroll, rather than guessing when the panel appeared. |
| place the panel with CSS anchor positioning … keep the measured placement only for a browser without it | native first, with a fallback | `popover.css` under `@supports (anchor-name: --a)`: `position-anchor: auto` (the `popovertarget` trigger is the implicit anchor, so it works with no script), `top: anchor(bottom)`, `position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline`. `popover.js` names the anchor (`anchor-name` on the trigger, `position-anchor` on the panel) and drops its scroll and resize listeners; `#place()` and `placement()` run only where `CSS.supports('anchor-name: --a')` is false. |
| the panel arrives and leaves as a transition, quiet 120 ms of opacity only, warm a short rise, playful the spring | CSS @starting-style, per register | A transition from `@starting-style` with `transition-behavior: allow-discrete` on `display` and `overlay`, so it can fade out in the top layer; `--_dur`, `--_ease` and `--_rise` are set per `[data-skin]`; reduced motion removes the transition, so the first frame is the finished one. `overlay.check.mjs` reads the first frame of each. |
| a plain trigger button is pressed: a 1 px settle in quiet, the colour shades in warm, a small give in playful | the touch contract | `sg-popover > :where(button, a[href]):active` answers with no transition and eases back in under 150 ms: quiet `translate: 0 1px`, warm an inset shade mixed toward `--sg-text`, playful `scale: 0.97` released on `--sg-ease-spring`. Reduced motion keeps the shade and drops the movement; `:root[data-sg-input=key]` drops it for the keyboard. |

## Accessibility

- The native popover API is the whole interaction model; a screen reader hears the trigger, then the panel's real content once it opens.
- Escape closes the panel and returns focus to its trigger, per the platform's own behaviour for `popover="auto"`.
- Forced colours: a plain bordered box; the fold and the postmark, both decorative, are hidden.

## Credit

The postmark and the folded letter are common paper motifs, not a specific tradition's. No credit is owed beyond the drawing itself.
