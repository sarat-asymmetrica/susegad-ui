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
> dialog is never legible as text through it.

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
