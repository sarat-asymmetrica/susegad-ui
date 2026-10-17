# Page transitions

Cross-document View Transitions for the whole site, and a tiny shared guard for a same-document swap.

## Cross-document navigation

Link `page.css`. Nothing else is required:

```html
<link rel="stylesheet" href="src/lib/susegad/transitions/page.css">
<script>getComputedStyle(document.documentElement).color</script>
```

The one-line inline script after the link is not decoration. On a page that is ready to show very early (parsing done, nothing else holding the first paint), Chromium can reveal it without the transition: the navigation then lands as an ordinary instant one, and the console shows an uncaught `InvalidStateError: Transition was aborted because of invalid state. ViewTransition opt-in disabled`. We think the cause is that Chromium reads the `@view-transition` opt-in from the page's resolved styles and the reveal came before they had been resolved once; that is our reading of the pattern (the failing runs revealed the page earlier than the passing ones), not something we have confirmed in Chromium's source. Asking for one computed style resolves the styles first, and in our measurements it removed the error: on the demo pages in Chromium with the machine busy, 11 of 150 navigations failed without it and 0 of 150 with it (then 0 of 450 with three runs in parallel).

Two details matter. The script must be a classic inline script, placed after the stylesheet link: not `defer`, not `type="module"` and not `async`, because those run after the first chance to reveal. And a strict Content-Security-Policy that blocks inline scripts needs either a hash for this line (`script-src 'sha256-...'`) or the same line in a small external classic file (`<script src="/susegad/transitions/resolve-styles.js"></script>`, also without `defer`).

`@view-transition { navigation: auto; }` turns on a View Transition for every same-origin navigation the browser initiates, in browsers that support it (Chromium today); everywhere else, navigation is the ordinary instant kind it has always been. Nothing else needs to change.

By default, the whole page cross-fades as one group (`::view-transition-old(root)` / `::view-transition-new(root)`). To make an element persist across the navigation instead, carrying its position and size across, rather than fading out and back in, give it a `data-vt` attribute:

```html
<header data-vt="header">…</header>
<sg-scene data-vt="scene" name="paus">…</sg-scene>
```

`page.css` ships names for exactly these two: the header and the scene, because those are the elements Wave 5's site-shell recipe carries across its pages. The browser matches an element with the same `view-transition-name` on the old and new page and animates between their two boxes. Only one element per page may hold a given name at the moment of navigation.

## A same-document swap

Tabs and the Kantar interlude both swap something in place rather than navigating, and both need the same three guards: don't try when the browser has no View Transitions, don't try under reduced motion, and don't start a second transition while one is still resolving (the browser would only abort the first, which produces an unhandled rejection for no visible benefit, land the change directly instead). `sameDocumentTransition()` is that guard, written once:

```js
import { sameDocumentTransition, nextTransitionName } from './src/lib/susegad/transitions/page.js';

let pending = null;
function selectTab(next) {
  pending = sameDocumentTransition(() => {
    // the DOM mutation itself: hide the old panel, show the new one
  }, { pending });
  if (pending) pending.finished.then(() => { pending = null; }, () => { pending = null; });
}
```

`sameDocumentTransition(update, { pending, reducedMotion })` runs `update()` either inside a `document.startViewTransition()` or directly, and always returns either the new `ViewTransition` (track it in your own `pending`, as above) or `null` (nothing to track: the update already ran). `reducedMotion` defaults to reading `prefers-reduced-motion` itself; pass it explicitly if you already have a motion value from `packages/core/register.js` (Tabs does, from its own `this.motion`).

`nextTransitionName(prefix)` hands out `sg-vt-1`, `sg-vt-2`, …, a unique `view-transition-name` per call, for the common case of naming just the one element that is mid-swap so two instances of the same component never fight over one name (Tabs names only its currently visible panel, and clears the name from the one it replaces).

## Reduced motion

`page.css`'s `@media (prefers-reduced-motion: reduce)` block disables every View Transition's animation (`animation: none !important` on every `::view-transition-*` pseudo-element), so the browser still runs the transition machinery (nothing breaks), but nothing visibly moves, the swap reads as instant either way. `sameDocumentTransition()` makes the same choice from the JavaScript side, so a same-document swap doesn't even start a transition under reduced motion.

## Lineage

Not a harvested plate. The cross-document and same-document mechanisms are the browser's own View Transitions API; this package is the site's shared configuration and one small guard function, not new theatre.
