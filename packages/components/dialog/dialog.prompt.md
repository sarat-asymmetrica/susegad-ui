# Dialog: the prompt and the words-to-code map

## The prompt

> Build `<sg-dialog>`, a custom element that wraps and enhances a native
> `<dialog>`. Its modal behaviour is entirely the platform's: `showModal()`
> for focus trapping and blocking the page, Escape to close, `<form
> method="dialog">` for its actions, and the browser's own focus return to
> the opener. Any element on the page can open it by carrying
> `data-sg-dialog="<the dialog's id>"`; without JavaScript, that same
> element is a real link to a real page, so nothing about the dialog is
> unreachable. Give it three registers: quiet is an own-sized box with a
> plain dimmed backdrop; warm and playful are full-bleed, with the Carepa
> surface behind a floating card, mounted only while the dialog is open and
> torn down on close. Prove in every register and theme that the card's own
> content stays readable against the backdrop, and that the page behind the
> dialog is never legible as text through it. Let a `<button commandfor command="show-modal">` open it with no script at all, with the element still waking the skin when it does, and a click handler for browsers without invoker commands. Let it arrive and leave as a transition from its first frame.

## The map

| Words in the prompt | Technique | How the code does it |
|---|---|---|
| "wraps and enhances a native `<dialog>`" | native-first | `dialog.js`'s `SgDialog extends SgElement` with `static native = 'dialog'` (decision 0005); `showModal()`/`close()`/`Escape` are never reimplemented. |
| "Any element… can open it by carrying `data-sg-dialog`" | progressive enhancement | `connected()` in `dialog.js` finds `[data-sg-dialog="<id>"]` and upgrades their `click` with `preventDefault()` + `open()`. `openersFor()` in `dialog.core.js` is the pure matcher, tested in Node. |
| "without JavaScript, that same element is a real link" | fallback | The demo's openers are `<a href="./no-js.html">`; JavaScript intercepts the click, and without it the browser simply navigates. Nothing is JavaScript-only. |
| "quiet is an own-sized box with a plain dimmed backdrop" | register | `dialog.css`'s base rules (quiet's look) style the native `::backdrop` with `var(--sg-scrim)`; `skins/quiet.js` mounts nothing. |
| "warm and playful are full-bleed, with the Carepa surface behind a floating card" | register, composition | `dialog.css`'s `[data-skin="warm"], [data-skin="playful"]` rules make the `<dialog>` fill the viewport and centre `.sg-dialog-card` over `.sg-dialog-scrim`; `skins/warm.js` and `skins/playful.js` call `mount()` from `…/surfaces/carepa/index.js` on that scrim element. |
| "mounted only while the dialog is open, and torn down on close" | honesty, performance | Both skins' `sync(state)` mount Carepa on `state.open` and call `carepa.destroy()` the moment it is false, so nothing draws behind a closed dialog (A4: everything off screen is paused; here, torn down, since a closed dialog owns no visible surface at all). |
| "the page behind the dialog is never legible as text through it" | contrast, honesty | Carepa's own room layer is opaque (see its lineage note); the card's background is `color-mix(in oklab, var(--sg-surface-raised) 96%, transparent)`, checked against the surface's brightest sheen. |
| a `<button commandfor command="show-modal">` opens it with no script | invoker commands | `commandfor` names the native `<dialog>`'s `id`; the browser opens it. `dialog.js` watches the `open` attribute with a `MutationObserver`, so `#afterOpen()` mounts the skin and fires `sg-dialog-open` once however it was opened; a `command` event on the `<sg-dialog>` itself covers `commandfor` pointing at it. Without `commandForElement` in `HTMLButtonElement.prototype` (iOS before 26.2) a click handler on those buttons runs the command and prevents the default. |
| the dialog arrives and leaves as a transition, quiet 120 ms of opacity only, warm a short rise, playful the spring | CSS @starting-style, per register | A transition from `@starting-style` with `transition-behavior: allow-discrete` on `display` and `overlay`, so it can fade out in the top layer; `--_dur`, `--_ease` and `--_rise` are set per `[data-skin]`; reduced motion removes the transition, so the first frame is the finished one. `overlay.check.mjs` reads the first frame of each. |
| a button in the card is pressed: a 1 px settle in quiet, the colour shades in warm, a small give in playful | the touch contract | `sg-dialog .sg-dialog-card button:active` answers with no transition and eases back in under 150 ms: quiet `translate: 0 1px`, warm an inset shade mixed toward `--sg-text`, playful `scale: 0.97` released on `--sg-ease-spring`. Reduced motion keeps the shade and drops the movement; `:root[data-sg-input=key]` drops it for the keyboard. |
