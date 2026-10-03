# Page transitions

*Every navigation on the site gets a cross-fade, and two elements — the header, the scene — carry across it instead of blinking out and back in.*

```html
<link rel="stylesheet" href="susegad/transitions/page.css">
<header data-vt="header">…</header>
<sg-scene data-vt="scene" name="paus">…</sg-scene>
```

## The prompt

Turn on a View Transition for every same-origin navigation with one CSS at-rule, `@view-transition { navigation: auto; }`, so the whole page cross-fades on its own with no JavaScript. Give exactly two elements a name that survives the navigation instead of cross-fading — a `data-vt="header"` attribute for the site's header and `data-vt="scene"` for whichever scene a page uses as its hero — so the browser animates their position and size across the page change rather than fading them out and in. Set the cross-fade's duration from the shared motion tokens, a shorter one for the whole-page fade and a slightly longer one for the two persistent elements finding their new place. Under `prefers-reduced-motion: reduce`, let the transition still happen (nothing about the page swap should break) but turn off every one of its animations, so it reads as instant. Then write one small shared function, `sameDocumentTransition(update, { pending, reducedMotion })`, for the few components (Tabs, the Kantar interlude) that swap something in place rather than navigating: it runs `update` inside `document.startViewTransition()` when the browser has one and the visitor has not asked for less motion, or directly otherwise, and it never starts a second transition while an earlier one from the same caller is still resolving.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| every same-origin navigation … no JavaScript | native first | `@view-transition { navigation: auto; }` is the entire cross-document mechanism. Browsers without it simply navigate as they always did; nothing needs feature-detecting for the CSS to be safe to ship everywhere. |
| carry across the navigation … rather than cross-fading | View Transitions | Two elements, one on the old page and one on the new, sharing a `view-transition-name` (`[data-vt="header"] { view-transition-name: sg-page-header; }`), are what the spec calls a persisting element: the browser interpolates its box between the two pages' layouts instead of capturing it as a bitmap and fading. |
| turn off every one of its animations … reads as instant | honest motion | `@media (prefers-reduced-motion: reduce) { ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; } }`. The transition still runs (the DOM still swaps correctly either way); only its visible motion is removed. |
| never starts a second transition while an earlier one … is still resolving | same guard, once | `sameDocumentTransition()`'s `pending` parameter: if the caller is still holding a `ViewTransition` from its last call, this one runs `update()` directly rather than calling `startViewTransition()` again, which the browser would answer by aborting the first (an unhandled `AbortError` for a change nobody would have seen anyway, since it never got to play). |

## Accessibility

- Cross-document transitions carry no meaning of their own; the page's content and headings are identical with or without them, so nothing is lost when they don't run.
- Focus and scroll position follow the browser's normal navigation behaviour; View Transitions do not change either.
- Reduced motion is honoured by the CSS alone, with no JavaScript required to detect it for the cross-document path.

## Credit

The cross-document and same-document mechanisms are the browser's own View Transitions API (a CSS Working Group and WHATWG specification); nothing here is a ported plate.
