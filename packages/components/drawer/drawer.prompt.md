# Drawer: the prompt and the words-to-code map

## The prompt

> Build `<sg-drawer>` on the same native `<dialog>` contract as Dialog
> (`showModal()`, Escape, `<form method="dialog">`, native focus return),
> laid out as a panel sliding in from one edge (`start`, `end`, `top` or
> `bottom`, logical so it flips in a right-to-left page) rather than a
> centred card. Quiet is a hairline panel. Warm is a paper panel with a
> deckled, torn edge, over the Carepa surface. Playful is the same,
> brighter, its slide timed to land on the Teental sixteen-beat cycle's
> first beat rather than starting the instant the dialog opens. Reuse
> Dialog's opener contract exactly: any element with `data-sg-drawer="<id>"`
> opens it, and without JavaScript it is a real link to a real page.

## The map

| Words in the prompt | Technique | How the code does it |
|---|---|---|
| "the same native `<dialog>` contract as Dialog" | reuse | `drawer.js` mirrors `dialog.js`'s `SgElement` structure almost line for line: `static native = 'dialog'`, the same open/close/opener wiring. A6: port before you invent. |
| "sliding in from one edge… logical" | layout | `drawer.core.js`'s `offTransform(edge)` and `normalizeEdge()` are pure and tested; `drawer.css` positions the `<dialog>` at the edge with `inset-inline-start/end`, never `left`/`right`. |
| "a deckled, torn edge" | texture | `drawer.css`'s `.sg-drawer-card::before` masks a strip with a repeating radial gradient, so the torn look works at any panel height without a fixed-size image. Drawn 1px outside the card's own border box on purpose (the torn paper spills past the edge); the card itself stays `overflow: visible` so that mask is never clipped, and scrolling lives on an inner `.sg-drawer-content` wrapper instead (Rasika S4: it was originally on the card itself, which clipped its own deckle). |
| "over the Carepa surface" | composition | `skins/warm.js` and `skins/playful.js` mount `…/surfaces/carepa/index.js` into `.sg-drawer-scrim`, the same pattern as Dialog's skins, only while the drawer is open. |
| "timed to land on the Teental sixteen-beat cycle's first beat" | motion, reuse | `skins/playful.js` imports `talaDelay` from `packages/tokens/tokens.js` (karigar-motion's port, commit `1e58e89`) and sets `--sg-drawer-delay: talaDelay(1)ms` on the element; `drawer.css`'s playful rule applies it as `animation-delay`. One beat in, not the very first (sam), so the pause reads as a breath before the panel moves, never more than 130ms. |
| "without JavaScript it is a real link to a real page" | fallback | Identical to Dialog: the demo's opener is `<a href="./no-js.html">`, and `drawer.check.mjs` checks it navigates with JavaScript off. |
